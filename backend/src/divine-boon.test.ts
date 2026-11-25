import { expect, it } from 'vitest';
import { abilities, type AbilityDefinition } from '@game/content/abilities.js';
import { units } from '@game/content/units.js';
import { createBattle, executeTurn, planEnemyTurn, previewActions, type BattleAction } from '@game/core/battle.js';

const boon: AbilityDefinition = { id: 'divine-boon', name: 'Benção divina', description: 'Sobrevive a um dano fatal com 1 HP.',
  energyCost: 40, target: 'ally', icon: '/media/abilities/divine-boon.png', effects: [{ kind: 'prevent-defeat' }] };
const action = (actorId: string, abilityId: string, targetId?: string): BattleAction => ({ actorId, abilityId, ...(targetId ? { targetId } : {}) });
function initial() {
  const state = createBattle(units.slice(0, 3), units.slice(3, 6), [...Object.values(abilities), boon]);
  state.teams.player.energy = 100;
  state.teams.enemy.energy = 100;
  state.teams.player.units[0].abilityIds = ['divine-boon', 'resurrection'];
  state.teams.enemy.units[0].abilityIds = ['simple-strike', 'soul-drain'];
  return state;
}

it('Benção divina deixa o aliado com 1 HP uma única vez e não modifica a prévia original', () => {
  const state = initial();
  state.teams.player.units[1].hp = 10;
  const before = structuredClone(state);
  let battle = executeTurn(state, [action('player-0', 'divine-boon', 'player-1')]).state;
  expect(state).toEqual(before);
  expect(battle.teams.player.energy).toBe(60);
  const hit = [action('enemy-0', 'simple-strike', 'player-1')];
  const saved = executeTurn(battle, hit);
  expect(saved.state.teams.player.units[1].hp).toBe(1);
  expect(saved.events.some((event) => event.kind === 'defeated')).toBe(false);
  battle = executeTurn(saved.state, []).state;
  expect(executeTurn(battle, hit).state.teams.player.units[1].hp).toBe(0);
});

it('dreno cura somente a vida perdida ao ativar Benção divina', () => {
  const state = initial();
  state.teams.player.units[1].hp = 10;
  state.teams.enemy.units[0].hp = 50;
  const protectedState = executeTurn(state, [action('player-0', 'divine-boon', 'player-1')]).state;
  const result = previewActions(protectedState, [action('enemy-0', 'soul-drain', 'player-1')]).state;
  expect(result.teams.player.units[1].hp).toBe(1);
  expect(result.teams.enemy.units[0].hp).toBe(59);
});

it('Benção também impede uma morte por sangramento e não acumula cargas ao reaplicar', () => {
  let state = initial();
  state.teams.player.units[1].hp = 3;
  state.teams.player.units[1].bleedTurns = 2;
  state.teams.player.units[1].bleedAmount = 5;
  state.teams.player.units[2].abilityIds = ['divine-boon'];
  state = executeTurn(state, [action('player-0', 'divine-boon', 'player-1'), action('player-2', 'divine-boon', 'player-1')]).state;
  state = executeTurn(state, []).state;
  expect(state.teams.player.units[1].hp).toBe(1);
  state = executeTurn(executeTurn(state, []).state, []).state;
  expect(state.teams.player.units[1].hp).toBe(0);
});

it('ressuscita com HP máximo e limpa a proteção antiga', () => {
  const state = initial();
  state.teams.player.units[1].hp = 0;
  state.teams.player.units[1].deathWardAbilityId = 'divine-boon';
  const restored = previewActions(state, [action('player-0', 'resurrection', 'player-1')]).state;
  expect(restored.teams.player.units[1].hp).toBe(100);
  expect(restored.teams.player.units[1].deathWardAbilityId).toBeNull();
});

it('Execução causa 50 de dano e exige 50 de energia', () => {
  const state = initial();
  state.teams.player.units[0].abilityIds = ['execution'];
  state.teams.player.energy = 49;
  expect(() => previewActions(state, [action('player-0', 'execution', 'enemy-0')])).toThrow(/Energia insuficiente/);
  state.teams.player.energy = 100;
  expect(abilities.execution).toBeDefined();
  const result = previewActions(state, [action('player-0', 'execution', 'enemy-0')]).state;
  expect(result.teams.enemy.units[0].hp).toBe(50);
  expect(result.teams.player.energy).toBe(50);
});

it('BOT considera a proteção contra morte e gera um combo válido', () => {
  const state = initial();
  state.activeSide = 'enemy';
  state.teams.enemy.units[0].abilityIds = ['divine-boon'];
  state.teams.enemy.units[1].hp = 15;
  state.teams.enemy.units.slice(1).forEach((u) => { u.abilityIds = []; });
  state.teams.player.units[0].abilityIds = ['execution'];
  state.teams.player.units.slice(1).forEach((u) => { u.abilityIds = []; });
  const actions = planEnemyTurn(state);
  expect(actions.some((a) => a.abilityId === 'divine-boon')).toBe(true);
  expect(() => previewActions(state, actions)).not.toThrow();
});
