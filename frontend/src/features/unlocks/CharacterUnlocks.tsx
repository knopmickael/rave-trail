import { useEffect, useState } from 'react';
import type { CharacterUnlockData } from '@game/contracts';
import { api, ApiError, gameDataCache } from '../../api';
import { useI18n } from '../../i18n/LanguageProvider';
import '../characters/characters.css';
import './unlocks.css';

export function CharacterUnlocks({ onBack, onSessionExpired }: {
  onBack: () => void;
  onSessionExpired: () => void;
}) {
  const { t, text } = useI18n();
  const [data, setData] = useState(() => gameDataCache.peek<CharacterUnlockData>('unlocks'));
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

  const missions = data?.characters.filter((unit) => unit.kind !== 'premium') ?? [];

  return <main className="unlocks-page">
    <header className="roster-header">
      <button type="button" className="back-arrow" onClick={onBack} aria-label={t('Voltar ao menu principal')}>
        <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
          <path d="M14 6 4 16l10 10M5 16h23" />
        </svg>
      </button>
      <h1>{t('Tabela de missões')}</h1>
    </header>
    {error && <section className="unlocks-state"><p className="feedback" role="alert">{text(error)}</p>
      <button className="fantasy-button compact" onClick={() => setAttempt((value) => value + 1)}>{t('Tentar novamente')}</button>
    </section>}
    {!data && !error && <p className="unlocks-state" role="status">{t('Carregando desbloqueios…')}</p>}
    {data && (missions.length === 0
      ? <p className="unlocks-state" role="status">{t('Nenhuma missão disponível no catálogo.')}</p>
      : <div className="unlocks-container" role="region" aria-label={t('Lista de missões')} tabIndex={0}>
        <div className="unlocks-grid">
          {missions.map((unit) => {
            const locked = !unit.unlocked && !unit.campaignAvailable;
            const campaignRequirement = unit.kind === 'battle-wins'
              ? unit.requirements.find((requirement) => requirement.description.startsWith('Finalize a batalha '))
              : undefined;
            const revealDescription = unit.kind === 'battle-wins' ? unit.revealRequirement ?? campaignRequirement?.description : undefined;
            const requirements = unit.kind === 'battle-wins'
              ? unit.requirements.filter((requirement) => requirement !== campaignRequirement
                || (!locked && requirement.current < requirement.target))
              : [];
            return <section key={unit.id} className={`unlock-card ${unit.unlocked ? 'unlock-card--available' : ''} ${locked ? 'unlock-card--locked' : ''}`}
              aria-labelledby={`unlock-${unit.id}`} aria-disabled={locked}>
              <div className="unlock-card-content" inert={locked}>
              <header className="unlock-card-header">
                <img src={unit.portrait} alt={t('Retrato de {name}', { name: text(unit.name) })} draggable={false} />
                <div><h2 id={`unlock-${unit.id}`}>{text(unit.name)}</h2>
                  <span className="unlock-status">{t(locked ? 'Bloqueada na campanha' : unit.unlocked ? 'Disponível' : 'Em progresso')}</span>
                </div>
              </header>
              <ul className="unlock-requirements" tabIndex={locked ? -1 : 0} aria-label={t('Requisitos de {name}', { name: text(unit.name) })}>
                {requirements.map((requirement, index) => <li key={index}>
                  <p id={`unlock-${unit.id}-${index}`}>{text(requirement.description)}</p>
                  <RequirementProgress requirement={requirement} labelId={`unlock-${unit.id}-${index}`} />
                </li>)}
              </ul>
              </div>
              {locked && <div className="unlock-mission-lock" role="img"
                aria-label={t('Missão de {name} bloqueada. {requirement}', { name: text(unit.name), requirement: revealDescription ? text(revealDescription) : t('Derrote este personagem na campanha para habilitá-la.') })}>
                <span className="unlock-mission-lock-icon" aria-hidden="true">
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="3">
                    <rect x="10" y="21" width="28" height="21" rx="4" /><path d="M16 21v-7a8 8 0 0 1 16 0v7M24 29v6" />
                  </svg>
                </span>
                {revealDescription && <CampaignRequirementLines description={revealDescription} />}
              </div>}
            </section>;
          })}
        </div>
      </div>)}

  </main>;
}

function CampaignRequirementLines({ description }: { description: string }) {
  const { text, locale } = useI18n();
  if (locale === 'en') return <p aria-hidden="true">{text(description)}</p>;
  const [battleLine, campaignLine] = description.split(' da campanha ');
  return <p aria-hidden="true">
    <span>{battleLine}</span>
    {campaignLine && <span>da campanha {campaignLine}</span>}
  </p>;
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
