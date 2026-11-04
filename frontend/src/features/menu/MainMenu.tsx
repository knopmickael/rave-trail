import { useRef, useState, type FormEvent } from 'react';
import type { User } from '@game/contracts';
import { assets } from '../../assets';
import './menu.css';

interface MainMenuProps {
  user: User;
  busy: boolean;
  error: string;
  onOpenCharacters: () => void;
  onOpenStore: () => void;
  onOpenCampaigns: () => void;
  onOpenQuickBattle: () => void;
  onOpenUnlocks: () => void;
  onOpenProfile: () => void;
  onLogout: () => Promise<void>;
  onSaveName: (name: string) => Promise<void>;
  audioVolume: number;
  audioMuted: boolean;
  onAudioVolumeChange: (volume: number) => void;
  onAudioMutedChange: (muted: boolean) => void;
}

export function MainMenu({ user, busy, error, onOpenCharacters, onOpenStore, onOpenCampaigns, onOpenQuickBattle, onOpenUnlocks, onOpenProfile, onLogout, onSaveName, audioVolume, audioMuted, onAudioVolumeChange, onAudioMutedChange }: MainMenuProps) {
  const profileDialog = useRef<HTMLDialogElement>(null);
  const settingsDialog = useRef<HTMLDialogElement>(null);
  const [name, setName] = useState(user.name);
  const [saving, setSaving] = useState(false);
  const [nameError, setNameError] = useState('');
  const [saved, setSaved] = useState(false);
  const profileBusy = busy || saving;

  async function saveName(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (profileBusy || !name.trim()) return;
    setSaving(true);
    setNameError('');
    setSaved(false);
    try { await onSaveName(name.trim()); setName(name.trim()); setSaved(true); }
    catch (cause) { setNameError(cause instanceof Error ? cause.message : 'Não foi possível salvar o nome.'); }
    finally { setSaving(false); }
  }

  return (
    <main className="main-menu-screen">
      <h1 className="visually-hidden">Menu principal</h1>
      <nav className="menu-options" aria-label="Opções do menu principal">
        <img className="main-menu-logo" src={assets.logo} alt="Rave Trail" />
        <button className="menu-option" onClick={onOpenCampaigns}>Campanha</button>
        <button className="menu-option" onClick={onOpenQuickBattle}>Batalha rápida</button>
        <button className="menu-option" onClick={onOpenCharacters}>Lista de personagens</button>
        <button className="menu-option" onClick={onOpenUnlocks}>Tabela de missões</button>
        <button className="menu-option" onClick={onOpenStore}>Loja</button>
        <button className="menu-option" disabled>Multiplayer</button>
        <button className="menu-option" aria-haspopup="dialog" aria-controls="audio-settings-dialog"
          onClick={() => settingsDialog.current?.showModal()}>Configurações</button>
      </nav>

      <button className="profile-card" aria-label={`Abrir perfil de ${user.name}`}
        aria-haspopup="dialog" aria-controls="user-profile-dialog"
        onClick={() => { onOpenProfile(); setName(user.name); setNameError(''); setSaved(false); profileDialog.current?.showModal(); }}>
        <ProfilePicture />
        <span className="profile-card-details">
          <strong>{user.name}</strong>
          <span title={user.email}>{user.email}</span>
        </span>
      </button>

      <dialog ref={profileDialog} id="user-profile-dialog" className="profile-dialog"
        aria-labelledby="profile-title"
        onCancel={(event) => { if (profileBusy) event.preventDefault(); }}
        onClick={(event) => {
          if (event.target === event.currentTarget && !profileBusy) profileDialog.current?.close();
        }}>
        <div className="profile-dialog-content">
          <button className="profile-close" aria-label="Fechar perfil" disabled={profileBusy}
            onClick={() => profileDialog.current?.close()}>
            <span aria-hidden="true">×</span>
          </button>
          <ProfilePicture large />
          <h2 id="profile-title">Meu perfil</h2>
          <dl className="profile-fields">
            <div><dt>Nome atual</dt><dd>{user.name}</dd></div>
            <div><dt>E-mail</dt><dd>{user.email}</dd></div>
          </dl>
          <form className="profile-name-form" onSubmit={saveName} aria-busy={saving}>
            <label htmlFor="profile-name">Nome</label>
            <input id="profile-name" name="name" autoComplete="nickname" required maxLength={40}
              value={name} disabled={profileBusy} onChange={(event) => { setName(event.target.value); setSaved(false); }} />
            <button type="submit" className="fantasy-button compact" disabled={profileBusy || !name.trim() || name.trim() === user.name}>
              {saving ? 'Salvando…' : 'Salvar nome'}
            </button>
            {nameError && <p className="feedback" role="alert">{nameError}</p>}
            {saved && <p className="profile-save-status" role="status">Nome salvo.</p>}
          </form>
          {error && <p className="feedback" role="alert">{error}</p>}
          <button className="fantasy-button compact" disabled={profileBusy} onClick={onLogout}>
            {busy ? 'Desconectando…' : 'Desconectar'}
          </button>
        </div>
      </dialog>

      <dialog ref={settingsDialog} id="audio-settings-dialog" className="profile-dialog settings-dialog"
        aria-labelledby="settings-title"
        onClick={(event) => {
          if (event.target === event.currentTarget) settingsDialog.current?.close();
        }}>
        <div className="profile-dialog-content">
          <button className="profile-close" aria-label="Fechar configurações"
            onClick={() => settingsDialog.current?.close()}>
            <span aria-hidden="true">×</span>
          </button>
          <h2 id="settings-title">Configurações</h2>
          <div className="audio-settings">
            <div className="audio-setting-heading">
              <label htmlFor="audio-volume">Volume do áudio</label>
              <output htmlFor="audio-volume" aria-live="polite">
                {audioMuted ? 'Silenciado' : `${audioVolume}%`}
              </output>
            </div>
            <input id="audio-volume" type="range" min="0" max="100" step="1" value={audioVolume}
              onChange={(event) => onAudioVolumeChange(Number(event.target.value))} />
            <label className="audio-mute-toggle">
              <input type="checkbox" checked={audioMuted}
                onChange={(event) => onAudioMutedChange(event.target.checked)} />
              Silenciar áudio
            </label>
          </div>
        </div>
      </dialog>
    </main>
  );
}

function ProfilePicture({ large = false }: { large?: boolean }) {
  return (
    <span className={`profile-picture ${large ? 'profile-picture--large' : ''}`} role="img" aria-label="Foto de perfil">
      <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" focusable="false">
        <circle cx="32" cy="23" r="11" fill="currentColor" />
        <path d="M12 55c0-12 8-19 20-19s20 7 20 19" fill="currentColor" />
      </svg>
    </span>
  );
}
