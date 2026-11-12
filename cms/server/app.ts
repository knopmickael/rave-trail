import { randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';
import Fastify from 'fastify';
import { z } from 'zod';
import type { Pool } from 'pg';
import { CmsError, CmsRepository } from './repository.js';
import { abilitySchema, campaignSchema, characterOrderSchema, characterSchema, encounterSchema, id, setupSchema } from './schemas.js';
import { chatSchema, suggestAbility } from './ai.js';
import { readMedia } from '../../backend/src/db/media.js';
import type { Entity } from '../contracts.js';
import { cmsEnvironmentFile } from '../environment.js';

export function createCmsApp(pool: Pool | null, origin = 'http://127.0.0.1:5188', apiPort = 3188) {
  const environmentFile = cmsEnvironmentFile();
  const setupCommand = process.env.CMS_PROFILE ? `cms:${process.env.CMS_PROFILE}:db:setup` : 'cms:db:setup';
  const app = Fastify({ bodyLimit: 8 * 1024 * 1024, logger: false });
  const token = randomBytes(32).toString('hex');
  const repo = pool ? new CmsRepository(pool) : null;
  app.addHook('onRequest', async (request, reply) => {
    reply.header('Cache-Control', 'no-store').header('X-Content-Type-Options', 'nosniff');
    if (![`127.0.0.1:${apiPort}`, new URL(origin).host].includes(request.headers.host ?? '')
      || request.headers.origin && request.headers.origin !== origin
      || request.headers['sec-fetch-site'] === 'cross-site') return reply.code(403).send({ message: 'Acesso permitido apenas pelo CMS local.' });
    if (!['GET', 'HEAD'].includes(request.method)) {
      const sent = request.headers['x-cms-token'];
      if (request.headers.origin !== origin || typeof sent !== 'string' || Buffer.byteLength(sent) !== Buffer.byteLength(token)
        || !timingSafeEqual(Buffer.from(sent), Buffer.from(token))) return reply.code(403).send({ message: 'Sessão local inválida. Recarregue o CMS.' });
    }
  });
  app.setErrorHandler((error, _request, reply) => {
    if (error instanceof CmsError) return reply.code(error.statusCode).send({ message: error.message });
    if (error instanceof z.ZodError) return reply.code(400).send({ message: error.issues.map((issue) => `${issue.path.join('.')}: ${issue.message}`).join('\n') });
    const code = (error as { code?: string }).code;
    if (code === '23503') return reply.code(409).send({ message: 'Registro referenciado por outro conteúdo, equipe ou histórico; ou uma referência selecionada não existe.' });
    if (code === '23505') return reply.code(409).send({ message: 'ID, capítulo ou posição já utilizado. Escolha um valor livre.' });
    if (code === '42P01' || code === '42703') return reply.code(503).send({ message: `Banco precisa das migrações. Execute npm run ${setupCommand}.` });
    const status = (error as { statusCode?: number }).statusCode;
    return reply.code(status && status >= 400 && status < 500 ? status : 503).send({ message: 'Não foi possível concluir a operação. Verifique o túnel SSH, a conexão com o banco e os campos enviados.' });
  });
  const requireRepo = () => { if (!repo) throw new CmsError(503, `Configure CMS_DATABASE_URL no ${environmentFile} e reinicie o CMS.`); return repo; };
  app.get('/api/status', async () => {
    let ready = false;
    let message = `Configure CMS_DATABASE_URL no ${environmentFile} e reinicie o CMS.`;
    if (pool) {
      try {
        const result = await pool.query("SELECT EXISTS (SELECT 1 FROM schema_migrations WHERE name='039_cms_content_requirements.sql') AS ready");
        ready = result.rows[0].ready;
        message = ready ? 'Conectado. Alterações são gravadas diretamente neste banco.' : `Execute npm run ${setupCommand} para preparar o banco.`;
      } catch { message = 'Banco indisponível. Verifique a URL, o túnel SSH e as migrações.'; }
    }
    return { token, database: process.env.CMS_DATABASE_LABEL ?? 'Banco do CMS', ready, message,
      aiReady: !!(process.env.CMS_AI_BASE_URL && process.env.CMS_AI_MODEL) };
  });
  app.get('/api/catalog', () => requireRepo().catalog());
  app.put('/api/characters/order', (request) => requireRepo().reorderCharacters(characterOrderSchema.parse(request.body).ids));
  const schemas = { characters: characterSchema, abilities: abilitySchema, campaigns: campaignSchema, encounters: encounterSchema };
  for (const entity of Object.keys(schemas) as Entity[]) {
    app.post(`/api/${entity}`, async (request, reply) => {
      const result = await requireRepo().save(entity, schemas[entity].parse(request.body), true);
      return reply.code(201).send(result);
    });
    app.put<{ Params: { id: string } }>(`/api/${entity}/:id`, async (request) => {
      const value = schemas[entity].parse(request.body);
      if (id.parse(request.params.id) !== value.id) throw new CmsError(400, 'O ID de um registro existente é imutável.');
      return requireRepo().save(entity, value, false);
    });
    app.delete<{ Params: { id: string } }>(`/api/${entity}/:id`, (request) => requireRepo().remove(entity, id.parse(request.params.id)));
  }
  app.post('/api/setups', (request) => requireRepo().saveSetup(setupSchema.parse(request.body)));
  app.delete<{ Params: { id: string } }>('/api/setups/:id', async (request) => {
    await requireRepo().pool.query('DELETE FROM cms_ability_setups WHERE id=$1', [id.parse(request.params.id)]);
    return { ok: true };
  });
  app.post('/api/ai/chat', (request) => suggestAbility(chatSchema.parse(request.body)));
  app.post('/api/media', async (request, reply) => {
    const input = z.object({ base64: z.string().max(7 * 1024 * 1024) }).strict().parse(request.body);
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(input.base64)) throw new CmsError(400, 'Arquivo inválido.');
    const content = Buffer.from(input.base64, 'base64');
    if (!content.length || content.length > 5 * 1024 * 1024) throw new CmsError(400, 'A imagem deve ter até 5 MB.');
    const mime = content.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png'
      : content[0] === 255 && content[1] === 216 && content[2] === 255 ? 'image/jpeg'
      : content.toString('ascii', 0, 4) === 'RIFF' && content.toString('ascii', 8, 12) === 'WEBP' ? 'image/webp' : null;
    if (!mime) throw new CmsError(400, 'Use PNG, JPEG ou WebP.');
    const mediaId = randomUUID();
    await requireRepo().pool.query('INSERT INTO cms_media VALUES ($1,$2,$3)', [mediaId, mime, content]);
    return reply.code(201).send({ path: `/media/cms/${mediaId}` });
  });
  app.get<{ Params: { id: string } }>('/media/cms/:id', async (request, reply) => {
    const image = await readMedia(requireRepo().pool, z.uuid().parse(request.params.id));
    if (!image) return reply.code(404).send();
    return reply.type(image.mimeType).send(image.content);
  });
  return app;
}
