import { useEffect, useState } from 'react';
import type { CampaignOption } from '@game/content/campaigns';
import { api, ApiError } from '../../api';
import { useI18n } from '../../i18n/LanguageProvider';
import './campaigns.css';

interface CampaignSelectionProps {
  onBack: () => void;
  onSessionExpired: () => void;
  onSelectCampaign: (id: string) => void;
}

export function CampaignSelection({ onBack, onSessionExpired, onSelectCampaign }: CampaignSelectionProps) {
  const { t, text } = useI18n();
  const [campaigns, setCampaigns] = useState<CampaignOption[] | null>(null);
  const [error, setError] = useState('');
  const [attempt, setAttempt] = useState(0);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    setError('');
    setCampaigns(null);
    api.campaigns().then((items) => { if (active) setCampaigns(items); })
      .catch((cause: unknown) => {
        if (!active) return;
        if (cause instanceof ApiError && cause.status === 401) { onSessionExpired(); return; }
        setError(cause instanceof Error ? cause.message : 'Não foi possível carregar as campanhas.');
      });
    return () => { active = false; };
  }, [attempt, onSessionExpired]);

  const selected = campaigns?.find((campaign) => campaign.id === selectedId && campaign.available);

  return (
    <main className="campaign-page">
      <header className="campaign-header">
        <button type="button" className="campaign-back" onClick={onBack} aria-label={t('Voltar ao menu principal')}>
          <Arrow direction="left" />
        </button>
        <h1>{t('Selecionar campanha')}</h1>
      </header>

      {error ? <section className="campaign-state">
        <p role="alert">{text(error)}</p>
        <button className="fantasy-button compact" onClick={() => setAttempt((value) => value + 1)}>{t('Tentar novamente')}</button>
      </section> : !campaigns ? <p className="campaign-state" role="status">{t('Carregando campanhas…')}</p>
        : campaigns.length === 0 ? <p className="campaign-state" role="status">{t('Nenhuma campanha cadastrada.')}</p> : (
          <section className="campaign-carousel" aria-label={t('Capítulos da campanha')}>
            <div className="campaign-track" tabIndex={0} aria-label={t('Lista de campanhas')} role="region">
              {campaigns.map((campaign) => (
                <button type="button" key={campaign.id}
                  className={`campaign-card ${campaign.available ? 'campaign-card--available' : 'campaign-card--locked'}`}
                  disabled={!campaign.available} aria-pressed={selectedId === campaign.id}
                  aria-label={t(campaign.available ? 'Capítulo {number}: {title}' : 'Capítulo {number}: {title} — bloqueado', { number: campaign.chapterNumber, title: text(campaign.title) })}
                  title={campaign.available ? text(campaign.description) : t('Capítulo bloqueado')}
                  onClick={() => { if (campaign.available) { setSelectedId(campaign.id); onSelectCampaign(campaign.id); } }}>
                  <img className="campaign-card-image" src={campaign.background} alt="" draggable={false} />
                  <span className="campaign-card-shade" aria-hidden="true" />
                  <span className="campaign-card-caption">
                    <span className="campaign-chapter-number">{t('Capítulo {number}', { number: campaign.chapterNumber })}</span>
                    <span className="campaign-chapter-title">{text(campaign.title)}</span>
                  </span>
                </button>
              ))}
            </div>
            <button className="campaign-scroll campaign-scroll--next" disabled
              aria-label={t('Ver próximos capítulos')}><Arrow direction="right" /></button>
          </section>
        )}
      <p className="campaign-selection-status" role="status">{selected ? t('Capítulo {number} selecionado: {title}.', { number: selected.chapterNumber, title: text(selected.title) }) : ''}</p>
    </main>
  );
}

function Arrow({ direction }: { direction: 'left' | 'right' }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden="true">
    <path d={direction === 'left' ? 'M14 6 4 16l10 10M5 16h23' : 'm18 6 10 10-10 10M27 16H4'} />
  </svg>;
}
