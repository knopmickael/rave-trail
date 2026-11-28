import { expect, it } from 'vitest';
import { units } from '@game/content/units.js';
import { battleUnlockRules } from '@game/content/unlocks.js';
import { characterUnlockProgress, type BattleVictory } from '@game/core/unlocks.js';
import { abilities } from '@game/content/abilities.js';
import { createBattle, executeTurn, previewActions } from '@game/core/battle.js';

const targets = [
  ['road-raider-1-base', [3, 1]], ['road-raider-2-base', [3, 1]], ['road-raider-3-base', [3, 1]],
  ['rival-a-base', [5, 3, 1]], ['rival-b-base', [5, 3, 1]], ['rival-female-base', [5, 3, 1]],
  ['guardian-healer-male-base', [5, 3, 1]], ['guardian-healer-female-base', [5, 3, 1]],
  ['passage-guardian-base', [10, 5, 3]],
  ['saqueador-da-estrada-iii', [10, 5]], ['saqueador-da-estrada-iv', [10, 5]], ['saqueadora-da-estrada-ii', [10, 5]],
  ['guerreiros-habilidosos-a', [10, 5, 3]], ['guerreiros-habilidosos-b', [10, 5, 3]], ['guerreiros-habilidosos-c', [10, 5, 3]],
  ['jung-de-grimoria-ii', [15, 10, 5]], ['exal-de-grimoria-ii', [15, 10, 5]], ['monnica-de-grimoria-ii', [15, 10, 5]],
  ['protagonist-main-transformed', [25, 15, 15, 15, 10]], ['rival-b-final-mode', [50, 30, 30, 15]],
  ['legendary-beast-premium', [100, 50, 30, 30, 30]],
  ['general-abel', [10, 5]], ['guardia-da-fronteira', [10, 5]], ['samurai-erlang', [10, 5]],
  ['sabio-do-castelo', [15, 10]], ['emissario-do-castelo', [15, 10]], ['grande-rei-osiris', [25, 15]],
] as const;
const victory = (enemy: string, player = 'protagonist-main-base', noPlayerDeaths?: boolean): BattleVictory =>
  ({ mode: 'quick', playerUnitIds: [player], enemyUnitIds: [enemy], ...(noPlayerDeaths !== undefined ? { noPlayerDeaths } : {}) });
const mission = (id: string, history: readonly BattleVictory[] = []) => {
  const result = characterUnlockProgress(units, [], history).characters.find((u) => u.id === id)!;
  if (result?.kind !== 'battle-wins') throw new Error(`Missão ausente: ${id}`);
  return result;
};

it.each(targets)('apresenta os objetivos solicitados para %s e não exige confrontos como objetivos adicionais', (id, wanted) => {
  expect(mission(id).requirements.map((r) => r.target)).toEqual(wanted);
});

it.each([
  ['rival-a-base', 'protagonist-main-base'], ['rival-b-base', 'protagonist-secondary-base'], ['rival-female-base', 'protagonist-female-base'],
] as const)('a terceira meta de %s exige o protagonista correto na equipe', (id, player) => {
  expect(mission(id, [victory(id, 'road-raider-1-base')]).requirements.map((r) => r.current)).toEqual([1, 1, 0]);
  expect(mission(id, [victory(id, player)]).requirements.map((r) => r.current)).toEqual([1, 1, 1]);
});

it('aceita qualquer um dos seis Saqueadores e dos três personagens de Pontes nas metas de equipe', () => {
  for (const player of ['road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base', 'saqueador-da-estrada-iii', 'saqueador-da-estrada-iv', 'saqueadora-da-estrada-ii']) {
    expect(mission('guardian-healer-male-base', [victory('guardian-healer-male-base', player)]).requirements[2].current).toBe(1);
    expect(mission('passage-guardian-base', [victory('passage-guardian-base', player)]).requirements[2].current).toBe(1);
  }
  for (const player of ['guardian-healer-male-base', 'guardian-healer-female-base', 'passage-guardian-base']) {
    expect(mission('guerreiros-habilidosos-a', [victory('guerreiros-habilidosos-a', player)]).requirements[2].current).toBe(1);
  }
});

it('versões II exigem vitórias com a versão I, independentemente do adversário', () => {
  for (const [id, original] of [['jung-de-grimoria-ii', 'rival-a-base'], ['exal-de-grimoria-ii', 'rival-b-base'], ['monnica-de-grimoria-ii', 'rival-female-base']]) {
    expect(mission(id, [victory('road-raider-1-base', original)]).requirements.map((r) => r.current)).toEqual([1, 0, 1]);
    expect(mission(id, [victory(id)]).requirements.map((r) => r.current)).toEqual([1, 1, 0]);
  }
});

it('Berzerk separa as três derrotas de versões II da meta de usar Ravi', () => {
  const history = ['jung-de-grimoria-ii', 'exal-de-grimoria-ii', 'monnica-de-grimoria-ii'].flatMap((id) =>
    Array.from({ length: 15 }, () => victory(id, 'protagonist-secondary-base')));
  expect(mission('protagonist-main-transformed', history).requirements.map((r) => r.current)).toEqual([25, 15, 15, 15, 0]);
  history.push(...Array.from({ length: 10 }, () => victory('road-raider-1-base')));
  expect(mission('protagonist-main-transformed', history).requirements.map((r) => r.current)).toEqual([25, 15, 15, 15, 10]);
  const unit = units.find((u) => u.id === 'protagonist-main-transformed')!;
  expect(unit.name).toBe('Ravi Berzerk');
  expect(unit.portrait).toBe('/media/characters/ravi-berserk-face.png');
});

it('Zéfiro conta apenas vitórias comprovadamente sem mortes e uma partida por grupo de adversários', () => {
  const history = [victory('rival-a-base'), victory('rival-a-base', undefined, false), victory('rival-a-base', undefined, true),
    victory('guardian-healer-male-base', undefined, true), victory('guerreiros-habilidosos-a', undefined, true)];
  history.push({ ...victory('rival-b-final-mode'), enemyUnitIds: ['rival-b-final-mode', 'rival-a-base', 'rival-female-base'] });
  expect(mission('legendary-beast-premium', history).requirements.map((r) => r.current)).toEqual([6, 3, 4, 1, 1]);
});

it('ambos os Premium mantêm preço e missão bloqueada até a batalha 7, sem contar vitórias anteriores', () => {
  const history = [victory('protagonist-main-transformed'), victory('protagonist-main-transformed')].map((v, i) =>
    ({ ...v, completedAt: `2026-11-26T${i ? '12' : '10'}:00:00.000Z` }));
  for (const id of ['rival-b-final-mode', 'legendary-beast-premium']) {
    expect(units.find((u) => u.id === id)?.unlock.kind).toBe('premium');
    expect(battleUnlockRules.find((r) => r.unitId === id)?.availableAfterEncounterId).toBe('path-1-encounter-7');
    const blocked = characterUnlockProgress(units, [], history, {}, [], []).characters.find((u) => u.id === id)!;
    expect(blocked).toMatchObject({ kind: 'battle-wins', campaignAvailable: false, priceUsd: 9.9 });
    const revealed = characterUnlockProgress(units, [], history, {}, [id], ['path-1-encounter-7'],
      { 'path-1-encounter-7': '2026-11-26T11:00:00.000Z' }).characters.find((u) => u.id === id)!;
    expect(revealed.kind === 'battle-wins' && revealed.requirements[0].current).toBe(1);
  }
});

it('registra derrota de aliado mesmo após ressurreição e não conta morte impedida pela Benção', () => {
  const initial = createBattle(units.slice(0, 2), [units[3]], Object.values(abilities));
  expect(initial.teams.player.units.map((u) => u.wasDefeated)).toEqual([false, false]);
  initial.teams.player.units[0].hp = 1;
  let state = executeTurn(initial, []).state;
  state.teams.enemy.energy = 100; state.teams.enemy.units[0].abilityIds = ['execution'];
  const warded = structuredClone(state); warded.teams.player.units[0].deathWardAbilityId = 'divine-boon';
  const survived = previewActions(warded, [{ actorId: 'enemy-0', abilityId: 'execution', targetId: 'player-0' }]).state;
  expect(survived.teams.player.units[0]).toMatchObject({ hp: 1, wasDefeated: false });
  state = executeTurn(state, [{ actorId: 'enemy-0', abilityId: 'execution', targetId: 'player-0' }]).state;
  expect(state.teams.player.units[0]).toMatchObject({ hp: 0, wasDefeated: true });
  state.teams.player.energy = 100; state.teams.player.units[1].abilityIds = ['resurrection'];
  state = previewActions(state, [{ actorId: 'player-1', abilityId: 'resurrection', targetId: 'player-0' }]).state;
  expect(state.teams.player.units[0]).toMatchObject({ hp: 100, wasDefeated: true });
  expect(initial.teams.player.units[0].wasDefeated).toBe(false);
});
