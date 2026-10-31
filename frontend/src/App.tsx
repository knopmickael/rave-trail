import { lazy, Suspense, useCallback, useEffect, useState, type FormEvent } from 'react';
import type { User } from '@game/contracts';
import { api, ApiError } from './api';
import { assets } from './assets';
import { CharacterList } from './features/characters/CharacterList';
import { MainMenu } from './features/menu/MainMenu';
import { CampaignSelection } from './features/campaigns/CampaignSelection';
import { CampaignMap } from './features/campaigns/CampaignMap';
import { QuickBattle } from './features/quick-battle/QuickBattle';
import { CharacterUnlocks } from './features/unlocks/CharacterUnlocks';
import { BattleLoading } from './features/battle/BattleLoading';
import { useAudioSettings } from './audio/useAudioSettings';
import { useGameAudio } from './audio/useGameAudio';
import type { BattleRecord } from '@game/core/battle';
import { FINAL_ENCOUNTER_ID } from '@game/content/campaign-rules';

const BATTLE_LOADING_MS = 700;
const battleScreenImport = () => import('./features/battle/BattleScreen');
const BattleScreen = lazy(() => battleScreenImport().then((module) => ({ default: module.BattleScreen })));

export function App() {
  const [screen, setScreen] = useState<'title' | 'auth' | 'menu' | 'characters' | 'campaigns' | 'map' | 'quick-battle' | 'unlocks' | 'battle'>('title');
  const [campaignId, setCampaignId] = useState('path-1');
  const [charactersReturn, setCharactersReturn] = useState<'menu' | 'map' | 'unlocks'>('menu');
  const [battle, setBattle] = useState<BattleRecord | null>(null);
  const [battleTitle, setBattleTitle] = useState('Batalha');
  const [battleReady, setBattleReady] = useState(false);
  const [user, setUser] = useState<User | null>(null);
  const [checking, setChecking] = useState(true);
  const [busy, setBusy] = useState(false);
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const audio = useAudioSettings();
  useGameAudio({ inBattle: screen === 'battle', finalBattle: battle?.encounterId === FINAL_ENCOUNTER_ID,
    volume: audio.volume, muted: audio.muted });

  const handleSessionExpired = useCallback(() => {
    setUser(null);
    setPassword('');
    setMode('login');
    setError('Sua sessão expirou. Entre novamente para continuar.');
    setScreen('auth');
  }, []);

  useEffect(() => {
    if (!user?.sessionExpiresAt) return;
    const expiresAt = Date.parse(user.sessionExpiresAt);
    const checkExpiry = () => { if (Date.now() >= expiresAt) handleSessionExpired(); };
    const timer = window.setTimeout(checkExpiry, Math.max(0, expiresAt - Date.now()));
    window.addEventListener('focus', checkExpiry);
    document.addEventListener('visibilitychange', checkExpiry);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('focus', checkExpiry);
      document.removeEventListener('visibilitychange', checkExpiry);
    };
  }, [user?.sessionExpiresAt, handleSessionExpired]);

  async function saveName(name: string) {
    try { setUser(await api.updateProfile(name)); }
    catch (cause) {
      if (cause instanceof ApiError && cause.status === 401) handleSessionExpired();
      throw cause;
    }
  }

  function openBattle(record: BattleRecord, title: string) {
    setBattle(record);
    setBattleTitle(title);
    setBattleReady(false);
    setScreen('battle');
  }

  useEffect(() => {
    let active = true;
    api.session().then((session) => { if (active) setUser(session); })
      .catch((cause: Error) => { if (active) setError(cause.message); })
      .finally(() => { if (active) setChecking(false); });
    return () => { active = false; };
  }, []);

  useEffect(() => {
    if (screen !== 'battle' || battleReady) return;
    void battleScreenImport();
    const timer = window.setTimeout(() => setBattleReady(true), BATTLE_LOADING_MS);
    return () => window.clearTimeout(timer);
  }, [screen, battleReady]);

  async function authenticate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy) return;
    setBusy(true);
    setError('');
    try {
      setUser(await api.authenticate(mode, email, password));
      setPassword('');
      setScreen('menu');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível entrar.');
    } finally {
      setBusy(false);
    }
  }

  async function logout() {
    setBusy(true);
    setError('');
    try {
      await api.logout();
      setUser(null);
      setScreen('title');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : 'Não foi possível sair.');
    } finally {
      setBusy(false);
    }
  }

  if (screen === 'characters' && user) {
    return <CharacterList onBack={() => setScreen(charactersReturn)} onSessionExpired={handleSessionExpired}
      backLabel={charactersReturn === 'map' ? 'Voltar ao mapa' : charactersReturn === 'unlocks' ? 'Voltar às missões' : 'Voltar ao menu principal'} />;
  }

  if (screen === 'campaigns' && user) {
    return <CampaignSelection onBack={() => setScreen('menu')} onSessionExpired={handleSessionExpired}
      onSelectCampaign={(id) => { setCampaignId(id); setScreen('map'); }} />;
  }

  if (screen === 'map' && user) {
    return <CampaignMap campaignId={campaignId} onBack={() => setScreen('campaigns')} onSessionExpired={handleSessionExpired}
      onBattleStarted={openBattle} />;
  }

  if (screen === 'quick-battle' && user) {
    return <QuickBattle onBack={() => setScreen('menu')} onSessionExpired={handleSessionExpired}
      onBattleStarted={(record) => openBattle(record, 'Batalha rápida')} />;
  }

  if (screen === 'unlocks' && user) {
    return <CharacterUnlocks onBack={() => setScreen('menu')} onSessionExpired={handleSessionExpired}
      onOpenCharacters={() => { setCharactersReturn('unlocks'); setScreen('characters'); }} />;
  }

  if (screen === 'battle' && user && battle) {
    if (!battleReady) return <BattleLoading />;
    return <Suspense fallback={<BattleLoading />}>
      <BattleScreen initialBattle={battle} title={battleTitle} onBack={() => setScreen(battle.encounterId === null ? 'quick-battle' : 'map')} onSessionExpired={handleSessionExpired} />
    </Suspense>;
  }

  if (screen === 'menu' && user) {
    return <MainMenu user={user} busy={busy} error={error} onLogout={logout}
      onSaveName={saveName}
      audioVolume={audio.volume} audioMuted={audio.muted}
      onAudioVolumeChange={audio.setVolume} onAudioMutedChange={audio.setMuted}
      onOpenProfile={() => setError('')}
      onOpenCampaigns={() => { setError(''); setScreen('campaigns'); }}
      onOpenQuickBattle={() => { setError(''); setScreen('quick-battle'); }}
      onOpenUnlocks={() => { setError(''); setScreen('unlocks'); }}
      onOpenCharacters={() => { setError(''); setCharactersReturn('menu'); setScreen('characters'); }} />;
  }

  return (
    <main className={`title-screen ${screen !== 'title' ? 'with-panel' : ''}`}>
      <img className="game-logo" src={assets.logo} alt="Rave Trail" />
      {screen === 'title' && (
        <button className="fantasy-button" disabled={checking} onClick={() => {
          setError('');
          setScreen(user ? 'menu' : 'auth');
        }}>
          {checking ? 'Carregando sessão…' : 'Começar jogo'}
        </button>
      )}
      {screen === 'auth' && (
        <section className="panel" aria-labelledby="auth-title">
          <h1 id="auth-title">{mode === 'login' ? 'Continue sua jornada' : 'Comece sua jornada'}</h1>
          <p>{mode === 'login' ? 'Entre na sua conta Rave Trail.' : 'Crie sua conta com e-mail e senha.'}</p>
          <form onSubmit={authenticate} aria-busy={busy}>
            <fieldset disabled={busy}>
              <label htmlFor="email">E-mail</label>
              <input id="email" name="email" type="email" autoComplete="email" maxLength={254}
                required value={email} onChange={(event) => setEmail(event.target.value)} />
              <label htmlFor="password">Senha</label>
              <input id="password" name="password" type="password" autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                minLength={mode === 'register' ? 10 : 1} maxLength={128} required value={password}
                aria-describedby={mode === 'register' ? 'password-help' : undefined}
                onChange={(event) => setPassword(event.target.value)} />
              {mode === 'register' && <small id="password-help">Use de 10 a 128 caracteres.</small>}
              <button type="submit" className="fantasy-button compact">{busy ? 'Aguarde…' : mode === 'login' ? 'Entrar' : 'Criar conta'}</button>
            </fieldset>
          </form>
          <button className="text-button" disabled={busy} onClick={() => {
            setMode(mode === 'login' ? 'register' : 'login');
            setPassword('');
            setError('');
          }}>{mode === 'login' ? 'Ainda não tem conta? Criar conta' : 'Já tem conta? Entrar'}</button>
          <button className="text-button" disabled={busy} onClick={() => { setError(''); setScreen('title'); }}>Voltar</button>
        </section>
      )}
      {error && <p className="feedback" role="alert">{error}</p>}
    </main>
  );
}
