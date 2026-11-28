// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { units } from '@game/content/units';
import { createInitialProgress, type PlayerProgress } from '@game/contracts';
import { FINAL_ENCOUNTER_ID } from '@game/content/campaign-rules';
import { SECOND_CAMPAIGN_CHARACTERS } from '@game/content/second-campaign';
import { characterUnlockProgress } from '@game/core/unlocks';
import { api, ApiError, clearGameData, gameDataCache } from '../../api';
import { CharacterUnlocks } from './CharacterUnlocks';

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, characterUnlocks: vi.fn(), progress: vi.fn() } };
});
const props = () => ({ onBack: vi.fn(), onSessionExpired: vi.fn() });
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => {
  vi.clearAllMocks();
  clearGameData();
  vi.mocked(api.progress).mockResolvedValue(createInitialProgress());
  vi.mocked(api.characterUnlocks).mockResolvedValue(characterUnlockProgress(units, [], []));
});
afterEach(() => { cleanup(); clearGameData(); });

it('mostra os novos requisitos e inclui Premium com missão, mantendo fora os Premium sem missão', async () => {
  render(<CharacterUnlocks {...props()} />);
  const raider = await screen.findByRole('region', { name: 'Saqueador da estrada I' });
  expect(screen.queryByRole('region', { name: 'General Abel' })).not.toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Lista de missões' })).toHaveClass('unlocks-container');
  expect(screen.getByRole('region', { name: 'Lista de missões' })).toHaveAttribute('tabindex', '0');
  expect(within(raider).getAllByRole('progressbar')).toHaveLength(2);
  expect(within(raider).getAllByRole('progressbar')[1]).toHaveAttribute('aria-valuemax', '1');
  expect(within(raider).getAllByRole('progressbar')[1]).toHaveAttribute('aria-valuenow', '0');
  const jung = screen.getByRole('region', { name: 'Jung de Grimória' });
  expect(within(jung).getByText(/utilizando Ravi de Berdal/)).toBeInTheDocument();
  expect(within(screen.getByRole('region', { name: 'Exal de Grimória' })).getByText(/Derrote Exal de Grimória na Batalha rápida 3 vezes/)).toBeInTheDocument();
  const berserk = screen.getByRole('region', { name: 'Ravi Berzerk' });
  expect(within(berserk).getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-valuemax'))).toEqual(['25', '15', '15', '15', '10']);
  expect(within(berserk).getByRole('list', { name: 'Requisitos de Ravi Berzerk' })).toHaveAttribute('tabindex', '0');
  expect(screen.queryByRole('button', { name: /Ver requisitos/ })).not.toBeInTheDocument();
  expect(screen.queryByText(/requisitos? concluídos?/)).not.toBeInTheDocument();
  for (const name of ['Trinity de Espinea', 'Vlade de Espinea']) {
    const card = screen.getByRole('region', { name });
    expect(within(card).getAllByRole('progressbar')[1]).toHaveAttribute('aria-valuemax', '5');
    expect(within(card).getByText(/Derrote Trinity de Espinea na Batalha rápida 5 vezes|Derrote Vlade de Espinea na Batalha rápida 5 vezes/)).toBeInTheDocument();
  }
  const drak = screen.getByRole('region', { name: 'Drak de Pontes' });
  expect(within(drak).getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-valuemax'))).toEqual(['10', '5', '3']);
  expect(within(drak).getByText(/Derrote Drak de Pontes na Batalha rápida 3 vezes utilizando Saqueadores da estrada/)).toBeInTheDocument();
  const passago = screen.getByRole('region', { name: 'Passago de Espinea' });
  expect(within(passago).getAllByRole('progressbar').map((bar) => bar.getAttribute('aria-valuemax'))).toEqual(['10', '5', '3']);
  expect(within(passago).getByText(/Derrote Passago de Espinea na Batalha rápida 5 vezes/)).toBeInTheDocument();
  for (const name of ['Exal - Verdadeiro poder', 'Besta Lendária Zéfiro']) {
    expect(within(screen.getByRole('region', { name })).getByText('Também disponível como Premium')).toBeInTheDocument();
  }
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /Resgatar|Liberar/ })).not.toBeInTheDocument();
});

it('exibe Ravi Berzerk e os Premium com missão já liberados na conta GM', async () => {
  const ids = units.map((unit) => unit.id);
  vi.mocked(api.characterUnlocks).mockResolvedValue(characterUnlockProgress(units, ids, [], {}, []));
  render(<CharacterUnlocks {...props()} />);
  const card = await screen.findByRole('region', { name: 'Ravi Berzerk' });
  expect(card).toHaveAttribute('aria-disabled', 'false');
  expect(card).not.toHaveClass('unlock-card--locked');
  expect(card.querySelector('.unlock-card-content')).not.toHaveAttribute('inert');
  expect(within(card).getByText('Disponível')).toBeInTheDocument();
  expect(card.querySelector('.unlock-mission-lock')).toBeNull();
  expect(screen.getByRole('region', { name: 'Exal - Verdadeiro poder' })).toHaveAttribute('aria-disabled', 'false');
  expect(screen.getByRole('region', { name: 'Besta Lendária Zéfiro' })).toHaveAttribute('aria-disabled', 'false');
});

it('mostra um estado vazio se o catálogo não possuir missões', async () => {
  vi.mocked(api.characterUnlocks).mockResolvedValue({ characters: [] });
  render(<CharacterUnlocks {...props()} />);
  expect(await screen.findByText('Nenhuma missão disponível no catálogo.')).toHaveAttribute('role', 'status');
  expect(screen.queryByRole('region', { name: 'Lista de missões' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Ver próximas missões' })).not.toBeInTheDocument();
});

it('mostra no cadeado a batalha de revelação configurada, mesmo diferente dos requisitos', async () => {
  const data = characterUnlockProgress(units, [], [], {}, []);
  vi.mocked(api.characterUnlocks).mockResolvedValue({ characters: data.characters.map((unit) => unit.id === 'road-raider-1-base' && unit.kind === 'battle-wins'
    ? { ...unit, revealRequirement: 'Finalize a batalha 4 da campanha 2' } : unit) });
  render(<CharacterUnlocks {...props()} />);
  const card = await screen.findByRole('region', { name: 'Saqueador da estrada I' });
  expect(within(card).getByRole('img', { name: /Missão de Saqueador da estrada I bloqueada\. Finalize a batalha 4 da campanha 2/ })).toBeInTheDocument();
  expect(within(card).getByText('Finalize a batalha 4')).toBeInTheDocument();
});

it('mantém as missões ainda não habilitadas visíveis, inertes e com cadeado', async () => {
  const data = characterUnlockProgress(units, [], [], {}, ['road-raider-1-base']);
  vi.mocked(api.characterUnlocks).mockResolvedValue({ characters: data.characters.map((unit) => unit.id === 'protagonist-main-transformed' && unit.kind === 'battle-wins'
    ? { ...unit, revealRequirement: 'Finalize a batalha 7 da campanha 1' } : unit) });
  render(<CharacterUnlocks {...props()} />);
  const enabled = await screen.findByRole('region', { name: 'Saqueador da estrada I' });
  expect(enabled).toHaveAttribute('aria-disabled', 'false');
  const locked = screen.getByRole('region', { name: 'Ravi Berzerk' });
  expect(locked).toHaveClass('unlock-card--locked');
  expect(locked).toHaveAttribute('aria-disabled', 'true');
  expect(locked.querySelector('.unlock-card-content')).toHaveAttribute('inert');
  expect(within(locked).getByRole('img', { name: /Missão de Ravi Berzerk bloqueada/ })).toBeInTheDocument();
  expect(within(locked).getByText('Finalize a batalha 7')).toBeInTheDocument();
  expect(within(locked).getByText('da campanha 1')).toBeInTheDocument();
  expect(within(within(locked).getByRole('list', { name: 'Requisitos de Ravi Berzerk' }))
    .queryByText('Finalize a batalha 7')).not.toBeInTheDocument();
  expect(within(locked).getAllByRole('progressbar')).toHaveLength(5);
  expect(document.querySelectorAll('.unlock-card')).toHaveLength(23);
});

it('oculta todas as missões da campanha 2 mesmo após vencer as seis primeiras batalhas da campanha 1', async () => {
  vi.mocked(api.progress).mockResolvedValue({ ...createInitialProgress(), completedEncounters: Array.from({ length: 6 }, (_, i) => `path-1-encounter-${i + 1}`) });
  render(<CharacterUnlocks {...props()} />);
  await screen.findByRole('region', { name: 'Saqueador da estrada I' });
  for (const unit of SECOND_CAMPAIGN_CHARACTERS) expect(screen.queryByRole('region', { name: unit.name })).not.toBeInTheDocument();
});

it('revela as 16 missões da campanha 2 após a final, mantendo os requisitos e a exclusão de Premium', async () => {
  vi.mocked(api.progress).mockResolvedValue({ ...createInitialProgress(), completedEncounters: [FINAL_ENCOUNTER_ID] });
  vi.mocked(api.characterUnlocks).mockResolvedValue(characterUnlockProgress(units, [], [], {}, []));
  render(<CharacterUnlocks {...props()} />);
  const abel = await screen.findByRole('region', { name: 'General Abel' });
  expect(within(abel).getByText('Vença 10 partidas no modo Batalha rápida.')).toBeInTheDocument();
  expect(abel).toHaveClass('unlock-card--locked');
  expect(document.querySelectorAll('.unlock-card')).toHaveLength(39);
  for (const unit of SECOND_CAMPAIGN_CHARACTERS.filter((unit) => unit.id !== 'maga-artemis')) {
    expect(screen.getByRole('region', { name: unit.name })).toBeInTheDocument();
  }
  expect(screen.queryByRole('region', { name: 'Maga Ártemis' })).not.toBeInTheDocument();
});

it('não exibe spoilers do cache enquanto aguarda o progresso e revela os cartões quando a vitória é confirmada', async () => {
  gameDataCache.set('unlocks', characterUnlockProgress(units, [], []));
  let finish!: (progress: PlayerProgress) => void;
  vi.mocked(api.progress).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  render(<CharacterUnlocks {...props()} />);
  expect(screen.queryByRole('region', { name: 'General Abel' })).not.toBeInTheDocument();
  await act(async () => { finish({ ...createInitialProgress(), completedEncounters: [FINAL_ENCOUNTER_ID] }); });
  expect(await screen.findByRole('region', { name: 'General Abel' })).toBeInTheDocument();
});

it('mantém os dados carregados ao retornar à janela sem repetir a consulta', async () => {
  const victories = Array.from({ length: 4 }, () => ({ mode: 'quick' as const, playerUnitIds: ['protagonist-main-base'], enemyUnitIds: ['road-raider-1-base'] }));
  vi.mocked(api.characterUnlocks).mockResolvedValueOnce(characterUnlockProgress(units, [], victories, {}, undefined, ['path-1-encounter-1']));
  render(<CharacterUnlocks {...props()} />);
  const card = await screen.findByRole('region', { name: 'Saqueador da estrada I' });
  expect(within(card).getAllByRole('progressbar')[0]).toHaveAttribute('aria-valuenow', '3');
  fireEvent.focus(window);
  expect(api.characterUnlocks).toHaveBeenCalledTimes(1);
  expect(within(card).getAllByRole('progressbar')[0]).toHaveAttribute('aria-valuenow', '3');
  expect(within(card).queryByText('Finalize a batalha 1')).not.toBeInTheDocument();
  expect(within(card).getByText('Em progresso')).toBeInTheDocument();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  expect(screen.queryByText(/desbloqueado com sucesso/i)).not.toBeInTheDocument();
});

it('exibe somente a listagem de missões e permite voltar ao menu', async () => {
  const handlers = props(); const user = userEvent.setup();
  render(<CharacterUnlocks {...handlers} />);
  await screen.findByRole('region', { name: 'Saqueador da estrada I' });
  expect(screen.queryByRole('button', { name: 'Abrir Lista de personagens' })).not.toBeInTheDocument();
  expect(screen.queryByText(/Derrote os personagens na campanha para habilitar suas missões/)).not.toBeInTheDocument();
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
