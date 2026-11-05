import { site } from '../seo';

export function GameIntroduction() {
  return <section className="game-introduction" aria-labelledby="game-title">
    <h1 id="game-title">Rave Trail</h1>
    <p>{site.introduction}</p>
    <a href="/sobre/">Conheça o jogo e saiba como jogar</a>
  </section>;
}
