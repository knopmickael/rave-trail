import { describe, expect, it } from 'vitest';
import { abilities } from '@game/content/abilities.js';
import { STARTER_UNIT_IDS, units } from '@game/content/units.js';
import { createBattle, executeTurn, planEnemyTurn, previewActions, resolvePlayerTurn, type BattleAction } from '@game/core/battle.js';

const definition = (id: string) => units.find((unit) => unit.id === id)!;
const state = (player: readonly string[] = STARTER_UNIT_IDS) => createBattle(player.map(definition),
  ['road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base'].map(definition), Object.values(abilities));
const action = (actor: number, abilityId: string, targetId?: string): BattleAction => ({ actorId: `player-${actor}`, abilityId, ...(targetId ? { targetId } : {}) });

describe('motor determinístico de combate', () => {
  it('inicia com jogador, HP cheio e regeneração de 15 independente para cada equipe', () => {
    const initial = state();
    expect(initial.activeSide).toBe('player');
    expect(initial.teams.player.energy).toBe(15);
    expect(initial.teams.enemy.energy).toBe(0);
    expect(initial.teams.player.units.map((unit) => unit.hp)).toEqual([100, 100, 100]);
    const next = executeTurn(initial, []).state;
    expect(next.activeSide).toBe('enemy');
    expect(next.teams.enemy.energy).toBe(15);
  });

  it('aplica dano simples e custo correto', () => {
    const result = previewActions(state(), [action(0, 'simple-strike', 'enemy-0')]);
    expect(result.state.teams.enemy.units[0].hp).toBe(80);
    expect(result.state.teams.player.energy).toBe(0);
  });

  it('transforma Ravi após a primeira rodada inimiga, preservando HP, energia e efeitos sem mutar a entrada', () => {
    const initial = createBattle([definition('protagonist-main-base')], [definition('rival-b-final-mode')], Object.values(abilities));
    initial.pendingTransformation = { actorId: 'player-0', unit: definition('protagonist-main-transformed') };
    const enemyTurn = executeTurn(initial, [action(0, 'guard')]).state;
    expect(enemyTurn.teams.player.units[0].unitId).toBe('protagonist-main-base');
    expect(initial.teams.player.units[0].guardExpiresAt).toBeNull();
    enemyTurn.teams.enemy.energy = 45;
    const before = JSON.stringify(enemyTurn);
    const transformed = executeTurn(enemyTurn, [{ actorId: 'enemy-0', abilityId: 'soul-drain-plus' }]);
    expect(JSON.stringify(enemyTurn)).toBe(before);
    expect(transformed.state.pendingTransformation).toBeUndefined();
    expect(transformed.state.teams.player.units).toHaveLength(1);
    expect(transformed.state.teams.player.units[0]).toMatchObject({ id: 'player-0', unitId: 'protagonist-main-transformed',
      name: 'Ravi Berserk', hp: 80, maxHp: 100, guardExpiresAt: 3, abilityIds: definition('protagonist-main-transformed').abilityIds });
    expect(transformed.state.teams.player.energy).toBe(20);
    expect(transformed.events.filter((event) => event.kind === 'transform')).toHaveLength(1);
    expect(() => previewActions(transformed.state, [action(0, 'retain-energy')])).toThrow(/habilidade inválidos/);
    expect(previewActions(transformed.state, [action(0, 'retain-energy-plus')]).state.teams.player.energy).toBe(55);
    const next = resolvePlayerTurn(transformed.state, []);
    expect(next.events.some((event) => event.kind === 'transform')).toBe(false);
    expect(next.state.teams.player.units[0].unitId).toBe('protagonist-main-transformed');
  });

  it('aplica dano forte', () => {
    const initial = state(['road-raider-3-base']); initial.teams.player.energy = 30;
    expect(previewActions(initial, [action(0, 'strong-strike', 'enemy-0')]).state.teams.enemy.units[0].hp).toBe(70);
  });

  it('aplica especial de Ravi com 35 de dano', () => {
    const initial = state(); initial.teams.player.energy = 25;
    expect(previewActions(initial, [action(0, 'main-special', 'enemy-0')]).state.teams.enemy.units[0].hp).toBe(65);
  });

  it('cura 20 sem exceder o máximo e não revive um alvo derrotado', () => {
    const initial = state(['guardian-healer-male-base']); initial.teams.player.energy = 100;
    initial.teams.player.units[0].hp = 70;
    const outcome = previewActions(initial, [action(0, 'heal', 'player-0')]);
    expect(outcome.state.teams.player.units[0].hp).toBe(90);
    expect(outcome.state.teams.player.energy).toBe(65);
    initial.teams.player.units[0].hp = 0;
    expect(() => previewActions(initial, [action(0, 'heal', 'player-0')])).toThrow();
  });

  it('limita energia a 100 ao reter e ao regenerar', () => {
    const initial = state(); initial.teams.player.energy = 95; initial.teams.enemy.energy = 98;
    expect(previewActions(initial, [action(0, 'retain-energy')]).state.teams.player.energy).toBe(100);
    expect(executeTurn(initial, []).state.teams.enemy.energy).toBe(100);
  });

  it('reter energia recupera 20', () => {
    expect(previewActions(state(), [action(0, 'retain-energy')]).state.teams.player.energy).toBe(35);
  });

  it('reter muita energia é gratuito, recupera 35 e respeita o limite de 100', () => {
    const initial = state(['protagonist-main-transformed']);
    initial.teams.player.energy = 0;
    expect(previewActions(initial, [action(0, 'retain-energy-plus')]).state.teams.player.energy).toBe(35);
    initial.teams.player.energy = 90;
    expect(previewActions(initial, [action(0, 'retain-energy-plus')]).state.teams.player.energy).toBe(100);
  });

  it('Guarda protege somente o próprio usuário e rejeita outro aliado ou inimigo', () => {
    const initial = state(); initial.teams.player.energy = 100;
    const outcome = previewActions(initial, [action(0, 'guard')]);
    expect(outcome.state.teams.player.units.map((unit) => unit.guardExpiresAt)).toEqual([3, null, null]);
    expect(outcome.state.teams.player.units[0].guardAbilityId).toBe('guard');
    expect(outcome.state.teams.player.energy).toBe(90);
    expect(() => previewActions(initial, [action(0, 'guard', 'player-1')])).toThrow(/próprio usuário/);
    expect(() => previewActions(initial, [action(0, 'guard', 'enemy-0')])).toThrow(/próprio usuário/);
  });

  it.each([
    ['rival-b-base', 'soul-drain', 25, 35],
    ['rival-b-final-mode', 'soul-drain-plus', 30, 45],
  ] as const)('%s drena vida, debita energia, respeita Guarda e limita a cura', (unitId, abilityId, amount, cost) => {
    const initial = state([unitId]); initial.teams.player.energy = 100;
    if (abilityId === 'soul-drain-plus') initial.teams.enemy.units.slice(1).forEach((unit) => { unit.hp = 0; });
    initial.teams.player.units[0].hp = 30;
    const before = JSON.stringify(initial);
    const drain = (targetId?: string) => action(0, abilityId, targetId);
    const outcome = previewActions(initial, [drain(abilityId === 'soul-drain-plus' ? undefined : 'enemy-0')]);
    expect(outcome.state.teams.enemy.units[0].hp).toBe(100 - amount);
    expect(outcome.state.teams.player.units[0].hp).toBe(30 + amount);
    expect(outcome.state.teams.player.energy).toBe(100 - cost);
    expect(JSON.stringify(initial)).toBe(before);
    initial.teams.enemy.units[0].guardExpiresAt = 2;
    initial.teams.enemy.units[0].guardReduction = 15;
    initial.teams.player.units[0].hp = 40;
    const guarded = previewActions(initial, [drain(abilityId === 'soul-drain-plus' ? undefined : 'enemy-0')]).state;
    expect(guarded.teams.enemy.units[0].hp).toBe(115 - amount);
    expect(guarded.teams.player.units[0].hp).toBe(25 + amount);
    initial.teams.enemy.units[0].hp = 1;
    initial.teams.player.units[0].hp = 95;
    expect(previewActions(initial, [drain(abilityId === 'soul-drain-plus' ? undefined : 'enemy-0')]).state.teams.player.units[0].hp).toBe(100);
  });

  it('drenagem em alvo derrotado antes no combo gera MISS, cobra energia e não cura', () => {
    const initial = state(['protagonist-main-base', 'rival-b-base']); initial.teams.player.energy = 100;
    initial.teams.player.units[1].hp = 50; initial.teams.enemy.units[0].hp = 20;
    const outcome = previewActions(initial, [action(0, 'simple-strike', 'enemy-0'), action(1, 'soul-drain', 'enemy-0')]);
    expect(outcome.state.teams.player.units[1].hp).toBe(50);
    expect(outcome.state.teams.player.energy).toBe(50);
    expect(outcome.events.some((event) => event.kind === 'miss')).toBe(true);
  });

  it('Fúria devastadora causa 35 em área, desconta Guarda e ignora derrotados', () => {
    const initial = state(['protagonist-main-transformed']); initial.teams.player.energy = 40;
    initial.teams.enemy.units[1].guardExpiresAt = 2; initial.teams.enemy.units[2].hp = 0;
    const outcome = previewActions(initial, [action(0, 'fury-scream')]);
    expect(outcome.state.teams.enemy.units.map((unit) => unit.hp)).toEqual([65, 75, 0]);
    expect(outcome.state.teams.player.energy).toBe(0);
  });

  it('cura coletiva recupera 30 por aliado vivo sem exceder o máximo nem ressuscitar', () => {
    const initial = state(['legendary-beast-premium', ...STARTER_UNIT_IDS.slice(0, 2)]); initial.teams.player.energy = 45;
    initial.teams.player.units.forEach((unit, index) => { unit.hp = [40, 90, 0][index]; });
    const outcome = previewActions(initial, [action(0, 'heal-plus')]);
    expect(outcome.state.teams.player.units.map((unit) => unit.hp)).toEqual([70, 100, 0]);
    expect(outcome.state.teams.player.energy).toBe(0);
  });

  it('ressuscita somente aliado derrotado com metade do HP e sem Guarda antiga', () => {
    const initial = state(['legendary-beast-premium', STARTER_UNIT_IDS[0]]); initial.teams.player.energy = 50;
    initial.teams.player.units[1].hp = 0; initial.teams.player.units[1].guardExpiresAt = 3;
    const outcome = previewActions(initial, [action(0, 'resurrection', 'player-1')]);
    expect(outcome.state.teams.player.units[1].hp).toBe(50);
    expect(outcome.state.teams.player.units[1].guardExpiresAt).toBeNull();
    expect(outcome.state.teams.player.units[1].guardAbilityId).toBeNull();
    expect(outcome.state.teams.player.energy).toBe(0);
    expect(outcome.events.some((event) => event.message.includes('retorna dos mortos'))).toBe(true);
    expect(() => previewActions(initial, [action(0, 'resurrection', 'player-0')])).toThrow(/aliado derrotado/);
    expect(() => previewActions(initial, [action(0, 'resurrection', 'enemy-0')])).toThrow(/aliado derrotado/);
    expect(() => previewActions(initial, [action(0, 'resurrection')])).toThrow(/aliado derrotado/);
    initial.teams.player.energy = 49;
    expect(() => previewActions(initial, [action(0, 'resurrection', 'player-1')])).toThrow(/Energia insuficiente/);
  });

  it('uma segunda ressurreição do mesmo alvo no combo gera MISS e mantém o custo', () => {
    const initial = state(['legendary-beast-premium', STARTER_UNIT_IDS[0], STARTER_UNIT_IDS[1]]); initial.teams.player.energy = 100;
    initial.teams.player.units[1].hp = 0;
    initial.teams.player.units[2].abilityIds = ['retain-energy-plus', 'resurrection'];
    // Outra unidade de suporte permite duas ressurreições na mesma fila com energia suficiente.
    initial.teams.player.units[0].abilityIds = ['resurrection'];
    initial.abilities.resurrection = { ...initial.abilities.resurrection, energyCost: 40 };
    const outcome = previewActions(initial, [action(0, 'resurrection', 'player-1'), action(2, 'resurrection', 'player-1')]);
    expect(outcome.state.teams.player.units[1].hp).toBe(50);
    expect(outcome.state.teams.player.energy).toBe(20);
    expect(outcome.events.some((event) => event.kind === 'miss')).toBe(true);
    expect(() => previewActions(initial, [action(0, 'resurrection', 'player-1'), action(1, 'retain-energy')])).toThrow(/inválidos/);
  });

  it('valida recuperação intermediária na ordem do combo', () => {
    const initial = state(); initial.teams.player.energy = 30;
    const result = previewActions(initial, [action(0, 'simple-strike', 'enemy-0'), action(1, 'retain-energy'), action(2, 'secondary-special')]);
    expect(result.energyAfter).toEqual([15, 35, 5]);
    expect(() => previewActions(initial, [action(0, 'simple-strike', 'enemy-0'), action(2, 'secondary-special'), action(1, 'retain-energy')])).toThrow(/Energia insuficiente/);
  });

  it('não permite energia negativa, ação duplicada, habilidade alheia ou alvo inválido', () => {
    const initial = state(); initial.teams.player.energy = 10;
    expect(() => previewActions(initial, [action(0, 'simple-strike', 'enemy-0')])).toThrow(/Energia/);
    expect(initial.teams.player.energy).toBe(10);
    expect(() => previewActions(state(), [action(0, 'retain-energy'), action(0, 'retain-energy')])).toThrow(/somente uma/);
    expect(() => previewActions(state(), [action(0, 'heal', 'player-0')])).toThrow(/inválidos/);
    expect(() => previewActions(state(), [action(0, 'simple-strike', 'player-0')])).toThrow(/alvo/);
  });

  it('não permite ações de derrotados nem equipe vazia/duplicada', () => {
    const initial = state(); initial.teams.player.units[0].hp = 0;
    expect(() => previewActions(initial, [action(0, 'retain-energy')])).toThrow();
    expect(() => createBattle([], [definition('road-raider-1-base')], Object.values(abilities))).toThrow();
    expect(() => createBattle([definition(STARTER_UNIT_IDS[0]), definition(STARTER_UNIT_IDS[0])], [definition('road-raider-1-base')], Object.values(abilities))).toThrow(/repita/);
  });

  it('Guarda reduz cada golpe sem consumir um escudo', () => {
    const initial = state(); initial.teams.player.energy = 100;
    initial.teams.enemy.units[0].guardExpiresAt = 2;
    const result = previewActions(initial, [action(0, 'simple-strike', 'enemy-0'), action(1, 'simple-strike', 'enemy-0'), action(2, 'simple-strike', 'enemy-0')]);
    expect(result.state.teams.enemy.units[0].hp).toBe(70);
    expect(result.state.teams.enemy.units[0].guardExpiresAt).toBe(2);
  });

  it('Guarda expira na segunda volta da equipe protegida e reaplicação não acumula redução', () => {
    let initial = state(); initial.teams.player.energy = 100;
    initial.teams.player.units[0].guardExpiresAt = 3;
    initial = executeTurn(initial, [action(0, 'guard'), action(1, 'guard')]).state;
    expect(initial.teams.player.units[0].guardExpiresAt).toBe(3);
    initial = executeTurn(initial, [{ actorId: 'enemy-0', abilityId: 'simple-strike', targetId: 'player-0' }]).state;
    expect(initial.teams.player.units[0].hp).toBe(90);
    expect(initial.teams.player.units[0].guardExpiresAt).toBe(3);
    initial = executeTurn(initial, []).state;
    initial = executeTurn(initial, []).state;
    expect(initial.teams.player.turns).toBe(3);
    expect(initial.teams.player.units[0].guardExpiresAt).toBeNull();
  });

  it('aplica Guarda AOE e ataque AOE somente em vivos', () => {
    const initial = state(); initial.teams.player.energy = 100; initial.teams.enemy.units[2].hp = 0;
    const result = previewActions(initial, [action(1, 'female-special'), action(2, 'secondary-special')]).state;
    expect(result.teams.player.units.map((unit) => unit.guardExpiresAt)).toEqual([3, 3, 3]);
    expect(result.teams.player.units.map((unit) => unit.guardAbilityId)).toEqual(['female-special', 'female-special', 'female-special']);
    expect(result.teams.enemy.units.map((unit) => unit.hp)).toEqual([80, 80, 0]);
    result.activeSide = 'enemy'; result.teams.enemy.energy = 100;
    result.teams.enemy.units[0].abilityIds = ['secondary-special'];
    const protectedTeam = previewActions(result, [{ actorId: 'enemy-0', abilityId: 'secondary-special' }]).state;
    expect(protectedTeam.teams.player.units.map((unit) => unit.hp)).toEqual([90, 90, 90]);
  });

  it('gera MISS com custo integral ao atacar alvo derrotado anteriormente no combo', () => {
    const initial = state(); initial.teams.player.energy = 100; initial.teams.enemy.units[0].hp = 20;
    const result = previewActions(initial, [action(0, 'simple-strike', 'enemy-0'), action(1, 'simple-strike', 'enemy-0')]);
    expect(result.state.teams.player.energy).toBe(70);
    expect(result.events.some((event) => event.kind === 'miss')).toBe(true);
    expect(result.state.teams.enemy.units[1].hp).toBe(100);
  });

  it('encerra em vitória e não executa o restante da fila após o resultado', () => {
    const initial = state(); initial.teams.enemy.units.forEach((unit, index) => { unit.hp = index === 0 ? 20 : 0; });
    const result = executeTurn(initial, [action(0, 'simple-strike', 'enemy-0'), action(1, 'retain-energy')]);
    expect(result.state.status).toBe('victory');
    expect(result.state.teams.player.energy).toBe(0);
    expect(() => executeTurn(result.state, [])).toThrow(/terminou/);
  });

  it('encerra em derrota', () => {
    const initial = state(); initial.activeSide = 'enemy'; initial.teams.enemy.energy = 15;
    initial.teams.player.units.forEach((unit, index) => { unit.hp = index === 0 ? 20 : 0; });
    expect(executeTurn(initial, [{ actorId: 'enemy-0', abilityId: 'simple-strike', targetId: 'player-0' }]).state.status).toBe('defeat');
  });

  it('Turno extra termina a fila, regenera 15 e permite novas ações', () => {
    const initial = state(['passage-guardian-base']); initial.teams.player.energy = 50;
    const result = executeTurn(initial, [action(0, 'extra-turn')]).state;
    expect(result.activeSide).toBe('player');
    expect(result.teams.player.energy).toBe(25);
    expect(result.teams.player.turns).toBe(2);
    expect(() => executeTurn(result, [action(0, 'retain-energy')])).not.toThrow();
  });

  it('acumula turnos extras e conta-os para a duração da Guarda', () => {
    const initial = state(['passage-guardian-base', 'protagonist-secondary-base']); initial.teams.player.energy = 100;
    initial.teams.player.units[1].abilityIds = ['extra-turn'];
    initial.teams.player.units[0].guardExpiresAt = 3;
    const result = executeTurn(initial, [action(0, 'extra-turn'), action(1, 'extra-turn')]).state;
    expect(result.teams.player.extraTurns).toBe(1);
    const again = executeTurn(result, []).state;
    expect(again.activeSide).toBe('player');
    expect(again.teams.player.units[0].guardExpiresAt).toBeNull();
  });

  it('ciclo de Turno extra com duas retenções recupera toda a energia gasta', () => {
    const initial = state(['passage-guardian-base', 'protagonist-secondary-base', 'protagonist-female-base']); initial.teams.player.energy = 100;
    const result = executeTurn(initial, [action(0, 'extra-turn'), action(1, 'retain-energy'), action(2, 'retain-energy')]).state;
    expect(result.teams.player.energy).toBe(100);
  });

  it('IA é determinística, respeita energia/ações e combina ataque com cura para sustentar a equipe', () => {
    const initial = createBattle(STARTER_UNIT_IDS.map(definition), ['passage-guardian-base', 'guardian-healer-male-base', 'guardian-healer-female-base'].map(definition), Object.values(abilities));
    initial.activeSide = 'enemy'; initial.teams.enemy.energy = 100; initial.teams.enemy.units[0].hp = 30;
    const planned = planEnemyTurn(initial);
    expect(planned).toEqual(planEnemyTurn(initial));
    const outcome = previewActions(initial, planned).state;
    expect(initial.teams.player.units.reduce((sum, unit) => sum + unit.hp, 0)
      - outcome.teams.player.units.reduce((sum, unit) => sum + unit.hp, 0)).toBeGreaterThan(0);
    expect(planned.some((entry) => entry.abilityId === 'heal')).toBe(true);
    expect(outcome.teams.enemy.units[0].hp).toBeGreaterThan(initial.teams.enemy.units[0].hp);
    expect(new Set(planned.map((entry) => entry.actorId)).size).toBe(planned.length);
    expect(() => previewActions(initial, planned)).not.toThrow();
  });

  it('IA ressuscita um aliado e não agenda uma ação para ele no mesmo turno', () => {
    const initial = createBattle(STARTER_UNIT_IDS.map(definition), ['legendary-beast-premium', 'protagonist-main-base', 'road-raider-1-base'].map(definition), Object.values(abilities));
    initial.activeSide = 'enemy'; initial.teams.enemy.energy = 100; initial.teams.enemy.units[1].hp = 0;
    initial.teams.player.units.forEach((unit) => { unit.abilityIds = []; });
    const planned = planEnemyTurn(initial);
    expect(planned[0]).toEqual({ actorId: 'enemy-0', abilityId: 'resurrection', targetId: 'enemy-1' });
    expect(planned.some((entry) => entry.actorId === 'enemy-1')).toBe(false);
    expect(previewActions(initial, planned).state.teams.enemy.units[1].hp).toBe(50);
  });

  it('IA considera cura coletiva e drenagem de vida', () => {
    const initial = createBattle(STARTER_UNIT_IDS.map(definition), ['legendary-beast-premium', 'rival-b-base', 'road-raider-1-base'].map(definition), Object.values(abilities));
    initial.activeSide = 'enemy'; initial.teams.enemy.energy = 100;
    initial.teams.enemy.units.forEach((unit) => { unit.hp = 40; });
    const planned = planEnemyTurn(initial);
    expect(planned[0].abilityId).toBe('heal-plus');
    expect(planned.some((entry) => entry.abilityId === 'soul-drain')).toBe(true);
    expect(() => previewActions(initial, planned)).not.toThrow();
  });

  it('resolve a IA até devolver o turno ao jogador e não modifica definições nem estado de entrada', () => {
    const beforeDefinitions = JSON.stringify({ units, abilities });
    const initial = state();
    const before = JSON.stringify(initial);
    const result = resolvePlayerTurn(initial, [action(0, 'retain-energy'), action(1, 'retain-energy'), action(2, 'retain-energy')]);
    expect(result.state.activeSide).toBe('player');
    expect(result.state.turn).toBe(3);
    expect(JSON.stringify(initial)).toBe(before);
    expect(JSON.stringify({ units, abilities })).toBe(beforeDefinitions);
    expect(JSON.parse(JSON.stringify(result.state))).toEqual(result.state);
  });

  it('Corte rápido causa dano imediato e sangra por três turnos do alvo', () => {
    const initial = state(['jung-de-grimoria-ii']); initial.teams.player.energy = 100;
    let battle = executeTurn(initial, [action(0, 'quick-slash', 'enemy-0')]).state;
    expect(battle.teams.enemy.units[0].hp).toBe(70);
    expect(battle.teams.enemy.units[0]).toMatchObject({ bleedTurns: 2, bleedAmount: 10 });
    battle = executeTurn(battle, []).state;
    battle = executeTurn(battle, []).state;
    expect(battle.teams.enemy.units[0].hp).toBe(60);
    expect(battle.teams.enemy.units[0].bleedTurns).toBe(1);
    battle = executeTurn(battle, []).state;
    battle = executeTurn(battle, []).state;
    expect(battle.teams.enemy.units[0].hp).toBe(50);
    expect(battle.teams.enemy.units[0]).toMatchObject({ bleedTurns: 0, bleedAmount: 0 });
  });

  it('Vórtex negro atinge todos e bloqueia apenas ataques por um turno inimigo', () => {
    const initial = state(['rival-b-final-mode']); initial.teams.player.energy = 30;
    let battle = executeTurn(initial, [action(0, 'dark-vortex')]).state;
    expect(battle.teams.enemy.units.map((unit) => unit.hp)).toEqual([85, 85, 85]);
    expect(battle.teams.enemy.units.map((unit) => unit.attackBlockedExpiresAt)).toEqual([2, 2, 2]);
    const enemyAttack = [{ actorId: 'enemy-0', abilityId: 'simple-strike', targetId: 'player-0' }];
    expect(() => previewActions(battle, enemyAttack)).toThrow(/impedido de atacar/);
    battle = executeTurn(battle, [{ actorId: 'enemy-0', abilityId: 'retain-energy' }]).state;
    expect(battle.teams.enemy.units[0].attackBlockedExpiresAt).toBe(2);
    battle = executeTurn(battle, []).state;
    expect(battle.teams.enemy.units[0].attackBlockedExpiresAt).toBeNull();
    battle = executeTurn(battle, enemyAttack).state;
    expect(battle.teams.player.units[0].hp).toBe(80);
  });

  it('Invulnerabilidade anula o próximo turno inimigo e expira no seguinte', () => {
    const initial = state(['passage-guardian-base']); initial.teams.player.energy = 100;
    let battle = executeTurn(initial, [action(0, 'fast-move')]).state;
    expect(battle.teams.player.units[0].invulnerableExpiresAt).toBe(2);
    const enemyAttack = [{ actorId: 'enemy-0', abilityId: 'simple-strike', targetId: 'player-0' }];
    battle = executeTurn(battle, enemyAttack).state;
    expect(battle.teams.player.units[0].hp).toBe(100);
    battle = executeTurn(battle, []).state;
    expect(battle.teams.player.units[0].invulnerableExpiresAt).toBeNull();
    battle = executeTurn(battle, enemyAttack).state;
    expect(battle.teams.player.units[0].hp).toBe(80);
  });

  it('permite vencer o primeiro combate com HP/energia iniciais e uma estratégia adaptativa legal', () => {
    let battle = state();
    for (let turn = 0; turn < 40 && battle.status === 'active'; turn++) {
      battle = resolvePlayerTurn(battle, planEnemyTurn(battle)).state;
    }
    expect(battle.status).toBe('victory');
    expect(battle.teams.enemy.units.every((unit) => unit.hp === 0)).toBe(true);
    expect(battle.teams.player.units.some((unit) => unit.hp > 0)).toBe(true);
  }, 20_000);
});
