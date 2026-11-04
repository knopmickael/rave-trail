// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createInitialProgress } from '@game/contracts';
import { abilities } from '@game/content/abilities';
import { narrativeCharacters, units } from '@game/content/units';
import { api } from '../../api';
import { Store } from './Store';

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, catalog: vi.fn(), progress: vi.fn() } };
});

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.catalog).mockResolvedValue({ units, characters: Object.values(narrativeCharacters), abilities: Object.values(abilities) });
  vi.mocked(api.progress).mockResolvedValue(createInitialProgress());
});
afterEach(cleanup);

async function openBeast() {
  const user = userEvent.setup();
  render(<Store onBack={vi.fn()} onSessionExpired={vi.fn()} />);
  await user.click(await screen.findByRole('button', { name: 'Personagens' }));
  await user.click(screen.getByRole('button', { name: 'Besta Lendária' }));
  return screen.getByRole('region', { name: 'Detalhes de Besta Lendária' });
}

it('mostra a arte original da Loja sem cadeado e mantém a compra desabilitada', async () => {
  const details = await openBeast();
  expect(within(details).getByRole('img', { name: 'Ilustração de corpo inteiro de Besta Lendária' })).toBeInTheDocument();
  expect(within(details).queryByRole('img', { name: /bloqueada/ })).not.toBeInTheDocument();
  expect(details.querySelector('.character-lock')).toBeNull();
  expect(details.querySelector('.character-illustration--locked')).toBeNull();
  expect(within(details).getByRole('button', { name: 'Adquirir por 9.90 USD' })).toBeDisabled();
});

it('marca a unidade premium como adquirida quando ela já está desbloqueada na conta', async () => {
  const progress = createInitialProgress();
  progress.unlockedUnitIds.push('legendary-beast-premium');
  vi.mocked(api.progress).mockResolvedValue(progress);
  const details = await openBeast();
  expect(within(details).getByRole('button', { name: 'Personagem adquirido' })).toBeDisabled();
  expect(within(details).queryByRole('button', { name: 'Adquirir por 9.90 USD' })).not.toBeInTheDocument();
});
