import { useEffect, useRef, useState } from 'react';
import { assets } from '../../assets';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export function BattleBackground({ finalBattle }: { finalBattle: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.(reducedMotionQuery).matches ?? false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    const preference = window.matchMedia?.(reducedMotionQuery);
    if (!preference) return;
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    update();
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    const element = video.current;
    if (!element || reducedMotion || failed) return;
    let active = true;
    const syncPlayback = () => {
      if (document.hidden) element.pause();
      else void element.play().catch(() => { if (active) setPlaying(false); });
    };
    document.addEventListener('visibilitychange', syncPlayback);
    syncPlayback();
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', syncPlayback);
      element.pause();
    };
  }, [reducedMotion, failed]);

  if (reducedMotion || failed) return null;
  return <div className={`battle-background${playing ? ' is-playing' : ''}`} aria-hidden="true">
    <video ref={video} src={finalBattle ? assets.finalBattleVideo : assets.battleVideo}
      poster={finalBattle ? assets.finalBattle : assets.battle}
      autoPlay loop muted playsInline preload="metadata" disablePictureInPicture tabIndex={-1}
      onLoadStart={() => setPlaying(false)} onPlaying={() => setPlaying(true)} onError={() => setFailed(true)} />
  </div>;
}
