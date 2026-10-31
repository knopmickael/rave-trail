import { useEffect, useRef, useState } from 'react';
import { assets } from '../assets';
import './sky-background.css';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

/** Montado uma única vez: trocar de tela não reinicia o movimento do céu. */
export function SkyBackground() {
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
    const syncPlayback = () => {
      if (document.hidden) element.pause();
      else {
        // Autoplay pode ser bloqueado pelo navegador; a imagem continua visível.
        void element.play().catch(() => setPlaying(false));
      }
    };
    document.addEventListener('visibilitychange', syncPlayback);
    syncPlayback();
    return () => {
      document.removeEventListener('visibilitychange', syncPlayback);
      element.pause();
    };
  }, [reducedMotion, failed]);

  return (
    <div className="sky-background" aria-hidden="true" style={{ backgroundImage: `url(${assets.sky})` }}>
      {!reducedMotion && !failed && (
        <video ref={video} className={`sky-background-video ${playing ? 'is-playing' : ''}`}
          src={assets.skyVideo} poster={assets.sky} autoPlay loop muted playsInline preload="metadata"
          disablePictureInPicture tabIndex={-1}
          onLoadStart={() => setPlaying(false)} onPlaying={() => setPlaying(true)} onError={() => setFailed(true)} />
      )}
    </div>
  );
}
