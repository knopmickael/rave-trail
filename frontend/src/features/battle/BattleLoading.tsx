import { assets } from '../../assets';
import './battle-loading.css';

export function BattleLoading() {
  return <main className="battle-loading-screen" style={{ backgroundImage: `url("${assets.sky}")` }}>
    <section className="battle-loading-modal" role="status" aria-live="polite">
      <p>Carregando batalha...</p>
    </section>
  </main>;
}
