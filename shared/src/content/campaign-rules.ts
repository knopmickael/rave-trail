import type { TeamSlots } from '../contracts.js';

export const FINAL_ENCOUNTER_ID = 'path-1-encounter-7';
export const FINAL_BATTLE_REQUIREMENT = 'É obrigatório possuir Ravi de Berdal na equipe. Ele será substituído por Ravi Berserk ao iniciar a batalha, mantendo os demais aliados.';
export const SECOND_FINAL_ENCOUNTER_ID = 'path-2-encounter-6';
export const OSIRIS_UNIT_ID = 'grande-rei-osiris';
export const OSIRIS_BATTLE_REQUIREMENT = 'Grande rei Osiris participará obrigatoriamente desta batalha. Escolha o slot que ele ocupará como aliado convidado.';

export function withOsiris(team: TeamSlots, slot: 0 | 1 | 2): TeamSlots {
  const selected = team.map((id) => id === OSIRIS_UNIT_ID ? null : id) as TeamSlots;
  selected[slot] = OSIRIS_UNIT_ID;
  return selected;
}

export const isFinalEncounter = (id: string | null | undefined) => id === FINAL_ENCOUNTER_ID || id === SECOND_FINAL_ENCOUNTER_ID;
