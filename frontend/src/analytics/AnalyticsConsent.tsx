import { useEffect, useRef, useState } from 'react';
import { useI18n } from '../i18n/LanguageProvider';
import { useAnalyticsConsent, type AnalyticsConsent as Consent } from './consent';
import { analyticsConfig } from './config';
import { setAnalyticsCollection } from './client';

export function AnalyticsConsent() {
  const { t } = useI18n();
  const { consent, ready, persisted, choose } = useAnalyticsConsent();
  const [reviewing, setReviewing] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const preferences = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (reviewing) heading.current?.focus();
  }, [reviewing]);

  useEffect(() => {
    if (ready) setAnalyticsCollection(consent === 'accepted', analyticsConfig);
  }, [consent, ready]);

  if (!ready) return null;
  const open = consent === null || reviewing;
  function save(next: Exclude<Consent, null>) {
    // Stop collection synchronously on refusal, before React's next effect.
    if (next === 'declined') setAnalyticsCollection(false, analyticsConfig);
    choose(next);
    setReviewing(false);
    preferences.current?.focus();
  }

  return <div className="analytics-consent">
    <button ref={preferences} type="button" className="analytics-preferences" aria-expanded={open}
      aria-controls="analytics-choice" onClick={() => setReviewing(true)}>{t('Preferências de analytics')}</button>
    {open && <section id="analytics-choice" className="analytics-choice" aria-labelledby="analytics-choice-title">
      <h2 id="analytics-choice-title" ref={heading} tabIndex={-1}>{t('Você escolhe o que compartilhar')}</h2>
      <p>{t('Sua permissão permitirá usar o Google Analytics para entender visitas e o caminho até as batalhas, sem enviar nome, e-mail ou identificador de conta. Você pode recusar e continuar jogando, ou mudar sua escolha a qualquer momento.')}</p>
      <p className="analytics-note">{t('O Google Analytics só será carregado após sua aprovação. Sua escolha é salva neste navegador e pode ser alterada aqui.')}</p>
      {!analyticsConfig.enabled && <p className="analytics-note">{t('A coleta está desativada neste ambiente.')}</p>}
      {consent !== null && <p>{consent === 'accepted' ? t('Sua escolha atual: aceitar analytics.') : t('Sua escolha atual: recusar analytics.')}</p>}
      <div className="analytics-actions">
        <button type="button" onClick={() => save('declined')}>{t('Recusar analytics')}</button>
        <button type="button" onClick={() => save('accepted')}>{t('Aprovar')}</button>
        {consent !== null && <button type="button" onClick={() => { setReviewing(false); preferences.current?.focus(); }}>{t('Fechar preferências')}</button>}
      </div>
    </section>}
    {!persisted && <p className="analytics-storage-message" role="status">{t('Não foi possível salvar a preferência. Sua escolha vale nesta página; ao recarregar, perguntaremos novamente.')}</p>}
  </div>;
}
