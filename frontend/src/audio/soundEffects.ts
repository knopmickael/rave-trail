export type SoundEffect = 'menu-click' | 'battle-click' | 'turn' | 'defeated' | 'victory' | 'defeat';
export const SOUND_EFFECT_EVENT = 'rave-trail-sound';

export function playSoundEffect(effect: SoundEffect) {
  document.dispatchEvent(new CustomEvent<SoundEffect>(SOUND_EFFECT_EVENT, { detail: effect }));
}
