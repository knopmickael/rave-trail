import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import type { AbilityDefinition } from '@game/content/abilities';
import { useI18n } from '../../i18n/LanguageProvider';

export function AbilityTooltip({ ability, children, focusable = false, extra, resetKey }: {
  ability: AbilityDefinition; children: ReactNode; focusable?: boolean; extra?: string; resetKey: string;
}) {
  const { t, text } = useI18n();
  const id = useId();
  const anchor = useRef<HTMLSpanElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const suppressed = useRef(false);
  const [position, setPosition] = useState<{ left: number; width: number; top?: number; bottom?: number } | null>(null);

  function hide() {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
    setPosition(null);
  }
  function start() {
    if (suppressed.current || timer.current) return;
    timer.current = setTimeout(() => {
      timer.current = null;
      if (!anchor.current || suppressed.current) return;
      const rect = anchor.current.getBoundingClientRect();
      const width = Math.min(280, window.innerWidth - 24);
      setPosition({ width, left: Math.max(12, Math.min(window.innerWidth - width - 12, rect.left + rect.width / 2 - width / 2)),
        ...(rect.top >= 190 ? { bottom: window.innerHeight - rect.top + 8 } : { top: rect.bottom + 8 }) });
    }, 1000);
  }
  function leave() { suppressed.current = false; hide(); }
  function clicked() { suppressed.current = true; hide(); }

  useEffect(() => { hide(); }, [resetKey]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);
  useEffect(() => {
    if (!position) return;
    const close = () => hide();
    window.addEventListener('scroll', close, true);
    window.addEventListener('resize', close);
    return () => { window.removeEventListener('scroll', close, true); window.removeEventListener('resize', close); };
  }, [position]);

  return <span ref={anchor} className="ability-tooltip-anchor" tabIndex={focusable ? 0 : undefined}
    aria-label={focusable ? text(ability.name) : undefined} aria-describedby={position ? id : undefined}
    onMouseEnter={start} onMouseLeave={leave} onFocus={start} onBlur={leave}
    onPointerDownCapture={clicked} onClickCapture={clicked}
    onKeyDown={(event) => { if (event.key === 'Escape') clicked(); }}>
    {children}
    {position && <span id={id} role="tooltip" className="ability-tooltip" style={position}>
      <strong>{text(ability.name)}</strong><span>{text(ability.description)}</span><span>{t('Custo: {cost} de energia', { cost: ability.energyCost })}</span>
      {extra && <span>{extra}</span>}
    </span>}
  </span>;
}
