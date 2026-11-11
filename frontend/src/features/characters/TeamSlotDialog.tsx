import type { RefObject, ReactNode } from 'react';
import type { TeamSlots } from '@game/contracts';
import type { UnitDefinition } from '@game/content/units';
import { CharacterArt } from './CharacterArt';
import { useI18n } from '../../i18n/LanguageProvider';

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
  const { t, text } = useI18n();
  return <dialog ref={dialogRef} className="team-dialog" aria-labelledby="team-dialog-title"
    onCancel={(event) => { event.preventDefault(); if (!busy) onClose(); }}
    onClick={(event) => { if (event.target === event.currentTarget && !busy) onClose(); }}>
    <div className="team-dialog-content">
      <h2 id="team-dialog-title">{t('Escolher posição na equipe')}</h2>
      <p>{typeof description === 'string' ? text(description) : description ?? t('Escolha o slot para {name}. Se estiver ocupado, o personagem será substituído.', { name: text(characterName) })}</p>
      <div className="team-slot-choices">
        {team.map((id, slot) => {
          const occupant = units.find((unit) => unit.id === id);
          return <button key={slot} type="button" className="team-slot-choice" disabled={busy}
            aria-label={occupant ? t('Usar slot {slot} — substituir {name}', { slot: slot + 1, name: text(occupant.name) }) : t('Usar slot {slot} — vazio', { slot: slot + 1 })}
            onClick={() => onChoose(slot as 0 | 1 | 2)}>
            <span className="slot-choice-picture">{occupant ? <CharacterArt unit={occupant} face /> : <span aria-hidden="true">×</span>}</span>
            <strong>{t('Slot {slot}', { slot: slot + 1 })}</strong><small>{occupant ? text(occupant.name) : t('Vazio')}</small>
          </button>;
        })}
      </div>
      {error && <p className="feedback" role="alert">{text(error)}</p>}
      <button type="button" className="text-button" disabled={busy} onClick={onClose}>{t('Cancelar')}</button>
      {busy && <p role="status">{text(busyText)}</p>}
    </div>
  </dialog>;
}
