import { useEffect, useRef, useState } from 'react';
import type { GameCatalog, PlayerProgress, QuickBattleData } from '@game/contracts';
import type { BattleRecord } from '@game/core/battle';
import { QUICK_BATTLE_COOLDOWN_MESSAGE } from '@game/content/quick-battle-rules';
import { api, ApiError, gameDataCache } from '../../api';
import { CharacterArt } from '../characters/CharacterArt';
import { useI18n } from '../../i18n/LanguageProvider';
import '../characters/characters.css';
import './quick-battle.css';

export function QuickBattle({ onBack, onOpenCharacters, onSessionExpired, onBattleStarted }: {
  onBack: () => void;
  onOpenCharacters: () => void;
  onSessionExpired: () => void;
  onBattleStarted: (battle: BattleRecord) => void;
}) {
  const { t, text } = useI18n();
  const [data, setData] = useState(() => gameDataCache.peek<QuickBattleData>('quick-battle'));
  const [catalog, setCatalog] = useState(() => gameDataCache.peek<GameCatalog>('catalog'));
  const [progress, setProgress] = useState(() => gameDataCache.peek<PlayerProgress>('progress'));
  const [error, setError] = useState('');
  const [startError, setStartError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now);
  const [serverOffset, setServerOffset] = useState(0);
  const availabilityVersion = useRef(0);

  function acceptAvailability(available: QuickBattleData) {
    setData(available);
    const receivedAt = Date.now();
    const offset = available.serverTime ? Date.parse(available.serverTime) - receivedAt : 0;
    setServerOffset(Number.isFinite(offset) ? offset : 0);
    setNow(receivedAt);
  }

  useEffect(() => {
    let active = true;
    setError('');
    setData(gameDataCache.peek('quick-battle'));
    setCatalog(gameDataCache.peek('catalog'));
    setProgress(gameDataCache.peek('progress'));
    let refreshing = true;
    const version = ++availabilityVersion.current;
    Promise.all([api.quickBattle(true), api.catalog(), api.progress()]).then(([available, content, saved]) => {
      if (active) {
        if (version === availabilityVersion.current) acceptAvailability(available);
        setCatalog(content); setProgress(saved);
      }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired();
      else setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a Batalha rápida.');
    }).finally(() => { refreshing = false; });
    const refresh = async () => {
      if (refreshing) return;
      refreshing = true;
      const version = ++availabilityVersion.current;
      try { const available = await api.quickBattle(true); if (active && version === availabilityVersion.current) acceptAvailability(available); }
      catch (cause) { if (active && cause instanceof ApiError && cause.status === 401) onSessionExpired(); }
      finally { refreshing = false; }
    };
    const visible = () => { if (!document.hidden) void refresh(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', visible);
    return () => { active = false; window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', visible); };
  }, [attempt, onSessionExpired]);

  const loaded = !!data && !!catalog && !!progress;
  const hasOpponents = !!data?.opponents.length;
  const hasTeam = !!progress?.selectedTeam.some((id) => id !== null);
  const missingTeam = loaded && !error && !hasTeam;
  const deadline = data?.blockedUntil ? Date.parse(data.blockedUntil) : 0;
  const remaining = Number.isFinite(deadline) ? Math.max(0, Math.ceil((deadline - now - serverOffset) / 1000)) : 0;
  const blocked = remaining > 0;

  useEffect(() => {
    if (!blocked) return;
    const interval = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(interval);
  }, [blocked]);

  async function enterBattle() {
    if (busy || !loaded || !hasOpponents || !hasTeam || blocked) return;
    setBusy(true);
    setStartError('');
    try { onBattleStarted(await api.startQuickBattle()); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired();
      else if (cause instanceof ApiError && cause.status === 429 && cause.retryAt && data) {
        availabilityVersion.current++;
        acceptAvailability({ ...data, blockedUntil: cause.retryAt, serverTime: cause.serverTime });
      }
      else setStartError(cause instanceof Error ? cause.message : 'Não foi possível iniciar a Batalha rápida.');
    } finally { setBusy(false); }
  }

  return <main className="quick-battle-page">
    <header className="roster-header">
      <button type="button" className="back-arrow" disabled={busy} onClick={onBack} aria-label={t('Voltar ao menu principal')}>
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M14 6 4 16l10 10M5 16h23" />
        </svg>
      </button>
      <h1>{t('Batalha rápida')}</h1>
    </header>

    <div className="quick-battle-content">
      <section className={`quick-battle-panel${loaded && !error ? ' quick-battle-panel--ready' : ''}`} aria-labelledby="quick-battle-intro" aria-busy={busy}>
        <h2 id="quick-battle-intro">{t('Prepare-se para o confronto')}</h2>
        <p className="quick-battle-intro-copy">{t('Enfrente uma equipe sorteada entre os três protagonistas e os capitães da guarda, disponíveis desde o início, e os inimigos que você já derrotou na campanha. Cada Batalha rápida é um novo confronto, sem mapa e sem avançar a campanha.')}</p>
        {error ? <>
          <p className="feedback" role="alert">{text(error)}</p>
          <button className="text-button" onClick={() => setAttempt((value) => value + 1)}>{t('Tentar novamente')}</button>
        </> : !loaded ? <p role="status">{t('Carregando adversários…')}</p> : <>
          <h3 className="quick-battle-opponents-title">{t('Adversários disponíveis')}</h3>
          {hasOpponents ? <ul className="quick-battle-opponents" aria-label={t('Adversários disponíveis')} tabIndex={0}>
            {data.opponents.map((unit) => <li key={unit.id}>
              <img src={unit.portrait} alt={t('Retrato de {name}', { name: text(unit.name) })} draggable={false} />
            </li>)}
          </ul> : <p className="quick-battle-empty" role="status">{t('Nenhum adversário disponível no catálogo.')}</p>}
        </>}
        {(missingTeam || startError || blocked) && <div className="quick-battle-notices">
          {missingTeam && <p role="status">{t('Monte sua equipe na Lista de personagens antes de entrar na batalha.')}</p>}
          {startError && <p className="feedback" role="alert">{text(startError)}</p>}
          {blocked && <p id="quick-battle-cooldown" className="quick-battle-cooldown" role="status">{t(QUICK_BATTLE_COOLDOWN_MESSAGE)}</p>}
        </div>}
        <div className="quick-battle-start">
          <button type="button" className="fantasy-button compact" disabled={busy || !loaded || !hasOpponents || !hasTeam || blocked}
            aria-describedby={blocked ? 'quick-battle-cooldown' : undefined}
            onClick={enterBattle}>{t(busy ? 'Preparando batalha…' : 'Entrar na batalha')}</button>
          {blocked && <span className="quick-battle-countdown" role="timer" aria-label={t('Tempo para iniciar nova batalha')}>
            {Math.floor(remaining / 60)}:{String(remaining % 60).padStart(2, '0')}
          </span>}
        </div>
      </section>
    </div>

    {progress && catalog && <section className="roster-team quick-battle-team" aria-labelledby="quick-team-title">
      <div className="team-panel team-panel--navigation">
        <button type="button" className="team-panel-open" aria-label={t('Abrir Lista de personagens')}
          disabled={busy} onClick={onOpenCharacters} />
        <h2 id="quick-team-title">{t('Minha equipe')}</h2>
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
  </main>;
}
