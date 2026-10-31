import { expect, it } from 'vitest';
import { abilities } from '@game/content/abilities.js';
import { STARTER_UNIT_IDS, units } from '@game/content/units.js';
import { BattleRuleError, createBattle, executeTurn, planEnemyTurn, previewActions,
  type BattleAction, type BattleState, type Fighter } from '@game/core/battle.js';

const definition = (id: string) => units.find((unit) => unit.id === id)!;
function battle(enemyIds: readonly string[] = STARTER_UNIT_IDS, energy = 15) {
  const initial = executeTurn(createBattle(STARTER_UNIT_IDS.map(definition), enemyIds.map(definition), Object.values(abilities)), []).state;
  initial.teams.enemy.energy = energy;
  return initial;
}
function damage(initial: BattleState, actions: readonly BattleAction[]) {
  const opponent = initial.activeSide === 'enemy' ? 'player' : 'enemy';
  const outcome = previewActions(initial, actions).state;
  return initial.teams[opponent].units.reduce((total, unit, index) => total + unit.hp - outcome.teams[opponent].units[index].hp, 0);
}

it('retém energia antes do ataque em área para causar 60 em vez de gastar tudo no primeiro golpe de 20', () => {
  const initial = battle();
  const planned = planEnemyTurn(initial);
  expect(damage(initial, planned)).toBe(60);
  const areaIndex = planned.findIndex((action) => action.abilityId === 'secondary-special');
  expect(areaIndex).toBeGreaterThan(0);
  expect(planned.slice(0, areaIndex).some((action) => action.abilityId === 'retain-energy')).toBe(true);
  expect(damage(initial, [{ actorId: 'enemy-0', abilityId: 'simple-strike', targetId: 'player-0' }])).toBe(20);
});

it('encontra duas retenções em sequência quando nenhuma habilidade ofensiva é inicialmente pagável', () => {
  const initial = battle(STARTER_UNIT_IDS, 0);
  const planned = planEnemyTurn(initial);
  expect(planned.map((action) => action.abilityId)).toEqual(['retain-energy', 'retain-energy', 'secondary-special']);
  expect(damage(initial, planned)).toBe(60);
  expect(previewActions(initial, planned).energyAfter).toEqual([20, 40, 15]);
});

it('distribui a energia entre golpes baratos quando três ataques menores superam um ataque mais forte', () => {
  const initial = battle(STARTER_UNIT_IDS, 45);
  initial.teams.player.units.forEach((unit) => { unit.abilityIds = []; });
  initial.teams.enemy.units.forEach((unit) => { unit.abilityIds = ['simple-strike', 'main-special', 'guard', 'heal']; });
  const planned = planEnemyTurn(initial);
  expect(planned.map((action) => action.abilityId)).toEqual(['simple-strike', 'simple-strike', 'simple-strike']);
  expect(damage(initial, planned)).toBe(60);
  expect(damage(initial, [
    { actorId: 'enemy-0', abilityId: 'main-special', targetId: 'player-0' },
    { actorId: 'enemy-1', abilityId: 'simple-strike', targetId: 'player-0' },
  ])).toBe(50);
});

it('prioriza eliminar dois adversários e retirar suas ações futuras em vez de apenas maximizar dano', () => {
  const initial = battle(STARTER_UNIT_IDS, 45);
  initial.teams.enemy.units.forEach((unit) => { unit.abilityIds = ['simple-strike']; });
  initial.teams.player.units.forEach((unit, index) => { unit.hp = [5, 20, 100][index]; });
  const planned = planEnemyTurn(initial);
  const outcome = previewActions(initial, planned);
  expect(damage(initial, planned)).toBe(45);
  expect(outcome.state.teams.player.units.map((unit) => unit.hp)).toEqual([0, 0, 80]);
  expect(outcome.events.some((event) => event.kind === 'miss')).toBe(false);
});

it('evita a Guarda e concentra dano no adversário desprotegido mais ferido', () => {
  const initial = battle(['protagonist-main-base'], 15);
  initial.teams.enemy.units[0].abilityIds = ['simple-strike'];
  initial.teams.player.units.forEach((unit) => { unit.abilityIds = []; });
  initial.teams.player.units[0].guardExpiresAt = 3;
  initial.teams.player.units[2].hp = 90;
  const planned = planEnemyTurn(initial);
  expect(planned).toEqual([{ actorId: 'enemy-0', abilityId: 'simple-strike', targetId: 'player-2' }]);
  expect(damage(initial, planned)).toBe(20);
});

it('abre mão do dano imediato para ressuscitar um aliado que pode sobreviver e voltar a agir', () => {
  const initial = battle(['legendary-beast-premium', 'road-raider-1-base'], 60);
  initial.teams.enemy.units[1].hp = 0;
  initial.teams.enemy.units[0].abilityIds = ['simple-strike', 'resurrection'];
  initial.teams.player.units.forEach((unit, index) => { unit.hp = index === 0 ? 100 : 0; unit.abilityIds = ['simple-strike']; });
  const planned = planEnemyTurn(initial);
  expect(planned).toEqual([{ actorId: 'enemy-0', abilityId: 'resurrection', targetId: 'enemy-1' }]);
  expect(previewActions(initial, planned).state.teams.enemy.units[1].hp).toBe(50);
});

it('aproveita suporte quando o mesmo combo continua causando o dano máximo', () => {
  const initial = battle(['legendary-beast-premium', 'road-raider-1-base', 'protagonist-main-base'], 100);
  initial.teams.player.units.forEach((unit) => { unit.abilityIds = []; });
  initial.teams.enemy.units[2].hp = 0;
  const planned = planEnemyTurn(initial);
  const outcome = previewActions(initial, planned).state;
  expect(damage(initial, planned)).toBe(30);
  expect(planned.some((action) => action.abilityId === 'resurrection')).toBe(true);
  expect(outcome.teams.enemy.units[2].hp).toBe(50);
  expect(planned.some((action) => action.actorId === 'enemy-2')).toBe(false);
});

it('encerra a batalha com uma única ação se já pode vencer, sem preparar suporte desnecessário', () => {
  const initial = battle(['protagonist-main-base', 'guardian-healer-male-base', 'legendary-beast-premium'], 100);
  initial.teams.enemy.units.forEach((unit) => { unit.hp = 40; });
  initial.teams.player.units.forEach((unit, index) => { unit.hp = index === 0 ? 5 : 0; });
  const planned = planEnemyTurn(initial);
  expect(planned).toHaveLength(1);
  expect(damage(initial, planned)).toBe(5);
  expect(previewActions(initial, planned).state.status).toBe('defeat');
});

it('omite ações sem benefício, inclusive reter energia já no limite', () => {
  const initial = battle(['legendary-beast-premium'], 100);
  initial.teams.enemy.units[0].abilityIds = ['heal-plus', 'retain-energy-plus'];
  expect(planEnemyTurn(initial)).toEqual([]);
});

it.each(['victory', 'defeat', 'abandoned'] as const)('não planeja ações após %s', (status) => {
  const initial = battle();
  initial.status = status;
  expect(planEnemyTurn(initial)).toEqual([]);
});

it('é determinística e mantém o snapshot, suas habilidades e as definições imutáveis', () => {
  const initial = battle(['protagonist-main-transformed', 'rival-b-final-mode', 'legendary-beast-premium'], 100);
  initial.teams.enemy.units.forEach((unit, index) => { unit.hp = [35, 50, 75][index]; });
  const serialized = JSON.stringify(initial);
  const definitions = JSON.stringify({ units, abilities });
  function freeze(value: object) {
    for (const entry of Object.values(value)) if (entry && typeof entry === 'object') freeze(entry);
    Object.freeze(value);
  }
  freeze(initial);
  const planned = planEnemyTurn(initial);
  expect(planEnemyTurn(initial)).toEqual(planned);
  expect(new Set(planned.map((action) => action.actorId)).size).toBe(planned.length);
  expect(() => executeTurn(initial, planned)).not.toThrow();
  expect(JSON.stringify(initial)).toBe(serialized);
  expect(JSON.stringify({ units, abilities })).toBe(definitions);
});

// Referência independente: atribui uma opção (ou passar) a cada ator e só então
// enumera as permutações. Inclui alvos que podem gerar MISS; o motor valida tudo.
function referenceMaximum(initial: BattleState): number {
  const side = initial.activeSide;
  const opponent = side === 'enemy' ? 'player' : 'enemy';
  const choices = initial.teams[side].units.filter((unit) => unit.hp > 0).map((actor) => {
    const options: (BattleAction | null)[] = [null];
    for (const abilityId of actor.abilityIds) {
      const ability = initial.abilities[abilityId];
      if (!ability) continue;
      let targets: (Fighter | undefined)[] = [undefined];
      if (ability.target === 'enemy') targets = initial.teams[opponent].units.filter((unit) => unit.hp > 0);
      if (ability.target === 'ally') targets = initial.teams[side].units.filter((unit) => unit.hp > 0);
      if (ability.target === 'defeated-ally') targets = initial.teams[side].units.filter((unit) => unit.hp === 0);
      for (const target of targets) options.push({ actorId: actor.id, abilityId, ...(target ? { targetId: target.id } : {}) });
    }
    return options;
  });
  let maximum = 0;
  function permutations(remaining: readonly BattleAction[], ordered: BattleAction[]) {
    if (!remaining.length) {
      try { maximum = Math.max(maximum, damage(initial, ordered)); }
      catch (error) { if (!(error instanceof BattleRuleError)) throw error; }
      return;
    }
    for (const [index, action] of remaining.entries()) permutations(remaining.filter((_, position) => position !== index), [...ordered, action]);
  }
  function assignments(index: number, selected: BattleAction[]) {
    if (index === choices.length) { permutations(selected, []); return; }
    for (const option of choices[index]) assignments(index + 1, option ? [...selected, option] : selected);
  }
  assignments(0, []);
  return maximum;
}

it('mantém combos legais e aproveita vitórias imediatas em diferentes equipes, energias, HPs e proteções', () => {
  const setups = [STARTER_UNIT_IDS, ['road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base'],
    ['passage-guardian-base', 'guardian-healer-male-base', 'guardian-healer-female-base'],
    ['protagonist-main-transformed', 'rival-b-final-mode', 'legendary-beast-premium']];
  let finishes = 0;
  for (const [setupIndex, setup] of setups.entries()) {
    for (const energy of [0, 15, 30, 45, 100]) {
      const initial = battle(setup, energy);
      initial.teams.player.units.forEach((unit, index) => {
        unit.hp = (energy === 100 ? [5, 15, 20] : [5, 35, 100])[(index + setupIndex) % 3];
        if ((index + energy) % 2 === 0) unit.guardExpiresAt = 3;
      });
      initial.teams.enemy.units.forEach((unit, index) => { unit.hp = [40, 70, setupIndex % 2 ? 0 : 100][index]; });
      const planned = planEnemyTurn(initial);
      const outcome = previewActions(initial, planned);
      expect(outcome.events.some((event) => event.kind === 'miss')).toBe(false);
      expect(outcome.energyAfter.every((value) => value >= 0 && value <= 100)).toBe(true);
      expect(new Set(planned.map((action) => action.actorId)).size).toBe(planned.length);
      const remainingHp = initial.teams.player.units.reduce((total, unit) => total + unit.hp, 0);
      if (referenceMaximum(initial) === remainingHp) {
        expect(outcome.state.status).toBe('defeat');
        finishes++;
      }
    }
  }
  expect(finishes).toBeGreaterThan(0);
}, 15_000);

it('usa o lado ativo corretamente, inclusive ao simular um combo da equipe do jogador', () => {
  const initial = createBattle(STARTER_UNIT_IDS.map(definition), ['road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base'].map(definition), Object.values(abilities));
  const planned = planEnemyTurn(initial);
  expect(planned.every((action) => action.actorId.startsWith('player-'))).toBe(true);
  expect(damage(initial, planned)).toBe(referenceMaximum(initial));
});

function duel(abilityIds: string[], hp: number, energy = 100) {
  const initial = battle(['protagonist-main-base'], energy);
  initial.teams.enemy.units[0].abilityIds = abilityIds;
  initial.teams.enemy.units[0].hp = hp;
  initial.teams.player.units.forEach((unit, index) => { unit.hp = index === 0 ? 100 : 0; unit.abilityIds = ['main-special']; });
  initial.teams.player.energy = 100;
  return initial;
}

it.each(['heal', 'guard', 'fast-move'])('usa %s quando atacar deixaria o último combatente morrer na resposta', (defense) => {
  const initial = duel(['simple-strike', defense], defense === 'guard' ? 25 : 20);
  const planned = planEnemyTurn(initial);
  expect(planned.map((action) => action.abilityId)).toEqual([defense]);
  const next = executeTurn(initial, planned).state;
  const counter = executeTurn(next, [{ actorId: 'player-0', abilityId: 'main-special', targetId: 'enemy-0' }]).state;
  expect(counter.status).toBe('active');
  expect(counter.teams.enemy.units[0].hp).toBeGreaterThan(0);
});

it('considera o dano futuro do sangramento em vez de escolher apenas o golpe de maior impacto', () => {
  const initial = duel(['main-special', 'quick-slash'], 100);
  initial.teams.player.units[0].abilityIds = [];
  expect(planEnemyTurn(initial)).toEqual([{ actorId: 'enemy-0', abilityId: 'quick-slash', targetId: 'player-0' }]);
});

it('troca dano em área por bloqueio de ataques quando isso impede uma derrota no contra-ataque', () => {
  const initial = battle(['rival-b-final-mode'], 100);
  initial.teams.enemy.units[0].hp = 30;
  initial.teams.enemy.units[0].abilityIds = ['secondary-special', 'dark-vortex'];
  initial.teams.player.units.forEach((unit) => { unit.abilityIds = ['main-special']; });
  initial.teams.player.energy = 100;
  const planned = planEnemyTurn(initial);
  expect(planned).toEqual([{ actorId: 'enemy-0', abilityId: 'dark-vortex' }]);
  const next = executeTurn(initial, planned).state;
  expect(next.teams.player.units.every((unit) => unit.attackBlockedExpiresAt != null)).toBe(true);
  expect(planEnemyTurn(next).some((action) => action.abilityId === 'main-special')).toBe(false);
});

it('planeja um turno extra para vencer antes de uma resposta adversária letal', () => {
  const initial = battle(['passage-guardian-base', 'road-raider-1-base'], 55);
  initial.teams.enemy.units.forEach((unit) => { unit.hp = 20; });
  initial.teams.enemy.units[0].abilityIds = ['extra-turn'];
  initial.teams.enemy.units[1].abilityIds = ['simple-strike'];
  initial.teams.player.units.forEach((unit, index) => { unit.hp = index === 0 ? 40 : 0; unit.abilityIds = ['fury-scream']; });
  initial.teams.player.energy = 100;
  const planned = planEnemyTurn(initial);
  expect(planned.some((action) => action.abilityId === 'extra-turn')).toBe(true);
  const next = executeTurn(initial, planned).state;
  expect(next.activeSide).toBe('enemy');
  expect(executeTurn(next, planEnemyTurn(next)).state.status).toBe('defeat');
});

it('usa suporte enquanto seus ataques estão bloqueados e não desperdiça golpes em alvos invulneráveis', () => {
  const initial = duel(['main-special', 'retain-energy', 'heal'], 50, 30);
  initial.teams.enemy.units[0].attackBlockedExpiresAt = initial.teams.enemy.turns + 2;
  const planned = planEnemyTurn(initial);
  expect(planned.some((action) => action.abilityId === 'main-special')).toBe(false);
  expect(() => executeTurn(initial, planned)).not.toThrow();
  initial.teams.enemy.units[0].attackBlockedExpiresAt = null;
  initial.teams.player.units[0].invulnerableExpiresAt = initial.teams.enemy.turns + 2;
  expect(planEnemyTurn(initial).some((action) => action.abilityId === 'main-special')).toBe(false);
});
