// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { AnalyticsConsent } from './AnalyticsConsent';
import { ANALYTICS_CONSENT_KEY } from './consent';
import { AboutApp } from '../components/AboutPage';
import { setAnalyticsCollection } from './client';

vi.mock('./client', () => ({ setAnalyticsCollection: vi.fn(), setAnalyticsScreen: vi.fn() }));
vi.mock('./config', () => ({ analyticsConfig: { enabled: true, measurementId: 'G-B68K6N7WP1' } }));

beforeEach(() => {
  vi.mocked(setAnalyticsCollection).mockClear();
  localStorage.clear();
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR']);
});
afterEach(cleanup);

it.each(['Aprovar', 'Recusar analytics'] as const)('persiste %s e reutiliza a escolha no Sobre', async (label) => {
  const user = userEvent.setup();
  const page = render(<AnalyticsConsent showPreferences />);
  expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBeNull();
  expect(setAnalyticsCollection).not.toHaveBeenCalledWith(true, expect.anything());
  await user.click(screen.getByRole('button', { name: label }));
  expect(localStorage.getItem(ANALYTICS_CONSENT_KEY)).toBe(label === 'Aprovar' ? 'accepted' : 'declined');
  expect(setAnalyticsCollection).toHaveBeenLastCalledWith(label === 'Aprovar', expect.anything());
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Preferências' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Preferências' }));
  expect(screen.getByRole('heading', { name: 'Você escolhe o que compartilhar' })).toHaveFocus();
  await user.click(screen.getByRole('button', { name: 'Fechar preferências' }));
  page.unmount();
  render(<AboutApp />);
  expect(setAnalyticsCollection).toHaveBeenLastCalledWith(label === 'Aprovar', expect.anything());
  expect(screen.queryByRole('region', { name: 'Você escolhe o que compartilhar' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Preferências' })).not.toBeInTheDocument();
});

it('acompanha alterações e remoção da preferência em outra aba', () => {
  render(<AnalyticsConsent showPreferences />);
  act(() => {
    localStorage.setItem(ANALYTICS_CONSENT_KEY, 'declined');
    window.dispatchEvent(new StorageEvent('storage', { key: ANALYTICS_CONSENT_KEY, newValue: 'declined' }));
  });
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(setAnalyticsCollection).toHaveBeenLastCalledWith(false, expect.anything());
  act(() => {
    localStorage.clear();
    window.dispatchEvent(new StorageEvent('storage', { key: null }));
  });
  expect(screen.getByRole('region')).toBeInTheDocument();
});

it('pede uma escolha para valor inválido e funciona quando o armazenamento falha', async () => {
  localStorage.setItem(ANALYTICS_CONSENT_KEY, 'invalid');
  vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('Storage blocked'); });
  const user = userEvent.setup();
  render(<AnalyticsConsent showPreferences />);
  await user.click(screen.getByRole('button', { name: 'Recusar analytics' }));
  expect(screen.queryByRole('region')).not.toBeInTheDocument();
  expect(screen.getByRole('status')).toHaveTextContent('Não foi possível salvar');
  await user.click(screen.getByRole('button', { name: 'Preferências' }));
  expect(screen.getByText('Sua escolha atual: recusar analytics.')).toBeInTheDocument();
});
