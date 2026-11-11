import { useEffect, useRef, useState } from 'react';
import type { CampaignMapData, GameCatalog, PlayerProgress } from '@game/contracts';
import type { BattleRecord } from '@game/core/battle';
import { FINAL_BATTLE_REQUIREMENT, FINAL_ENCOUNTER_ID, SECOND_FINAL_ENCOUNTER_ID,
  OSIRIS_BATTLE_REQUIREMENT } from '@game/content/campaign-rules';
import { api, ApiError } from '../../api';
import { assets } from '../../assets';
import { CharacterArt } from '../characters/CharacterArt';
import { TeamSlotDialog } from '../characters/TeamSlotDialog';
import { CampaignMapBackground } from './CampaignMapBackground';
import { CampaignStory } from './CampaignStory';
import { useI18n } from '../../i18n/LanguageProvider';
import '../characters/characters.css';
import './campaign-map.css';

interface CampaignMapProps {
  campaignId: string;
  onBack: () => void;
  onSessionExpired: () => void;
  onBattleStarted: (battle: BattleRecord, title: string) => void;
}

export function CampaignMap({ campaignId, onBack, onSessionExpired, onBattleStarted }: CampaignMapProps) {
  const { t, text } = useI18n();
  const [map, setMap] = useState<CampaignMapData | null>(null);
  const [catalog, setCatalog] = useState<GameCatalog | null>(null);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [startError, setStartError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const drawer = useRef<HTMLDialogElement>(null);
  const slotDialog = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    let active = true;
    setError('');
    setMap(null);
    Promise.all([api.campaignMap(campaignId), api.catalog(), api.progress()]).then(([data, content, saved]) => {
      if (active) { setMap(data); setCatalog(content); setProgress(saved); }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired();
      else setError(cause instanceof Error ? cause.message : 'Não foi possível carregar o mapa.');
    });
    return () => { active = false; };
  }, [campaignId, attempt, onSessionExpired]);

  const selected = map?.encounters.find((entry) => entry.id === selectedId);
  const next = map?.encounters.find((entry) => entry.available && !entry.completed)?.id;
  const teamSize = progress?.selectedTeam.filter(Boolean).length ?? 0;
  const missingRavi = selected?.id === FINAL_ENCOUNTER_ID && !progress?.selectedTeam.includes('protagonist-main-base');
  const osirisBattle = selected?.id === SECOND_FINAL_ENCOUNTER_ID;
  function closeDrawer() { if (!busy) { drawer.current?.close(); setStartError(''); } }
  function closeSlotDialog() {
    if (busy) return;
    slotDialog.current?.close(); setStartError(''); drawer.current?.showModal();
  }

  function requestStart() {
    if (!selected || busy || !selected.available || missingRavi) return;
    if (osirisBattle) { drawer.current?.close(); setStartError(''); slotDialog.current?.showModal(); }
    else void startBattle();
  }

  async function startBattle(osirisSlot?: 0 | 1 | 2) {
    if (!selected || busy || !selected.available || missingRavi || osirisBattle && osirisSlot === undefined) return;
    setBusy(true);
    setStartError('');
    try {
      const battle = await (osirisBattle ? api.startBattle(selected.id, { osirisSlot: osirisSlot! }) : api.startBattle(selected.id));
      slotDialog.current?.close();
      onBattleStarted(battle, selected.title);
    }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired();
      else setStartError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a batalha.');
    } finally { setBusy(false); }
  }

  return (
    <main className="campaign-map-page">
      <div className="map-canvas" role="region" aria-label={t(campaignId === 'path-1' ? 'Mapa da primeira campanha' : 'Mapa da segunda campanha')}>
        <div className="map-world">
          {campaignId === 'path-1' ? <CampaignMapBackground />
            : <img className="campaign-map-image" src={assets.campaignMap} alt={t('Mapa da campanha')} draggable={false} />}
          {map?.encounters.map((entry) => (
            <button key={entry.id} type="button"
              className={`map-node ${entry.completed ? 'map-node--completed' : ''} ${entry.id === next ? 'map-node--next' : ''}`}
              style={{ left: `${entry.mapX}%`, top: `${entry.mapY}%` }} disabled={!entry.available}
              data-next={entry.id === next} aria-label={t(entry.available ? 'Batalha {number}: {title}' : 'Batalha {number}: {title} — bloqueada', { number: entry.position, title: text(entry.title) })}
              title={entry.available ? text(entry.title) : t('Vença a batalha {number} para continuar.', { number: entry.position - 1 })}
               onClick={() => { setSelectedId(entry.id); setStartError(''); drawer.current?.showModal(); }}>
              <span>{entry.position}</span>{entry.completed && <span className="map-completed-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <header className="map-header">
        <button className="campaign-back" onClick={onBack} aria-label={t('Voltar às campanhas')}><span aria-hidden="true">←</span></button>
        <div className="map-heading"><div className="map-title-row">
          <h1>{map ? text(map.campaign.title) : t(campaignId === 'path-1' ? 'Primeira campanha' : 'Segunda campanha')}</h1>
          {(campaignId === 'path-1' || campaignId === 'path-2') && <CampaignStory campaignId={campaignId} />}
        </div>
          {map && <p>{t('{count} de {total} batalhas vencidas', { count: map.encounters.filter((entry) => entry.completed).length, total: map.encounters.length })}</p>}
        </div>
      </header>
      {error && <section className="map-message"><p role="alert">{text(error)}</p><button className="fantasy-button compact" onClick={() => setAttempt((value) => value + 1)}>{t('Tentar novamente')}</button></section>}
      {!map && !error && <p className="map-message" role="status">{t('Carregando mapa…')}</p>}
      {progress && catalog && <section className="roster-team map-team" aria-labelledby="map-team-title">
        <div className="team-panel">
          <h2 id="map-team-title">{t('Minha equipe')}</h2>
          <div className="team-slots">
            {Array.from({ length: 3 }, (_, index) => {
              const member = catalog.units.find((unit) => unit.id === progress.selectedTeam[index] && progress.unlockedUnitIds.includes(unit.id));
              return <div className={`team-slot ${!member ? 'team-slot--empty' : ''}`} key={index}
                role={member ? 'group' : 'img'} aria-label={member ? t('Slot {slot}: {name}', { slot: index + 1, name: text(member.name) }) : t('Slot {slot} vazio', { slot: index + 1 })}>
                {member ? <CharacterArt unit={member} face /> : <span className="empty-slot-cross" aria-hidden="true">×</span>}
              </div>;
            })}
          </div>
        </div>
      </section>}

      <dialog ref={drawer} className="encounter-drawer" aria-labelledby="encounter-title"
        onCancel={(event) => { if (busy) event.preventDefault(); }}
        onClick={(event) => { if (event.target === event.currentTarget) closeDrawer(); }}>
        <div className="encounter-drawer-content">
          <header className="encounter-drawer-header">
            <div><span className="encounter-number">{t('Batalha {number}', { number: selected?.position ?? '' })}</span><h2 id="encounter-title">{text(selected?.title)}</h2></div>
            <button className="drawer-close" aria-label={t('Fechar detalhes da batalha')} disabled={busy} onClick={closeDrawer}>×</button>
          </header>
          {selected && catalog && <div className="encounter-drawer-body">
            <h3>{t('Adversários')}</h3>
            <div className="encounter-enemies">
              {selected.enemyUnitIds.map((id, slot) => {
                const unit = catalog.units.find((entry) => entry.id === id);
                return unit ? <figure key={`${id}-${slot}`}><img src={unit.portrait} alt={t('Retrato de {name}', { name: text(unit.name) })} /><figcaption>{text(unit.name)}</figcaption></figure> : null;
              })}
            </div>
             <h3>{t('História')}</h3><p className="encounter-story">{text(selected.story)}</p>
              {selected.id === FINAL_ENCOUNTER_ID && <p className="encounter-requirement">{text(FINAL_BATTLE_REQUIREMENT)}</p>}
          </div>}
          <footer className="encounter-drawer-footer">
            {startError && <p className="feedback" role="alert">{text(startError)}</p>}
            {!teamSize && !osirisBattle && <p>{t('Escolha pelo menos um personagem para sua equipe antes de iniciar.')}</p>}
            <button className="fantasy-button compact" disabled={busy || missingRavi || (!osirisBattle && !teamSize)} onClick={requestStart}>
              {t(busy ? 'Preparando batalha…' : 'Iniciar batalha')}
            </button>
          </footer>
        </div>
      </dialog>
      {progress && catalog && <TeamSlotDialog dialogRef={slotDialog} team={progress.selectedTeam} units={catalog.units}
        characterName="Grande rei Osiris" description={OSIRIS_BATTLE_REQUIREMENT} busy={busy} error={startError}
        busyText="Preparando batalha…" onChoose={(slot) => { void startBattle(slot); }} onClose={closeSlotDialog} />}
    </main>
  );
}
