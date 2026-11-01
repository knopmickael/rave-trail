// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { campaigns } from '@game/content/campaigns';
import { api, ApiError } from '../../api';
import { CampaignSelection } from './CampaignSelection';

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, campaigns: vi.fn() } };
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.campaigns).mockResolvedValue(campaigns.map((campaign) => ({ ...campaign, available: campaign.id === 'path-1' })));
});
afterEach(cleanup);

it('permite selecionar o primeiro capítulo e impede selecionar o bloqueado', async () => {
  const user = userEvent.setup();
  render(<CampaignSelection onBack={vi.fn()} onSessionExpired={vi.fn()} onSelectCampaign={vi.fn()} />);
  const first = await screen.findByRole('button', { name: 'Capítulo 1: Pondo o pé na estrada' });
  const second = screen.getByRole('button', { name: 'Capítulo 2: Além das Fronteiras — bloqueado' });
  expect(first).toBeEnabled();
  expect(first).toHaveAttribute('aria-pressed', 'false');
  expect(second).toBeDisabled();
  await user.click(first);
  expect(first).toHaveAttribute('aria-pressed', 'true');
  await user.click(second);
  expect(second).toHaveAttribute('aria-pressed', 'false');
  expect(first).toHaveAttribute('aria-pressed', 'true');
});

it('aceita mais capítulos, omite a seta anterior e mantém a próxima desabilitada', async () => {
  const base = campaigns[1];
  vi.mocked(api.campaigns).mockResolvedValue(Array.from({ length: 6 }, (_, index) => ({ ...base, id: `extra-${index}`, chapterNumber: index + 1, title: `Capítulo extra ${index + 1}`, available: index === 0 })));
  render(<CampaignSelection onBack={vi.fn()} onSessionExpired={vi.fn()} onSelectCampaign={vi.fn()} />);
  await screen.findByRole('button', { name: 'Capítulo 1: Capítulo extra 1' });
  expect(screen.getAllByRole('button', { name: /^Capítulo \d:/ })).toHaveLength(6);
  expect(screen.queryByRole('button', { name: 'Ver capítulos anteriores' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Ver próximos capítulos' })).toBeDisabled();
});

it('mostra erro sem inventar campanhas e permite recarregar', async () => {
  vi.mocked(api.campaigns).mockRejectedValueOnce(new Error('Servidor indisponível.'));
  const user = userEvent.setup();
  render(<CampaignSelection onBack={vi.fn()} onSessionExpired={vi.fn()} onSelectCampaign={vi.fn()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Servidor indisponível.');
  expect(screen.queryByRole('button', { name: /^Capítulo 1:/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByRole('button', { name: 'Capítulo 1: Pondo o pé na estrada' })).toBeEnabled();
});

it('informa sessão expirada e mantém retorno ao menu acessível', async () => {
  const onSessionExpired = vi.fn();
  const onBack = vi.fn();
  vi.mocked(api.campaigns).mockRejectedValueOnce(new ApiError('Sessão expirada.', 401));
  const user = userEvent.setup();
  render(<CampaignSelection onBack={onBack} onSessionExpired={onSessionExpired} onSelectCampaign={vi.fn()} />);
  await vi.waitFor(() => expect(onSessionExpired).toHaveBeenCalledTimes(1));
  await user.click(screen.getByRole('button', { name: 'Voltar ao menu principal' }));
  expect(onBack).toHaveBeenCalledTimes(1);
});

it('trata um catálogo vazio sem falhar', async () => {
  vi.mocked(api.campaigns).mockResolvedValue([]);
  render(<CampaignSelection onBack={vi.fn()} onSessionExpired={vi.fn()} onSelectCampaign={vi.fn()} />);
  expect(await screen.findByText('Nenhuma campanha cadastrada.')).toBeInTheDocument();
});
