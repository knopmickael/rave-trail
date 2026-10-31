import { useEffect, useRef, useState } from 'react';
import { assets } from '../../assets';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

export function CampaignMapBackground() {
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

  return <>
    <img className="campaign-map-image" src={assets.campaignMap}
      alt="Mapa de Berdal e das rotas da primeira jornada" draggable={false} />
    {!reducedMotion && !failed && <video ref={video}
      className={`campaign-map-video${playing ? ' is-playing' : ''}`}
      src={assets.campaignMapVideo} poster={assets.campaignMap}
      autoPlay loop muted playsInline preload="metadata" disablePictureInPicture
      aria-hidden="true" tabIndex={-1}
      onLoadStart={() => setPlaying(false)} onPlaying={() => setPlaying(true)} onError={() => setFailed(true)} />}
  </>;
}
