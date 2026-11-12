import { afterEach, expect, it, vi } from 'vitest';
import { createCmsApp } from '../cms/server/app';
import { abilitySchema, characterSchema, encounterSchema } from '../cms/server/schemas';
import { units } from '../shared/src/content/units';
import { battleUnlockRules } from '../shared/src/content/unlocks';
import { chatSchema, suggestAbility } from '../cms/server/ai';
import { abilities } from '../shared/src/content/abilities';
import { characterUnlockProgress } from '../shared/src/core/unlocks';

afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

it('protege o CMS contra hosts externos, requisições cross-site e mutações sem token local', async () => {
  const app = createCmsApp(null);
  try {
    expect((await app.inject({ url: '/api/status', headers: { host: 'attacker.example' } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/status', headers: { host: '127.0.0.1:3188', origin: 'https://attacker.example' } })).statusCode).toBe(403);
    expect((await app.inject({ url: '/api/status', headers: { host: '127.0.0.1:3188', 'sec-fetch-site': 'cross-site' } })).statusCode).toBe(403);
    const status = await app.inject({ url: '/api/status', headers: { host: '127.0.0.1:5188' } });
    expect(status.json()).toMatchObject({ ready: false });
    const headers = { host: '127.0.0.1:5188', origin: 'http://127.0.0.1:5188' };
    const input = { method: 'POST' as const, url: '/api/abilities', payload: abilities.guard };
    expect((await app.inject({ ...input, headers })).statusCode).toBe(403);
    const token = status.json().token;
    expect((await app.inject({ ...input, headers: { ...headers, 'x-cms-token': token } })).statusCode).toBe(503);
    expect((await app.inject({ ...input, headers: { ...headers, 'x-cms-token': 'x'.repeat(64) } })).statusCode).toBe(403);
  } finally { await app.close(); }
});

it('aceita os 11 efeitos existentes e impede efeitos desconhecidos, campos extras e alvos incompatíveis', () => {
  for (const ability of Object.values(abilities)) expect(abilitySchema.safeParse(ability).success, ability.id).toBe(true);
  expect(abilitySchema.safeParse({ ...abilities.guard, effects: [{ kind: 'stun', turns: 2 }] }).success).toBe(false);
  expect(abilitySchema.safeParse({ ...abilities.guard, effects: [{ kind: 'guard', reduction: 10, teamTurns: 2, percent: true }] }).success).toBe(false);
  expect(abilitySchema.safeParse({ ...abilities.guard, target: 'all-enemies' }).success).toBe(false);
  expect(abilitySchema.safeParse({ ...abilities.resurrection, target: 'ally' }).success).toBe(false);
  expect(abilitySchema.safeParse({ ...abilities.guard, icon: 'javascript:alert(1)' }).success).toBe(false);
  expect(abilitySchema.safeParse({ ...abilities.guard, icon: '/media/../../secret' }).success).toBe(false);
  expect(characterSchema.safeParse({}).success).toBe(false);
});

it('valida propostas de IA e não transforma uma mecânica inédita em efeito executável', async () => {
  vi.stubEnv('CMS_AI_BASE_URL', 'http://127.0.0.1:11434/v1'); vi.stubEnv('CMS_AI_MODEL', 'local-test');
  const input = chatSchema.parse({ messages: [{ role: 'user', content: 'Crie um atordoamento total.' }], ability: null });
  const extension = { message: 'Atordoamento total exige uma extensão.', ability: null,
    engineExtension: { summary: 'Atordoamento', reason: 'O bloqueio atual impede apenas ataques.', suggestedConfig: 'Adicionar um estado stun com duração e bloqueio de ações.' } };
  const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify(extension) } }] })));
  vi.stubGlobal('fetch', fetchMock);
  expect(await suggestAbility(input)).toEqual(extension);
  expect(fetchMock.mock.calls[0][0]).toBe('http://127.0.0.1:11434/v1/chat/completions');
  fetchMock.mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: JSON.stringify({ ...extension, ability: { ...abilities.guard, effects: [{ kind: 'stun', turns: 1 }] } }) } }] })));
  await expect(suggestAbility(input)).rejects.toMatchObject({ statusCode: 502 });
  fetchMock.mockResolvedValue(new Response('{}', { status: 401 }));
  await expect(suggestAbility(input)).rejects.toMatchObject({ statusCode: 502 });
});

it('rejeita desbloqueios diretos, revelação implícita, recompensas e estado provisório no contrato de autoria', () => {
  const base = { ...units[0], abilityIds: [...units[0].abilityIds], unlockRule: null, priceUsd: null };
  expect(characterSchema.safeParse(base).success).toBe(true);
  for (const kind of ['encounter', 'unavailable']) expect(characterSchema.safeParse({ ...base, unlock: { kind, description: 'Legado.' } }).success).toBe(false);
  expect(characterSchema.safeParse({ ...base, provisional: true }).success).toBe(false);
  const mission = { ...base, unlock: { kind: 'battle-wins', description: 'Missão.' }, unlockRule: { unitId: base.id, description: 'Missão.', requirements: [{ kind: 'battle-wins', mode: 'quick', target: 3, description: 'Vença três rápidas.' }] } };
  expect(characterSchema.safeParse(mission).success).toBe(false);
  expect(characterSchema.safeParse({ ...mission, unlockRule: { ...mission.unlockRule, availableFromStart: true } }).success).toBe(true);
  expect(characterSchema.safeParse({ ...mission, unlockRule: { ...mission.unlockRule, availableAfterEncounterId: 'battle-1' } }).success).toBe(true);
  expect(characterSchema.safeParse({ ...mission, unlockRule: { ...mission.unlockRule, availableFromStart: true, availableAfterEncounterId: 'battle-1' } }).success).toBe(false);
  const encounter = { id: 'battle-1', campaignId: 'path-1', position: 1, title: 'Batalha', story: 'História.', mapX: 50, mapY: 50, enemyUnitIds: [base.id] };
  expect(encounterSchema.safeParse(encounter).success).toBe(true);
  expect(encounterSchema.safeParse({ ...encounter, rewardUnitIds: [base.id] }).success).toBe(false);
  expect(encounterSchema.safeParse({ ...encounter, provisional: false }).success).toBe(false);
  for (const rule of battleUnlockRules) expect(!!rule.availableFromStart !== !!rule.availableAfterEncounterId).toBe(true);
});

it('conta vitórias apenas após o marco explícito de revelação mesmo quando há requisitos de confrontos anteriores', () => {
  const unit = { id: 'cms-mission', name: 'Missão dinâmica', portrait: '/media/abilities/guard.jpg' };
  const victory = (time: string) => ({ mode: 'quick' as const, playerUnitIds: ['ravi'], enemyUnitIds: ['jung'], completedAt: time });
  const data = characterUnlockProgress([unit], [], [victory('2026-11-01T11:00:00Z'), victory('2026-11-01T13:00:00Z')], {}, [unit.id], ['early', 'gate'],
    { early: '2026-11-01T10:00:00Z', gate: '2026-11-01T12:00:00Z' }, { prices: {}, rules: [{ unitId: unit.id, description: 'Missão', availableAfterEncounterId: 'gate',
      requirements: [{ kind: 'encounter', encounterId: 'early', target: 1, description: 'Concluir o primeiro confronto.' },
        { kind: 'battle-wins', mode: 'quick', target: 5, description: 'Vencer cinco rápidas.' }] }] });
  const mission = data.characters[0];
  expect(mission.kind === 'battle-wins' && mission.requirements.map((r) => r.current)).toEqual([1, 1]);
});
