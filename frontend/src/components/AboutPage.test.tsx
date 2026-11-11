// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AboutApp } from './AboutPage';
import { LanguageProvider, LANGUAGE_STORAGE_KEY } from '../i18n/LanguageProvider';
import { TitleScreen } from './TitleScreen';

beforeEach(() => {
  localStorage.clear();
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR']);
});
afterEach(cleanup);

it('hidrata o HTML português e aplica a escolha inglesa sem divergências nem acesso à API', async () => {
  localStorage.setItem(LANGUAGE_STORAGE_KEY, 'en');
  const fetch = vi.spyOn(globalThis, 'fetch');
  const container = document.createElement('div');
  container.innerHTML = renderToString(<AboutApp />);
  expect(container.querySelector('h1')).toHaveTextContent('Conheça Rave Trail');
  document.body.append(container);
  const recoverableError = vi.fn();
  let root!: ReturnType<typeof hydrateRoot>;
  try {
    await act(async () => { root = hydrateRoot(container, <AboutApp />, { onRecoverableError: recoverableError }); });
    expect(screen.getByRole('heading', { name: 'Discover Rave Trail' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'How to play Rave Trail' })).toBeInTheDocument();
    expect(screen.getByText('Do I need to create an account?')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'How to play' })).toHaveAttribute('href', '#como-jogar');
    expect(document.title).toBe('About Rave Trail | Discover the RPG and learn how to play');
    expect(document.documentElement.lang).toBe('en');
    expect(recoverableError).not.toHaveBeenCalled();
    expect(fetch).not.toHaveBeenCalled();
  } finally {
    await act(async () => root.unmount());
    container.remove();
  }
});

it('permite trocar o idioma no Sobre e reaproveita essa escolha ao voltar ao jogo', async () => {
  const user = userEvent.setup();
  const about = render(<AboutApp />);
  await user.selectOptions(screen.getByLabelText('Idioma'), 'en');
  expect(screen.getByRole('heading', { name: 'Discover Rave Trail' })).toBeInTheDocument();
  expect(localStorage.getItem(LANGUAGE_STORAGE_KEY)).toBe('en');
  about.unmount();
  render(<LanguageProvider><TitleScreen /></LanguageProvider>);
  expect(screen.getByRole('button', { name: 'Start game' })).toBeInTheDocument();
});

it('segue o idioma do navegador quando a escolha é automática', async () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
  const user = userEvent.setup();
  render(<AboutApp />);
  expect(screen.getByRole('heading', { name: 'Discover Rave Trail' })).toBeInTheDocument();
  expect(screen.getByLabelText('Language')).toHaveValue('auto');
  await user.selectOptions(screen.getByLabelText('Language'), 'pt-BR');
  expect(screen.getByRole('heading', { name: 'Conheça Rave Trail' })).toBeInTheDocument();
  expect(document.documentElement.lang).toBe('pt-BR');
});
