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

it.each([
  ['road-raider-1-base', 5], ['road-raider-2-base', 5], ['road-raider-3-base', 5],
  ['rival-a-base', 10], ['jung-de-grimoria-ii', 25], ['rival-b-base', 10],
  ['rival-female-base', 10], ['guardian-healer-male-base', 10], ['guardian-healer-female-base', 10],
  ['passage-guardian-base', 20], ['guerreiros-habilidosos-a', 15],
  ['guerreiros-habilidosos-b', 15], ['guerreiros-habilidosos-c', 15],
  ['protagonist-main-transformed', 30],
] as const)('exige o n�mero correto de vit�rias r�pidas para %s', (id, count) => {
  const requirement = progress(id, victories('protagonist-main-base', count - 1))[1];
  expect(requirement).toMatchObject({ current: count - 1, target: count });
  expect(progress(id, victories('protagonist-main-base', count))[1]).toMatchObject({ current: count, target: count });
  expect(progress(id, victories('protagonist-main-base', count + 5))[1].current).toBe(count);
});

it.each([
  ['road-raider-1-base', 'road-raider-1-base', 3], ['road-raider-2-base', 'road-raider-2-base', 3],
  ['road-raider-3-base', 'road-raider-3-base', 3], ['rival-a-base', 'rival-a-base', 5],
  ['rival-b-base', 'rival-b-base', 5], ['rival-female-base', 'rival-female-base', 5],
  ['guardian-healer-male-base', 'guardian-healer-male-base', 5],
  ['guardian-healer-female-base', 'guardian-healer-female-base', 5],
  ['passage-guardian-base', 'passage-guardian-base', 10],
  ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-a', 15],
  ['guerreiros-habilidosos-b', 'guerreiros-habilidosos-b', 15],
  ['guerreiros-habilidosos-c', 'guerreiros-habilidosos-c', 15],
  ['jung-de-grimoria-ii', 'rival-a-base', 15],
  ['protagonist-main-transformed', 'rival-a-base', 20],
] as const)('%s exige derrotar o oponente espec�fico %s vezes', (id, opponent, target) => {
  expect(progress(id, victories(opponent, target - 1))[2]).toMatchObject({ current: target - 1, target });
  expect(progress(id, victories(opponent, target))[2]).toMatchObject({ current: target, target });
});

it('Jung exige Ravi de Berdal base na meta adicional', () => {
  const unqualified = [...victories('rival-a-base', 10, ['protagonist-secondary-base']),
    ...victories('rival-a-base', 10, ['protagonist-main-transformed'])];
  expect(progress('rival-a-base', unqualified)[3].current).toBe(0);
  expect(progress('rival-a-base', [...unqualified, ...victories('rival-a-base', 3)])[3].current).toBe(3);
});

it('Drak exige Saqueadores da estrada na meta adicional', () => {
  const wrong = victories('passage-guardian-base', 5, ['protagonist-main-base']);
  expect(progress('passage-guardian-base', wrong)[3].current).toBe(0);
  expect(progress('passage-guardian-base', victories('passage-guardian-base', 5, ['road-raider-1-base']))[3].current).toBe(5);
});

it('Jung II exige Ravi base e Berserk exige Jung II com Ravi base', () => {
  expect(progress('jung-de-grimoria-ii', victories('rival-a-base', 10, ['protagonist-main-transformed']))[3].current).toBe(0);
  expect(progress('jung-de-grimoria-ii', victories('rival-a-base', 10))[3].current).toBe(10);
  expect(progress('protagonist-main-transformed', victories('jung-de-grimoria-ii', 10, ['protagonist-secondary-base']))[3].current).toBe(0);
  expect(progress('protagonist-main-transformed', victories('jung-de-grimoria-ii', 10))[3].current).toBe(10);
});

it('exige concluir a batalha de campanha correspondente', () => {
  expect(progress('road-raider-1-base', [], [])[0]).toMatchObject({ current: 0, target: 1 });
  expect(progress('road-raider-1-base', [], ['path-1-encounter-1'])[0]).toMatchObject({ current: 1, target: 1 });
  expect(progress('protagonist-main-transformed', [], ['path-1-encounter-6'])[0].current).toBe(0);
  expect(progress('protagonist-main-transformed', [], ['path-1-encounter-7'])[0].current).toBe(1);
});

it('marca Kalis e Ridan como dispon�veis desde o in�cio e Ravi Berserk ap�s a batalha 7', () => {
  expect(battleUnlockRules.find((rule) => rule.unitId === 'capitao-da-guarda-kalis-base')).toMatchObject({ availableFromStart: true });
  expect(battleUnlockRules.find((rule) => rule.unitId === 'capitao-da-guarda-ridan-base')).toMatchObject({ availableFromStart: true });
  expect(battleUnlockRules.find((rule) => rule.unitId === 'protagonist-main-transformed'))
    .toMatchObject({ availableAfterEncounterId: 'path-1-encounter-7' });
});

it('conta uma batalha uma �nica vez para cada oponente mesmo com unidades repetidas na equipe inimiga', () => {
  const history: BattleVictory[] = [{ mode: 'quick', playerUnitIds: ['protagonist-main-base'], enemyUnitIds: ['road-raider-1-base', 'road-raider-1-base', 'road-raider-2-base'] }];
  expect(progress('road-raider-1-base', history)[2].current).toBe(1);
  expect(progress('road-raider-2-base', history)[2].current).toBe(1);
});

it('lista as metas e os tr�s Premium a US$ 9,90, refletindo os desbloqueios persistidos', () => {
  const data = characterUnlockProgress(units, ['road-raider-1-base'], []);
  expect(data.characters).toHaveLength(35);
  expect(data.characters.find((unit) => unit.id === 'road-raider-1-base')?.unlocked).toBe(true);
  expect(data.characters.filter((unit) => unit.kind === 'premium')).toEqual([
    expect.objectContaining({ id: 'rival-b-final-mode', priceUsd: 9.9, unlocked: false }),
    expect.objectContaining({ id: 'legendary-beast-premium', priceUsd: 9.9, unlocked: false }),
    expect.objectContaining({ id: 'maga-artemis', priceUsd: 9.9, unlocked: false }),
  ]);
});

it('mant�m miss�es de personagens j� liberados acess�veis mesmo sem um encontro pr�prio na campanha', () => {
  const unlocked = ['protagonist-main-transformed', 'legendary-beast-premium'];
  const data = characterUnlockProgress(units, unlocked, [], {}, [], allEncounters);
  for (const id of unlocked) expect(data.characters.find((unit) => unit.id === id)).toMatchObject({ unlocked: true, campaignAvailable: true });
  expect(data.characters.find((unit) => unit.id === 'road-raider-1-base')).toMatchObject({ unlocked: false, campaignAvailable: false });
  expect(data.characters.find((unit) => unit.id === 'maga-artemis')).toMatchObject({ kind: 'premium', priceUsd: 9.9 });
});

it('ignora vitórias rápidas anteriores à revelação do personagem na campanha', () => {
  const before = { mode: 'quick' as const, playerUnitIds: ['protagonist-main-base'],
    enemyUnitIds: ['road-raider-1-base'], completedAt: '2026-10-30T10:00:00.000Z' };
  const after = { ...before, completedAt: '2026-10-30T12:00:00.000Z' };
  const data = characterUnlockProgress(units, [], [before, before, after], {}, ['road-raider-1-base'],
    ['path-1-encounter-1'], { 'path-1-encounter-1': '2026-10-30T11:00:00.000Z' });
  const raider = data.characters.find((unit) => unit.id === 'road-raider-1-base')!;
  expect(raider.kind === 'battle-wins' && raider.requirements[1].current).toBe(1);
  expect(raider.kind === 'battle-wins' && raider.requirements[2].current).toBe(1);
});

it('zera somente a miss�o indicada e conta novas vit�rias ap�s o marco sem descartar o hist�rico das demais', () => {
  const before = { ...victories('rival-a-base', 1)[0], completedAt: '2026-10-30T10:00:00.000Z',
    enemyUnitIds: ['rival-a-base', 'guerreiros-habilidosos-a', 'guerreiros-habilidosos-b'] };
  const atReset = { ...before, completedAt: '2026-10-30T11:00:00.000Z' };
  const after = { ...before, completedAt: '2026-10-30T12:00:00.000Z' };
  const result = characterUnlockProgress(units, [], [before, atReset, after], { 'guerreiros-habilidosos-a': atReset.completedAt }, undefined, allEncounters);
  const trinity = result.characters.find((unit) => unit.id === 'guerreiros-habilidosos-a')!;
  const vlade = result.characters.find((unit) => unit.id === 'guerreiros-habilidosos-b')!;
  const jungle = result.characters.find((unit) => unit.id === 'rival-a-base')!;
  expect(trinity.kind === 'battle-wins' && trinity.requirements[2].current).toBe(1);
  expect(vlade.kind === 'battle-wins' && vlade.requirements[2].current).toBe(3);
  expect(jungle.kind === 'battle-wins' && jungle.requirements[2].current).toBe(3);
});
