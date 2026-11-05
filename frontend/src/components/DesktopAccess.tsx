import { useLayoutEffect, useRef, useSyncExternalStore, type ReactNode } from 'react';
import { assets } from '../assets';
import { site } from '../seo';
import './desktop-access.css';

const noticePath = '/acesse-pelo-computador';
const isNarrow = () => window.innerWidth < 720;
const subscribe = (update: () => void) => {
  window.addEventListener('resize', update);
  return () => window.removeEventListener('resize', update);
};

export function DesktopAccess({ children }: { children: ReactNode }) {
  const blocked = useSyncExternalStore(subscribe, isNarrow);
  const returnUrl = useRef(window.location.pathname === noticePath ? '/'
    : `${window.location.pathname}${window.location.search}${window.location.hash}`);

  useLayoutEffect(() => {
    if (blocked && window.location.pathname !== noticePath) {
      window.history.replaceState(null, '', noticePath);
    } else if (!blocked && window.location.pathname === noticePath) {
      window.history.replaceState(null, '', returnUrl.current);
    }
  }, [blocked]);

  if (!blocked) return children;
  return <main className="desktop-access" aria-labelledby="desktop-access-message">
    <section className="desktop-access-content">
      <img src={assets.logo} alt="Rave Trail" />
      <h1 id="desktop-access-message">Para ter uma melhor experiência com o jogo, por favor acesse-o através de um computador.</h1>
      <p>{site.introduction}</p>
      <a href="/sobre/">Conheça o Rave Trail e saiba como jogar</a>
    </section>
  </main>;
}
