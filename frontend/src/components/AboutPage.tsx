import { LanguageProvider, useI18n } from '../i18n/LanguageProvider';
import { LanguageSelector } from '../i18n/LanguageSelector';
import { assets } from '../assets';

export const ABOUT_TITLE = 'Sobre Rave Trail | Conheça o RPG e saiba como jogar';

export function AboutApp() {
  return <LanguageProvider pageTitle={ABOUT_TITLE} deferDetection><AboutPage /></LanguageProvider>;
}

export function AboutPage() {
  const { t } = useI18n();
  return <>
    <header className="public-header">
      <a href="/" aria-label={t('Rave Trail — início')}><img src={assets.logo} alt="Rave Trail" width="772" height="518" fetchPriority="high" /></a>
      <nav aria-label={t('Navegação')}><a href="#como-jogar">{t('Como jogar')}</a><a href="#perguntas">{t('Perguntas frequentes')}</a><a href="/" className="play-link">{t('Jogar Rave Trail')}</a></nav>
      <div className="public-language"><LanguageSelector /></div>
    </header>
    <main className="about-game"><article>
      <header className="about-intro">
        <p className="eyebrow">{t('RPG de fantasia no navegador')}</p>
        <h1>{t('Conheça Rave Trail')}</h1>
        <p>{t('Rave Trail é um RPG online de fantasia com batalhas estratégicas por turnos. Monte uma equipe de personagens, explore campanhas e escolha suas habilidades para superar cada confronto.')}</p>
        <p>{t('Também conhecido como rave-trail ou ravetrail, o jogo está disponível em')} <a href="https://rave-trail.com.br/">rave-trail.com.br</a>. {t('A interface está disponível em português e inglês, com seleção automática pelo navegador e troca de idioma nas configurações. O jogo roda diretamente no navegador do computador, sem instalar um aplicativo.')}</p>
        <a className="play-link" href="/">{t('Começar a jogar')}</a>
      </header>
      <section aria-labelledby="aventura">
        <h2 id="aventura">{t('Uma jornada de fantasia e estratégia')}</h2>
        <p>{t('Acompanhe Ravi, Doko e Anna, que deixam Berdal em uma missão de reconhecimento pelas rotas comerciais. No caminho, a equipe enfrenta saqueadores, conhece novos adversários e descobre desafios que vão além de seu vilarejo.')}</p>
        <p>{t('Avance pelos encontros da campanha, conheça personagens de diferentes regiões e encontre a combinação de habilidades certa para cada batalha.')}</p>
      </section>
      <section aria-labelledby="recursos">
        <h2 id="recursos">{t('O que você encontra em Rave Trail')}</h2>
        <ul className="features">
          <li><h3>{t('Combate por turnos')}</h3><p>{t('Escolha ataques, proteção e cura. Planeje a ordem das ações e administre a energia da equipe.')}</p></li>
          <li><h3>{t('Sua própria equipe')}</h3><p>{t('Combine até três personagens e suas habilidades para criar uma estratégia.')}</p></li>
          <li><h3>{t('Campanhas de fantasia')}</h3><p>{t('Explore o mapa, enfrente encontros sequenciais e acompanhe a jornada dos protagonistas.')}</p></li>
          <li><h3>{t('Batalhas rápidas e missões')}</h3><p>{t('Enfrente equipes sorteadas, complete objetivos e avance no desbloqueio de personagens.')}</p></li>
        </ul>
      </section>
      <section aria-labelledby="como-jogar">
        <h2 id="como-jogar">{t('Como jogar Rave Trail')}</h2>
        <ol className="steps">
          <li><a href="/">{t('Acesse a página inicial do Rave Trail pelo navegador de um computador.')}</a></li>
          <li>{t('Selecione Começar jogo e crie sua conta com e-mail e senha, ou entre em uma conta existente.')}</li>
          <li>{t('Abra a Lista de personagens e monte sua equipe com os personagens disponíveis.')}</li>
          <li>{t('Escolha Campanha para avançar pela história ou Batalha rápida para enfrentar uma equipe sorteada.')}</li>
          <li>{t('Durante o combate, escolha as habilidades e os alvos, confira o combo do turno e encerre o turno para executar sua estratégia.')}</li>
        </ol>
      </section>
      <section aria-labelledby="perguntas">
        <h2 id="perguntas">{t('Perguntas frequentes')}</h2>
        <details open><summary>{t('Rave Trail, rave-trail e ravetrail são o mesmo jogo?')}</summary><p>{t('Sim. Essas são variações do nome Rave Trail. O endereço do jogo é')} <a href="https://rave-trail.com.br/">https://rave-trail.com.br/</a>.</p></details>
        <details><summary>{t('Preciso instalar alguma coisa para jogar?')}</summary><p>{t('Não é necessário instalar um aplicativo. O jogo funciona no navegador, com JavaScript ativado e conexão à internet.')}</p></details>
        <details><summary>{t('Posso jogar pelo celular?')}</summary><p>{t('A interface do jogo foi projetada para computadores. Abaixo de 720 pixels de largura, uma página recomenda acessar o jogo por um computador. Esta apresentação pode ser lida em qualquer tamanho de tela.')}</p></details>
        <details><summary>{t('Preciso criar uma conta?')}</summary><p>{t('Sim. A conta permite salvar sua equipe, o progresso na campanha, os desbloqueios e os resultados das batalhas.')}</p></details>
        <details><summary>{t('Rave Trail tem combate em tempo real?')}</summary><p>{t('O combate é por turnos. Cada turno tem um limite de tempo para você selecionar habilidades, escolher alvos e confirmar as ações da equipe.')}</p></details>
      </section>
      <footer className="about-footer"><a className="play-link" href="/">{t('Jogar Rave Trail no computador')}</a><p>{t('Rave Trail — RPG de fantasia e estratégia por turnos.')}</p></footer>
    </article></main>
  </>;
}
