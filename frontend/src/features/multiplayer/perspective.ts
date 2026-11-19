import type { BattleRecord, BattleSide } from '@game/core/battle';

/** Presentation only: fighter IDs and command targets remain canonical. */
export function perspectiveBattle(battle: BattleRecord, mySide: BattleSide): BattleRecord {
  if (mySide === 'player') return battle;
  const swap = (side: BattleSide): BattleSide => side === 'player' ? 'enemy' : 'player';
  return { ...battle, state: { ...battle.state,
    teams: { player: battle.state.teams.enemy, enemy: battle.state.teams.player },
    activeSide: swap(battle.state.activeSide),
    status: battle.state.status === 'victory' ? 'defeat' : battle.state.status === 'defeat' ? 'victory' : battle.state.status,
  }, combo: battle.combo ? { ...battle.combo, side: swap(battle.combo.side) } : null,
  log: battle.log?.map((event) => ({ ...event,
    actionId: event.actionId?.replace(/^(player|enemy):/, (_, side: BattleSide) => `${swap(side)}:`),
    message: event.message.startsWith('Sua equipe inicia') ? event.message.replace('Sua equipe', 'Equipe inimiga')
      : event.message.startsWith('Equipe inimiga inicia') ? event.message.replace('Equipe inimiga', 'Sua equipe') : event.message,
  })) };
}
