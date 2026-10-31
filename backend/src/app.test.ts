import { randomUUID } from 'node:crypto';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createInitialProgress, type PlayerProgress, type User } from '@game/contracts.js';
import { abilities } from '@game/content/abilities.js';
import { narrativeCharacters, units } from '@game/content/units.js';
import { campaigns } from '@game/content/campaigns.js';
import { encounters } from '@game/content/encounters.js';
import { GameError, type GameRepository } from './game/repository.js';
import { createApp } from './app.js';
import { EmailAlreadyUsedError, type AuthRepository, type Credentials, type SessionInput } from './auth/repository.js';
import { hashSessionToken } from './auth/crypto.js';
import { characterUnlockProgress } from '@game/core/unlocks.js';

class MemoryRepository implements AuthRepository, GameRepository {
  users = new Map<string, Credentials>();
  sessions = new Map<string, SessionInput & { userId: string }>();
  progresses = new Map<string, PlayerProgress>();
  async register(email: string, passwordHash: string, session: SessionInput): Promise<User> {
    if (this.users.has(email)) throw new EmailAlreadyUsedError();
    const user = { id: randomUUID(), email, name: 'Aventureiro' };
    this.users.set(email, { ...user, passwordHash });
    this.progresses.set(user.id, createInitialProgress());
    await this.createSession(user.id, session);
    return user;
  }
  async findCredentials(email: string) { return this.users.get(email) ?? null; }
  async createSession(userId: string, session: SessionInput) { this.sessions.set(session.tokenHash, { ...session, userId }); }
  async findSession(hash: string) {
    const session = this.sessions.get(hash);
    if (!session || session.expiresAt <= new Date()) return null;
    const credentials = [...this.users.values()].find((user) => user.id === session.userId);
    return credentials ? { id: credentials.id, email: credentials.email, name: credentials.name, sessionExpiresAt: session.expiresAt.toISOString() } : null;
  }
  async deleteSession(hash: string) { this.sessions.delete(hash); }
  async getProgress(id: string) { return this.progresses.get(id) ?? null; }
  async updateName(id: string, name: string) {
    const user = [...this.users.values()].find((entry) => entry.id === id)!;
    user.name = name;
    return { id: user.id, email: user.email, name };
  }
  async getCatalog() { return { characters: Object.values(narrativeCharacters), units, abilities: Object.values(abilities) }; }
  async getCharacterUnlocks(userId: string) {
    const progress = this.progresses.get(userId)!;
    const defeated = new Set(encounters.filter((entry) => progress.completedEncounters.includes(entry.id)).flatMap((entry) => entry.enemyUnitIds));
    return characterUnlockProgress(units, progress.unlockedUnitIds, [], progress.missionProgressResets, [...defeated]);
  }
  async getCampaigns(userId: string) {
    return campaigns.map((campaign) => ({ ...campaign, available: campaign.released && this.progresses.get(userId)!.availablePathIds.includes(campaign.id) }));
  }
  async setTeamSlot(userId: string, slot: number, unitId: string | null) {
    const progress = this.progresses.get(userId)!;
    if (unitId && !units.some((unit) => unit.id === unitId)) throw new GameError(400, 'Personagem inválido para a equipe.');
    if (unitId && !progress.unlockedUnitIds.includes(unitId)) throw new GameError(403, 'Este personagem ainda está bloqueado.');
    if (unitId) progress.selectedTeam = progress.selectedTeam.map((id) => id === unitId ? null : id) as PlayerProgress['selectedTeam'];
    progress.selectedTeam[slot] = unitId;
    return progress.selectedTeam;
  }
}

const origin = 'http://127.0.0.1:5173';
const password = 'uma senha longa de teste';
let repository: MemoryRepository;
let app: Awaited<ReturnType<typeof createApp>>;
const cookie = (response: { cookies: { name: string; value: string }[] }) => {
  const session = response.cookies.find((item) => item.name === 'rave_trail_session')!;
  return `${session.name}=${session.value}`;
};
const register = (email = 'jogador@example.com') => app.inject({
  method: 'POST', url: '/api/auth/register', headers: { origin }, payload: { email, password },
});

beforeEach(async () => {
  repository = new MemoryRepository();
  app = await createApp({ repository, gameRepository: repository, origin });
});
afterEach(async () => { await app.close(); vi.useRealTimers(); });

describe('autenticação HTTP', () => {
  it('cadastra, normaliza o e-mail, cria progresso e restaura a sessão', async () => {
    const response = await register('  Jogador@Example.com  ');
    expect(response.statusCode).toBe(201);
    expect(response.json().user.email).toBe('jogador@example.com');
    expect(response.json().user).not.toHaveProperty('passwordHash');
    expect(response.headers['set-cookie']).toContain('HttpOnly');
    expect(response.headers['set-cookie']).toContain('SameSite=Lax');
    expect(response.headers['cache-control']).toBe('no-store');
    const me = await app.inject({ url: '/api/auth/me', headers: { cookie: cookie(response) } });
    expect(me.json()).toEqual(response.json());
    const progress = await app.inject({ url: '/api/progress', headers: { cookie: cookie(response) } });
    expect(progress.json().progress).toEqual(createInitialProgress());
    expect(repository.users.get('jogador@example.com')!.passwordHash).not.toContain(password);
    expect(repository.sessions.has(hashSessionToken(response.cookies[0].value))).toBe(true);
    expect(repository.sessions.has(response.cookies[0].value)).toBe(false);
  });

  it('rejeita e-mail duplicado independentemente de caixa', async () => {
    await register();
    const duplicate = await register('JOGADOR@example.com');
    expect(duplicate.statusCode).toBe(409);
    expect(repository.users.size).toBe(1);
  });

  it('limita cadastro e login a uma hora absoluta, sem renovar a sessão nas consultas', async () => {
    vi.useFakeTimers({ toFake: ['Date'] });
    vi.setSystemTime(new Date('2026-10-30T12:00:00Z'));
    const account = await register();
    expect(account.headers['set-cookie']).toContain('Max-Age=3600');
    expect(account.json().user.sessionExpiresAt).toBe('2026-10-30T13:00:00.000Z');
    vi.setSystemTime(new Date('2026-10-30T12:59:59Z'));
    const before = await app.inject({ url: '/api/auth/me', headers: { cookie: cookie(account) } });
    expect(before.statusCode).toBe(200);
    expect(before.json().user.sessionExpiresAt).toBe(account.json().user.sessionExpiresAt);
    vi.setSystemTime(new Date('2026-10-30T13:00:00Z'));
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie: cookie(account) } })).statusCode).toBe(401);
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { email: 'jogador@example.com', password } });
    expect(login.statusCode).toBe(200);
    expect(login.headers['set-cookie']).toContain('Max-Age=3600');
    expect(login.json().user.sessionExpiresAt).toBe('2026-10-30T14:00:00.000Z');
  });

  it('edita somente o nome da conta autenticada e preserva o prazo da sessão', async () => {
    const first = await register();
    const second = await register('perfil-outra@example.com');
    const update = await app.inject({ method: 'PATCH', url: `/api/profile?userId=${second.json().user.id}`,
      headers: { origin, cookie: cookie(first) }, payload: { name: '  Ravi jogador  ' } });
    expect(update.statusCode).toBe(200);
    expect(update.json().user).toEqual({ ...first.json().user, name: 'Ravi jogador' });
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie: cookie(first) } })).json()).toEqual(update.json());
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie: cookie(second) } })).json().user.name).toBe('Aventureiro');
    expect(update.json().user).not.toHaveProperty('passwordHash');
  });

  it('valida o nome e exige sessão e origem válidas para editar o perfil', async () => {
    const account = await register();
    const headers = { origin, cookie: cookie(account) };
    for (const payload of [{ name: '' }, { name: '   ' }, { name: 'x'.repeat(41) }, { name: 'nome\ninválido' }, { name: 'Nome', email: 'outro@example.com' }]) {
      expect((await app.inject({ method: 'PATCH', url: '/api/profile', headers, payload })).statusCode).toBe(400);
    }
    expect((await app.inject({ method: 'PATCH', url: '/api/profile', headers: { origin }, payload: { name: 'Nome' } })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PATCH', url: '/api/profile', headers: { ...headers, origin: 'https://externo.example' }, payload: { name: 'Nome' } })).statusCode).toBe(403);
  });

  it.each([
    { email: 'invalido', password },
    { email: 'a@example.com', password: 'curta' },
    { email: 'a@example.com', password: 'x'.repeat(129) },
    { email: 'a@example.com', password, role: 'admin' },
  ])('valida os dados de cadastro: %j', async (payload) => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/register', headers: { origin }, payload });
    expect(response.statusCode).toBe(400);
    expect(repository.users.size).toBe(0);
  });

  it('retorna a mesma mensagem para conta inexistente e senha incorreta', async () => {
    await register();
    const login = (email: string) => app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: { email, password: 'senha incorreta' } });
    const existing = await login('jogador@example.com');
    const missing = await login('naoexiste@example.com');
    expect(existing.statusCode).toBe(401);
    expect(missing.statusCode).toBe(401);
    expect(existing.json()).toEqual(missing.json());
  });

  it('rotaciona a sessão no login e a revoga no logout', async () => {
    const original = await register();
    const login = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin, cookie: cookie(original) }, payload: { email: 'jogador@example.com', password } });
    expect(login.statusCode).toBe(200);
    expect(cookie(login)).not.toBe(cookie(original));
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie: cookie(original) } })).statusCode).toBe(401);
    const logout = await app.inject({ method: 'POST', url: '/api/auth/logout', headers: { origin, cookie: cookie(login) } });
    expect(logout.statusCode).toBe(204);
    expect((await app.inject({ url: '/api/auth/me', headers: { cookie: cookie(login) } })).statusCode).toBe(401);
  });

  it('rejeita sessões expiradas, ausentes e adulteradas', async () => {
    const response = await register();
    for (const session of repository.sessions.values()) session.expiresAt = new Date(0);
    for (const value of [cookie(response), 'rave_trail_session=invalida', '']) {
      expect((await app.inject({ url: '/api/auth/me', headers: { cookie: value } })).statusCode).toBe(401);
      expect((await app.inject({ url: '/api/progress', headers: { cookie: value } })).statusCode).toBe(401);
    }
  });

  it('isola o progresso por conta, ignorando userId enviado na URL', async () => {
    const first = await register();
    const second = await register('outro@example.com');
    repository.progresses.get(first.json().user.id)!.audioEnabled = false;
    const response = await app.inject({ url: `/api/progress?userId=${first.json().user.id}`, headers: { cookie: cookie(second) } });
    expect(response.json().progress.audioEnabled).toBe(true);
  });

  it('bloqueia mutações sem origem válida', async () => {
    for (const headers of [{}, { origin: 'https://outro.example' }]) {
      const response = await app.inject({ method: 'POST', url: '/api/auth/register', headers, payload: { email: 'a@example.com', password } });
      expect(response.statusCode).toBe(403);
    }
    expect(repository.users.size).toBe(0);
  });

  it('limita tentativas de login', async () => {
    for (let index = 0; index < 10; index++) {
      await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: {} });
    }
    const response = await app.inject({ method: 'POST', url: '/api/auth/login', headers: { origin }, payload: {} });
    expect(response.statusCode).toBe(429);
  });

  it('emite cookie Secure em produção', async () => {
    const production = await createApp({ repository, gameRepository: repository, origin, production: true });
    try {
      const response = await production.inject({ method: 'POST', url: '/api/auth/register', headers: { origin }, payload: { email: 'secure@example.com', password } });
      expect(response.headers['set-cookie']).toContain('Secure');
    } finally { await production.close(); }
  });
});

describe('catálogo e equipe HTTP', () => {
  it('protege o hub de desbloqueios e usa apenas os dados da conta autenticada', async () => {
    expect((await app.inject({ url: '/api/character-unlocks' })).statusCode).toBe(401);
    const first = await register();
    const second = await register('desbloqueios@example.com');
    repository.progresses.get(first.json().user.id)!.unlockedUnitIds.push('road-raider-1-base');
    const response = await app.inject({ url: `/api/character-unlocks?userId=${first.json().user.id}`, headers: { cookie: cookie(second) } });
    expect(response.statusCode).toBe(200);
    expect(response.json().unlocks.characters).toHaveLength(16);
    expect(response.json().unlocks.characters.every((unit: { campaignAvailable: boolean }) => !unit.campaignAvailable)).toBe(true);
    expect((await app.inject({ method: 'POST', url: '/api/character-unlocks', headers: { origin, cookie: cookie(second) }, payload: { unlockedUnitIds: ['rival-b-final-mode'] } })).statusCode).toBe(404);
  });
  it('lista duas campanhas autenticadas com apenas a primeira disponível', async () => {
    expect((await app.inject({ url: '/api/campaigns' })).statusCode).toBe(401);
    const account = await register();
    const response = await app.inject({ url: '/api/campaigns', headers: { cookie: cookie(account) } });
    expect(response.statusCode).toBe(200);
    expect(response.json().campaigns.map((campaign: { id: string; available: boolean }) => [campaign.id, campaign.available])).toEqual([['path-1', true], ['path-2', false]]);
  });

  it('usa a disponibilidade da conta da sessão e não libera capítulo ainda não lançado', async () => {
    const first = await register();
    const second = await register('campanha-outra@example.com');
    repository.progresses.get(second.json().user.id)!.availablePathIds = ['path-2'];
    const response = await app.inject({ url: `/api/campaigns?userId=${first.json().user.id}`, headers: { cookie: cookie(second) } });
    expect(response.json().campaigns.map((campaign: { available: boolean }) => campaign.available)).toEqual([false, false]);
  });

  it('exige sessão para ler o catálogo e modificar equipe', async () => {
    expect((await app.inject({ url: '/api/catalog' })).statusCode).toBe(401);
    expect((await app.inject({ method: 'PUT', url: '/api/team/slots/0', headers: { origin }, payload: { unitId: null } })).statusCode).toBe(401);
    const account = await register();
    const response = await app.inject({ url: '/api/catalog', headers: { cookie: cookie(account) } });
    expect(response.statusCode).toBe(200);
    expect(response.json().catalog.units).toHaveLength(units.length);
  });

  it('valida slot, dados, origem e bloqueio antes de alterar a equipe', async () => {
    const account = await register();
    const headers = { origin, cookie: cookie(account) };
    for (const slot of ['-1', '3', 'x']) expect((await app.inject({ method: 'PUT', url: `/api/team/slots/${slot}`, headers, payload: { unitId: null } })).statusCode).toBe(400);
    for (const unitId of ['passage-guardian-base', 'guerreiros-habilidosos-a', 'legendary-beast-premium', 'rival-b-final-mode']) {
      expect((await app.inject({ method: 'PUT', url: '/api/team/slots/0', headers, payload: { unitId } })).statusCode).toBe(403);
    }
    expect((await app.inject({ method: 'PUT', url: '/api/team/slots/0', headers, payload: { unitId: 'inventado' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/api/team/slots/0', headers, payload: { unitId: null, userId: 'outro' } })).statusCode).toBe(400);
    expect((await app.inject({ method: 'PUT', url: '/api/team/slots/0', headers: { cookie: cookie(account), origin: 'https://externo.example' }, payload: { unitId: null } })).statusCode).toBe(403);
    expect(repository.progresses.get(account.json().user.id)!.selectedTeam).toEqual([null, null, null]);
  });

  it('adiciona, move, remove e isola a equipe pela conta da sessão', async () => {
    const first = await register();
    const second = await register('segunda@example.com');
    const put = (slot: number, unitId: string | null) => app.inject({ method: 'PUT', url: `/api/team/slots/${slot}`, headers: { origin, cookie: cookie(first) }, payload: { unitId } });
    expect((await put(1, 'protagonist-main-base')).json().team).toEqual([null, 'protagonist-main-base', null]);
    expect((await put(2, 'protagonist-main-base')).json().team).toEqual([null, null, 'protagonist-main-base']);
    expect((await put(2, null)).json().team).toEqual([null, null, null]);
    expect(repository.progresses.get(second.json().user.id)!.selectedTeam).toEqual([null, null, null]);
  });
});
