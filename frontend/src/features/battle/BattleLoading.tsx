import { assets } from '../../assets';
import { useI18n } from '../../i18n/LanguageProvider';
import './battle-loading.css';

export function BattleLoading() {
  const { t } = useI18n();
  return <main className="battle-loading-screen" style={{ backgroundImage: `url("${assets.sky}")` }}>
    <section className="battle-loading-modal" role="status" aria-live="polite">
      <p>{t('Carregando batalha...')}</p>
    </section>
  </main>;
}
