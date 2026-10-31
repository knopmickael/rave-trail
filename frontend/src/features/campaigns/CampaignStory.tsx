import { useRef } from 'react';
import gameHistory from '../../../../game-history.txt?raw';

// O prólogo antecede as seções de planejamento da narrativa no arquivo original.
const [, ...introduction] = gameHistory.replace(/\r\n?/g, '\n').split('\nDesenvolvimento da narrativa')[0].trim().split(/\n+/);

export function CampaignStory() {
  const dialog = useRef<HTMLDialogElement>(null);

  return <>
    <button type="button" className="campaign-story-button" aria-label="Ler história de Rave Trail"
      title="Ler história de Rave Trail" aria-haspopup="dialog" aria-controls="campaign-story-dialog"
      onClick={() => dialog.current?.showModal()}>
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M8 21h12a2 2 0 0 0 2-2v-2H10v2a2 2 0 1 1-4 0V5a2 2 0 0 0-4 0v2h4" />
        <path d="M19 17V5a2 2 0 0 0-2-2H4M10 8h5M10 12h5" />
      </svg>
    </button>
    <dialog ref={dialog} id="campaign-story-dialog" className="campaign-story-dialog"
      aria-labelledby="campaign-story-title"
      onClick={(event) => { if (event.target === event.currentTarget) dialog.current?.close(); }}>
      <header className="campaign-story-header">
        <div><span className="campaign-story-kicker">Antes da primeira batalha</span>
          <h2 id="campaign-story-title">História de Rave Trail</h2>
        </div>
        <button type="button" className="drawer-close" aria-label="Fechar história" autoFocus
          onClick={() => dialog.current?.close()}>×</button>
      </header>
      <div className="campaign-story-body" tabIndex={0} role="region" aria-label="Prólogo de Rave Trail">
        {introduction.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
      </div>
    </dialog>
  </>;
}
