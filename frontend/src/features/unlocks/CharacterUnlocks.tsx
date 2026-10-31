import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import type { CharacterUnlockData } from '@game/contracts';
import { api, ApiError } from '../../api';
import '../characters/characters.css';
import './unlocks.css';

const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' });

export function CharacterUnlocks({ onBack, onOpenCharacters, onSessionExpired }: {
  onBack: () => void;
  onOpenCharacters: () => void;
  onSessionExpired: () => void;
}) {
  const [data, setData] = useState<CharacterUnlockData | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [canPrevious, setCanPrevious] = useState(false);
  const [canNext, setCanNext] = useState(false);
  const track = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    setError('');
    api.characterUnlocks().then((saved) => { if (active) setData(saved); }).catch((cause: unknown) => {
      if (!active) return;
      if (cause instanceof ApiError && cause.status === 401) onSessionExpired();
      else setError(cause instanceof Error ? cause.message : 'Não foi possível carregar os desbloqueios.');
    });
    return () => { active = false; };
  }, [attempt, onSessionExpired]);

  useEffect(() => {
    const refresh = () => setAttempt((value) => value + 1);
    window.addEventListener('focus', refresh);
    return () => window.removeEventListener('focus', refresh);
  }, []);

  useEffect(() => {
    const element = track.current;
    if (!element) { setCanPrevious(false); setCanNext(false); return; }
    const measure = () => {
      setCanPrevious(element.scrollLeft > 1);
      setCanNext(element.scrollWidth - element.clientWidth - element.scrollLeft > 1);
    };
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    observer?.observe(element);
    element.addEventListener('scroll', measure);
    window.addEventListener('resize', measure);
    measure();
    return () => {
      observer?.disconnect();
      element.removeEventListener('scroll', measure);
      window.removeEventListener('resize', measure);
    };
  }, [data]);

  function scroll(direction: -1 | 1) {
    const element = track.current;
    if (!element) return;
    const card = element.querySelector<HTMLElement>('.unlock-card');
    const step = (card?.getBoundingClientRect().width || element.clientWidth) + (parseFloat(getComputedStyle(element).columnGap) || 0);
    const columns = Math.max(1, Math.floor(element.clientWidth / step));
    element.scrollBy({ left: direction * columns * step,
      behavior: window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
    element.focus({ preventScroll: true });
  }

  function navigate(event: KeyboardEvent<HTMLDivElement>) {
    if (event.target !== event.currentTarget || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
    event.preventDefault();
    scroll(event.key === 'ArrowLeft' ? -1 : 1);
  }

  return <main className="unlocks-page">
    <header className="roster-header">
      <button type="button" className="back-arrow" onClick={onBack} aria-label="Voltar ao menu principal">
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M14 6 4 16l10 10M5 16h23" />
        </svg>
      </button>
      <h1>Missões</h1>
    </header>
    <div className="unlocks-intro">
      <p>Derrote os personagens na campanha para habilitar suas missões. Complete os requisitos para liberá-los na Lista de personagens.</p>
      <button className="text-button" onClick={onOpenCharacters}>Abrir Lista de personagens</button>
    </div>
    {error && <section className="unlocks-state"><p className="feedback" role="alert">{error}</p>
      <button className="fantasy-button compact" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button>
    </section>}
    {!data && !error && <p className="unlocks-state" role="status">Carregando desbloqueios…</p>}
    {data && (data.characters.length === 0
      ? <p className="unlocks-state" role="status">Nenhuma missão disponível no catálogo.</p>
      : <div className="unlocks-carousel">
        {canPrevious && <button type="button" className="unlocks-scroll unlocks-scroll--previous"
          aria-label="Ver missões anteriores" aria-controls="mission-track" onClick={() => scroll(-1)}><ScrollArrow previous /></button>}
        <div ref={track} id="mission-track" className="unlocks-grid" role="region" aria-label="Lista de missões"
          tabIndex={0} onKeyDown={navigate} style={{ gridTemplateColumns: `repeat(${Math.ceil(data.characters.length / 2)}, var(--mission-card-width))` }}>
          {data.characters.map((unit) => {
            const locked = !unit.campaignAvailable;
            return <section key={unit.id} className={`unlock-card ${unit.unlocked ? 'unlock-card--available' : ''} ${locked ? 'unlock-card--locked' : ''}`}
              aria-labelledby={`unlock-${unit.id}`} aria-disabled={locked}>
              <div className="unlock-card-content" inert={locked}>
              <header className="unlock-card-header">
                <img src={unit.portrait} alt={`Retrato de ${unit.name}`} draggable={false} />
                <div><h2 id={`unlock-${unit.id}`}>{unit.name}</h2>
                  <span className="unlock-status">{locked ? 'Bloqueada na campanha' : unit.unlocked ? 'Disponível' : unit.kind === 'premium' ? 'Premium' : 'Em progresso'}</span>
                </div>
              </header>
              {unit.kind === 'premium' ? <>
                <div className="unlock-card-body unlock-premium"><p className="unlock-price">{price.format(unit.priceUsd)}</p></div>
                <button type="button" className="fantasy-button compact" disabled>Adquirir personagem</button>
              </> : <ul className="unlock-requirements" tabIndex={locked ? -1 : 0} aria-label={`Requisitos de ${unit.name}`}>
                {unit.requirements.map((requirement, index) => <li key={index}>
                  <p id={`unlock-${unit.id}-${index}`}>{requirement.description}</p>
                  <RequirementProgress requirement={requirement} labelId={`unlock-${unit.id}-${index}`} />
                </li>)}
              </ul>}
              </div>
              {locked && <span className="unlock-mission-lock" role="img" aria-label={`Missão de ${unit.name} bloqueada. Derrote este personagem na campanha para habilitá-la.`}>
                <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3" aria-hidden="true">
                  <rect x="10" y="21" width="28" height="21" rx="4" /><path d="M16 21v-7a8 8 0 0 1 16 0v7M24 29v6" />
                </svg>
              </span>}
            </section>;
          })}
        </div>
        {canNext && <button type="button" className="unlocks-scroll unlocks-scroll--next"
          aria-label="Ver próximas missões" aria-controls="mission-track" onClick={() => scroll(1)}><ScrollArrow /></button>}
      </div>)}

  </main>;
}

function RequirementProgress({ requirement, labelId }: {
  requirement: { current: number; target: number }; labelId: string;
}) {
  return <div className="unlock-progress-line">
    <div className="unlock-progress" role="progressbar" aria-labelledby={labelId}
      aria-valuemin={0} aria-valuemax={requirement.target} aria-valuenow={requirement.current}>
      <span style={{ width: `${requirement.current / requirement.target * 100}%` }} />
    </div>
    <span>{requirement.current} / {requirement.target}</span>
  </div>;
}

function ScrollArrow({ previous = false }: { previous?: boolean }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path d={previous ? 'M20 6 10 16l10 10' : 'm12 6 10 10-10 10'} />
  </svg>;
}
