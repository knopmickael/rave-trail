import { assets } from '../assets';
import { GameIntroduction } from './GameIntroduction';
import { IndieRadarBadge } from './IndieRadarBadge';

export function TitleScreen({ checking = false, onStart, error }: {
  checking?: boolean;
  onStart?: () => void;
  error?: string;
}) {
  return <main className="title-screen title-screen--landing">
    <img className="game-logo" src={assets.logo} alt="Rave Trail" width="772" height="518" fetchPriority="high" />
    <GameIntroduction />
    <button className="fantasy-button" disabled={checking} onClick={onStart}>
      {checking ? 'Carregando sessão…' : 'Começar jogo'}
    </button>
    {error && <p className="feedback" role="alert">{error}</p>}
    <IndieRadarBadge />
  </main>;
}
