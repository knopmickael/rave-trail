import { useEffect, useState } from 'react';
import type { CharacterUnlockData } from '@game/contracts';
import { SECOND_CAMPAIGN_UNIT_IDS } from '@game/content/second-campaign';
import { api, ApiError } from '../../api';
import '../characters/characters.css';
import './unlocks.css';

const price = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'USD' });
const hiddenUnitIds = new Set<string>(SECOND_CAMPAIGN_UNIT_IDS);

export function CharacterUnlocks({ onBack, onSessionExpired }: {
  onBack: () => void;
  onSessionExpired: () => void;
}) {
  const [data, setData] = useState<CharacterUnlockData | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);

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

  const missions = data?.characters.filter((unit) => !hiddenUnitIds.has(unit.id) && unit.kind !== 'premium') ?? [];

  return <main className="unlocks-page">
    <header className="roster-header">
      <button type="button" className="back-arrow" onClick={onBack} aria-label="Voltar ao menu principal">
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M14 6 4 16l10 10M5 16h23" />
        </svg>
      </button>
      <h1>Tabela de missões</h1>
    </header>
    {error && <section className="unlocks-state"><p className="feedback" role="alert">{error}</p>
      <button className="fantasy-button compact" onClick={() => setAttempt((value) => value + 1)}>Tentar novamente</button>
    </section>}
    {!data && !error && <p className="unlocks-state" role="status">Carregando desbloqueios…</p>}
    {data && (missions.length === 0
      ? <p className="unlocks-state" role="status">Nenhuma missão disponível no catálogo.</p>
      : <div className="unlocks-container" role="region" aria-label="Lista de missões" tabIndex={0}>
        <div className="unlocks-grid">
          {missions.map((unit) => {
            const locked = !unit.unlocked && !unit.campaignAvailable;
            const campaignRequirement = locked && unit.kind === 'battle-wins'
              ? unit.requirements.find((requirement) => requirement.description.startsWith('Finalize a batalha '))
              : undefined;
            const requirements = unit.kind === 'battle-wins'
              ? unit.requirements.filter((requirement) => requirement !== campaignRequirement)
              : [];
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
                <button type="button" className="fantasy-button compact" disabled>{unit.unlocked ? 'Personagem adquirido' : 'Adquirir personagem'}</button>
              </> : <ul className="unlock-requirements" tabIndex={locked ? -1 : 0} aria-label={`Requisitos de ${unit.name}`}>
                {requirements.map((requirement, index) => <li key={index}>
                  <p id={`unlock-${unit.id}-${index}`}>{requirement.description}</p>
                  <RequirementProgress requirement={requirement} labelId={`unlock-${unit.id}-${index}`} />
                </li>)}
              </ul>}
              </div>
              {locked && <div className="unlock-mission-lock" role="img"
                aria-label={`Missão de ${unit.name} bloqueada. ${campaignRequirement?.description ?? 'Derrote este personagem na campanha para habilitá-la.'}`}>
                <span className="unlock-mission-lock-icon" aria-hidden="true">
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3">
                    <rect x="10" y="21" width="28" height="21" rx="4" /><path d="M16 21v-7a8 8 0 0 1 16 0v7M24 29v6" />
                  </svg>
                </span>
                {campaignRequirement && <p aria-hidden="true">{campaignRequirement.description}</p>}
              </div>}
            </section>;
          })}
        </div>
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
