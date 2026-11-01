import type { RefObject, ReactNode } from 'react';
import type { TeamSlots } from '@game/contracts';
import type { UnitDefinition } from '@game/content/units';
import { CharacterArt } from './CharacterArt';

export function TeamSlotDialog({ dialogRef, team, units, characterName, busy, error, onChoose, onClose,
  description, busyText = 'Salvando equipe…' }: {
  dialogRef: RefObject<HTMLDialogElement | null>;
  team: TeamSlots;
  units: readonly UnitDefinition[];
  characterName: string;
  busy: boolean;
  error: string;
  onChoose: (slot: 0 | 1 | 2) => void;
  onClose: () => void;
  description?: ReactNode;
  busyText?: string;
}) {
  return <dialog ref={dialogRef} className="team-dialog" aria-labelledby="team-dialog-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="team-dialog-content">
      <h2 id="team-dialog-title">Escolher posição na equipe</h2>
      <p>{description ?? <>Escolha o slot para <strong>{characterName}</strong>. Se estiver ocupado, o personagem será substituído.</>}</p>
      <div className="team-slot-choices">
        {team.map((id, slot) => {
          const occupant = units.find((unit) => unit.id === id);
          return <button key={slot} type="button" className="team-slot-choice" disabled={busy}
            aria-label={`Usar slot ${slot + 1}${occupant ? ` — substituir ${occupant.name}` : ' — vazio'}`}
            onClick={() => onChoose(slot as 0 | 1 | 2)}>
            <span className="slot-choice-picture">{occupant ? <CharacterArt unit={occupant} face /> : <span aria-hidden="true">×</span>}</span>
            <strong>Slot {slot + 1}</strong><small>{occupant?.name ?? 'Vazio'}</small>
          </button>;
        })}
      </div>
      {error && <p className="feedback" role="alert">{error}</p>}
      <button type="button" className="text-button" disabled={busy} onClick={onClose}>Cancelar</button>
      {busy && <p role="status">{busyText}</p>}
    </div>
  </dialog>;
}
