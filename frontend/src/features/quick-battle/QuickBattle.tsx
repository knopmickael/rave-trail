import { useEffect, useState } from 'react';
import type { GameCatalog, PlayerProgress, QuickBattleData } from '@game/contracts';
import type { BattleRecord } from '@game/core/battle';
import { api, ApiError, gameDataCache } from '../../api';
import { CharacterArt } from '../characters/CharacterArt';
import { useI18n } from '../../i18n/LanguageProvider';
import '../characters/characters.css';
import './quick-battle.css';

export function QuickBattle({ onBack, onSessionExpired, onBattleStarted }: {
  onBack: () => void;
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

  useEffect(() => {
    let active = true;
    setError('');
    setData(gameDataCache.peek('quick-battle'));
    setCatalog(gameDataCache.peek('catalog'));
    setProgress(gameDataCache.peek('progress'));
    Promise.all([api.quickBattle(), api.catalog(), api.progress()]).then(([available, content, saved]) => {
      if (active) { setData(available); setCatalog(content); setProgress(saved); }
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired();
      else setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a Batalha rápida.');
    });
    return () => { active = false; };
  }, [attempt, onSessionExpired]);

  const loaded = !!data && !!catalog && !!progress;
  const hasOpponents = !!data?.opponents.length;
  const hasTeam = !!progress?.selectedTeam.some((id) => id !== null);

  async function enterBattle() {
    if (busy || !loaded || !hasOpponents || !hasTeam) return;
    setBusy(true);
    setStartError('');
    try { onBattleStarted(await api.startQuickBattle()); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired();
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
      <section className="quick-battle-panel" aria-labelledby="quick-battle-intro" aria-busy={busy}>
        <h2 id="quick-battle-intro">{t('Prepare-se para o confronto')}</h2>
        <p>{t('Enfrente uma equipe sorteada entre os três protagonistas, disponíveis desde o início, os inimigos que você já derrotou na campanha e os capitães desbloqueados na Tabela de missões. Cada Batalha rápida é um novo confronto, sem mapa e sem avançar a campanha.')}</p>
        {error ? <>
          <p className="feedback" role="alert">{text(error)}</p>
          <button className="text-button" onClick={() => setAttempt((value) => value + 1)}>{t('Tentar novamente')}</button>
        </> : !loaded ? <p role="status">{t('Carregando adversários…')}</p> : <>
          <h3>{t('Adversários disponíveis')}</h3>
          {hasOpponents ? <ul className="quick-battle-opponents" aria-label={t('Adversários disponíveis')}>
            {data.opponents.map((unit) => <li key={unit.id}>
              <img src={unit.portrait} alt={t('Retrato de {name}', { name: text(unit.name) })} draggable={false} />
            </li>)}
          </ul> : <p role="status">{t('Nenhum adversário disponível no catálogo.')}</p>}
          {!hasTeam && <p role="status">{t('Monte sua equipe na Lista de personagens antes de entrar na batalha.')}</p>}
        </>}
        {startError && <p className="feedback" role="alert">{text(startError)}</p>}
        <button type="button" className="fantasy-button compact" disabled={busy || !loaded || !hasOpponents || !hasTeam}
          onClick={enterBattle}>{t(busy ? 'Preparando batalha…' : 'Entrar na batalha')}</button>
      </section>
    </div>

    {progress && catalog && <section className="roster-team quick-battle-team" aria-labelledby="quick-team-title">
      <div className="team-panel">
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
