import { expect, it } from 'vitest';
import { abilities } from '@game/content/abilities.js';
import { units } from '@game/content/units.js';
import { createBattle, executeTurn, previewActions, type BattleAction } from '@game/core/battle.js';

const definition = (id: string) => units.find((unit) => unit.id === id)!;
function battle(allies = ['road-raider-1-base', 'protagonist-main-base', 'protagonist-secondary-base']) {
  const state = createBattle(allies.map(definition),
    ['road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base'].map(definition), Object.values(abilities));
  state.teams.player.energy = 100;
  return state;
}
const action = (actor: number, abilityId: string, targetId?: string): BattleAction => ({ actorId: `player-${actor}`, abilityId, ...(targetId ? { targetId } : {}) });

it('amplifica somente no próximo turno do aliado, expira depois dele e preserva a entrada', () => {
  const initial = battle();
  const snapshot = JSON.stringify(initial);
  let state = executeTurn(initial, [action(0, 'internal-strength', 'player-1'), action(1, 'simple-strike', 'enemy-0')]).state;
  expect(state.teams.enemy.units[0].hp).toBe(80);
  expect(state.teams.player.energy).toBe(50);
  expect(state.teams.player.units[1]).toMatchObject({ damageBoostAmount: 15, damageBoostStartsAt: 2, damageBoostExpiresAt: 3 });
  state = executeTurn(state, []).state;
  state = executeTurn(state, [action(0, 'simple-strike', 'enemy-0'), action(1, 'simple-strike', 'enemy-1')]).state;
  expect(state.teams.enemy.units.map((unit) => unit.hp)).toEqual([60, 65, 100]);
  state = executeTurn(state, []).state;
  expect(state.teams.player.units[1].damageBoostExpiresAt).toBeNull();
  expect(previewActions(state, [action(1, 'simple-strike', 'enemy-1')]).state.teams.enemy.units[1].hp).toBe(45);
  expect(JSON.stringify(initial)).toBe(snapshot);
});

it('permite escolher a si mesmo, valida aliados vivos e exige 35 de energia', () => {
  const state = battle();
  state.teams.player.energy = 34;
  expect(() => previewActions(state, [action(0, 'internal-strength', 'player-0')])).toThrow(/Energia insuficiente/);
  state.teams.player.energy = 35;
  expect(() => previewActions(state, [action(0, 'internal-strength', 'enemy-0')])).toThrow(/alvo vivo/);
  state.teams.player.units[1].hp = 0;
  expect(() => previewActions(state, [action(0, 'internal-strength', 'player-1')])).toThrow(/alvo vivo/);
  state.teams.player.units[0].attackBlockedExpiresAt = 99;
  let next = executeTurn(state, [action(0, 'internal-strength', 'player-0')]).state;
  next = executeTurn(next, []).state;
  next.teams.player.units[0].attackBlockedExpiresAt = null;
  expect(previewActions(next, [action(0, 'simple-strike', 'enemy-0')]).state.teams.enemy.units[0].hp).toBe(65);
});

it('não acumula bônus e renovar não remove o bônus ativo; aplica o aumento a cada alvo antes da Guarda', () => {
  const initial = battle();
  initial.teams.player.units[1].abilityIds = ['internal-strength'];
  let state = executeTurn(initial, [action(0, 'internal-strength', 'player-2'), action(1, 'internal-strength', 'player-2')]).state;
  state = executeTurn(state, []).state;
  state.teams.player.energy = 100;
  state.teams.enemy.units[0].guardExpiresAt = 99;
  state.teams.enemy.units[0].guardReduction = 15;
  state = executeTurn(state, [action(0, 'internal-strength', 'player-2'), action(2, 'secondary-special')]).state;
  expect(state.teams.enemy.units.map((unit) => unit.hp)).toEqual([80, 65, 65]);
  state = executeTurn(state, []).state;
  expect(previewActions(state, [action(2, 'secondary-special')]).state.teams.enemy.units.map((unit) => unit.hp)).toEqual([60, 30, 30]);
});

it('aumenta o dano da drenagem sem aumentar a cura e respeita invulnerabilidade', () => {
  const initial = battle();
  initial.teams.player.units[1].abilityIds = ['soul-drain'];
  initial.teams.player.units[1].hp = 30;
  let state = executeTurn(initial, [action(0, 'internal-strength', 'player-1')]).state;
  state = executeTurn(state, []).state;
  const outcome = previewActions(state, [action(1, 'soul-drain', 'enemy-0')]).state;
  expect(outcome.teams.enemy.units[0].hp).toBe(60);
  expect(outcome.teams.player.units[1].hp).toBe(55);
  state.teams.enemy.units[0].invulnerableExpiresAt = 99;
  expect(previewActions(state, [action(1, 'soul-drain', 'enemy-0')]).state.teams.enemy.units[0].hp).toBe(100);
});

it('preserva o dano ampliado do sangramento criado pelo golpe e não altera sangramentos já aplicados', () => {
  const initial = battle();
  initial.teams.player.units[1].abilityIds = ['quick-slash'];
  initial.teams.enemy.units[1].bleedAmount = 10;
  initial.teams.enemy.units[1].bleedTurns = 3;
  let state = executeTurn(initial, [action(0, 'internal-strength', 'player-1')]).state;
  state = executeTurn(state, []).state;
  state = executeTurn(state, [action(1, 'quick-slash', 'enemy-0')]).state;
  expect(state.teams.enemy.units[0]).toMatchObject({ hp: 40, bleedAmount: 25, bleedTurns: 2 });
  expect(state.teams.enemy.units[1]).toMatchObject({ hp: 80, bleedAmount: 10 });
  state = executeTurn(state, []).state;
  expect(state.teams.player.units[1].damageBoostExpiresAt).toBeNull();
  state = executeTurn(state, []).state;
  expect(state.teams.enemy.units[0].hp).toBe(15);
});

it('ativa o bônus no turno extra da própria equipe', () => {
  const initial = battle(['road-raider-1-base', 'passage-guardian-base', 'protagonist-main-base']);
  let state = executeTurn(initial, [action(0, 'internal-strength', 'player-2'), action(1, 'extra-turn')]).state;
  expect(state.activeSide).toBe('player');
  expect(state.teams.player.turns).toBe(2);
  expect(previewActions(state, [action(2, 'simple-strike', 'enemy-0')]).state.teams.enemy.units[0].hp).toBe(65);
});

it('remove o bônus e sua ativação pendente quando um personagem retorna dos mortos', () => {
  const initial = battle(['road-raider-1-base', 'protagonist-main-base', 'legendary-beast-premium']);
  initial.teams.player.units[1].hp = 15;
  let state = executeTurn(initial, [action(0, 'internal-strength', 'player-1')]).state;
  state = executeTurn(state, [{ actorId: 'enemy-0', abilityId: 'simple-strike', targetId: 'player-1' }]).state;
  expect(state.teams.player.units[1].hp).toBe(0);
  state = previewActions(state, [action(2, 'resurrection', 'player-1')]).state;
  expect(state.teams.player.units[1]).toMatchObject({ hp: 50, damageBoostAmount: 0, damageBoostStartsAt: null, damageBoostExpiresAt: null });
});
