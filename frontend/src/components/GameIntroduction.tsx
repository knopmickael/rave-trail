import { site } from '../seo';
import { useI18n } from '../i18n/LanguageProvider';

export function GameIntroduction() {
  const { t, text } = useI18n();
  return <section className="game-introduction" aria-labelledby="game-title">
    <h1 id="game-title">Rave Trail</h1>
    <p>{text(site.introduction)}</p>
    <a href="/sobre/">{t('Conheça o jogo e saiba como jogar')}</a>
  </section>;
}
