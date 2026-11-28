import { expect, it } from 'vitest';
import { units } from '@game/content/units.js';
import { battleUnlockRules } from '@game/content/unlocks.js';
import { characterUnlockProgress, type BattleVictory } from '@game/core/unlocks.js';

const allEncounters = ['1', '2', '3', '4', '5', '6', '7'].map((position) => `path-1-encounter-${position}`);
const victories = (enemyUnitId: string, count: number, playerUnitIds = ['protagonist-main-base'],
  mode: BattleVictory['mode'] = 'quick'): BattleVictory[] => Array.from({ length: count }, () => ({ mode, playerUnitIds, enemyUnitIds: [enemyUnitId] }));
const progress = (id: string, wins: readonly BattleVictory[], completed = allEncounters) => {
  const unit = characterUnlockProgress(units, [], wins, {}, undefined, completed).characters.find((entry) => entry.id === id)!;
  if (unit.kind !== 'battle-wins') throw new Error('Esperada uma meta de combate.');
  return unit.requirements;
};
const quickIndex = (id: string) => battleUnlockRules.find((r) => r.unitId === id)!.requirements.findIndex((r) => r.kind === 'battle-wins' && !r.opponentUnitIds);
const opponentIndex = (id: string, opponent: string) => battleUnlockRules.find((r) => r.unitId === id)!.requirements.findIndex((r) => r.kind === 'battle-wins' && r.opponentUnitIds?.includes(opponent));

it.each([
  ['road-raider-1-base', 3], ['road-raider-2-base', 3], ['road-raider-3-base', 3],
  ['rival-a-base', 5], ['jung-de-grimoria-ii', 15], ['rival-b-base', 5],
  ['rival-female-base', 5], ['guardian-healer-male-base', 5], ['guardian-healer-female-base', 5],
  ['passage-guardian-base', 10], ['guerreiros-habilidosos-a', 10],
  ['guerreiros-habilidosos-b', 10], ['guerreiros-habilidosos-c', 10], ['protagonist-main-transformed', 25],
] as const)('exige o número correto de vitórias rápidas para %s', (id, count) => {
  expect(progress(id, victories('protagonist-main-base', count - 1))[quickIndex(id)]).toMatchObject({ current: count - 1, target: count });
  expect(progress(id, victories('protagonist-main-base', count))[quickIndex(id)]).toMatchObject({ current: count, target: count });
  expect(progress(id, victories('protagonist-main-base', count + 5))[quickIndex(id)].current).toBe(count);
  expect(progress(id, victories('protagonist-main-base', count, undefined, 'multiplayer'))[quickIndex(id)].current).toBe(0);
});

it.each([
  ['road-raider-1-base', 'road-raider-1-base', 1], ['road-raider-2-base', 'road-raider-2-base', 1],
  ['road-raider-3-base', 'road-raider-3-base', 1], ['rival-a-base', 'rival-a-base', 3],
  ['rival-b-base', 'rival-b-base', 3], ['rival-female-base', 'rival-female-base', 3],
  ['guardian-healer-male-base', 'guardian-healer-male-base', 3], ['guardian-healer-female-base', 'guardian-healer-female-base', 3],
  ['passage-guardian-base', 'passage-guardian-base', 5], ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-a', 5],
  ['guerreiros-habilidosos-b', 'guerreiros-habilidosos-b', 5], ['guerreiros-habilidosos-c', 'guerreiros-habilidosos-c', 5],
  ['jung-de-grimoria-ii', 'jung-de-grimoria-ii', 10], ['protagonist-main-transformed', 'jung-de-grimoria-ii', 15],
] as const)('%s exige derrotar o oponente específico %s vezes', (id, opponent, target) => {
  expect(progress(id, victories(opponent, target - 1))[opponentIndex(id, opponent)]).toMatchObject({ current: target - 1, target });
  expect(progress(id, victories(opponent, target))[opponentIndex(id, opponent)]).toMatchObject({ current: target, target });
});

it('Jung exige Ravi de Berdal base na meta adicional', () => {
  const wrong = [...victories('rival-a-base', 10, ['protagonist-secondary-base']), ...victories('rival-a-base', 10, ['protagonist-main-transformed'])];
  expect(progress('rival-a-base', wrong)[2].current).toBe(0);
  expect(progress('rival-a-base', [...wrong, ...victories('rival-a-base', 1)])[2].current).toBe(1);
});

it('Drak exige Saqueadores da estrada na meta adicional', () => {
  expect(progress('passage-guardian-base', victories('passage-guardian-base', 5))[2].current).toBe(0);
  expect(progress('passage-guardian-base', victories('passage-guardian-base', 3, ['road-raider-1-base']))[2].current).toBe(3);
});

it('Jung II exige o original e Berzerk separa derrotas de adversários da utilização de Ravi', () => {
  expect(progress('jung-de-grimoria-ii', victories('jung-de-grimoria-ii', 10))[2].current).toBe(0);
  expect(progress('jung-de-grimoria-ii', victories('road-raider-1-base', 5, ['rival-a-base']))[2].current).toBe(5);
  expect(progress('protagonist-main-transformed', victories('jung-de-grimoria-ii', 15, ['protagonist-secondary-base']))[1].current).toBe(15);
});

it('mantém a campanha como revelação, sem duplicá-la nos objetivos rápidos', () => {
  expect(battleUnlockRules.find((r) => r.unitId === 'road-raider-1-base')?.availableAfterEncounterId).toBe('path-1-encounter-1');
  expect(battleUnlockRules.find((r) => r.unitId === 'road-raider-1-base')?.requirements.every((r) => r.kind === 'battle-wins')).toBe(true);
  expect(battleUnlockRules.find((r) => r.unitId === 'protagonist-main-transformed')?.availableAfterEncounterId).toBe('path-1-encounter-7');
});

it('marca Kalis e Ridan como disponíveis desde o início e Ravi Berzerk após a batalha 7', () => {
  expect(battleUnlockRules.find((rule) => rule.unitId === 'capitao-da-guarda-kalis-base')).toMatchObject({ availableFromStart: true });
  expect(battleUnlockRules.find((rule) => rule.unitId === 'capitao-da-guarda-ridan-base')).toMatchObject({ availableFromStart: true });
  expect(battleUnlockRules.find((rule) => rule.unitId === 'protagonist-main-transformed')).toMatchObject({ availableAfterEncounterId: 'path-1-encounter-7' });
});

it('conta uma batalha uma única vez para cada adversário mesmo se repetido', () => {
  const history = [victories('guerreiros-habilidosos-a', 1)[0]];
  history[0] = { ...history[0], enemyUnitIds: ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-a', 'guerreiros-habilidosos-b'] };
  expect(progress('guerreiros-habilidosos-a', history)[1].current).toBe(1);
  expect(progress('guerreiros-habilidosos-b', history)[1].current).toBe(1);
});

it('lista os três preços Premium, dois deles com missão, e preserva desbloqueios persistidos', () => {
  const data = characterUnlockProgress(units, ['road-raider-1-base'], []);
  expect(data.characters).toHaveLength(40);
  expect(data.characters.find((unit) => unit.id === 'road-raider-1-base')?.unlocked).toBe(true);
  expect(data.characters.filter((unit) => unit.kind === 'premium')).toEqual([expect.objectContaining({ id: 'maga-artemis', priceUsd: 9.9 })]);
  for (const id of ['rival-b-final-mode', 'legendary-beast-premium']) expect(data.characters.find((unit) => unit.id === id)).toMatchObject({ kind: 'battle-wins', priceUsd: 9.9 });
});

it('mantém missões de personagens já liberados acessíveis sem encontro próprio na campanha', () => {
  const unlocked = ['protagonist-main-transformed', 'legendary-beast-premium'];
  const data = characterUnlockProgress(units, unlocked, [], {}, [], allEncounters);
  for (const id of unlocked) expect(data.characters.find((unit) => unit.id === id)).toMatchObject({ unlocked: true, campaignAvailable: true });
  expect(data.characters.find((unit) => unit.id === 'road-raider-1-base')).toMatchObject({ unlocked: false, campaignAvailable: false });
  expect(data.characters.find((unit) => unit.id === 'maga-artemis')).toMatchObject({ kind: 'premium', priceUsd: 9.9 });
});

it('ignora vitórias rápidas anteriores à revelação do personagem na campanha', () => {
  const before = { ...victories('road-raider-1-base', 1)[0], completedAt: '2026-10-30T10:00:00.000Z' };
  const after = { ...before, completedAt: '2026-10-30T12:00:00.000Z' };
  const data = characterUnlockProgress(units, [], [before, before, after], {}, ['road-raider-1-base'], ['path-1-encounter-1'], { 'path-1-encounter-1': '2026-10-30T11:00:00.000Z' });
  const raider = data.characters.find((unit) => unit.id === 'road-raider-1-base')!;
  expect(raider.kind === 'battle-wins' && raider.requirements.map((r) => r.current)).toEqual([1, 1]);
});

it('zera somente a missão indicada sem descartar o histórico das demais', () => {
  const before = { ...victories('rival-a-base', 1)[0], completedAt: '2026-10-30T10:00:00.000Z', enemyUnitIds: ['rival-a-base', 'guerreiros-habilidosos-a', 'guerreiros-habilidosos-b'] };
  const atReset = { ...before, completedAt: '2026-10-30T11:00:00.000Z' };
  const after = { ...before, completedAt: '2026-10-30T12:00:00.000Z' };
  const result = characterUnlockProgress(units, [], [before, atReset, after], { 'guerreiros-habilidosos-a': atReset.completedAt }, undefined, allEncounters);
  const a = result.characters.find((unit) => unit.id === 'guerreiros-habilidosos-a')!;
  const b = result.characters.find((unit) => unit.id === 'guerreiros-habilidosos-b')!;
  expect(a.kind === 'battle-wins' && a.requirements[1].current).toBe(1);
  expect(b.kind === 'battle-wins' && b.requirements[1].current).toBe(3);
});
