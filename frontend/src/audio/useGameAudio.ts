import { useEffect, useRef } from 'react';
import { assets } from '../assets';
import { SOUND_EFFECT_EVENT, type SoundEffect } from './soundEffects';

interface GameAudioOptions {
  inBattle: boolean;
  finalBattle?: boolean;
  volume: number;
  muted: boolean;
}

function play(audio: HTMLAudioElement) {
  try {
    const result = audio.play();
    if (result) void result.catch(() => {
      // Navegadores bloqueiam áudio antes da primeira interação do usuário.
    });
  } catch {
    // Ambientes sem reprodução de mídia (por exemplo, testes) ignoram o áudio.
  }
}

export function useGameAudio({ inBattle, finalBattle = false, volume, muted }: GameAudioOptions) {
  const musicRef = useRef<HTMLAudioElement[]>([]);
  const effectsRef = useRef<Partial<Record<SoundEffect, HTMLAudioElement>>>({});
  const track = inBattle ? finalBattle ? 2 : 1 : 0;
  const trackRef = useRef(track);
  const volumeRef = useRef(volume);
  const mutedRef = useRef(muted);

  trackRef.current = track;
  volumeRef.current = volume;
  mutedRef.current = muted;

  useEffect(() => {
    const music = [assets.baseAudio, assets.fightAudio, assets.finalFightAudio].map((src) => {
      const audio = new Audio(src);
      audio.loop = true;
      audio.preload = 'auto';
      audio.volume = mutedRef.current ? 0 : volumeRef.current / 100;
      return audio;
    });
    const effects = Object.fromEntries(Object.entries({
      'menu-click': assets.menuClickAudio, 'battle-click': assets.battleClickAudio,
      turn: assets.changeTurnAudio, defeated: assets.playerDeathAudio,
      victory: assets.battleWinAudio, defeat: assets.battleLoseAudio,
    }).map(([key, src]) => {
      const audio = new Audio(src);
      audio.preload = 'auto';
      audio.volume = mutedRef.current ? 0 : volumeRef.current / 100;
      return [key, audio];
    })) as Record<SoundEffect, HTMLAudioElement>;
    musicRef.current = music;
    effectsRef.current = effects;

    const effect = (event: Event) => {
      const sound = effects[(event as CustomEvent<SoundEffect>).detail];
      if (!sound || mutedRef.current || volumeRef.current === 0) return;
      sound.currentTime = 0;
      play(sound);
    };
    const click = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target.closest('button, [role="button"]') : null;
      if (!target || target.matches(':disabled, [aria-disabled="true"]')) return;
      effect(new CustomEvent(SOUND_EFFECT_EVENT, { detail: target.closest('.battle-page') ? 'battle-click' : 'menu-click' }));
    };

    const unlock = () => {
      const active = music[trackRef.current];
      if (active) play(active);
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
    };
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    document.addEventListener('click', click, true);
    document.addEventListener(SOUND_EFFECT_EVENT, effect);

    return () => {
      document.removeEventListener('pointerdown', unlock);
      document.removeEventListener('keydown', unlock);
      document.removeEventListener('click', click, true);
      document.removeEventListener(SOUND_EFFECT_EVENT, effect);
      [...music, ...Object.values(effects)].forEach((audio) => audio.pause());
      musicRef.current = [];
      effectsRef.current = {};
    };
  }, []);

  useEffect(() => {
    musicRef.current.forEach((audio, index) => {
      if (index !== track) audio.pause();
      else {
        if (track !== 0) audio.currentTime = 0;
        play(audio);
      }
    });
  }, [track]);

  useEffect(() => {
    const nextVolume = muted ? 0 : volume / 100;
    [...musicRef.current, ...Object.values(effectsRef.current)].forEach((audio) => { audio.volume = nextVolume; });
  }, [volume, muted]);
}
