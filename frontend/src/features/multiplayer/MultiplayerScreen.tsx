import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { BattleAction } from '@game/core/battle';
import type { GameCatalog, PlayerProgress } from '@game/contracts';
import type { MultiplayerInput } from '@game/multiplayer';
import { api, ApiError, gameDataCache } from '../../api';
import { useI18n } from '../../i18n/LanguageProvider';
import { BattleScreen } from '../battle/BattleScreen';
import { MultiplayerClient } from './client';
import { perspectiveBattle } from './perspective';
import '../quick-battle/quick-battle.css';
import './multiplayer.css';

export function MultiplayerScreen({ userId, onBack, onOpenCharacters, onSessionExpired, onBattleActive }: {
  userId: string; onBack: () => void; onOpenCharacters: () => void; onSessionExpired: () => void;
  onBattleActive: (active: boolean) => void;
}) {
  const { t, text } = useI18n();
  const [client] = useState(() => new MultiplayerClient(userId));
  const snapshot = useSyncExternalStore(client.subscribe, client.getSnapshot);
  const { view, connected } = snapshot;
  const latest = useRef(view); latest.current = view;
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [teamData, setTeamData] = useState<{ progress: PlayerProgress; catalog: GameCatalog } | null>(null);
  const [now, setNow] = useState(Date.now);
  const ready = useRef<string | null>(null);
  useEffect(() => { client.start(); return () => client.stop(); }, [client]);
  useEffect(() => { if (snapshot.expired) onSessionExpired(); }, [snapshot.expired, onSessionExpired]);
  useEffect(() => {
    onBattleActive(view.phase === 'active');
    return () => onBattleActive(false);
  }, [view.phase, onBattleActive]);
  useEffect(() => {
    let active = true;
    Promise.all([api.progress(), api.catalog()]).then(([progress, catalog]) => {
      if (active) setTeamData({ progress, catalog });
    }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired();
      else setError(cause instanceof Error ? cause.message : 'Não foi possível carregar a equipe.');
    });
    return () => { active = false; };
  }, [onSessionExpired]);
  useEffect(() => {
    if (!connected) { ready.current = null; return; }
    if (view.phase !== 'preparing' || !view.matchId || ready.current === view.matchId) return;
    ready.current = view.matchId;
    void client.command({ type: 'ready', matchId: view.matchId }).catch((cause: Error) => { ready.current = null; setError(cause.message); });
  }, [view.phase, view.matchId, connected, client]);
  useEffect(() => {
    if (!view.disconnectedUntil) return;
    const timer = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(timer);
  }, [view.disconnectedUntil]);
  useEffect(() => {
    if (view.phase !== 'finished') return;
    for (const key of ['progress', 'unlocks', 'quick-battle']) gameDataCache.delete(key);
  }, [view.phase]);

  const record = useMemo(() => view.battle && view.mySide ? perspectiveBattle(view.battle, view.mySide) : null, [view.battle, view.mySide]);
  async function command(input: MultiplayerInput) {
    setBusy(true); setError('');
    try { await client.command(input); }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Não foi possível sincronizar a partida. Tente novamente.'); }
    finally { setBusy(false); }
  }
  const connectionNotice = <aside className="multiplayer-notice" aria-live="polite">
    {!connected && <p role="status">{t('Reconectando à partida…')}</p>}
    {view.disconnectedUntil && <p role="status">{t('Adversário desconectado. Aguardando reconexão por até {seconds}s.', {
      seconds: Math.max(0, Math.ceil((Date.parse(view.disconnectedUntil) - now) / 1000)),
    })}</p>}
    {(error || snapshot.error) && <p className="feedback" role="alert">{text(error || snapshot.error)}</p>}
  </aside>;

  if (record && (view.phase === 'active' || view.phase === 'finished')) {
    return <>{connectionNotice}<BattleScreen key={record.id} initialBattle={record} title={t('Multiplayer contra {name}', { name: view.opponent?.name ?? '' })} onBack={onBack} onSessionExpired={onSessionExpired}
      multiplayer={{ record, connected,
        onDraft: (actions: BattleAction[]) => client.command({ type: 'draft', matchId: record.id,
          revision: latest.current.battle!.revision, draftRevision: latest.current.draftRevision!, actions }),
        onTurn: () => client.command({ type: 'turn', matchId: record.id,
          revision: latest.current.battle!.revision, draftRevision: latest.current.draftRevision! }),
        onSurrender: () => client.command({ type: 'surrender', matchId: record.id }),
      }} /></>;
  }
  const reserved = view.phase === 'queued' || view.phase === 'preparing';
  const members = teamData?.progress.selectedTeam.map((id) => teamData.catalog.units.find((unit) => unit.id === id && teamData.progress.unlockedUnitIds.includes(unit.id)));
  const validTeam = members?.length === 3 && members.every(Boolean);
  return <main className="quick-battle-page multiplayer-page">
    <header className="roster-header">
      <button type="button" className="back-arrow" disabled={reserved || busy} onClick={onBack} aria-label={t('Voltar ao menu principal')}>←</button>
      <h1>{t('Multiplayer')}</h1>
    </header>
    <div className="quick-battle-content"><section className="quick-battle-panel" aria-busy={busy}>
      {view.phase === 'finished' && view.result ? <>
        <h2>{t(view.result.reason === 'void' ? 'Batalha encerrada' : view.result.winnerId === userId ? 'Vitória!' : 'Derrota')}</h2>
        <p>{t(view.result.reason === 'void' ? 'Partida anulada. Nenhuma vitória ou derrota foi registrada.' : 'O resultado multiplayer foi salvo.')}</p>
        <p>{t('Rodadas: {rounds} · Turnos executados: {turns}', { rounds: view.result.rounds, turns: view.result.totalTurns })}</p>
        <p>{t('Histórico detalhado indisponível após a reconexão. O resultado foi preservado.')}</p>
      </> : <>
        <h2>{t(view.phase === 'queued' ? 'Procurando adversário…' : view.phase === 'preparing' ? 'Aguardando os dois jogadores…' : 'Prepare-se para o confronto')}</h2>
        <p>{t('Encontre outro jogador na fila global. Sua equipe precisa ter três personagens. Quem começa é sorteado.')}</p>
        <p>{t('Você tem 45 segundos por turno. Ao esgotar o tempo, seu combo é descartado. Desconexões permitem reconectar por 10 segundos.')}</p>
      </>}
      {view.opponent && <p>{t('Adversário: {name}', { name: view.opponent.name })}</p>}
      {members && <ul className="multiplayer-team" aria-label={t('Minha equipe')}>
        {members.map((unit, slot) => <li key={slot}>{unit ? <><img src={unit.portrait} alt="" /><span>{text(unit.name)}</span></> : <span>{t('Slot {slot} vazio', { slot: slot + 1 })}</span>}</li>)}
      </ul>}
      {!connected && <p role="status">{t('Conectando ao multiplayer…')}</p>}
      {connectionNotice}
      <div className="multiplayer-actions">
        {view.phase === 'queued' ? <button className="fantasy-button compact" disabled={busy || !connected} onClick={() => void command({ type: 'cancel' })}>{t('Cancelar busca')}</button>
          : view.phase !== 'preparing' && <button className="fantasy-button compact" disabled={busy || !connected || !validTeam} onClick={() => void command({ type: 'join' })}>{t('Buscar partida')}</button>}
        <button className="text-button" disabled={busy || reserved} onClick={onOpenCharacters}>{t('Montar equipe')}</button>
      </div>
    </section></div>
  </main>;
}
