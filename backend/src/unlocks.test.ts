import { expect, it } from 'vitest';
import { units } from '@game/content/units.js';
import { characterUnlockProgress, type BattleVictory } from '@game/core/unlocks.js';

const victories = (enemyUnitId: string, count: number, playerUnitIds = ['protagonist-main-base'],
  mode: BattleVictory['mode'] = 'quick'): BattleVictory[] => Array.from({ length: count }, () => ({ mode, playerUnitIds, enemyUnitIds: [enemyUnitId] }));
const progress = (id: string, wins: readonly BattleVictory[]) => {
  const unit = characterUnlockProgress(units, [], wins).characters.find((entry) => entry.id === id)!;
  if (unit.kind !== 'battle-wins') throw new Error('Esperada uma meta de combate.');
  return unit.requirements;
};

it.each([
  ['road-raider-1-base', 5], ['road-raider-2-base', 5], ['road-raider-3-base', 5],
  ['rival-a-base', 10], ['jung-de-grimoria-ii', 25], ['rival-female-base', 10],
  ['guardian-healer-male-base', 10], ['guardian-healer-female-base', 10],
  ['passage-guardian-base', 15],
] as const)('exige o número correto de vitórias rápidas para %s', (id, count) => {
  expect(progress(id, victories(id, count - 1))[0]).toMatchObject({ current: count - 1, target: count });
  expect(progress(id, victories(id, count))[0]).toMatchObject({ current: count, target: count });
  expect(progress(id, victories(id, count + 5))[0].current).toBe(count);
});

it('Jung exige Ravi de Berdal, e não apenas qualquer versão do mesmo personagem', () => {
  const unqualified = [...victories('rival-a-base', 10, ['protagonist-secondary-base']), ...victories('rival-a-base', 10, ['protagonist-main-transformed'])];
  expect(progress('rival-a-base', unqualified)[0].current).toBe(0);
  expect(progress('rival-a-base', [...unqualified, ...victories('rival-a-base', 3)])[0].current).toBe(3);
});

it.each(['protagonist-main-base', 'protagonist-secondary-base', 'protagonist-female-base', 'protagonist-main-transformed'])('considera %s alguém de Berdal', (id) => {
  expect(progress('passage-guardian-base', victories('passage-guardian-base', 15, [id]))[0].current).toBe(15);
  expect(progress('passage-guardian-base', victories('passage-guardian-base', 15, ['rival-a-base']))[0].current).toBe(0);
});

it.each(['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b'])('%s exige 20 batalhas rápidas contra Grimorianos, uma contagem por partida', (id) => {
  const trio: BattleVictory = { mode: 'quick', playerUnitIds: ['road-raider-1-base'], enemyUnitIds: ['rival-a-base', 'rival-b-base', 'rival-female-base'] };
  const history = Array.from({ length: 19 }, () => trio);
  expect(progress(id, history)[0]).toMatchObject({ current: 19, target: 20 });
  expect(progress(id, [...history, trio])[0].current).toBe(20);
  expect(progress(id, [...history, trio, trio])[0].current).toBe(20);
});

it.each(['rival-a-base', 'jung-de-grimoria-ii', 'rival-b-base', 'rival-female-base'])('aceita %s como Grimoriano mesmo sem o trio completo', (opponent) => {
  for (const id of ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c']) {
    expect(progress(id, victories(opponent, 1, ['road-raider-1-base']))[0].current).toBe(1);
  }
});

it('Passago exige as metas de 20 rápidas e 10 Multiplayer simultaneamente, sem condição de Berdal', () => {
  const quick = victories('rival-a-base', 20, ['rival-female-base']);
  const multiplayer = victories('rival-b-base', 10, ['road-raider-1-base'], 'multiplayer');
  expect(progress('guerreiros-habilidosos-c', [...quick.slice(0, 19), ...multiplayer]).map((entry) => [entry.current, entry.target])).toEqual([[19, 20], [10, 10]]);
  expect(progress('guerreiros-habilidosos-c', [...quick, ...multiplayer.slice(0, 9)]).map((entry) => [entry.current, entry.target])).toEqual([[20, 20], [9, 10]]);
  expect(progress('guerreiros-habilidosos-c', [...quick, ...multiplayer]).every((entry) => entry.current === entry.target)).toBe(true);
});

it('metas de Espinea ignoram o próprio trio e Exal final e separam os modos de batalha', () => {
  const otherEnemies = [...victories('guerreiros-habilidosos-a', 30), ...victories('guerreiros-habilidosos-b', 30),
    ...victories('guerreiros-habilidosos-c', 30), ...victories('rival-b-final-mode', 30)];
  for (const id of ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c']) {
    expect(progress(id, otherEnemies).every((entry) => entry.current === 0)).toBe(true);
    expect(progress(id, victories('rival-a-base', 20, [], 'multiplayer'))[0].current).toBe(0);
  }
});

it('Exal comum exige Multiplayer e não é liberado pelas vitórias rápidas usadas na meta de Ravi Berserk', () => {
  expect(progress('rival-b-base', victories('rival-b-base', 20))[0].current).toBe(0);
  expect(progress('rival-b-base', victories('rival-b-base', 9, [], 'multiplayer'))[0].current).toBe(9);
  expect(progress('rival-b-base', victories('rival-b-base', 10, [], 'multiplayer'))[0].current).toBe(10);
  expect(progress('protagonist-main-transformed', victories('rival-b-base', 20, [], 'multiplayer'))[1].current).toBe(0);
});

it('Ravi Berserk exige as metas de Grimória e 50 vitórias rápidas simultaneamente', () => {
  const history = [...victories('rival-a-base', 15, []), ...victories('rival-b-base', 19, []), ...victories('rival-female-base', 10, []), ...victories('protagonist-main-base', 5, [])];
  expect(progress('protagonist-main-transformed', history).map((entry) => [entry.current, entry.target])).toEqual([[15, 15], [19, 20], [10, 10], [49, 50]]);
  expect(progress('protagonist-main-transformed', [...history, ...victories('rival-b-base', 1, [])]).every((entry) => entry.current === entry.target)).toBe(true);
});

it('50 vitórias contam quaisquer adversários mas não substituem as metas específicas de Ravi Berserk', () => {
  expect(progress('protagonist-main-transformed', victories('protagonist-main-base', 50)).map((entry) => entry.current)).toEqual([0, 0, 0, 50]);
  expect(progress('protagonist-main-transformed', victories('rival-b-base', 60, [], 'multiplayer'))[3].current).toBe(0);
  const trio: BattleVictory = { mode: 'quick', playerUnitIds: [], enemyUnitIds: ['rival-a-base', 'rival-b-base', 'rival-female-base'] };
  expect(progress('protagonist-main-transformed', Array.from({ length: 49 }, () => trio)).map((entry) => entry.current)).toEqual([15, 20, 10, 49]);
});

it('conta uma batalha uma única vez para cada oponente mesmo com unidades repetidas na equipe inimiga', () => {
  const history: BattleVictory[] = [{ mode: 'quick', playerUnitIds: ['protagonist-main-base'], enemyUnitIds: ['road-raider-1-base', 'road-raider-1-base', 'road-raider-2-base'] }];
  expect(progress('road-raider-1-base', history)[0].current).toBe(1);
  expect(progress('road-raider-2-base', history)[0].current).toBe(1);
});

it('lista somente as metas e os dois Premium a US$ 9,90, refletindo os desbloqueios persistidos', () => {
  const data = characterUnlockProgress(units, ['road-raider-1-base'], []);
  expect(data.characters).toHaveLength(16);
  expect(data.characters.find((unit) => unit.id === 'road-raider-1-base')?.unlocked).toBe(true);
  expect(data.characters.filter((unit) => unit.kind === 'premium')).toEqual([
    expect.objectContaining({ id: 'rival-b-final-mode', priceUsd: 9.9, unlocked: false }),
    expect.objectContaining({ id: 'legendary-beast-premium', priceUsd: 9.9, unlocked: false }),
  ]);
});

it('Jung II exige 25 vitórias rápidas usando Ravi base e não compartilha o contador do Jung original', () => {
  const excluded = [...victories('rival-a-base', 30), ...victories('jung-de-grimoria-ii', 30, ['protagonist-secondary-base']),
    ...victories('jung-de-grimoria-ii', 30, ['protagonist-main-transformed']), ...victories('jung-de-grimoria-ii', 30, ['protagonist-main-base'], 'multiplayer')];
  expect(progress('jung-de-grimoria-ii', excluded)[0]).toMatchObject({ current: 0, target: 25 });
  expect(progress('jung-de-grimoria-ii', [...excluded, ...victories('jung-de-grimoria-ii', 24)])[0].current).toBe(24);
  expect(progress('jung-de-grimoria-ii', [...excluded, ...victories('jung-de-grimoria-ii', 25)])[0].current).toBe(25);
  expect(progress('rival-a-base', victories('jung-de-grimoria-ii', 25))[0].current).toBe(0);
});

it('zera somente a missão indicada e conta novas vitórias após o marco sem descartar o histórico das demais', () => {
  const before = { ...victories('rival-a-base', 1)[0], completedAt: '2026-10-30T10:00:00.000Z' };
  const atReset = { ...before, completedAt: '2026-10-30T11:00:00.000Z' };
  const after = { ...before, completedAt: '2026-10-30T12:00:00.000Z' };
  const result = characterUnlockProgress(units, [], [before, atReset, after], { 'guerreiros-habilidosos-a': atReset.completedAt });
  const trinity = result.characters.find((unit) => unit.id === 'guerreiros-habilidosos-a')!;
  const vlade = result.characters.find((unit) => unit.id === 'guerreiros-habilidosos-b')!;
  const jung = result.characters.find((unit) => unit.id === 'rival-a-base')!;
  expect(trinity.kind === 'battle-wins' && trinity.requirements[0].current).toBe(1);
  expect(vlade.kind === 'battle-wins' && vlade.requirements[0].current).toBe(3);
  expect(jung.kind === 'battle-wins' && jung.requirements[0].current).toBe(3);
});
