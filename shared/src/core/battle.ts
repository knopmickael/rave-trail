import type { AbilityDefinition } from '../content/abilities.js';
import type { UnitDefinition } from '../content/units.js';
import { planEnemyTurn } from './battle-ai.js';

export { planEnemyTurn };

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
  guardReduction?: number | null;
  bleedTurns?: number;
  bleedAmount?: number;
  invulnerableExpiresAt?: number | null;
  attackBlockedExpiresAt?: number | null;
  damageBoostAmount?: number;
  damageBoostStartsAt?: number | null;
  damageBoostExpiresAt?: number | null;
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

function isAttackAbility(ability: AbilityDefinition) {
  return ability.effects.some((effect) => effect.kind === 'damage' || effect.kind === 'drain' || effect.kind === 'bleed');
}

function guardReduction(state: BattleState, unit: Fighter) {
  if (typeof unit.guardReduction === 'number') return unit.guardReduction;
  const ability = unit.guardAbilityId ? state.abilities[unit.guardAbilityId] : undefined;
  const effect = ability?.effects.find((entry) => entry.kind === 'guard');
  return effect?.kind === 'guard' ? effect.reduction : 10;
}

export function damageBonus(unit: Fighter, teamTurns: number) {
  return unit.damageBoostStartsAt != null && unit.damageBoostExpiresAt != null
    && unit.damageBoostStartsAt <= teamTurns && unit.damageBoostExpiresAt > teamTurns ? unit.damageBoostAmount ?? 0 : 0;
}

function clearEffects(unit: Fighter) {
  unit.guardExpiresAt = null;
  unit.guardAbilityId = null;
  unit.guardReduction = null;
  unit.bleedTurns = 0;
  unit.bleedAmount = 0;
  unit.invulnerableExpiresAt = null;
  unit.attackBlockedExpiresAt = null;
  unit.damageBoostAmount = 0;
  unit.damageBoostStartsAt = null;
  unit.damageBoostExpiresAt = null;
}

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
      unit.guardReduction = null;
      events.push({ kind: 'guard', message: `A Guarda de ${unit.name} expirou.` });
    }
    if (unit.attackBlockedExpiresAt != null && unit.attackBlockedExpiresAt <= team.turns) {
      unit.attackBlockedExpiresAt = null;
      events.push({ kind: 'guard', message: `${unit.name} pode voltar a atacar.` });
    }
    if (unit.damageBoostExpiresAt != null && unit.damageBoostExpiresAt <= team.turns) {
      unit.damageBoostAmount = 0;
      unit.damageBoostStartsAt = null;
      unit.damageBoostExpiresAt = null;
      events.push({ kind: 'guard', message: `A Força interna de ${unit.name} expirou.` });
    }
  }
  // A invulnerabilidade protege contra o turno da equipe adversária; por isso,
  // seu prazo é contado no relógio dessa equipe e expira no início do turno dela.
  for (const unit of state.teams[other(side)].units) {
    if (unit.invulnerableExpiresAt != null && unit.invulnerableExpiresAt <= team.turns) {
      unit.invulnerableExpiresAt = null;
      events.push({ kind: 'guard', message: `A invulnerabilidade de ${unit.name} expirou.` });
    }
  }
  const bleeding = team.units.some((unit) => unit.hp > 0 && (unit.bleedTurns ?? 0) > 0);
  for (const unit of team.units) {
    if (unit.hp <= 0 || (unit.bleedTurns ?? 0) <= 0) continue;
    if (unit.invulnerableExpiresAt == null) {
      const damage = Math.min(unit.bleedAmount ?? 0, unit.hp);
      unit.hp -= damage;
      events.push({ kind: 'damage', message: `${unit.name} sofre ${damage} de dano de sangramento.`, targetIds: [unit.id] });
      if (unit.hp === 0) events.push({ kind: 'defeated', message: `${unit.name} foi derrotado.`, targetIds: [unit.id] });
    } else {
      events.push({ kind: 'guard', message: `${unit.name} está invulnerável: o sangramento não causa dano.`, targetIds: [unit.id] });
    }
    unit.bleedTurns = (unit.bleedTurns ?? 0) - 1;
    if (unit.bleedTurns <= 0) {
      unit.bleedTurns = 0;
      unit.bleedAmount = 0;
    }
  }
  if (bleeding) result(state, events);
  // Compatibilidade com partidas antigas que ainda possuem uma transformação pendente.
  // A substituição preserva o slot, o HP proporcional e os efeitos ativos.
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
      hp: unit.maxHp, maxHp: unit.maxHp, abilityIds: [...unit.abilityIds], guardExpiresAt: null, guardReduction: null,
      bleedTurns: 0, bleedAmount: 0, invulnerableExpiresAt: null, attackBlockedExpiresAt: null,
      damageBoostAmount: 0, damageBoostStartsAt: null, damageBoostExpiresAt: null })),
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
    if (actor.attackBlockedExpiresAt != null && isAttackAbility(ability)) {
      throw new BattleRuleError(`${actor.name} está impedido de atacar neste turno.`);
    }
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
              clearEffects(target);
              events.push({ kind: 'heal', message: `${target.name} retorna dos mortos com ${target.hp} HP.`, ...targetMetadata });
            }
            continue;
          }
          if (target.hp <= 0) continue;
          if (effect.kind === 'damage' || effect.kind === 'drain') {
            let appliedDamage = 0;
            if (target.invulnerableExpiresAt != null) {
              events.push({ kind: 'guard', message: `${target.name} está invulnerável e não recebe dano.`, ...targetMetadata });
            } else {
              const reduction = target.guardExpiresAt === null ? 0 : guardReduction(state, target);
              appliedDamage = Math.max(0, effect.amount + damageBonus(actor, team.turns) - reduction);
              target.hp = clamp(target.hp - appliedDamage, target.maxHp);
              events.push({ kind: 'damage', message: `${target.name} recebe ${appliedDamage} de dano.`, ...targetMetadata });
              if (target.hp === 0) events.push({ kind: 'defeated', message: `${target.name} foi derrotado.`, ...targetMetadata });
            }
            if (effect.kind === 'drain') heal(actor, appliedDamage, events, metadata);
          } else if (effect.kind === 'heal') {
            heal(target, effect.amount, events, targetMetadata);
          } else if (effect.kind === 'guard') {
            const targetTeam = team.units.includes(target) ? team : enemy;
            target.guardExpiresAt = targetTeam.turns + effect.teamTurns;
            target.guardAbilityId = ability.id;
            target.guardReduction = effect.reduction;
            events.push({ kind: 'guard', message: `Guarda aplicada em ${target.name}: −${effect.reduction} por golpe, por ${effect.teamTurns} turnos.`, ...targetMetadata });
          } else if (effect.kind === 'bleed') {
            target.bleedTurns = effect.turns;
            target.bleedAmount = effect.amount + damageBonus(actor, team.turns);
            events.push({ kind: 'damage', message: `${target.name} está sangrando: ${target.bleedAmount} de dano por ${effect.turns} turnos.`, ...targetMetadata });
          } else if (effect.kind === 'invulnerable') {
            const opposingTeam = state.teams[other(side)];
            target.invulnerableExpiresAt = opposingTeam.turns + 1 + effect.teamTurns;
            events.push({ kind: 'guard', message: `${target.name} ficará invulnerável no próximo turno inimigo.`, ...targetMetadata });
          } else if (effect.kind === 'attack-block') {
            const targetTeam = team.units.includes(target) ? team : enemy;
            target.attackBlockedExpiresAt = targetTeam.turns + 1 + effect.teamTurns;
            events.push({ kind: 'guard', message: `${target.name} não poderá atacar durante ${effect.teamTurns} turno(s).`, ...targetMetadata });
          } else if (effect.kind === 'damage-boost') {
            const targetTeam = team.units.includes(target) ? team : enemy;
            const alreadyActive = damageBonus(target, targetTeam.turns) > 0;
            target.damageBoostAmount = effect.amount;
            // Renovar o efeito não remove o bônus que já estiver ativo neste turno.
            if (!alreadyActive) target.damageBoostStartsAt = targetTeam.turns + 1;
            target.damageBoostExpiresAt = targetTeam.turns + 1 + effect.teamTurns;
            events.push({ kind: 'guard', message: `${target.name} recebe Força interna: +${effect.amount} de dano no próximo turno da equipe.`, ...targetMetadata });
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
