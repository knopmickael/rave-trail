import { useEffect, useRef, useState } from 'react';
import type { GameCatalog, PlayerProgress } from '@game/contracts';
import type { UnitDefinition } from '@game/content/units';
import { SECOND_CAMPAIGN_UNIT_IDS } from '@game/content/second-campaign';
import { api, ApiError, gameDataCache } from '../../api';
import { CharacterArt } from './CharacterArt';
import { AbilityIcon } from './AbilityIcon';
import { TeamSlotDialog } from './TeamSlotDialog';
import { useI18n } from '../../i18n/LanguageProvider';
import './characters.css';

const hiddenUnitIds = new Set<string>(SECOND_CAMPAIGN_UNIT_IDS);

interface CharacterListProps {
  onBack: () => void;
  onSessionExpired: () => void;
  backLabel?: string;
}

export function CharacterList({ onBack, onSessionExpired, backLabel = 'Voltar ao menu principal' }: CharacterListProps) {
  const { t, text } = useI18n();
  const [progress, setProgress] = useState(() => gameDataCache.peek<PlayerProgress>('progress'));
  const [catalog, setCatalog] = useState(() => gameDataCache.peek<GameCatalog>('catalog'));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [teamError, setTeamError] = useState('');
  const [pendingUnit, setPendingUnit] = useState<UnitDefinition | null>(null);
  const slotDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    setError('');
    setProgress(gameDataCache.peek('progress'));
    setCatalog(gameDataCache.peek('catalog'));
    Promise.all([api.progress(), api.catalog()]).then(([saved, content]) => {
      if (active) { setProgress(saved); setCatalog(content); }
    })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os personagens.');
      });
    return () => { active = false; };
  }, [attempt, onSessionExpired]);

  const unlocked = new Set(progress?.unlockedUnitIds ?? []);
  const units = catalog?.units ?? [];
  const rosterUnits = units.filter((unit) => !hiddenUnitIds.has(unit.id));
  const selected = rosterUnits.find((unit) => unit.id === selectedId);

  function chooseSlot() {
    if (!selected || !unlocked.has(selected.id)) return;
    setTeamError('');
    setPendingUnit(selected);
    slotDialog.current?.showModal();
  }

  function closeSlotDialog() {
    if (busy) return;
    slotDialog.current?.close();
    setPendingUnit(null);
    setTeamError('');
  }

  async function saveSlot(slot: number, unitId: string | null) {
    if (busy) return;
    setBusy(true);
    setTeamError('');
    try {
      const team = await api.setTeamSlot(slot, unitId);
      setProgress((previous) => previous ? { ...previous, selectedTeam: team } : previous);
      slotDialog.current?.close();
      setPendingUnit(null);
    } catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired();
      else setTeamError(cause instanceof Error ? cause.message : 'Não foi possível salvar a equipe.');
    } finally { setBusy(false); }
  }

  return (
    <main className="roster-page">
      <header className="roster-header">
        <button type="button" className="back-arrow" onClick={onBack} aria-label={text(backLabel)}>
          <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
            <path d="M14 6 4 16l10 10M5 16h23" />
          </svg>
        </button>
        <h1>{t('Lista de personagens')}</h1>
      </header>

      {error ? (
        <section className="roster-state">
          <p role="alert">{text(error)}</p>
          <button className="fantasy-button compact" onClick={() => setAttempt((value) => value + 1)}>{t('Tentar novamente')}</button>
        </section>
      ) : !progress || !catalog ? <p className="roster-state" role="status">{t('Carregando personagens…')}</p> : (
        <div className="roster-layout">
          <section className="roster-library" aria-label={t('Catálogo de personagens')}>
            <div>
              <div className="face-grid">
                {rosterUnits.map((unit) => {
                  const available = unlocked.has(unit.id);
                  const name = text(unit.name);
                  return (
                    <div className={`face-wrap ${!available ? 'face-wrap--locked' : ''} ${selectedId === unit.id ? 'face-wrap--selected' : ''}`} key={unit.id}>
                      <button type="button" className="face-thumb"
                        aria-label={t(available ? 'Selecionar {name}' : 'Selecionar {name} — bloqueado', { name })}
                        aria-pressed={selectedId === unit.id}
                        onClick={() => setSelectedId(unit.id)}>
                        <CharacterArt unit={unit} face />
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="roster-team" aria-labelledby="team-title">
            <div className="team-panel">
              <h2 id="team-title">{t('Minha equipe')}</h2>
              <div className="team-slots">
                {Array.from({ length: 3 }, (_, index) => {
                  const member = units.find((unit) => unit.id === progress.selectedTeam[index] && unlocked.has(unit.id));
                  return <div className={`team-slot ${!member ? 'team-slot--empty' : ''}`} key={index}
                    role={member ? 'group' : 'img'} aria-label={member ? t('Slot {slot}: {name}', { slot: index + 1, name: text(member.name) }) : t('Slot {slot} vazio', { slot: index + 1 })}>
                    {member ? <><CharacterArt unit={member} face /><button type="button" className="team-remove" disabled={busy}
                      aria-label={t('Remover {name} do slot {slot}', { name: text(member.name), slot: index + 1 })} onClick={() => saveSlot(index, null)}>×</button></>
                      : <span className="empty-slot-cross" aria-hidden="true">×</span>}
                  </div>;
                })}
              </div>
              {teamError && !pendingUnit && <p className="feedback" role="alert">{text(teamError)}</p>}
            </div>
          </section>

          {selected && <CharacterDetails unit={selected} catalog={catalog} unlocked={unlocked.has(selected.id)} busy={busy} onAdd={chooseSlot} />}

          <TeamSlotDialog dialogRef={slotDialog} team={progress.selectedTeam} units={units}
            characterName={pendingUnit?.name ?? ''} busy={busy} error={pendingUnit ? teamError : ''}
            onChoose={(slot) => { if (pendingUnit) void saveSlot(slot, pendingUnit.id); }} onClose={closeSlotDialog} />
        </div>
      )}
    </main>
  );
}

export function CharacterDetails({ unit, catalog, unlocked, busy, onAdd, purchaseLabel, showLock = true }: {
  unit: UnitDefinition; catalog: GameCatalog; unlocked: boolean; busy: boolean; onAdd: () => void; purchaseLabel?: string; showLock?: boolean;
}) {
  const { t, text } = useI18n();
  const name = text(unit.name);
  const locked = !unlocked && showLock;
  return (
    <section className="character-details" aria-label={t('Detalhes de {name}', { name })}>
      <div className="character-display">
        <div className={`character-illustration ${locked ? 'character-illustration--locked' : ''}`} role="img" aria-label={t(locked ? 'Ilustração de corpo inteiro de {name} - bloqueada' : 'Ilustração de corpo inteiro de {name}', { name })}>
          <CharacterArt unit={unit} />
          {locked && <span className="character-lock" aria-hidden="true"><svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3"><rect x="10" y="21" width="28" height="21" rx="4" /><path d="M16 21v-7a8 8 0 0 1 16 0v7M24 29v6" /></svg></span>}
        </div>
        <div className="character-nameplate">
          <h2>{name}</h2>
        </div>
      </div>

      <div className="character-information">
        <div className="character-skills">
          <ul className="ability-list" aria-label={t('Habilidades de {name}', { name })}>
            {unit.abilityIds.map((id) => {
              const ability = catalog.abilities.find((entry) => entry.id === id);
              if (!ability) return null;
              return (
                <li className="ability-row" key={id}>
                  <AbilityIcon ability={ability} />
                  <div>
                    <h3>{text(ability.name)}</h3>
                    <p>{text(ability.description)}</p>
                    <span className="ability-cost">{t('Custo: {cost} de energia', { cost: ability.energyCost })}</span>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
        <section className="character-description" aria-labelledby="description-title">
          <h3 id="description-title">{t('Descrição')}</h3>
          <div className="description-copy"><p>{text(unit.description)}</p></div>
          {purchaseLabel
            ? <button type="button" className="fantasy-button compact team-add" disabled>{purchaseLabel}</button>
            : <button type="button" className="fantasy-button compact team-add" disabled={!unlocked || busy}
              title={!unlocked ? text(unit.unlock.description) : undefined} onClick={onAdd}>{t('Adicionar à equipe')}</button>}
        </section>
      </div>
    </section>
  );
}
