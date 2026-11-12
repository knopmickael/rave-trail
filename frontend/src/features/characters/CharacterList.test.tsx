// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createInitialProgress } from '@game/contracts';
import { abilities } from '@game/content/abilities';
import { narrativeCharacters, units } from '@game/content/units';
import { api } from '../../api';
import { CharacterList } from './CharacterList';

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, progress: vi.fn(), catalog: vi.fn(), setTeamSlot: vi.fn() } };
});
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
});
beforeEach(() => {
  vi.clearAllMocks();
  vi.mocked(api.progress).mockResolvedValue(createInitialProgress());
  vi.mocked(api.catalog).mockResolvedValue({ units, characters: Object.values(narrativeCharacters), abilities: Object.values(abilities) });
  vi.mocked(api.setTeamSlot).mockResolvedValue([null, null, null]);
});
afterEach(cleanup);

function renderList() {
  return render(<CharacterList onBack={vi.fn()} onSessionExpired={vi.fn()} />);
}

it.each(['Exal - Verdadeiro poder', 'Besta Lendária'])('mostra somente aquisição desabilitada para %s bloqueado', async (name) => {
  const user = userEvent.setup();
  renderList();
  await user.click(await screen.findByRole('button', { name: `Selecionar ${name} — bloqueado` }));
  const details = screen.getByRole('region', { name: `Detalhes de ${name}` });
  expect(within(details).getByRole('button', { name: 'Adicionar à equipe' })).toBeDisabled();
  expect(within(details).queryByRole('button', { name: 'Adquirir personagem' })).not.toBeInTheDocument();
  expect(api.setTeamSlot).not.toHaveBeenCalled();
});

it('destaca a thumb clicada e apresenta as quatro habilidades do personagem à direita', async () => {
  const user = userEvent.setup();
  renderList();
  const aren = await screen.findByRole('button', { name: 'Selecionar Ravi de Berdal' });
  const lia = screen.getByRole('button', { name: 'Selecionar Anna de Berdal' });
  expect(screen.queryByRole('heading', { name: 'Conheça seus personagens' })).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: /Detalhes/ })).not.toBeInTheDocument();
  await user.click(aren);
  expect(aren).toHaveAttribute('aria-pressed', 'true');
  const details = screen.getByRole('region', { name: 'Detalhes de Ravi de Berdal' });
  expect(within(details).getByRole('img', { name: /corpo inteiro de Ravi de Berdal/ })).toBeInTheDocument();
  expect(within(details).getAllByRole('listitem')).toHaveLength(4);
  expect(within(details).getByRole('heading', { name: 'Investida' })).toBeInTheDocument();
  await user.click(lia);
  expect(lia).toHaveAttribute('aria-pressed', 'true');
  expect(aren).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('heading', { name: 'Varredura tática' })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Detalhes de Ravi de Berdal' })).not.toBeInTheDocument();
  expect(screen.queryByText('ARTE PROVISÓRIA')).not.toBeInTheDocument();
  expect(screen.queryByText(/Nomes e artes provisórios/)).not.toBeInTheDocument();
  expect(screen.queryByText(/Jovem da guarda/)).not.toBeInTheDocument();
  expect(screen.queryByText(/100 HP/)).not.toBeInTheDocument();
});

it('exibe todo o catálogo do banco sem textos auxiliares e com os novos inimigos bloqueados', async () => {
  renderList();
  await screen.findByRole('button', { name: 'Selecionar Ravi de Berdal' });
  const catalog = screen.getByRole('region', { name: 'Catálogo de personagens' });
  expect(within(catalog).getAllByRole('button')).toHaveLength(units.length);
  expect(within(catalog).getAllByRole('button').map((button) => button.getAttribute('aria-label'))).toEqual(units.map((unit) => `Selecionar ${unit.name}${unit.unlock.kind === 'starter' ? '' : ' — bloqueado'}`));
  expect(within(catalog).getByRole('button', { name: 'Selecionar Doko de Berdal' })).toBeEnabled();
  expect(within(catalog).getByRole('button', { name: 'Selecionar Anna de Berdal' })).toBeEnabled();
  expect(within(catalog).getByRole('button', { name: 'Selecionar Drak de Pontes — bloqueado' })).toBeEnabled();
  expect(within(catalog).getByRole('button', { name: 'Selecionar Ravi Berserk — bloqueado' })).toBeEnabled();
  expect(within(catalog).getByRole('button', { name: 'Selecionar Besta Lendária — bloqueado' })).toBeEnabled();
  expect(screen.queryByText(/Seus companheiros de jornada/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/unidades desbloqueadas/i)).not.toBeInTheDocument();
  expect(screen.queryByText('Retratos e ilustrações provisórios.')).not.toBeInTheDocument();
  expect(screen.queryByText('Equipe atual da sua conta.')).not.toBeInTheDocument();
  expect(within(catalog).getByRole('button', { name: 'Selecionar Saqueador da estrada I — bloqueado' })).toBeEnabled();
  expect(within(catalog).getByRole('button', { name: 'Selecionar Exal - Verdadeiro poder — bloqueado' })).toBeEnabled();
});

it('permite consultar bloqueados, mas impede adicioná-los à equipe', async () => {
  const user = userEvent.setup();
  renderList();
  const aren = await screen.findByRole('button', { name: 'Selecionar Ravi de Berdal' });
  await user.click(aren);
  const guardian = screen.getByRole('button', { name: 'Selecionar Drak de Pontes — bloqueado' });
  await user.click(guardian);
  expect(aren).toHaveAttribute('aria-pressed', 'false');
  expect(guardian).toHaveAttribute('aria-pressed', 'true');
  const details = screen.getByRole('region', { name: 'Detalhes de Drak de Pontes' });
  const unlockDescription = units.find((unit) => unit.id === 'passage-guardian-base')!.unlock.description;
  expect(within(details).queryByText(unlockDescription)).not.toBeInTheDocument();
  expect(within(details).getByRole('img', { name: /bloqueada/ })).toBeInTheDocument();
  expect(within(details).getByRole('button', { name: 'Adicionar à equipe' })).toBeDisabled();
  expect(api.setTeamSlot).not.toHaveBeenCalled();
});

it('usa desbloqueios e equipe recebidos do servidor, incluindo o chefão desbloqueado', async () => {
  const progress = createInitialProgress();
  progress.unlockedUnitIds.push('passage-guardian-base');
  progress.selectedTeam = ['passage-guardian-base', 'protagonist-female-base', null];
  vi.mocked(api.progress).mockResolvedValue(progress);
  const user = userEvent.setup();
  renderList();
  await user.click(await screen.findByRole('button', { name: 'Selecionar Drak de Pontes' }));
  expect(screen.getByRole('heading', { name: 'Turno extra' })).toBeInTheDocument();
  const team = screen.getByRole('region', { name: 'Minha equipe' });
  expect(team.querySelector('.team-panel')).toBeInTheDocument();
  expect(within(team).getByRole('group', { name: 'Slot 1: Drak de Pontes' })).toBeInTheDocument();
  expect(within(team).getByRole('img', { name: 'Slot 3 vazio' })).toBeInTheDocument();
});

it('permite selecionar retratos com o teclado', async () => {
  const user = userEvent.setup();
  renderList();
  const ivo = await screen.findByRole('button', { name: 'Selecionar Doko de Berdal' });
  ivo.focus();
  await user.keyboard('{Enter}');
  expect(ivo).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('heading', { name: 'Proteção coletiva' })).toBeInTheDocument();
});

it('não inventa desbloqueios quando a consulta falha e permite tentar novamente', async () => {
  vi.mocked(api.progress).mockRejectedValueOnce(new Error('Servidor indisponível.'));
  const user = userEvent.setup();
  renderList();
  expect(await screen.findByRole('alert')).toHaveTextContent('Servidor indisponível.');
  expect(screen.queryByRole('button', { name: 'Selecionar Ravi de Berdal' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  expect(await screen.findByRole('button', { name: 'Selecionar Ravi de Berdal' })).toBeEnabled();
  expect(api.progress).toHaveBeenCalledTimes(2);
});

it('começa com três slots vazios e salva no slot escolhido pelo jogador', async () => {
  const user = userEvent.setup();
  vi.mocked(api.setTeamSlot).mockResolvedValue([null, 'protagonist-main-base', null]);
  renderList();
  await user.click(await screen.findByRole('button', { name: 'Selecionar Ravi de Berdal' }));
  for (let slot = 1; slot <= 3; slot++) expect(screen.getByRole('img', { name: `Slot ${slot} vazio` })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Adicionar à equipe' }));
  const dialog = screen.getByRole('dialog', { name: 'Escolher posição na equipe' });
  await user.click(within(dialog).getByRole('button', { name: 'Usar slot 2 — vazio' }));
  expect(api.setTeamSlot).toHaveBeenCalledWith(1, 'protagonist-main-base');
  expect(await screen.findByRole('group', { name: 'Slot 2: Ravi de Berdal' })).toBeInTheDocument();
  expect(screen.queryByText(/no slot 2\./)).not.toBeInTheDocument();
  expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('exibe falha de gravação sem alterar o time e permite repetir a escolha', async () => {
  const user = userEvent.setup();
  vi.mocked(api.setTeamSlot).mockRejectedValueOnce(new Error('Falha ao salvar.'));
  renderList();
  await user.click(await screen.findByRole('button', { name: 'Selecionar Anna de Berdal' }));
  await user.click(screen.getByRole('button', { name: 'Adicionar à equipe' }));
  await user.click(screen.getByRole('button', { name: 'Usar slot 1 — vazio' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao salvar.');
  expect(screen.getByRole('img', { name: 'Slot 1 vazio' })).toBeInTheDocument();
  expect(screen.getByRole('dialog')).toBeInTheDocument();
});

it('remove uma unidade do slot salvando a posição vazia no servidor', async () => {
  const progress = createInitialProgress();
  progress.selectedTeam = ['protagonist-main-base', null, null];
  vi.mocked(api.progress).mockResolvedValue(progress);
  const user = userEvent.setup();
  renderList();
  await user.click(await screen.findByRole('button', { name: 'Remover Ravi de Berdal do slot 1' }));
  expect(api.setTeamSlot).toHaveBeenCalledWith(0, null);
  expect(await screen.findByRole('img', { name: 'Slot 1 vazio' })).toBeInTheDocument();
  expect(screen.queryByText(/Slot 1 liberado/)).not.toBeInTheDocument();
});

it('usa nomes e descrições do catálogo retornado pela API', async () => {
  const content = { units: units.map((unit) => unit.id === 'protagonist-main-base' ? { ...unit, name: 'Ravi atualizado no banco', description: 'Texto persistido no servidor.' } : unit), characters: Object.values(narrativeCharacters), abilities: Object.values(abilities) };
  vi.mocked(api.catalog).mockResolvedValue(content);
  const user = userEvent.setup();
  renderList();
  await user.click(await screen.findByRole('button', { name: 'Selecionar Ravi atualizado no banco' }));
  expect(screen.getByText('Texto persistido no servidor.')).toBeInTheDocument();
});

it('inclui personagens adicionais do banco mesmo sem ordem de lista definida', async () => {
  const extra = { ...units[0], id: 'extra-db-unit', name: 'Personagem adicional', rosterOrder: null };
  vi.mocked(api.catalog).mockResolvedValue({ units: [...units, extra], characters: Object.values(narrativeCharacters), abilities: Object.values(abilities) });
  const user = userEvent.setup();
  renderList();
  await user.click(await screen.findByRole('button', { name: 'Selecionar Personagem adicional — bloqueado' }));
  expect(screen.getByRole('region', { name: 'Detalhes de Personagem adicional' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Adicionar à equipe' })).toBeDisabled();
});
