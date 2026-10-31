import type { AbilityDefinition } from '../content/abilities.js';
import type { UnitDefinition } from '../content/units.js';

export type BattleSide = 'player' | 'enemy';
export const TURN_DURATION_MS = 45_000;
export const BOT_THINK_MS = 7_000;
export interface Fighter {
  id: string;
  unitId: string;
  name: string;
  portrait: string;
  hp: number;
  maxHp: number;
  abilityIds: readonly string[];
  guardExpiresAt: number | null;
  guardAbilityId?: string | null;
}
export interface BattleTeam { units: Fighter[]; energy: number; turns: number; extraTurns: number }
export interface BattleState {
  teams: Record<BattleSide, BattleTeam>;
  abilities: Record<string, AbilityDefinition>;
  activeSide: BattleSide;
  turn: number;
  status: 'active' | 'victory' | 'defeat' | 'abandoned';
  pendingTransformation?: { actorId: string; unit: Pick<UnitDefinition, 'id' | 'name' | 'portrait' | 'maxHp' | 'abilityIds'> };
}
export interface BattleAction { actorId: string; abilityId: string; targetId?: string }
export interface BattleCombo { side: BattleSide; actions: BattleAction[] }
export interface BattleEvent {
  message: string;
  kind: 'damage' | 'heal' | 'energy' | 'guard' | 'miss' | 'turn' | 'defeated' | 'result' | 'transform';
  actionId?: string;
  actorId?: string;
  abilityId?: string;
  targetIds?: string[];
}
// Batalhas rápidas não pertencem a um encontro de campanha.
export interface BattleRecord {
  id: string; encounterId: string | null; revision: number; state: BattleState; log?: BattleEvent[];
  combo?: BattleCombo | null;
  turnDeadlineAt?: string | null;
  botActsAt?: string | null;
}
export interface BattleTurnResult { battle: BattleRecord; events: BattleEvent[] }
export class BattleRuleError extends Error {}
const other = (side: BattleSide): BattleSide => side === 'player' ? 'enemy' : 'player';
const clamp = (value: number, maximum: number) => Math.max(0, Math.min(maximum, value));

function copyState(state: BattleState): BattleState {
  return { ...state, teams: {
    player: { ...state.teams.player, units: state.teams.player.units.map((unit) => ({ ...unit })) },
    enemy: { ...state.teams.enemy, units: state.teams.enemy.units.map((unit) => ({ ...unit })) },
  } };
}

function heal(unit: Fighter, amount: number, events: BattleEvent[], metadata: Pick<BattleEvent, 'actionId' | 'actorId' | 'abilityId' | 'targetIds'>) {
  const recovered = Math.min(amount, unit.maxHp - unit.hp);
  unit.hp += recovered;
  events.push({ kind: 'heal', message: `${unit.name} recupera ${recovered} HP.`, ...metadata });
}

function result(state: BattleState, events: BattleEvent[]) {
  if (state.teams.enemy.units.every((unit) => unit.hp === 0)) state.status = 'victory';
  else if (state.teams.player.units.every((unit) => unit.hp === 0)) state.status = 'defeat';
  if (state.status !== 'active') events.push({ kind: 'result', message: state.status === 'victory' ? 'Vitória!' : 'Derrota.' });
}

function beginTurn(state: BattleState, side: BattleSide, events: BattleEvent[]) {
  state.activeSide = side;
  state.turn++;
  const team = state.teams[side];
  team.turns++;
  team.energy = clamp(team.energy + 15, 100);
  for (const unit of team.units) {
    if (unit.guardExpiresAt !== null && unit.guardExpiresAt <= team.turns) {
      unit.guardExpiresAt = null;
      unit.guardAbilityId = null;
      events.push({ kind: 'guard', message: `A Guarda de ${unit.name} expirou.` });
    }
  }
  // O duelo começa com Ravi base; após a primeira rodada adversária, a transformação
  // substitui a unidade no mesmo slot, preservando HP proporcional e efeitos ativos.
  if (side === 'player' && state.teams.enemy.turns > 0 && state.pendingTransformation) {
    const { actorId, unit } = state.pendingTransformation;
    const actor = team.units.find((entry) => entry.id === actorId);
    if (actor && actor.hp > 0) {
      const previousName = actor.name;
      actor.hp = Math.max(1, Math.ceil(actor.hp * unit.maxHp / actor.maxHp));
      actor.unitId = unit.id;
      actor.name = unit.name;
      actor.portrait = unit.portrait;
      actor.maxHp = unit.maxHp;
      actor.abilityIds = [...unit.abilityIds];
      delete state.pendingTransformation;
      events.push({ kind: 'transform', actorId: actor.id, targetIds: [actor.id],
        message: `${previousName} despertou como ${unit.name}!` });
    }
  }
  events.push({ kind: 'turn', message: `${side === 'player' ? 'Sua equipe' : 'Equipe inimiga'} inicia o turno ${state.turn}: +15 de energia (total ${team.energy}).` });
}

export function createBattle(player: readonly UnitDefinition[], enemy: readonly UnitDefinition[], abilities: readonly AbilityDefinition[]): BattleState {
  if (player.length < 1 || player.length > 3 || enemy.length < 1 || enemy.length > 3) throw new BattleRuleError('Equipes devem ter de uma a três unidades.');
  if (new Set(player.map((unit) => unit.id)).size !== player.length) throw new BattleRuleError('Não repita a mesma unidade na equipe.');
  const makeTeam = (units: readonly UnitDefinition[], side: BattleSide): BattleTeam => ({
    energy: 0, turns: 0, extraTurns: 0,
    units: units.map((unit, index) => ({ id: `${side}-${index}`, unitId: unit.id, name: unit.name, portrait: unit.portrait,
      hp: unit.maxHp, maxHp: unit.maxHp, abilityIds: [...unit.abilityIds], guardExpiresAt: null })),
  });
  const state: BattleState = { teams: { player: makeTeam(player, 'player'), enemy: makeTeam(enemy, 'enemy') },
    abilities: Object.fromEntries(abilities.map((ability) => [ability.id, { ...ability, effects: ability.effects.map((effect) => ({ ...effect })) }])),
    activeSide: 'player', turn: 0, status: 'active' };
  beginTurn(state, 'player', []);
  return state;
}

/** Simula a fila inteira sem trocar de turno. Usada pela previsão visual e pela resolução oficial. */
export function previewActions(initial: BattleState, actions: readonly BattleAction[]) {
  if (initial.status !== 'active') throw new BattleRuleError('Esta batalha já terminou.');
  const state = copyState(initial);
  const events: BattleEvent[] = [];
  const energyAfter: number[] = [];
  const side = state.activeSide;
  const team = state.teams[side];
  const enemy = state.teams[other(side)];
  const acted = new Set<string>();
  if (actions.length > team.units.length) throw new BattleRuleError('A fila tem mais ações do que personagens.');
  // A validade inicial dos alvos é verificada antes de qualquer ação, permitindo MISS por excesso de dano no combo.
  for (const action of actions) {
    const actor = initial.teams[side].units.find((unit) => unit.id === action.actorId);
    const ability = state.abilities[action.abilityId];
    if (!actor || actor.hp <= 0 || !actor.abilityIds.includes(action.abilityId) || !ability) throw new BattleRuleError('Personagem ou habilidade inválidos.');
    if (acted.has(actor.id)) throw new BattleRuleError('Cada personagem pode usar somente uma habilidade por turno.');
    acted.add(actor.id);
    if (ability.target === 'enemy' || ability.target === 'ally') {
      const targets = initial.teams[ability.target === 'enemy' ? other(side) : side].units;
      if (!targets.some((unit) => unit.id === action.targetId && unit.hp > 0)) throw new BattleRuleError('Escolha um alvo vivo e válido.');
    } else if (ability.target === 'defeated-ally') {
      if (!initial.teams[side].units.some((unit) => unit.id === action.targetId && unit.hp === 0)) throw new BattleRuleError('Escolha um aliado derrotado e válido.');
    } else if (ability.target === 'self') {
      if (action.targetId !== undefined && action.targetId !== actor.id) throw new BattleRuleError('Esta habilidade protege somente o próprio usuário.');
    } else if (action.targetId !== undefined) throw new BattleRuleError('Esta habilidade não exige um alvo individual.');
  }
  for (const [actionIndex, action] of actions.entries()) {
    if (state.status !== 'active') break;
    const actor = team.units.find((unit) => unit.id === action.actorId)!;
    const ability = state.abilities[action.abilityId];
    if (actor.hp <= 0) continue;
    if (team.energy < ability.energyCost) throw new BattleRuleError(`Energia insuficiente para ${ability.name}. Ajuste a ordem do combo.`);
    team.energy -= ability.energyCost;
    const actionId = `${side}:${state.turn}:${actionIndex}`;
    const metadata = { actionId, actorId: actor.id, abilityId: ability.id };
    const targets = ability.target === 'enemy' ? enemy.units.filter((unit) => unit.id === action.targetId)
      : ability.target === 'ally' || ability.target === 'defeated-ally' ? team.units.filter((unit) => unit.id === action.targetId)
        : ability.target === 'self' ? [actor]
          : ability.target === 'all-enemies' ? enemy.units.filter((unit) => unit.hp > 0)
            : ability.target === 'all-allies' ? team.units.filter((unit) => unit.hp > 0) : [];
    const targetIds = targets.map((target) => target.id);
    events.push({ kind: 'energy', message: `${actor.name}: ${ability.name} (−${ability.energyCost} energia).`, ...metadata, targetIds });
    if (targets.length === 1 && (ability.target === 'defeated-ally' ? targets[0].hp > 0 : targets[0].hp <= 0)) {
      events.push({ kind: 'miss', message: `${actor.name}: MISS — ${targets[0].name} ${ability.target === 'defeated-ally' ? 'já está vivo' : 'já foi derrotado'}. O custo foi mantido.`, ...metadata, targetIds });
    } else {
      for (const effect of ability.effects) {
        if (effect.kind === 'restore-energy') {
          const recovered = Math.min(effect.amount, 100 - team.energy);
          team.energy += recovered;
          events.push({ kind: 'energy', message: `${actor.name} recupera ${recovered} de energia para a equipe.`, ...metadata, targetIds });
        } else if (effect.kind === 'extra-turn') {
          team.extraTurns += effect.count;
          events.push({ kind: 'turn', message: `${actor.name} concede ${effect.count} turno adicional à equipe.`, ...metadata, targetIds });
        } else for (const target of targets) {
          const targetMetadata = { ...metadata, targetIds: [target.id] };
          if (effect.kind === 'revive') {
            if (target.hp === 0) {
              target.hp = Math.max(1, Math.floor(target.maxHp * effect.hpRatio));
              target.guardExpiresAt = null;
              target.guardAbilityId = null;
              events.push({ kind: 'heal', message: `${target.name} retorna dos mortos com ${target.hp} HP.`, ...targetMetadata });
            }
            continue;
          }
          if (target.hp <= 0) continue;
          if (effect.kind === 'damage' || effect.kind === 'drain') {
            const damage = Math.max(0, effect.amount - (target.guardExpiresAt === null ? 0 : 10));
            target.hp = clamp(target.hp - damage, target.maxHp);
            events.push({ kind: 'damage', message: `${target.name} recebe ${damage} de dano.`, ...targetMetadata });
            if (target.hp === 0) events.push({ kind: 'defeated', message: `${target.name} foi derrotado.`, ...targetMetadata });
            if (effect.kind === 'drain') heal(actor, effect.amount, events, metadata);
          } else if (effect.kind === 'heal') {
            heal(target, effect.amount, events, targetMetadata);
          } else if (effect.kind === 'guard') {
            const targetTeam = team.units.includes(target) ? team : enemy;
            target.guardExpiresAt = targetTeam.turns + effect.teamTurns;
            target.guardAbilityId = ability.id;
            events.push({ kind: 'guard', message: `Guarda aplicada em ${target.name}: −${effect.reduction} por golpe, por ${effect.teamTurns} turnos.`, ...targetMetadata });
          }
        }
      }
      result(state, events);
    }
    energyAfter.push(team.energy);
  }
  return { state, events, energyAfter };
}

export function executeTurn(initial: BattleState, actions: readonly BattleAction[]) {
  const outcome = previewActions(initial, actions);
  if (outcome.state.status === 'active') {
    const side = outcome.state.activeSide;
    const extra = outcome.state.teams[side].extraTurns > 0;
    if (extra) outcome.state.teams[side].extraTurns--;
    beginTurn(outcome.state, extra ? side : other(side), outcome.events);
  }
  return outcome;
}

/** Busca exata dos combos do turno: maior dano efetivo primeiro, suporte só em empate. */
export function planEnemyTurn(initial: BattleState): BattleAction[] {
  if (initial.status !== 'active') return [];
  const side = initial.activeSide;
  const opponent = other(side);
  const initialTeam = initial.teams[side];
  const initialEnemies = initial.teams[opponent].units;
  const actions: BattleAction[] = [];
  const visited = new Set<string>();
  let bestActions: BattleAction[] = [];

  function rank(state: BattleState): number[] {
    const team = state.teams[side];
    const enemies = state.teams[opponent].units;
    const damage = initialEnemies.reduce((total, unit, index) => total + unit.hp - enemies[index].hp, 0);
    const defeated = enemies.filter((unit, index) => initialEnemies[index].hp > 0 && unit.hp === 0).length;
    const revived = team.units.filter((unit, index) => initialTeam.units[index].hp === 0 && unit.hp > 0).length;
    const healing = team.units.reduce((total, unit, index) => total + Math.max(0, unit.hp - initialTeam.units[index].hp), 0);
    const protection = team.units.reduce((total, unit, index) => {
      const before = initialTeam.units[index];
      const oldTurns = before.hp > 0 ? Math.max(0, (before.guardExpiresAt ?? initialTeam.turns) - initialTeam.turns) : 0;
      const newTurns = unit.hp > 0 ? Math.max(0, (unit.guardExpiresAt ?? team.turns) - team.turns) : 0;
      return total + Math.max(0, newTurns - oldTurns);
    }, 0);
    // A comparação é lexicográfica: nenhum benefício de suporte compensa menos dano.
    // Se já pode encerrar a batalha, evita gastar ações antes do golpe final sem necessidade.
    return [damage, defeated, enemies.every((unit) => unit.hp === 0) ? -actions.length : 0,
      revived, team.extraTurns - initialTeam.extraTurns, healing, protection, team.energy, -actions.length];
  }

  let bestRank = rank(initial);
  function better(candidate: readonly number[]) {
    for (let index = 0; index < candidate.length; index++) {
      if (candidate[index] !== bestRank[index]) return candidate[index] > bestRank[index];
    }
    return false;
  }

  function search(simulated: BattleState, used: number) {
    const team = simulated.teams[side];
    // Atores/habilidades e contadores de turno não mudam durante uma prévia.
    // Prefixos com os mesmos atores usados e estado têm exatamente as mesmas continuações.
    const key = JSON.stringify([used, team.energy, team.extraTurns, simulated.status,
      ...(['player', 'enemy'] as const).map((teamSide) => simulated.teams[teamSide].units.map((unit) =>
        [unit.hp, unit.guardExpiresAt, unit.guardAbilityId]))]);
    if (visited.has(key)) return;
    visited.add(key);
    const candidate = rank(simulated);
    if (better(candidate)) { bestRank = candidate; bestActions = actions.slice(); }
    if (simulated.status !== 'active') return;

    for (const [index, actor] of team.units.entries()) {
      if (used & (1 << index) || initialTeam.units[index].hp <= 0 || actor.hp <= 0) continue;
      for (const id of actor.abilityIds) {
        const ability = simulated.abilities[id];
        if (!ability || ability.energyCost > team.energy) continue;
        const targets = ability.target === 'enemy' ? simulated.teams[opponent].units.filter((unit) => unit.hp > 0)
          : ability.target === 'ally' ? team.units.filter((unit, targetIndex) => unit.hp > 0 && initialTeam.units[targetIndex].hp > 0)
            : ability.target === 'defeated-ally' ? team.units.filter((unit, targetIndex) => unit.hp === 0 && initialTeam.units[targetIndex].hp === 0)
              : [undefined];
        for (const target of targets) {
          actions.push({ actorId: actor.id, abilityId: id, ...(target ? { targetId: target.id } : {}) });
          // Revalida o prefixo inteiro contra o estado original, pelas mesmas regras do jogador.
          const outcome = previewActions(initial, actions);
          search(outcome.state, used | (1 << index));
          actions.pop();
        }
      }
    }
  }

  search(initial, 0);
  return bestActions;
}

export function resolvePlayerTurn(initial: BattleState, actions: readonly BattleAction[]) {
  if (initial.activeSide !== 'player') throw new BattleRuleError('Aguarde o turno da sua equipe.');
  let outcome = executeTurn(initial, actions);
  const events = [...outcome.events];
  while (outcome.state.status === 'active' && outcome.state.activeSide === 'enemy') {
    outcome = executeTurn(outcome.state, planEnemyTurn(outcome.state));
    events.push(...outcome.events);
  }
  return { state: outcome.state, events };
}
