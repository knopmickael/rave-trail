import { useEffect, useRef, useState } from 'react';
import { assets } from '../assets';
import './sky-background.css';

const reducedMotionQuery = '(prefers-reduced-motion: reduce)';

/** Montado uma única vez: trocar de tela não reinicia o movimento do céu. */
export function SkyBackground({ sunset = false }: { sunset?: boolean }) {
  const video = useRef<HTMLVideoElement>(null);
  const [reducedMotion, setReducedMotion] = useState(() => window.matchMedia?.(reducedMotionQuery).matches ?? false);
  const [playing, setPlaying] = useState(false);
  const [failed, setFailed] = useState(false);
  const [source, setSource] = useState<string | null>(null);

  useEffect(() => {
    const preference = window.matchMedia?.(reducedMotionQuery);
    if (!preference) return;
    const update = () => setReducedMotion(preference.matches);
    preference.addEventListener('change', update);
    update();
    return () => preference.removeEventListener('change', update);
  }, []);

  useEffect(() => {
    if (reducedMotion || failed) return;
    const controller = new AbortController();
    let objectUrl: string | undefined;
    // canplaythrough é uma estimativa; um Blob só fica disponível após baixar tudo.
    void fetch(assets.skyVideo, { signal: controller.signal, priority: 'low' })
      .then((response) => {
        if (!response.ok) throw new Error('Vídeo indisponível');
        return response.blob();
      })
      .then((blob) => {
        if (controller.signal.aborted) return;
        objectUrl = URL.createObjectURL(blob);
        setSource(objectUrl);
      })
      .catch(() => { if (!controller.signal.aborted) setFailed(true); });
    return () => {
      controller.abort();
      if (objectUrl) URL.revokeObjectURL(objectUrl);
      setSource(null);
    };
  }, [reducedMotion, failed]);

  useEffect(() => {
    const element = video.current;
    if (!element || !source || reducedMotion || failed) return;
    let active = true;
    element.defaultPlaybackRate = 0.5;
    element.playbackRate = 0.5;
    const syncPlayback = () => {
      if (document.hidden) element.pause();
      else {
        // Autoplay pode ser bloqueado pelo navegador; a imagem continua visível.
        void element.play().catch(() => { if (active) setPlaying(false); });
      }
    };
    document.addEventListener('visibilitychange', syncPlayback);
    syncPlayback();
    return () => {
      active = false;
      document.removeEventListener('visibilitychange', syncPlayback);
      element.pause();
    };
  }, [source, reducedMotion, failed]);

  return (
    <div className={`sky-background${sunset ? ' sky-background--sunset' : ''}`} aria-hidden="true">
      <div className="sky-background-media" style={{ backgroundImage: `url(${assets.sky})` }}>
        {!reducedMotion && !failed && source && (
          <video ref={video} className={`sky-background-video ${playing ? 'is-playing' : ''}`}
            src={source} poster={assets.sky} loop muted playsInline preload="auto"
            disablePictureInPicture tabIndex={-1}
            onLoadedMetadata={(event) => { event.currentTarget.currentTime = Math.min(1, event.currentTarget.duration); }}
            onLoadStart={() => setPlaying(false)} onPlaying={() => setPlaying(true)} onError={() => setFailed(true)} />
        )}
      </div>
    </div>
  );
}
