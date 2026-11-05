// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { DesktopAccess } from './DesktopAccess';

const originalWidth = window.innerWidth;
function resize(width: number) {
  Object.defineProperty(window, 'innerWidth', { configurable: true, writable: true, value: width });
  fireEvent.resize(window);
}
afterEach(() => {
  cleanup();
  resize(originalWidth);
  window.history.replaceState(null, '', '/');
});

it('redireciona larguras abaixo de 720 px e mostra o aviso com logo sem montar o jogo', () => {
  resize(719);
  const game = vi.fn(() => <button>Jogar</button>);
  const Game = game;
  render(<DesktopAccess><Game /></DesktopAccess>);
  expect(window.location.pathname).toBe('/acesse-pelo-computador');
  expect(screen.getByRole('heading')).toHaveTextContent('Para ter uma melhor experiência com o jogo, por favor acesse-o através de um computador.');
  expect(screen.getByRole('img', { name: 'Rave Trail' })).toHaveAttribute('src', '/media/images/logo-rave-trail.png');
  expect(game).not.toHaveBeenCalled();
});

it('permite exatamente 720 px e aplica o bloqueio ao redimensionar, restaurando a URL ao ampliar', () => {
  resize(720);
  window.history.replaceState(null, '', '/?origem=teste#inicio');
  render(<DesktopAccess><button>Jogar</button></DesktopAccess>);
  expect(screen.getByRole('button', { name: 'Jogar' })).toBeInTheDocument();
  resize(600);
  expect(window.location.pathname).toBe('/acesse-pelo-computador');
  expect(screen.queryByRole('button', { name: 'Jogar' })).not.toBeInTheDocument();
  resize(1280);
  expect(window.location.pathname + window.location.search + window.location.hash).toBe('/?origem=teste#inicio');
  expect(screen.getByRole('button', { name: 'Jogar' })).toBeInTheDocument();
});

it('retorna ao início ao abrir diretamente a página de aviso em uma tela compatível', () => {
  resize(1920);
  window.history.replaceState(null, '', '/acesse-pelo-computador');
  render(<DesktopAccess><button>Jogar</button></DesktopAccess>);
  expect(window.location.pathname).toBe('/');
  expect(screen.getByRole('button', { name: 'Jogar' })).toBeInTheDocument();
});
