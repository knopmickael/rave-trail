// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { units } from '@game/content/units';
import { characterUnlockProgress } from '@game/core/unlocks';
import { api, ApiError } from '../../api';
import { CharacterUnlocks } from './CharacterUnlocks';

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, characterUnlocks: vi.fn() } };
});
const props = () => ({ onBack: vi.fn(), onOpenCharacters: vi.fn(), onSessionExpired: vi.fn() });
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.characterUnlocks).mockResolvedValue(characterUnlockProgress(units, [], []));
});
afterEach(cleanup);

it('mostra todos os requisitos dentro dos cartões e os preços com compra desabilitada', async () => {
  render(<CharacterUnlocks {...props()} />);
  const raider = await screen.findByRole('region', { name: 'Saqueador da estrada I' });
  expect(within(raider).getByRole('progressbar')).toHaveAttribute('aria-valuemax', '5');
  expect(within(raider).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '0');
  const jung = screen.getByRole('region', { name: 'Jung de Grimória' });
  expect(within(jung).getByText(/utilizando Ravi de Berdal/)).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Exal de Grimória' })).getByText(/Multiplayer 10 vezes/)).toBeInTheDocument();
  const berserk = screen.getByRole('region', { name: 'Ravi Berserk' });
  expect(within(berserk).getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-valuemax'))).toEqual(['15', '20', '10', '50']);
  expect(within(berserk).getByRole('list', { name: 'Requisitos de Ravi Berserk' })).toHaveAttribute('tabindex', '0');
  expect(screen.queryByRole('button', { name: /Ver requisitos/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/requisitos? concluídos?/)).not.toBeInTheDocument();
  for (const name of ['Trinity de Espinea', 'Vlade de Espinea']) {
    const card = screen.getByRole('region', { name });
    expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuemax', '20');
    expect(within(card).getByText(/Derrote Grimorianos na Batalha rápida 20 vezes/)).toBeInTheDocument();
  }
  const passago = screen.getByRole('region', { name: 'Passago de Espinea' });
  expect(within(passago).getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-valuemax'))).toEqual(['20', '10']);
  expect(within(passago).getByText(/Derrote Grimorianos no Multiplayer 10 vezes/)).toBeInTheDocument();
  for (const name of ['Exal - Verdadeiro poder', 'Fera Lendária']) {
    const premium = screen.getByRole('region', { name });
    expect(within(premium).getByRole('button', { name: 'Adquirir personagem' })).toBeDisabled();
    expect(within(premium).getByText(/9,90/)).toBeInTheDocument();
    expect(within(premium).queryByRole('progressbar')).not.toBeInTheDocument();
  }
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Resgatar|Liberar/ })).not.toBeInTheDocument();
});

it('mostra um estado vazio se o catálogo não possuir missões', async () => {
  vi.mocked(api.characterUnlocks).mockResolvedValue({ characters: [] });
  render(<CharacterUnlocks {...props()} />);
  expect(await screen.findByText('Nenhuma missão disponível no catálogo.')).toHaveAttribute('role', 'status');
  expect(screen.queryByRole('region', { name: 'Lista de missões' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ver próximas missões' })).not.toBeInTheDocument();
});

it('mantém as missões ainda não habilitadas visíveis, inertes e com cadeado', async () => {
  vi.mocked(api.characterUnlocks).mockResolvedValue(characterUnlockProgress(units, [], [], {}, ['road-raider-1-base']));
  render(<CharacterUnlocks {...props()} />);
  const enabled = await screen.findByRole('region', { name: 'Saqueador da estrada I' });
  expect(enabled).toHaveAttribute('aria-disabled', 'false');
  const locked = screen.getByRole('region', { name: 'Ravi Berserk' });
  expect(locked).toHaveClass('unlock-card--locked');
  expect(locked).toHaveAttribute('aria-disabled', 'true');
  expect(locked.querySelector('.unlock-card-content')).toHaveAttribute('inert');
  expect(within(locked).getByRole('img', { name: /Missão de Ravi Berserk bloqueada/ })).toBeInTheDocument();
  expect(document.querySelectorAll('.unlock-card')).toHaveLength(16);
});

it('navega por botões e esconde cada seta ao alcançar a respectiva borda, inclusive após redimensionar', async () => {
  const user = userEvent.setup();
  render(<CharacterUnlocks {...props()} />);
  const track = await screen.findByRole('region', { name: 'Lista de missões' });
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: 620 });
  Object.defineProperty(track, 'scrollWidth', { configurable: true, value: 1250 });
  const move = vi.fn(({ left }: ScrollToOptions) => {
    track.scrollLeft = Math.max(0, Math.min(track.scrollWidth - track.clientWidth, track.scrollLeft + (left ?? 0)));
    fireEvent.scroll(track);
  });
  Object.defineProperty(track, 'scrollBy', { configurable: true, value: move });
  fireEvent.resize(window);
  expect(screen.queryByRole('button', { name: 'Ver missões anteriores' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Ver próximas missões' }));
  expect(move).toHaveBeenCalledWith({ left: 620, behavior: 'smooth' });
  expect(track).toHaveFocus();
  expect(screen.getByRole('button', { name: 'Ver missões anteriores' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Ver próximas missões' }));
  expect(screen.queryByRole('button', { name: 'Ver próximas missões' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Ver missões anteriores' }));
  await user.click(screen.getByRole('button', { name: 'Ver missões anteriores' }));
  expect(screen.queryByRole('button', { name: 'Ver missões anteriores' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ver próximas missões' })).toBeInTheDocument();
  Object.defineProperty(track, 'clientWidth', { configurable: true, value: 1250 });
  fireEvent.resize(window);
  expect(screen.queryByRole('button', { name: 'Ver próximas missões' })).not.toBeInTheDocument();
});

it('atualiza o progresso ao retornar à janela e reflete a disponibilidade sem notificações', async () => {
  const victories = Array.from({ length: 4 }, () => ({ mode: 'quick' as const, playerUnitIds: ['protagonist-main-base'], enemyUnitIds: ['road-raider-1-base'] }));
  vi.mocked(api.characterUnlocks).mockResolvedValueOnce(characterUnlockProgress(units, [], victories));
  render(<CharacterUnlocks {...props()} />);
  const card = await screen.findByRole('region', { name: 'Saqueador da estrada I' });
  expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '4');
  vi.mocked(api.characterUnlocks).mockResolvedValueOnce(characterUnlockProgress(units, ['road-raider-1-base'], [...victories, victories[0]]));
  fireEvent.focus(window);
  await vi.waitFor(() => expect(within(card).getByRole('progressbar')).toHaveAttribute('aria-valuenow', '5'));
  expect(within(card).getByText('Disponível')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(/desbloqueado com sucesso/i)).not.toBeInTheDocument();
});

it('permite abrir a Lista de personagens e voltar ao menu', async () => {
  const handlers = props(); const user = userEvent.setup();
  render(<CharacterUnlocks {...handlers} />);
  await screen.findByRole('region', { name: 'Saqueador da estrada I' });
  await user.click(screen.getByRole('button', { name: 'Abrir Lista de personagens' }));
  expect(handlers.onOpenCharacters).toHaveBeenCalledTimes(1);
  await user.click(screen.getByRole('button', { name: 'Voltar ao menu principal' }));
  expect(handlers.onBack).toHaveBeenCalledTimes(1);
});

it('permite tentar novamente quando a consulta falha', async () => {
  vi.mocked(api.characterUnlocks).mockRejectedValueOnce(new Error('Falha ao consultar as metas.'));
  const user = userEvent.setup();
  render(<CharacterUnlocks {...props()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao consultar as metas.');
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByRole('region', { name: 'Saqueador da estrada I' })).toBeInTheDocument();
});

it('retorna à autenticação quando a sessão expira', async () => {
  vi.mocked(api.characterUnlocks).mockRejectedValueOnce(new ApiError('Sessão expirada.', 401));
  const handlers = props();
  render(<CharacterUnlocks {...handlers} />);
  await vi.waitFor(() => expect(handlers.onSessionExpired).toHaveBeenCalledTimes(1));
});
