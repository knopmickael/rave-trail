// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { abilities } from '@game/content/abilities';
import { AbilityTooltip } from './AbilityTooltip';

beforeEach(() => vi.useFakeTimers());
afterEach(() => { cleanup(); vi.useRealTimers(); });
const advance = (ms: number) => act(async () => { await vi.advanceTimersByTimeAsync(ms); });

it('só mostra os detalhes após um segundo e os fecha imediatamente ao clicar, sem reabrir sozinho', async () => {
  render(<AbilityTooltip ability={abilities.guard} resetKey="0"><button>Ícone</button></AbilityTooltip>);
  const button = screen.getByRole('button', { name: 'Ícone' });
  expect(button).not.toHaveAttribute('title');
  fireEvent.mouseOver(button);
  await advance(999);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  await advance(1);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Guarda');
  expect(screen.getByRole('tooltip')).toHaveTextContent('Custo: 10 de energia');
  fireEvent.click(button);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  await advance(2000);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.mouseOut(button, { relatedTarget: document.body });
  fireEvent.mouseOver(button);
  await advance(1000);
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
});

it('cancela o atraso ao sair do ícone e fecha o balão quando a seleção muda', async () => {
  const view = render(<AbilityTooltip ability={abilities.guard} resetKey="0"><button>Ícone</button></AbilityTooltip>);
  fireEvent.mouseOver(screen.getByRole('button'));
  await advance(700);
  fireEvent.mouseOut(screen.getByRole('button'), { relatedTarget: document.body });
  await advance(1000);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  fireEvent.mouseOver(screen.getByRole('button'));
  await advance(1000);
  expect(screen.getByRole('tooltip')).toBeInTheDocument();
  view.rerender(<AbilityTooltip ability={abilities.guard} resetKey="1"><button>Ícone</button></AbilityTooltip>);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});

it('permite consultar efeitos ou habilidades desabilitadas pelo teclado, com fechamento por Escape', async () => {
  const view = render(<AbilityTooltip ability={abilities['female-special']} resetKey="0" focusable extra="2 turnos restantes.">
    <button disabled>Ícone</button>
  </AbilityTooltip>);
  const anchor = view.container.querySelector('.ability-tooltip-anchor')!;
  fireEvent.focus(anchor);
  await advance(1000);
  expect(screen.getByRole('tooltip')).toHaveTextContent('Proteção coletiva');
  expect(screen.getByRole('tooltip')).toHaveTextContent('2 turnos restantes.');
  fireEvent.keyDown(anchor, { key: 'Escape' });
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  await advance(1000);
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
});
