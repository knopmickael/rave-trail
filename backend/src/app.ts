import { randomBytes } from 'node:crypto';
import Fastify from 'fastify';
import cookie from '@fastify/cookie';
import rateLimit from '@fastify/rate-limit';
import { z } from 'zod';
import { createSessionToken, hashPassword, hashSessionToken, verifyPassword } from './auth/crypto.js';
import { EmailAlreadyUsedError, type AuthRepository } from './auth/repository.js';
import { GameError, type GameRepository } from './game/repository.js';
import type { BattleRepository } from './game/battle-repository.js';
import { BattleRuleError } from '@game/core/battle.js';

const sessionCookie = 'rave_trail_session';
const sessionSeconds = 60 * 60;
const email = z.string().trim().toLowerCase().max(254).email();
const registerSchema = z.object({ email, password: z.string().min(10).max(128) }).strict();
const loginSchema = z.object({ email, password: z.string().min(1).max(128) }).strict();

interface AppOptions {
  repository: AuthRepository;
  gameRepository: GameRepository;
  battleRepository?: BattleRepository;
  origin: string;
  production?: boolean;
  logger?: boolean;
  // Verificação de saúde do banco para o endpoint /api/health. Opcional para
  // manter o app desacoplado do driver; o index.ts a fornece com um SELECT 1.
  checkDatabase?: () => Promise<void>;
}

export async function createApp({ repository, gameRepository, battleRepository, origin, production = false, logger = false, checkDatabase }: AppOptions) {
  const app = Fastify({
    logger: logger ? { redact: ['req.headers.cookie', 'req.headers.authorization', 'res.headers.set-cookie'] } : false,
    bodyLimit: 16 * 1024,
  });
  await app.register(cookie);
  await app.register(rateLimit, { global: false });
  const cookieOptions = { httpOnly: true, secure: production, sameSite: 'lax' as const, path: '/' };
  // Verificar uma senha mesmo quando a conta não existe reduz diferenças de tempo no login.
  const dummyPasswordHash = await hashPassword(randomBytes(32).toString('hex'));

  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store');
    reply.header('X-Content-Type-Options', 'nosniff');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && request.headers.origin !== origin) {
      return reply.code(403).send({ message: 'Origem da requisição não permitida.' });
    }
  });

  app.setErrorHandler((error, request, reply) => {
    if (error instanceof EmailAlreadyUsedError) {
      return reply.code(409).send({ message: 'Já existe uma conta com este e-mail.' });
    }
    if (error instanceof GameError) return reply.code(error.statusCode).send({ message: error.message });
    if (error instanceof BattleRuleError) return reply.code(400).send({ message: error.message });
    const status = error && typeof error === 'object' && 'statusCode' in error ? error.statusCode : undefined;
    if (typeof status === 'number' && status >= 400 && status < 500) {
      return reply.code(status).send({ message: status === 429
        ? 'Muitas tentativas. Aguarde um minuto e tente novamente.' : 'Requisição inválida.' });
    }
    request.log.error({ err: error }, 'Falha na requisição');
    return reply.code(500).send({ message: 'Não foi possível concluir a solicitação.' });
  });

  // Verificação de saúde para monitores externos (UptimeRobot, etc.).
  // Pública e leve: valida o processo e, quando possível, a conexão com o banco.
  app.get('/api/health', async (request, reply) => {
    if (checkDatabase) {
      try {
        await checkDatabase();
      } catch (error) {
        request.log.error({ err: error }, 'Health check: banco indisponível');
        return reply.code(503).send({ status: 'error', database: 'down' });
      }
    }
    return { status: 'ok', database: checkDatabase ? 'up' : 'unknown' };
  });

  function tokenHash(raw: string | undefined): string | null {
    return raw && /^[a-f0-9]{64}$/.test(raw) ? hashSessionToken(raw) : null;
  }

  const authLimit = { rateLimit: { max: 10, timeWindow: '1 minute' } };

  app.post('/api/auth/register', { config: authLimit }, async (request, reply) => {
    const parsed = registerSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Informe um e-mail válido e uma senha de 10 a 128 caracteres.' });
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + sessionSeconds * 1000);
    const user = await repository.register(parsed.data.email, await hashPassword(parsed.data.password), {
      tokenHash: hashSessionToken(token), expiresAt,
    });
    reply.setCookie(sessionCookie, token, { ...cookieOptions, maxAge: sessionSeconds, expires: expiresAt });
    return reply.code(201).send({ user: { ...user, sessionExpiresAt: expiresAt.toISOString() } });
  });

  app.post('/api/auth/login', { config: authLimit }, async (request, reply) => {
    const parsed = loginSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Informe um e-mail válido e sua senha.' });
    const credentials = await repository.findCredentials(parsed.data.email);
    const valid = await verifyPassword(parsed.data.password, credentials?.passwordHash ?? dummyPasswordHash);
    if (!credentials || !valid) return reply.code(401).send({ message: 'E-mail ou senha incorretos.' });
    const token = createSessionToken();
    const expiresAt = new Date(Date.now() + sessionSeconds * 1000);
    const previous = tokenHash(request.cookies[sessionCookie]);
    if (previous) await repository.deleteSession(previous);
    await repository.createSession(credentials.id, { tokenHash: hashSessionToken(token), expiresAt });
    reply.setCookie(sessionCookie, token, { ...cookieOptions, maxAge: sessionSeconds, expires: expiresAt });
    return { user: { id: credentials.id, email: credentials.email, name: credentials.name, sessionExpiresAt: expiresAt.toISOString() } };
  });

  app.post('/api/auth/logout', async (request, reply) => {
    const hash = tokenHash(request.cookies[sessionCookie]);
    if (hash) await repository.deleteSession(hash);
    reply.clearCookie(sessionCookie, cookieOptions);
    return reply.code(204).send();
  });

  app.get('/api/auth/me', async (request, reply) => {
    const hash = tokenHash(request.cookies[sessionCookie]);
    const user = hash ? await repository.findSession(hash) : null;
    if (!user) {
      reply.clearCookie(sessionCookie, cookieOptions);
      return reply.code(401).send({ message: 'Entre na sua conta para continuar.' });
    }
    return { user };
  });

  app.get('/api/progress', async (request, reply) => {
    const hash = tokenHash(request.cookies[sessionCookie]);
    const user = hash ? await repository.findSession(hash) : null;
    if (!user) return reply.code(401).send({ message: 'Entre na sua conta para continuar.' });
    const progress = await repository.getProgress(user.id);
    if (!progress) return reply.code(404).send({ message: 'Progresso não encontrado.' });
    return { progress };
  });

  app.patch('/api/profile', async (request, reply) => {
    const hash = tokenHash(request.cookies[sessionCookie]);
    const user = hash ? await repository.findSession(hash) : null;
    if (!user) return reply.code(401).send({ message: 'Entre na sua conta para continuar.' });
    const parsed = z.object({ name: z.string().trim().min(1).max(40).regex(/^[^\p{Cc}]+$/u) }).strict().safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ message: 'Informe um nome de 1 a 40 caracteres, sem caracteres de controle.' });
    return { user: { ...user, ...await repository.updateName(user.id, parsed.data.name) } };
  });

  app.get('/api/catalog', async (request, reply) => {
    const hash = tokenHash(request.cookies[sessionCookie]);
    if (!hash || !await repository.findSession(hash)) return reply.code(401).send({ message: 'Entre na sua conta para continuar.' });
    return { catalog: await gameRepository.getCatalog() };
  });

  app.get('/api/campaigns', async (request, reply) => {
    const hash = tokenHash(request.cookies[sessionCookie]);
    const user = hash ? await repository.findSession(hash) : null;
    if (!user) return reply.code(401).send({ message: 'Entre na sua conta para continuar.' });
    return { campaigns: await gameRepository.getCampaigns(user.id) };
  });
  app.get('/api/character-unlocks', async (request, reply) => {
    const hash = tokenHash(request.cookies[sessionCookie]);
    const user = hash ? await repository.findSession(hash) : null;
    if (!user) return reply.code(401).send({ message: 'Entre na sua conta para continuar.' });
    return { unlocks: await gameRepository.getCharacterUnlocks(user.id) };
  });

  app.put<{ Params: { slot: string } }>('/api/team/slots/:slot', async (request, reply) => {
    const hash = tokenHash(request.cookies[sessionCookie]);
    const user = hash ? await repository.findSession(hash) : null;
    if (!user) return reply.code(401).send({ message: 'Entre na sua conta para continuar.' });
    const body = z.object({ unitId: z.string().min(1).max(100).nullable() }).strict().safeParse(request.body);
    if (!/^[0-2]$/.test(request.params.slot) || !body.success) return reply.code(400).send({ message: 'Informe um slot de 0 a 2 e o personagem desejado.' });
    return { team: await gameRepository.setTeamSlot(user.id, Number(request.params.slot), body.data.unitId) };
  });

  const requireBattles = () => {
    if (!battleRepository) throw new GameError(503, 'Serviço de batalhas indisponível.');
    return battleRepository;
  };
  const authenticatedUser = async (raw: string | undefined) => {
    const hash = tokenHash(raw);
    const user = hash ? await repository.findSession(hash) : null;
    if (!user) throw new GameError(401, 'Entre na sua conta para continuar.');
    return user;
  };
  app.get<{ Params: { id: string } }>('/api/campaigns/:id/map', async (request) => {
    const user = await authenticatedUser(request.cookies[sessionCookie]);
    return { map: await requireBattles().getMap(user.id, request.params.id) };
  });
  app.post<{ Params: { id: string } }>('/api/encounters/:id/battles', async (request, reply) => {
    const user = await authenticatedUser(request.cookies[sessionCookie]);
    const body = z.object({ osirisSlot: z.union([z.literal(0), z.literal(1), z.literal(2)]).optional() }).strict().safeParse(request.body ?? {});
    if (!body.success) throw new GameError(400, 'Escolha um slot válido de 0 a 2 para Osiris.');
    return reply.code(201).send({ battle: await requireBattles().startBattle(user.id, request.params.id, body.data) });
  });
  app.get('/api/quick-battle', async (request) => {
    const user = await authenticatedUser(request.cookies[sessionCookie]);
    return { quickBattle: await requireBattles().getQuickBattle(user.id) };
  });
  app.post('/api/quick-battle/battles', async (request, reply) => {
    const user = await authenticatedUser(request.cookies[sessionCookie]);
    if (!z.object({}).strict().safeParse(request.body).success) throw new GameError(400, 'A equipe adversária é sorteada pelo servidor.');
    return reply.code(201).send({ battle: await requireBattles().startQuickBattle(user.id) });
  });
  app.get<{ Params: { id: string } }>('/api/battles/:id', async (request) => {
    const user = await authenticatedUser(request.cookies[sessionCookie]);
    if (!z.uuid().safeParse(request.params.id).success) throw new GameError(400, 'ID de batalha inválido.');
    return { battle: await requireBattles().getBattle(user.id, request.params.id) };
  });
  app.post<{ Params: { id: string } }>('/api/battles/:id/abandon', async (request) => {
    const user = await authenticatedUser(request.cookies[sessionCookie]);
    if (!z.uuid().safeParse(request.params.id).success || !z.object({}).strict().safeParse(request.body).success) throw new GameError(400, 'Comando de desistência inválido.');
    return { battle: await requireBattles().abandonBattle(user.id, request.params.id) };
  });
  app.post<{ Params: { id: string } }>('/api/battles/:id/turns', async (request) => {
    const user = await authenticatedUser(request.cookies[sessionCookie]);
    const body = z.object({ revision: z.number().int().min(0), requestId: z.uuid(), actions: z.array(z.object({
      actorId: z.string().min(1).max(100), abilityId: z.string().min(1).max(100), targetId: z.string().min(1).max(100).optional(),
    }).strict()).max(3) }).strict().safeParse(request.body);
    if (!body.success || !z.uuid().safeParse(request.params.id).success) throw new GameError(400, 'Comando de batalha inválido.');
    return requireBattles().submitTurn(user.id, request.params.id, body.data.revision, body.data.requestId, body.data.actions);
  });

  return app;
}
