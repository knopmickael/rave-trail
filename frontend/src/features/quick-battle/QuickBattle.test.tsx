// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createInitialProgress } from '@game/contracts';
import { abilities } from '@game/content/abilities';
import { narrativeCharacters, STARTER_UNIT_IDS, units } from '@game/content/units';
import { encounters } from '@game/content/encounters';
import { createBattle, type BattleRecord } from '@game/core/battle';
import { api, ApiError } from '../../api';
import { QuickBattle } from './QuickBattle';

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, quickBattle: vi.fn(), catalog: vi.fn(), progress: vi.fn(), startQuickBattle: vi.fn() } };
});
const enemies = units.filter((unit) => encounters[0].enemyUnitIds.includes(unit.id));
const battle = (): BattleRecord => ({ id: '00000000-0000-4000-8000-000000000001', encounterId: null, revision: 0,
  state: createBattle(STARTER_UNIT_IDS.map((id) => units.find((unit) => unit.id === id)!), enemies, Object.values(abilities)) });
const props = () => ({ onBack: vi.fn(), onOpenCharacters: vi.fn(), onSessionExpired: vi.fn(), onBattleStarted: vi.fn() });

beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.quickBattle).mockResolvedValue({ opponents: enemies });
  vi.mocked(api.catalog).mockResolvedValue({ units, characters: Object.values(narrativeCharacters), abilities: Object.values(abilities) });
  const progress = createInitialProgress(); progress.selectedTeam = [...STARTER_UNIT_IDS];
  vi.mocked(api.progress).mockResolvedValue(progress);
  vi.mocked(api.startQuickBattle).mockResolvedValue(battle());
});
afterEach(cleanup);

it('mostra a explicação, somente os adversários retornados e a equipe nos slots corretos', async () => {
  const handlers = props(); const user = userEvent.setup();
  render(<QuickBattle {...handlers} />);
  expect(screen.getByRole('heading', { name: 'Batalha rápida' })).toBeInTheDocument();
  expect(screen.getByText(/inimigos que você já derrotou na campanha/)).toBeInTheDocument();
  const opponents = await screen.findByRole('list', { name: 'Adversários disponíveis' });
  expect(within(opponents).getAllByRole('img')).toHaveLength(3);
  enemies.forEach((unit) => expect(within(opponents).getByRole('img', { name: `Retrato de ${unit.name}` })).toHaveAttribute('src', unit.portrait));
  within(opponents).getAllByRole('listitem').forEach((item) => expect(item).toHaveTextContent(''));
  expect(within(opponents).queryByText('Exal de Grimória')).not.toBeInTheDocument();
  const team = screen.getByRole('region', { name: 'Minha equipe' });
  expect(team.querySelector('.team-panel')).toBeInTheDocument();
  STARTER_UNIT_IDS.forEach((id, index) => expect(within(team).getByRole('group', { name: `Slot ${index + 1}: ${units.find((unit) => unit.id === id)!.name}` })).toBeInTheDocument());
  expect(screen.getByRole('button', { name: 'Entrar na batalha' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Voltar ao menu principal' }));
  expect(handlers.onBack).toHaveBeenCalledTimes(1);
});

it('abre a Lista de personagens pelo bloco Minha equipe', async () => {
  const handlers = props(); const user = userEvent.setup();
  render(<QuickBattle {...handlers} />);
  const team = await screen.findByRole('region', { name: 'Minha equipe' });
  await user.click(within(team).getByRole('button', { name: 'Abrir Lista de personagens' }));
  expect(handlers.onOpenCharacters).toHaveBeenCalledTimes(1);
});

it('impede iniciar se o catálogo não retornar adversários', async () => {
  vi.mocked(api.quickBattle).mockResolvedValue({ opponents: [] });
  const user = userEvent.setup();
  render(<QuickBattle {...props()} />);
  expect(await screen.findByText(/Nenhum adversário disponível/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Entrar na batalha' }));
  expect(api.startQuickBattle).not.toHaveBeenCalled();
});

it('mostra a equipe vazia e orienta montá-la antes de iniciar', async () => {
  vi.mocked(api.progress).mockResolvedValue(createInitialProgress());
  render(<QuickBattle {...props()} />);
  expect(await screen.findByText(/Monte sua equipe na Lista de personagens/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Entrar na batalha' })).toBeDisabled();
  const team = screen.getByRole('region', { name: 'Minha equipe' });
  expect(within(team).getAllByRole('img', { name: /^Slot \d vazio$/ })).toHaveLength(3);
});

it('inicia pelo servidor, bloqueia cliques repetidos e entrega o sorteio retornado', async () => {
  let finish!: (value: BattleRecord) => void;
  vi.mocked(api.startQuickBattle).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const handlers = props(); const user = userEvent.setup();
  render(<QuickBattle {...handlers} />);
  await screen.findByRole('list', { name: 'Adversários disponíveis' });
  await user.click(screen.getByRole('button', { name: 'Entrar na batalha' }));
  expect(screen.getByRole('button', { name: 'Preparando batalha…' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Voltar ao menu principal' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Preparando batalha…' }));
  expect(api.startQuickBattle).toHaveBeenCalledTimes(1);
  expect(api.startQuickBattle).toHaveBeenCalledWith();
  const record = battle(); finish(record);
  await vi.waitFor(() => expect(handlers.onBattleStarted).toHaveBeenCalledWith(record));
});

it('permite tentar novamente após erro de carregamento', async () => {
  vi.mocked(api.quickBattle).mockRejectedValueOnce(new Error('Servidor indisponível.'));
  const user = userEvent.setup();
  render(<QuickBattle {...props()} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Servidor indisponível.');
  expect(screen.getByRole('button', { name: 'Entrar na batalha' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByRole('list', { name: 'Adversários disponíveis' })).toBeInTheDocument();
});

it('preserva a página após falha no início e permite tentar novamente', async () => {
  vi.mocked(api.startQuickBattle).mockRejectedValueOnce(new Error('Não foi possível iniciar.'));
  const handlers = props(); const user = userEvent.setup();
  render(<QuickBattle {...handlers} />);
  await screen.findByRole('list', { name: 'Adversários disponíveis' });
  await user.click(screen.getByRole('button', { name: 'Entrar na batalha' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível iniciar.');
  expect(handlers.onBattleStarted).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Entrar na batalha' }));
  await vi.waitFor(() => expect(handlers.onBattleStarted).toHaveBeenCalledTimes(1));
});

it.each(['carregamento', 'início'])('informa sessão expirada no %s', async (step) => {
  if (step === 'carregamento') vi.mocked(api.quickBattle).mockRejectedValueOnce(new ApiError('Sessão expirada.', 401));
  else vi.mocked(api.startQuickBattle).mockRejectedValueOnce(new ApiError('Sessão expirada.', 401));
  const handlers = props(); const user = userEvent.setup();
  render(<QuickBattle {...handlers} />);
  if (step === 'início') {
    await screen.findByRole('list', { name: 'Adversários disponíveis' });
    await user.click(screen.getByRole('button', { name: 'Entrar na batalha' }));
  }
  await vi.waitFor(() => expect(handlers.onSessionExpired).toHaveBeenCalledTimes(1));
});
