import { expect, it } from 'vitest';
import { abilities, type AbilityDefinition } from '@game/content/abilities.js';
import { units } from '@game/content/units.js';
import { createBattle, executeTurn, planEnemyTurn, previewActions, type BattleAction, type BattleState } from '@game/core/battle.js';

const fixtures: AbilityDefinition[] = [
  { id: 'hit', target: 'enemy', effects: [{ kind: 'damage', amount: 40 }] },
  { id: 'area', target: 'all-enemies', effects: [{ kind: 'damage', amount: 30 }] },
  { id: 'dot', target: 'enemy', effects: [{ kind: 'bleed', amount: 7, turns: 3 }] },
  { id: 'healing', target: 'ally', effects: [{ kind: 'heal', amount: 30 }] },
  { id: 'shield', target: 'ally', effects: [{ kind: 'guard', reduction: 10, teamTurns: 5, healPerTurn: 8 }] },
  { id: 'immunity', target: 'ally', effects: [{ kind: 'invulnerable', teamTurns: 1 }] },
  { id: 'leech', target: 'enemy', effects: [{ kind: 'drain', amount: 25 }] },
  { id: 'reflection', target: 'ally', effects: [{ kind: 'damage-reflection', percent: 30, teamTurns: 1 }] },
  { id: 'burning', target: 'enemy', effects: [{ kind: 'burn', teamTurns: 3 }] },
  { id: 'meditation', target: 'self', effects: [{ kind: 'concentration', teamTurns: 2 }] },
  { id: 'extra', target: 'team', effects: [{ kind: 'extra-turn', count: 1 }] },
  { id: 'revival', target: 'defeated-ally', effects: [{ kind: 'revive', hpRatio: 1 }] },
].map((a) => ({ name: a.id, description: a.id, energyCost: a.id === 'meditation' ? 45 : 0, icon: '/media/abilities/guard.jpg', ...a })) as AbilityDefinition[];

function battle() {
  const team = units.slice(0, 2);
  const state = createBattle(team, team, fixtures);
  for (const side of Object.values(state.teams)) for (const unit of side.units) unit.abilityIds = fixtures.map((a) => a.id);
  state.teams.player.energy = 100;
  state.teams.enemy.energy = 100;
  return state;
}
const action = (actorId: string, abilityId: string, targetId?: string): BattleAction => ({ actorId, abilityId, ...(targetId ? { targetId } : {}) });
const skip = (state: BattleState) => executeTurn(state, []).state;

it('publica o novo balanceamento e as cinco habilidades com seus contratos e assets', () => {
  expect(abilities['quick-slash']).toMatchObject({ energyCost: 35, effects: [{ kind: 'damage', amount: 25 }, { kind: 'bleed', amount: 5, turns: 3 }] });
  expect(abilities['wolfs-howl']).toMatchObject({ effects: [{ kind: 'damage', amount: 25 }, { kind: 'burn', teamTurns: 3 }] });
  expect(abilities['fury-scream']).toMatchObject({ energyCost: 60, effects: [{ kind: 'damage', amount: 45 }] });
  expect(abilities['damage-reflection']).toMatchObject({ energyCost: 35, target: 'ally', effects: [{ kind: 'damage-reflection', percent: 30, teamTurns: 1 }], icon: '/media/abilities/damage-reflection.png' });
  expect(abilities['deep-concentration']).toMatchObject({ energyCost: 45, target: 'self', effects: [{ kind: 'concentration', teamTurns: 2 }] });
  expect(abilities['dragons-roar']).toMatchObject({ energyCost: 35, target: 'enemy', effects: [{ kind: 'damage', amount: 25 }, { kind: 'ability-block', teamTurns: 1 }] });
  expect(abilities['seismic-explosion']).toMatchObject({ energyCost: 50, target: 'all-enemies', effects: [{ kind: 'damage', amount: 35 }] });
  expect(abilities['frozen-throne']).toMatchObject({ energyCost: 45, target: 'all-enemies', effects: [{ kind: 'attack-block', teamTurns: 2 }], icon: '/media/abilities/frozen-throne.png' });
});

it('queimadura bloqueia cura e novos escudos por exatamente três turnos da equipe alvo', () => {
  let state = battle(); state.teams.enemy.units[0].hp = 40;
  state = executeTurn(state, [action('player-0', 'burning', 'enemy-0')]).state;
  for (let turn = 1; turn <= 3; turn++) {
    expect(state.teams.enemy.turns).toBe(turn);
    for (const id of ['healing', 'shield', 'immunity']) {
      const outcome = previewActions(state, [action('enemy-1', id, 'enemy-0')]);
      expect(outcome.state.teams.enemy.units[0]).toMatchObject({ hp: 40, guardExpiresAt: null, invulnerableExpiresAt: null });
    }
    state = skip(skip(state));
  }
  expect(previewActions(state, [action('enemy-1', 'healing', 'enemy-0')]).state.teams.enemy.units[0].hp).toBe(70);
  expect(previewActions(state, [action('enemy-1', 'shield', 'enemy-0')]).state.teams.enemy.units[0].guardExpiresAt).not.toBeNull();
});

it('queimadura pausa a cura vinculada sem remover a guarda e impede cura por dreno', () => {
  let state = battle();
  Object.assign(state.teams.enemy.units[0], { hp: 40, guardExpiresAt: 20, guardReduction: 10, guardHealPerTurn: 8 });
  state = executeTurn(state, [action('player-0', 'burning', 'enemy-0')]).state;
  expect(state.teams.enemy.units[0]).toMatchObject({ hp: 40, guardExpiresAt: 20 });
  const drain = previewActions(state, [action('enemy-0', 'leech', 'player-0')]).state;
  expect(drain.teams.enemy.units[0].hp).toBe(40);
  expect(drain.teams.player.units[0].hp).toBe(75);
});

it('reflete 30% do dano direto real sem absorvê-lo nem mutar a previsão de entrada', () => {
  let state = battle();
  state.teams.player.units[0].guardExpiresAt = 20; state.teams.player.units[0].guardReduction = 10;
  state = executeTurn(state, [action('player-1', 'reflection', 'player-0')]).state;
  const before = JSON.stringify(state);
  const outcome = previewActions(state, [action('enemy-0', 'hit', 'player-0')]);
  expect(outcome.state.teams.player.units[0].hp).toBe(70);
  expect(outcome.state.teams.enemy.units[0].hp).toBe(91);
  expect(JSON.stringify(state)).toBe(before);
});

it('reflexão expira antes do segundo turno inimigo, incluindo turnos extras', () => {
  let state = executeTurn(battle(), [action('player-1', 'reflection', 'player-0')]).state;
  state.teams.enemy.extraTurns = 1;
  state = executeTurn(state, [action('enemy-0', 'hit', 'player-0')]).state;
  expect(state.activeSide).toBe('enemy'); expect(state.teams.enemy.turns).toBe(2);
  state = previewActions(state, [action('enemy-0', 'hit', 'player-0')]).state;
  expect(state.teams.player.units[0].hp).toBe(20);
  expect(state.teams.enemy.units[0].hp).toBe(88);
});

it('não reflete sangramento nem encadeia reflexões entre duas unidades protegidas', () => {
  let state = executeTurn(battle(), [action('player-1', 'reflection', 'player-0')]).state;
  const bleed = executeTurn(state, [action('enemy-0', 'dot', 'player-0')]).state;
  expect(bleed.teams.player.units[0].hp).toBe(93);
  expect(bleed.teams.enemy.units[0].hp).toBe(100);
  state = executeTurn(state, [action('enemy-1', 'reflection', 'enemy-0')]).state;
  const hit = previewActions(state, [action('player-0', 'hit', 'enemy-0')]).state;
  expect(hit.teams.enemy.units[0].hp).toBe(60);
  expect(hit.teams.player.units[0].hp).toBe(88);
});

it('reflexão respeita invulnerabilidade, limita overkill e arredonda para baixo', () => {
  let state = battle(); state.teams.player.units[0].hp = 5;
  state = executeTurn(state, [action('player-1', 'reflection', 'player-0')]).state;
  const fatal = previewActions(state, [action('enemy-0', 'hit', 'player-0')]).state;
  expect(fatal.teams.player.units[0].hp).toBe(0);
  expect(fatal.teams.enemy.units[0].hp).toBe(99);
  state.teams.player.units[0].invulnerableExpiresAt = 99;
  const immune = previewActions(state, [action('enemy-0', 'hit', 'player-0')]).state;
  expect(immune.teams.player.units[0].hp).toBe(5);
  expect(immune.teams.enemy.units[0].hp).toBe(100);
});

it('reflexão fatal interrompe os próximos golpes em área e não permite dreno ressuscitar o agressor', () => {
  let state = executeTurn(battle(), [action('player-1', 'reflection', 'player-0')]).state;
  state.teams.enemy.units[0].hp = 1;
  const area = previewActions(state, [action('enemy-0', 'area')]).state;
  expect(area.teams.player.units.map((u) => u.hp)).toEqual([70, 100]);
  expect(area.teams.enemy.units[0].hp).toBe(0);
  const drain = previewActions(state, [action('enemy-0', 'leech', 'player-0')]).state;
  expect(drain.teams.enemy.units[0].hp).toBe(0);
});

it('dano devolvido respeita a Guarda e a Invulnerabilidade do agressor', () => {
  const state = executeTurn(battle(), [action('player-1', 'reflection', 'player-0')]).state;
  Object.assign(state.teams.enemy.units[0], { guardExpiresAt: 20, guardReduction: 5 });
  expect(previewActions(state, [action('enemy-0', 'hit', 'player-0')]).state.teams.enemy.units[0].hp).toBe(93);
  state.teams.enemy.units[0].invulnerableExpiresAt = 99;
  expect(previewActions(state, [action('enemy-0', 'hit', 'player-0')]).state.teams.enemy.units[0].hp).toBe(100);
});

it('concentração bloqueia dois turnos futuros e completa a energia quando o usuário volta a agir', () => {
  let state = executeTurn(battle(), [action('player-0', 'meditation')]).state;
  expect(state.teams.player.energy).toBe(55);
  state.teams.player.energy = 0;
  for (let ownTurn = 2; ownTurn <= 3; ownTurn++) {
    state = skip(state);
    expect(state.teams.player.turns).toBe(ownTurn);
    expect(() => previewActions(state, [action('player-0', 'hit', 'enemy-0')])).toThrow(/habilidades/);
    expect(() => previewActions(state, [action('player-1', 'hit', 'enemy-0')])).not.toThrow();
    state = skip(state);
  }
  state = skip(state);
  expect(state.teams.player.energy).toBe(100);
  expect(() => previewActions(state, [action('player-0', 'hit', 'enemy-0')])).not.toThrow();
});

it('turnos extras contam para a concentração e o bot respeita o bloqueio', () => {
  let state = executeTurn(battle(), [action('player-0', 'meditation'), action('player-1', 'extra')]).state;
  expect(state.activeSide).toBe('player'); expect(state.teams.player.turns).toBe(2);
  for (const team of Object.values(state.teams)) for (const unit of team.units) unit.abilityIds = ['hit'];
  expect(planEnemyTurn(state).some((a) => a.actorId === 'player-0')).toBe(false);
  state = skip(skip(state));
  expect(() => previewActions(state, [action('player-0', 'hit', 'enemy-0')])).toThrow(/habilidades/);
});

it('morte e ressurreição cancelam a recompensa pendente de concentração', () => {
  let state = battle(); state.teams.player.units[0].hp = 1;
  state = executeTurn(state, [action('player-0', 'meditation')]).state;
  state.teams.player.energy = 0;
  state = executeTurn(state, [action('enemy-0', 'hit', 'player-0')]).state;
  state = executeTurn(state, [action('player-1', 'revival', 'player-0')]).state;
  state = skip(skip(skip(state)));
  expect(state.teams.player.turns).toBe(4);
  expect(state.teams.player.energy).toBe(45);
});

it('conclui concentração antes dos ticks de sangramento do novo turno', () => {
  let state = executeTurn(battle(), [action('player-0', 'meditation')]).state;
  state.teams.player.energy = 0;
  state = skip(skip(skip(state)));
  Object.assign(state.teams.player.units[0], { hp: 1, bleedTurns: 1, bleedAmount: 7 });
  state = skip(state);
  const outcome = executeTurn(state, []);
  expect(outcome.state.teams.player.turns).toBe(4);
  expect(outcome.state.teams.player.energy).toBe(100);
  expect(outcome.state.teams.player.units[0].hp).toBe(0);
});

it('Rugido congela por um turno e Trono de gelo bloqueia somente ataques por dois turnos', () => {
  const create = () => {
    const state = createBattle(units.slice(0, 2), units.slice(0, 2), Object.values(abilities));
    for (const team of Object.values(state.teams)) {
      team.energy = 100;
      for (const unit of team.units) unit.abilityIds = Object.keys(abilities);
    }
    return state;
  };
  let frozen = executeTurn(create(), [action('player-0', 'dragons-roar', 'enemy-0')]).state;
  expect(frozen.teams.enemy.units[0].hp).toBe(75);
  expect(() => previewActions(frozen, [action('enemy-0', 'retain-energy')])).toThrow(/habilidades/);
  frozen = skip(skip(frozen));
  expect(() => previewActions(frozen, [action('enemy-0', 'retain-energy')])).not.toThrow();
  let throne = executeTurn(create(), [action('player-0', 'frozen-throne')]).state;
  for (let turn = 1; turn <= 2; turn++) {
    expect(() => previewActions(throne, [action('enemy-0', 'simple-strike', 'player-0')])).toThrow(/atacar/);
    expect(() => previewActions(throne, [action('enemy-0', 'retain-energy')])).not.toThrow();
    throne = skip(skip(throne));
  }
  expect(() => previewActions(throne, [action('enemy-0', 'simple-strike', 'player-0')])).not.toThrow();
});
