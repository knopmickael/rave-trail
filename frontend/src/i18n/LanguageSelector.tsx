import { useId } from 'react';
import { isLanguagePreference, useI18n } from './LanguageProvider';

export function LanguageSelector({ details = false }: { details?: boolean }) {
  const id = useId();
  const { t, locale, preference, setPreference } = useI18n();
  return <div className="language-selector">
    <label htmlFor={id}>{t('Idioma')}</label>
    <select id={id} value={preference} aria-describedby={details ? `${id}-help` : undefined}
      onChange={(event) => { if (isLanguagePreference(event.target.value)) setPreference(event.target.value); }}>
      <option value="auto">{t('Automático (navegador)')}</option>
      <option value="pt-BR" lang="pt-BR">Português</option>
      <option value="en" lang="en">English</option>
    </select>
    {details && <p id={`${id}-help`}>{t('Idioma atual: {language}. Sua escolha é salva neste navegador.', { language: locale === 'en' ? 'English' : 'Português' })}</p>}
  </div>;
}
