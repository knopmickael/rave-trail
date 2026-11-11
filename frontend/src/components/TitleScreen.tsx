import { assets } from '../assets';
import { GameIntroduction } from './GameIntroduction';
import { IndieRadarBadge } from './IndieRadarBadge';
import { useI18n } from '../i18n/LanguageProvider';
import { LanguageSelector } from '../i18n/LanguageSelector';

export function TitleScreen({ checking = false, onStart, error }: {
  checking?: boolean;
  onStart?: () => void;
  error?: string;
}) {
  const { t, text } = useI18n();
  return <main className="title-screen title-screen--landing">
    <div className="entry-language"><LanguageSelector /></div>
    <img className="game-logo" src={assets.logo} alt="Rave Trail" width="772" height="518" fetchPriority="high" />
    <GameIntroduction />
    <button className="fantasy-button" disabled={checking} onClick={onStart}>
      {t(checking ? 'Carregando sessão…' : 'Começar jogo')}
    </button>
    {error && <p className="feedback" role="alert">{text(error)}</p>}
    <IndieRadarBadge />
  </main>;
}
