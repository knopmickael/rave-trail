import { useEffect, useRef, useState } from 'react';
import type { CampaignMapData, GameCatalog, PlayerProgress } from '@game/contracts';
import type { BattleRecord } from '@game/core/battle';
import { FINAL_BATTLE_REQUIREMENT, FINAL_ENCOUNTER_ID } from '@game/content/campaign-rules';
import { api, ApiError } from '../../api';
import { assets } from '../../assets';
import { CharacterArt } from '../characters/CharacterArt';
import { CampaignMapBackground } from './CampaignMapBackground';
import '../characters/characters.css';
import './campaign-map.css';

interface CampaignMapProps {
  campaignId: string;
  onBack: () => void;
  onSessionExpired: () => void;
  onBattleStarted: (battle: BattleRecord, title: string) => void;
}

export function CampaignMap({ campaignId, onBack, onSessionExpired, onBattleStarted }: CampaignMapProps) {
  const [map, setMap] = useState<CampaignMapData | null>(null);
  const [catalog, setCatalog] = useState<GameCatalog | null>(null);
  const [progress, setProgress] = useState<PlayerProgress | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [startError, setStartError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const canvas = useRef<HTMLDivElement>(null);
  const drawer = useRef<HTMLDialogElement>(null);

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

  useEffect(() => {
    const viewport = canvas.current;
    const next = viewport?.querySelector<HTMLElement>('[data-next="true"]');
    if (viewport && next && viewport.scrollWidth > viewport.clientWidth) {
      viewport.scrollLeft = Math.max(0, next.offsetLeft - viewport.clientWidth / 2);
      viewport.scrollTop = Math.max(0, next.offsetTop - viewport.clientHeight / 2);
    }
  }, [map]);

  const selected = map?.encounters.find((entry) => entry.id === selectedId);
  const next = map?.encounters.find((entry) => entry.available && !entry.completed)?.id;
  const teamSize = progress?.selectedTeam.filter(Boolean).length ?? 0;
  const missingRavi = selected?.id === FINAL_ENCOUNTER_ID && !progress?.selectedTeam.includes('protagonist-main-base');
  function closeDrawer() { if (!busy) { drawer.current?.close(); setStartError(''); } }

  async function startBattle() {
    if (!selected || busy || !selected.available || missingRavi) return;
    setBusy(true);
    setStartError('');
    try { onBattleStarted(await api.startBattle(selected.id), selected.title); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired();
      else setStartError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a batalha.');
    } finally { setBusy(false); }
  }

  return (
    <main className="campaign-map-page">
      <div className="map-canvas" ref={canvas} role="region" aria-label="Mapa da primeira campanha" tabIndex={0}>
        <div className="map-world">
          {campaignId === 'path-1' ? <CampaignMapBackground />
            : <img className="campaign-map-image" src={assets.campaignMap} alt="Mapa da campanha" draggable={false} />}
          {map?.encounters.map((entry) => (
            <button key={entry.id} type="button"
              className={`map-node ${entry.completed ? 'map-node--completed' : ''} ${entry.id === next ? 'map-node--next' : ''}`}
              style={{ left: `${entry.mapX}%`, top: `${entry.mapY}%` }} disabled={!entry.available}
              data-next={entry.id === next} aria-label={`Batalha ${entry.position}: ${entry.title}${entry.available ? '' : ' — bloqueada'}`}
              title={entry.available ? entry.title : `Vença a batalha ${entry.position - 1} para continuar.`}
              onClick={() => { setSelectedId(entry.id); setStartError(''); drawer.current?.showModal(); }}>
              <span>{entry.position}</span>{entry.completed && <span className="map-completed-check" aria-hidden="true">✓</span>}
            </button>
          ))}
        </div>
      </div>

      <header className="map-header">
        <button className="campaign-back" onClick={onBack} aria-label="Voltar às campanhas"><span aria-hidden="true">←</span></button>
        <div><h1>{map?.campaign.title ?? 'Primeira campanha'}</h1>
          {map && <p>{map.encounters.filter((entry) => entry.completed).length} de {map.encounters.length} batalhas vencidas</p>}
        </div>
      </header>
      {error && <section className="map-message"><p role="alert">{error}</p><button className="fantasy-button compact" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button></section>}
      {!map && !error && <p className="map-message" role="status">Carregando mapa…</p>}
      {progress && catalog && <section className="roster-team map-team" aria-labelledby="map-team-title">
        <div className="team-panel">
          <h2 id="map-team-title">Minha equipe</h2>
          <div className="team-slots">
            {Array.from({ length: 3 }, (_, index) => {
              const member = catalog.units.find((unit) => unit.id === progress.selectedTeam[index] && progress.unlockedUnitIds.includes(unit.id));
              return <div className={`team-slot ${!member ? 'team-slot--empty' : ''}`} key={index}
                role={member ? 'group' : 'img'} aria-label={member ? `Slot ${index + 1}: ${member.name}` : `Slot ${index + 1} vazio`}>
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
            <div><span className="encounter-number">Batalha {selected?.position}</span><h2 id="encounter-title">{selected?.title}</h2></div>
            <button className="drawer-close" aria-label="Fechar detalhes da batalha" disabled={busy} onClick={closeDrawer}>×</button>
          </header>
          {selected && catalog && <div className="encounter-drawer-body">
            <h3>Adversários</h3>
            <div className="encounter-enemies">
              {selected.enemyUnitIds.map((id, slot) => {
                const unit = catalog.units.find((entry) => entry.id === id);
                return unit ? <figure key={`${id}-${slot}`}><img src={unit.portrait} alt={`Retrato de ${unit.name}`} /><figcaption>{unit.name}</figcaption></figure> : null;
              })}
            </div>
             <h3>História</h3><p className="encounter-story">{selected.story}</p>
             {selected.id === FINAL_ENCOUNTER_ID && <p className="encounter-requirement">{FINAL_BATTLE_REQUIREMENT}</p>}
            {selected.provisional && <p className="encounter-provisional">Configuração provisória de encontro.</p>}
          </div>}
          <footer className="encounter-drawer-footer">
            {startError && <p className="feedback" role="alert">{startError}</p>}
            {!teamSize && <p>Escolha pelo menos um personagem para sua equipe antes de iniciar.</p>}
            <button className="fantasy-button compact" disabled={busy || !teamSize || missingRavi} onClick={startBattle}>
              {busy ? 'Preparando batalha…' : 'Iniciar batalha'}
            </button>
          </footer>
        </div>
      </dialog>
    </main>
  );
}
