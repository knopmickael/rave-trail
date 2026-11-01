import { damageBonus, executeTurn, previewActions, type BattleAction, type BattleSide, type BattleState, type Fighter } from './battle.js';

// Três combos: a jogada atual, a melhor resposta adversária e a continuação.
// A enumeração de cada combo é completa; apenas a árvore entre turnos é podada.
const ROOT_CHOICES = 12;
const REPLY_CHOICES = 6;
const WIN_SCORE = 1_000_000;

interface PlannedTurn {
  actions: BattleAction[];
  state: BattleState;
  score: number;
  tactics: string;
}

const other = (side: BattleSide): BattleSide => side === 'player' ? 'enemy' : 'player';
const nextTurn = (state: BattleState, side: BattleSide) => state.teams[side].turns + (state.activeSide === side ? 0 : 1);
const blocked = (state: BattleState, side: BattleSide, unit: Fighter) => (unit.attackBlockedExpiresAt ?? 0) > nextTurn(state, side);

function positionKey(state: BattleState) {
  return JSON.stringify([state.status, state.activeSide, state.turn, state.pendingTransformation?.unit.id,
    ...(['player', 'enemy'] as const).map((side) => {
      const team = state.teams[side];
      return [team.energy, team.turns, team.extraTurns, team.units.map((unit) =>
        [unit.unitId, unit.hp, unit.guardExpiresAt, unit.guardAbilityId, unit.guardReduction,
          unit.bleedTurns, unit.bleedAmount, unit.invulnerableExpiresAt, unit.attackBlockedExpiresAt,
          unit.damageBoostAmount, unit.damageBoostStartsAt, unit.damageBoostExpiresAt])];
    })]);
}

function attackPower(state: BattleState, side: BattleSide, unit: Fighter, energy: number) {
  if (unit.hp <= 0 || blocked(state, side, unit)) return 0;
  return Math.max(0, ...unit.abilityIds.map((id) => {
    const ability = state.abilities[id];
    if (!ability || ability.energyCost > energy) return 0;
    return ability.effects.reduce((total, effect) => total + (effect.kind === 'damage' || effect.kind === 'drain'
      ? effect.amount + damageBonus(unit, nextTurn(state, side))
      : effect.kind === 'bleed' ? effect.amount + damageBonus(unit, nextTurn(state, side)) : 0), 0);
  }));
}

function teamValue(state: BattleState, side: BattleSide) {
  const team = state.teams[side];
  const opponent = other(side);
  const enemies = state.teams[opponent];
  // Energia disponível no próximo ataque, incluindo retenções possíveis dos aliados.
  const restored = enemies.units.filter((unit) => unit.hp > 0).reduce((total, unit) => total + Math.max(0,
    ...unit.abilityIds.map((id) => (state.abilities[id]?.effects ?? []).reduce((sum, effect) =>
      sum + (effect.kind === 'restore-energy' ? effect.amount : 0), 0))), 0);
  const enemyEnergy = Math.min(100, enemies.energy + (state.activeSide === opponent ? 0 : 15) + restored);
  const attacks = enemies.units.map((unit) => attackPower(state, opponent, unit, enemyEnergy)).filter((power) => power > 0);
  const incoming = attacks.reduce((total, power) => total + power, 0);
  let value = Math.min(team.energy, 60) * .4 + Math.max(0, team.energy - 60) * .15 + team.extraTurns * 30;
  for (const unit of team.units) {
    if (unit.hp <= 0) continue;
    // Uma unidade viva também representa mais uma ação em cada turno futuro.
    value += 100 + unit.hp + 20 * Math.sqrt(unit.hp / unit.maxHp);
    const bonus = damageBonus(unit, nextTurn(state, side));
    if (bonus > 0 && attackPower(state, side, unit, 100) > 0) {
      const area = unit.abilityIds.some((id) => state.abilities[id]?.target === 'all-enemies'
        && state.abilities[id].effects.some((effect) => effect.kind === 'damage' || effect.kind === 'drain' || effect.kind === 'bleed'));
      const targets = area ? enemies.units.filter((enemy) => enemy.hp > 0).length : 1;
      value += bonus * targets * .6;
    }
    if (unit.guardExpiresAt != null && unit.guardExpiresAt > team.turns) {
      const guard = unit.guardAbilityId ? state.abilities[unit.guardAbilityId]?.effects.find((effect) => effect.kind === 'guard') : undefined;
      const reduction = unit.guardReduction ?? (guard?.kind === 'guard' ? guard.reduction : 10);
      value += Math.min(unit.hp, attacks.reduce((saved, power) => saved + Math.min(power, reduction), 0)) * .35;
    }
    if ((unit.invulnerableExpiresAt ?? 0) > nextTurn(state, opponent)) value += Math.min(unit.hp, incoming) * .5;
    if (blocked(state, side, unit)) {
      // Mede a ofensiva perdida sem considerar o próprio bloqueio duas vezes.
      const available = { ...unit, attackBlockedExpiresAt: null };
      value -= attackPower(state, side, available, Math.min(100, team.energy + 15)) * .4;
    }
    value -= Math.min(unit.hp, (unit.bleedAmount ?? 0) * (unit.bleedTurns ?? 0) * .65);
  }
  return value;
}

function evaluate(state: BattleState, side: BattleSide) {
  if (state.status !== 'active') {
    if (state.status === 'abandoned') return 0;
    return (state.status === 'victory') === (side === 'player') ? WIN_SCORE : -WIN_SCORE;
  }
  return teamValue(state, side) - teamValue(state, other(side));
}

/** Mantém boas alternativas de suporte, além dos melhores ataques e alvos. */
function shortlist(turns: readonly PlannedTurn[], limit: number) {
  const selected = turns.slice(0, Math.ceil(limit / 2));
  const tactics = new Set(selected.map((turn) => turn.tactics));
  for (const turn of turns) {
    if (selected.length >= limit) break;
    if (!tactics.has(turn.tactics)) { selected.push(turn); tactics.add(turn.tactics); }
  }
  for (const turn of turns) {
    if (selected.length >= limit) break;
    if (!selected.includes(turn)) selected.push(turn);
  }
  return selected.sort((a, b) => b.score - a.score || a.actions.length - b.actions.length);
}

/** Planejamento adversarial determinístico, usando as mesmas regras e recursos do jogador. */
export function planEnemyTurn(initial: BattleState): BattleAction[] {
  if (initial.status !== 'active') return [];
  const perspective = initial.activeSide;
  const turnCache = new Map<string, PlannedTurn[]>();

  function enumerate(state: BattleState) {
    const cacheKey = positionKey(state);
    const cached = turnCache.get(cacheKey);
    if (cached) return cached;
    const side = state.activeSide;
    const initialTeam = state.teams[side];
    const actions: BattleAction[] = [];
    const visited = new Set<string>();
    const positions = new Map<string, PlannedTurn>();

    function visit(simulated: BattleState, used: number) {
      const key = `${used}:${positionKey(simulated)}`;
      if (visited.has(key)) return;
      visited.add(key);
      // A troca real de turno inclui expiração de efeitos, sangramento, energia e transformação.
      const next = simulated.status === 'active' ? executeTurn(simulated, []).state : simulated;
      const nextKey = positionKey(next);
      const previous = positions.get(nextKey);
      if (!previous || actions.length < previous.actions.length) {
        const tactics = [...new Set(actions.flatMap((action) => state.abilities[action.abilityId].effects.map((effect) =>
          `${state.abilities[action.abilityId].target}:${effect.kind}`)))].sort().join(',');
        positions.set(nextKey, { actions: actions.slice(), state: next, score: evaluate(next, side), tactics });
      }
      if (simulated.status !== 'active') return;
      const team = simulated.teams[side];
      for (const [index, actor] of team.units.entries()) {
        if (used & (1 << index) || initialTeam.units[index].hp <= 0 || actor.hp <= 0) continue;
        for (const id of actor.abilityIds) {
          const ability = simulated.abilities[id];
          if (!ability || ability.energyCost > team.energy) continue;
          if (actor.attackBlockedExpiresAt != null && ability.effects.some((effect) =>
            effect.kind === 'damage' || effect.kind === 'drain' || effect.kind === 'bleed')) continue;
          const targets = ability.target === 'enemy' ? simulated.teams[other(side)].units.filter((unit) => unit.hp > 0)
            : ability.target === 'ally' ? team.units.filter((unit, targetIndex) => unit.hp > 0 && initialTeam.units[targetIndex].hp > 0)
              : ability.target === 'defeated-ally' ? team.units.filter((unit, targetIndex) => unit.hp === 0 && initialTeam.units[targetIndex].hp === 0)
                : [undefined];
          for (const target of targets) {
            const action = { actorId: actor.id, abilityId: id, ...(target ? { targetId: target.id } : {}) };
            actions.push(action);
            // Prefixos já válidos podem ser estendidos sem recalcular as ações anteriores.
            visit(previewActions(simulated, [action]).state, used | (1 << index));
            actions.pop();
          }
        }
      }
    }

    visit(state, 0);
    const ranked = [...positions.values()].sort((a, b) => b.score - a.score || a.actions.length - b.actions.length);
    // Só os estados da fronteira são guardados; os demais são descartados entre turnos.
    const choices = shortlist(ranked, ROOT_CHOICES);
    turnCache.set(cacheKey, choices);
    return choices;
  }

  function search(state: BattleState, depth: number, alpha: number, beta: number): number {
    if (state.status !== 'active') {
      const score = evaluate(state, perspective);
      return score + Math.sign(score) * depth * 1_000;
    }
    if (depth === 0) return evaluate(state, perspective);
    const choices = enumerate(state);
    // A última camada usa o melhor combo da enumeração completa, sem aprofundar outra resposta.
    if (depth === 1) return evaluate(choices[0].state, perspective);
    const maximizing = state.activeSide === perspective;
    let best = maximizing ? -Infinity : Infinity;
    for (const turn of shortlist(choices, REPLY_CHOICES)) {
      const score = search(turn.state, depth - 1, alpha, beta);
      best = maximizing ? Math.max(best, score) : Math.min(best, score);
      if (maximizing) alpha = Math.max(alpha, best);
      else beta = Math.min(beta, best);
      if (beta <= alpha) break;
    }
    return best;
  }

  const choices = enumerate(initial);
  // Não prepara suporte quando já existe um combo que encerra a partida.
  if (choices[0].score === WIN_SCORE) return choices[0].actions;
  let best = -Infinity;
  let selected: BattleAction[] = [];
  for (const turn of choices) {
    const score = search(turn.state, 2, best, Infinity);
    // Um corte alfa-beta pode devolver apenas um limite. Empates não substituem
    // a melhor linha já confirmada; a ordem inicial resolve-os por valor imediato.
    if (score > best) {
      best = score;
      selected = turn.actions;
    }
  }
  return selected;
}
