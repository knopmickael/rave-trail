import { useEffect, useState } from 'react';

export interface AudioSettings {
  volume: number;
  muted: boolean;
}

const STORAGE_KEY = 'rave-trail-audio-settings';
const DEFAULT_SETTINGS: AudioSettings = { volume: 50, muted: false };

function readSettings(): AudioSettings {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return DEFAULT_SETTINGS;
    const parsed = JSON.parse(stored) as Partial<AudioSettings>;
    if (typeof parsed.volume !== 'number' || typeof parsed.muted !== 'boolean') return DEFAULT_SETTINGS;
    return { volume: Math.min(100, Math.max(0, Math.round(parsed.volume))), muted: parsed.muted };
  } catch {
    return DEFAULT_SETTINGS;
  }
}

export function useAudioSettings() {
  const [settings, setSettings] = useState<AudioSettings>(readSettings);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch {
      // Ignora indisponibilidade do armazenamento local.
    }
  }, [settings]);

  return {
    ...settings,
    setVolume: (volume: number) => setSettings((current) => ({ ...current, volume: Math.min(100, Math.max(0, Math.round(volume))) })),
    setMuted: (muted: boolean) => setSettings((current) => ({ ...current, muted })),
  };
}
