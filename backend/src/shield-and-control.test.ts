import { expect, it } from 'vitest';
import { abilities, type AbilityDefinition } from '@game/content/abilities.js';
import { units } from '@game/content/units.js';
import { createBattle, executeTurn, planEnemyTurn, previewActions, type BattleAction, type BattleState } from '@game/core/battle.js';

// Contratos explícitos permitem exercitar o motor antes de existir o catálogo novo.
const divine: AbilityDefinition = { id: 'divine-protection', name: 'Proteção divina', description: 'Escudo com cura por turno.',
  energyCost: 35, target: 'all-allies', icon: '/media/abilities/divine-protection.png',
  effects: [{ kind: 'guard', reduction: 10, teamTurns: 3, healPerTurn: 10 }] };
const retaliation: AbilityDefinition = { id: 'retaliation', name: 'Retaliação', description: 'Remove escudos.',
  energyCost: 30, target: 'all-enemies', icon: '/media/abilities/retaliation.png', effects: [{ kind: 'dispel-shields' }] };
// Existing battles keep the original control effect in their immutable snapshot.
const howl: AbilityDefinition = { ...abilities['wolfs-howl'], effects: [{ kind: 'damage', amount: 20 }, { kind: 'ability-block', teamTurns: 1 }] };
const action = (actorId: string, abilityId: string, targetId?: string): BattleAction => ({ actorId, abilityId, ...(targetId ? { targetId } : {}) });
function initial() {
  const state = createBattle(units.slice(0, 3), units.slice(3, 6), [...Object.values(abilities), divine, retaliation, howl]);
  for (const side of ['player', 'enemy'] as const) {
    state.teams[side].energy = 100;
    for (const unit of state.teams[side].units) unit.abilityIds = ['divine-protection', 'retaliation', 'wolfs-howl', 'retain-energy'];
  }
  return state;
}
const round = (state: BattleState) => executeTurn(executeTurn(state, []).state, []).state;

it('Proteção divina protege imediatamente e cura exatamente nos três próximos turnos da equipe', () => {
  const state = initial();
  state.teams.player.units.forEach((unit, index) => { unit.hp = [40, 95, 0][index]; });
  const before = structuredClone(state);
  let battle = executeTurn(state, [action('player-0', divine.id)]).state;
  expect(state).toEqual(before);
  expect(battle.teams.player.energy).toBe(65);
  expect(battle.teams.player.units.map((unit) => unit.hp)).toEqual([40, 95, 0]);
  battle.teams.enemy.units[0].abilityIds = ['simple-strike'];
  battle = executeTurn(battle, [action('enemy-0', 'simple-strike', 'player-0')]).state;
  // Dano 20 - escudo 10 + primeira cura 10.
  expect(battle.teams.player.units.map((unit) => unit.hp)).toEqual([40, 100, 0]);
  battle = round(battle);
  expect(battle.teams.player.units[0].hp).toBe(50);
  battle = round(battle);
  expect(battle.teams.player.units[0]).toMatchObject({ hp: 60, guardExpiresAt: null, guardHealPerTurn: null });
  battle = round(battle);
  expect(battle.teams.player.units[0].hp).toBe(60);
});

it('renovar Proteção divina não acumula cura e turnos extras consomem sua duração', () => {
  let battle = initial();
  battle.teams.player.units[0].hp = 20;
  battle = previewActions(battle, [action('player-0', divine.id), action('player-1', divine.id)]).state;
  battle.teams.player.extraTurns = 3;
  for (const hp of [30, 40, 50]) {
    battle = executeTurn(battle, []).state;
    expect(battle.teams.player.units[0].hp).toBe(hp);
  }
  expect(battle.teams.player.units[0].guardExpiresAt).toBeNull();
});

it('Retaliação remove todos os escudos e a cura vinculada sem apagar sangramento ou bônus de ataque', () => {
  const state = initial();
  state.teams.player.units[0].hp = 40;
  let battle = executeTurn(state, [action('player-0', divine.id)]).state;
  battle.teams.player.units[0].invulnerableExpiresAt = 99;
  battle.teams.player.units[0].bleedTurns = 2;
  battle.teams.player.units[0].bleedAmount = 5;
  battle.teams.player.units[0].damageBoostAmount = 10;
  battle.teams.player.units[0].damageBoostStartsAt = 1;
  battle.teams.player.units[0].damageBoostExpiresAt = 99;
  const outcome = previewActions(battle, [action('enemy-0', retaliation.id)]);
  expect(outcome.state.teams.enemy.energy).toBe(70);
  for (const unit of outcome.state.teams.player.units) {
    expect(unit).toMatchObject({ guardExpiresAt: null, guardAbilityId: null, guardReduction: null, guardHealPerTurn: null, invulnerableExpiresAt: null });
  }
  expect(outcome.state.teams.player.units[0]).toMatchObject({ bleedTurns: 2, damageBoostAmount: 10 });
  battle = executeTurn(outcome.state, []).state;
  expect(battle.teams.player.units[0].hp).toBe(35);
  // Pode aplicar um novo escudo após a remoção.
  expect(previewActions(battle, [action('player-0', divine.id)]).state.teams.player.units[0].guardExpiresAt).not.toBeNull();
});

it('uma Guarda comum substitui o escudo divino e interrompe a cura', () => {
  let battle = initial();
  battle.teams.player.units[0].hp = 40;
  battle.teams.player.units[0].abilityIds = [divine.id, 'guard'];
  battle = previewActions(battle, [action('player-1', divine.id), action('player-0', 'guard')]).state;
  battle = round(battle);
  expect(battle.teams.player.units[0].hp).toBe(40);
});

it('snapshot legado de Uivo bloqueia qualquer habilidade por um turno, mantendo aliados livres', () => {
  let battle = executeTurn(initial(), [action('player-0', howl.id, 'enemy-0')]).state;
  expect(battle.teams.enemy.units[0].hp).toBe(80);
  expect(battle.teams.player.energy).toBe(65);
  for (const id of [divine.id, retaliation.id, howl.id, 'retain-energy']) {
    expect(() => previewActions(battle, [action('enemy-0', id, id === howl.id ? 'player-0' : undefined)])).toThrow(/impedido de usar habilidades/);
  }
  expect(() => previewActions(battle, [action('enemy-1', 'retain-energy')])).not.toThrow();
  battle = round(battle);
  expect(() => previewActions(battle, [action('enemy-0', 'retain-energy')])).not.toThrow();
});

it('bloqueio total expira com turnos extras e não impede o avanço automático da batalha', () => {
  let battle = executeTurn(initial(), [action('player-0', howl.id, 'enemy-0')]).state;
  battle.teams.enemy.extraTurns = 1;
  expect(() => previewActions(battle, [action('enemy-0', 'retain-energy')])).toThrow(/impedido/);
  battle = executeTurn(battle, []).state;
  expect(() => previewActions(battle, [action('enemy-0', 'retain-energy')])).not.toThrow();
});

it('BOT ignora todas as ações do personagem bloqueado e planeja ações legais para seus aliados', () => {
  const battle = executeTurn(initial(), [action('player-0', howl.id, 'enemy-0')]).state;
  const planned = planEnemyTurn(battle);
  expect(planned.some((entry) => entry.actorId === 'enemy-0')).toBe(false);
  expect(() => previewActions(battle, planned)).not.toThrow();
});
