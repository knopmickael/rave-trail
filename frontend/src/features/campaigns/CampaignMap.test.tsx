// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { createInitialProgress } from '@game/contracts';
import { campaigns } from '@game/content/campaigns';
import { encounters } from '@game/content/encounters';
import { FINAL_BATTLE_REQUIREMENT, SECOND_FINAL_ENCOUNTER_ID, OSIRIS_BATTLE_REQUIREMENT } from '@game/content/campaign-rules';
import { abilities } from '@game/content/abilities';
import { narrativeCharacters, STARTER_UNIT_IDS, units } from '@game/content/units';
import { createBattle } from '@game/core/battle';
import { api, ApiError } from '../../api';
import { CampaignMap } from './CampaignMap';

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, campaignMap: vi.fn(), catalog: vi.fn(), progress: vi.fn(), startBattle: vi.fn() } };
});
const mapData = () => ({ campaign: { ...campaigns[0], available: true }, encounters: encounters.filter((entry) => entry.campaignId === 'path-1').map((entry) => ({ ...entry, available: entry.position === 1, completed: false, activeBattleId: null })) });
const battle = { id: '00000000-0000-4000-8000-000000000001', encounterId: encounters[0].id, revision: 0,
  state: createBattle(STARTER_UNIT_IDS.map((id) => units.find((unit) => unit.id === id)!), encounters[0].enemyUnitIds.map((id) => units.find((unit) => unit.id === id)!), Object.values(abilities)) };

beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
});
beforeEach(() => {
  vi.clearAllMocks();
  const progress = createInitialProgress(); progress.selectedTeam = [...STARTER_UNIT_IDS];
  vi.mocked(api.campaignMap).mockResolvedValue(mapData());
  vi.mocked(api.catalog).mockResolvedValue({ units, characters: Object.values(narrativeCharacters), abilities: Object.values(abilities) });
  vi.mocked(api.progress).mockResolvedValue(progress);
  vi.mocked(api.startBattle).mockResolvedValue(battle);
});
afterEach(cleanup);
const props = () => ({ campaignId: 'path-1', onBack: vi.fn(), onOpenCharacters: vi.fn(), onSessionExpired: vi.fn(), onBattleStarted: vi.fn() });

it('mostra sete pontos e abre título, três rostos e história somente no encontro liberado', async () => {
  const user = userEvent.setup();
  const handlers = props();
  render(<CampaignMap {...handlers} />);
  const first = await screen.findByRole('button', { name: 'Batalha 1: Saqueadores da estrada' });
  expect(screen.getAllByRole('button', { name: /^Batalha \d:/ })).toHaveLength(7);
  expect(document.querySelector('.map-world video')).toBeNull();
  expect(screen.getByRole('img', { name: 'Mapa da campanha' })).toHaveAttribute('src', '/media/campaigns/mapa-campanha-01.png');
  expect(screen.queryByRole('navigation', { name: 'Mover o mapa' })).not.toBeInTheDocument();
  const team = screen.getByRole('region', { name: 'Minha equipe' });
  expect(team.querySelector('.team-panel')).toBeInTheDocument();
  STARTER_UNIT_IDS.forEach((id, index) => {
    const member = units.find((unit) => unit.id === id)!;
    const slot = within(team).getByRole('group', { name: `Slot ${index + 1}: ${member.name}` });
    expect(slot.querySelector('img')).toHaveAttribute('src', member.portrait);
  });
  const blocked = screen.getByRole('button', { name: /Batalha 3:.*Drak.*bloqueada/ });
  expect(blocked).toBeDisabled();
  await user.click(blocked);
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(first);
  const drawer = screen.getByRole('dialog', { name: 'Saqueadores da estrada' });
  expect(within(drawer).getAllByRole('img')).toHaveLength(3);
  expect(within(drawer).getByText(/primeiro desafio real de sua jornada/)).toBeInTheDocument();
  expect(within(drawer).getByRole('button', { name: 'Iniciar batalha' })).toBeEnabled();
  expect(within(drawer).queryByRole('button', { name: 'Montar equipe' })).not.toBeInTheDocument();
  await user.click(within(drawer).getByRole('button', { name: 'Fechar detalhes da batalha' }));
  await user.click(screen.getByRole('button', { name: 'Voltar às campanhas' }));
  expect(handlers.onBack).toHaveBeenCalledTimes(1);
});

it('abre a Lista de personagens pelo bloco Minha equipe do mapa', async () => {
  const handlers = props(); const user = userEvent.setup();
  render(<CampaignMap {...handlers} />);
  const team = await screen.findByRole('region', { name: 'Minha equipe' });
  await user.click(within(team).getByRole('button', { name: 'Abrir Lista de personagens' }));
  expect(handlers.onOpenCharacters).toHaveBeenCalledTimes(1);
});

it('inicia a batalha no servidor e entrega o estado retornado para a navegação', async () => {
  const handlers = props(); const user = userEvent.setup();
  render(<CampaignMap {...handlers} />);
  await user.click(await screen.findByRole('button', { name: 'Batalha 1: Saqueadores da estrada' }));
  await user.click(screen.getByRole('button', { name: 'Iniciar batalha' }));
  expect(api.startBattle).toHaveBeenCalledWith('path-1-encounter-1');
  await vi.waitFor(() => expect(handlers.onBattleStarted).toHaveBeenCalledWith(battle, 'Saqueadores da estrada'));
});

it('abre o prólogo pelo pergaminho ao lado do título e fecha a história sem iniciar uma batalha', async () => {
  const user = userEvent.setup();
  render(<CampaignMap {...props()} />);
  const title = await screen.findByRole('heading', { name: 'Pondo o pé na estrada' });
  const scroll = within(title.parentElement!).getByRole('button', { name: 'Ler história de Pondo o pé na estrada' });
  expect(scroll).toHaveAttribute('aria-haspopup', 'dialog');
  expect(screen.queryByRole('dialog', { name: 'História de Pondo o pé na estrada' })).not.toBeInTheDocument();
  await user.click(scroll);
  const dialog = screen.getByRole('dialog', { name: 'História de Pondo o pé na estrada' });
  expect(within(dialog).getByText(/três jovens camponeses vivem pacificamente/)).toBeInTheDocument();
  expect(within(dialog).getByText(/ataques coordenados destroem estruturas comerciais/)).toBeInTheDocument();
  expect(within(dialog).getByText(/a missão de investigar os responsáveis pelos ataques/)).toBeInTheDocument();
  expect(within(dialog).queryByText(encounters[0].story)).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Fechar história' }));
  expect(dialog).not.toHaveAttribute('open');
  await user.click(scroll);
  expect(dialog).toHaveAttribute('open');
  await user.click(dialog);
  expect(dialog).not.toHaveAttribute('open');
  expect(api.startBattle).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Batalha 1: Saqueadores da estrada' })).toBeEnabled();
});

it('mostra o pergaminho com a história anterior à batalha 01 da segunda campanha', async () => {
  vi.mocked(api.campaignMap).mockResolvedValue({ campaign: { ...campaigns[1], available: true }, encounters: [] });
  const user = userEvent.setup();
  render(<CampaignMap {...props()} campaignId="path-2" />);
  await screen.findByRole('heading', { name: 'Além das Fronteiras' });
  await user.click(screen.getByRole('button', { name: 'Ler história de Além das Fronteiras' }));
  const dialog = screen.getByRole('dialog', { name: 'História de Além das Fronteiras' });
  expect(within(dialog).getByText(/O confronto com Exal deixou marcas em Ravi, Doko e Anna/)).toBeInTheDocument();
  expect(within(dialog).getByText(/o grupo precisa atravessar uma fronteira sob vigilância/)).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Fechar história' }));
  expect(dialog).not.toHaveAttribute('open');
});

it('usa título, descrição e mapa retornados pelo CMS também em campanhas adicionais', async () => {
  vi.mocked(api.campaignMap).mockResolvedValue({ campaign: { ...campaigns[0], id: 'new-campaign', title: 'Jornada editada', description: 'Primeiro parágrafo do CMS.\n\nSegundo parágrafo do CMS.', mapBackground: '/media/campaigns/path-2.webp', available: true }, encounters: [] });
  const user = userEvent.setup(); render(<CampaignMap {...props()} campaignId="new-campaign" />);
  await user.click(await screen.findByRole('button', { name: 'Ler história de Jornada editada' }));
  const dialog = screen.getByRole('dialog', { name: 'História de Jornada editada' });
  expect(within(dialog).getByText('Primeiro parágrafo do CMS.')).toBeInTheDocument();
  expect(within(dialog).getByText('Segundo parágrafo do CMS.')).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Mapa da campanha' })).toHaveAttribute('src', '/media/campaigns/path-2.webp');
});

it('exibe os slots vazios e orienta escolher personagens sem oferecer montagem no modal', async () => {
  vi.mocked(api.progress).mockResolvedValue(createInitialProgress());
  const handlers = props(); const user = userEvent.setup();
  render(<CampaignMap {...handlers} />);
  await user.click(await screen.findByRole('button', { name: 'Batalha 1: Saqueadores da estrada' }));
  expect(screen.getByRole('button', { name: 'Iniciar batalha' })).toBeDisabled();
  expect(screen.getByText('Escolha pelo menos um personagem para sua equipe antes de iniciar.')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Montar equipe' })).not.toBeInTheDocument();
  const team = screen.getByRole('region', { name: 'Minha equipe' });
  expect(within(team).getAllByRole('img', { name: /^Slot \d vazio$/ })).toHaveLength(3);
  expect(api.startBattle).not.toHaveBeenCalled();
});

it('reflete Drak liberado após as duas primeiras vitórias', async () => {
  const data = mapData();
  data.encounters = data.encounters.map((entry) => ({ ...entry, completed: entry.position <= 2, available: entry.position <= 3 }));
  vi.mocked(api.campaignMap).mockResolvedValue(data);
  render(<CampaignMap {...props()} />);
  expect(await screen.findByRole('button', { name: /Batalha 3:.*Drak/ })).toBeEnabled();
  expect(screen.getByRole('button', { name: /Batalha 4:.*bloqueada/ })).toBeDisabled();
});

it.each([true, false])('mostra o requisito final abaixo da história e exige Ravi base para iniciar (Ravi: %s)', async (withRavi) => {
  const data = mapData();
  data.encounters = data.encounters.map((entry) => ({ ...entry, available: true }));
  vi.mocked(api.campaignMap).mockResolvedValue(data);
  const progress = createInitialProgress();
  progress.selectedTeam = withRavi ? ['protagonist-secondary-base', 'protagonist-main-base', 'protagonist-female-base']
    : ['protagonist-secondary-base', null, 'protagonist-female-base'];
  vi.mocked(api.progress).mockResolvedValue(progress);
  const user = userEvent.setup();
  render(<CampaignMap {...props()} />);
  await user.click(await screen.findByRole('button', { name: /Batalha 7:/ }));
  const dialog = screen.getByRole('dialog', { name: 'Exal — Verdadeiro poder' });
  expect(within(dialog).getAllByRole('img')).toHaveLength(1);
  const requirement = within(dialog).getByText(FINAL_BATTLE_REQUIREMENT);
  expect(requirement.previousElementSibling).toHaveTextContent(encounters[6].story);
  const start = within(dialog).getByRole('button', { name: 'Iniciar batalha' });
  if (withRavi) {
    expect(start).toBeEnabled();
    await user.click(start);
    expect(api.startBattle).toHaveBeenCalledWith(encounters[6].id);
  } else {
    expect(start).toBeDisabled();
    await user.click(start);
    expect(api.startBattle).not.toHaveBeenCalled();
  }
});

it('exibe Jung e Exal na ordem aprovada no painel da sexta batalha', async () => {
  const data = mapData();
  data.encounters = data.encounters.map((entry) => ({ ...entry, available: true }));
  vi.mocked(api.campaignMap).mockResolvedValue(data);
  const user = userEvent.setup();
  render(<CampaignMap {...props()} />);
  await user.click(await screen.findByRole('button', { name: /Batalha 6:/ }));
  expect(within(screen.getByRole('dialog')).getAllByRole('img').map((image) => image.getAttribute('alt')))
    .toEqual(['Retrato de Jung de Grimória II', 'Retrato de Exal de Grimória']);
});

it('trata erro de carregamento e sessão expirada sem inventar progresso', async () => {
  const handlers = props(); const user = userEvent.setup();
  vi.mocked(api.campaignMap).mockRejectedValueOnce(new Error('Falha ao carregar.')).mockRejectedValueOnce(new ApiError('Sessão expirada.', 401));
  render(<CampaignMap {...handlers} />);
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao carregar.');
  expect(screen.queryByRole('button', { name: /^Batalha 1:/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Tentar novamente' }));
  await vi.waitFor(() => expect(handlers.onSessionExpired).toHaveBeenCalledTimes(1));
});

it.each([true, false])('abre o mesmo modal de slots da lista de personagens somente ao iniciar a final da campanha 02 (equipe salva: %s)', async (hasTeam) => {
  const data = { campaign: { ...campaigns[1], available: true }, encounters: encounters.filter((entry) => entry.campaignId === 'path-2')
    .map((entry) => ({ ...entry, available: true, completed: false, activeBattleId: null })) };
  vi.mocked(api.campaignMap).mockResolvedValue(data);
  const progress = createInitialProgress();
  if (hasTeam) progress.selectedTeam = [...STARTER_UNIT_IDS];
  vi.mocked(api.progress).mockResolvedValue(progress);
  const user = userEvent.setup();
  render(<CampaignMap {...props()} campaignId="path-2" />);
  await user.click(await screen.findByRole('button', { name: 'Batalha 6: O verdadeiro rei demônio' }));
  expect(screen.getAllByRole('button', { name: /^Batalha \d:/ })).toHaveLength(6);
  expect(screen.getByRole('img', { name: 'Mapa da campanha' })).toHaveAttribute('src', '/media/campaigns/mapa-campanha-01.png');
  const dialog = screen.getByRole('dialog', { name: 'O verdadeiro rei demônio' });
  expect(within(dialog).queryByText(OSIRIS_BATTLE_REQUIREMENT)).not.toBeInTheDocument();
  expect(within(dialog).queryByRole('radio')).not.toBeInTheDocument();
  expect(screen.queryByText(/provisóri|temporári/i)).not.toBeInTheDocument();
  const start = within(dialog).getByRole('button', { name: 'Iniciar batalha' });
  expect(start).toBeEnabled();
  await user.click(start);
  expect(api.startBattle).not.toHaveBeenCalled();
  const slots = screen.getByRole('dialog', { name: 'Escolher posição na equipe' });
  expect(slots).toHaveClass('team-dialog');
  expect(dialog).not.toHaveAttribute('open');
  expect(within(slots).getByText(OSIRIS_BATTLE_REQUIREMENT)).toBeInTheDocument();
  expect(within(slots).getAllByRole('button', { name: /^Usar slot/ })).toHaveLength(3);
  await user.click(within(slots).getByRole('button', { name: 'Cancelar' }));
  expect(slots).not.toHaveAttribute('open');
  expect(dialog).toHaveAttribute('open');
  await user.click(start);
  await user.click(within(slots).getByRole('button', { name: /^Usar slot 2/ }));
  await vi.waitFor(() => expect(api.startBattle).toHaveBeenCalledWith(SECOND_FINAL_ENCOUNTER_ID, { osirisSlot: 1 }));
  expect(progress.selectedTeam).toEqual(hasTeam ? [...STARTER_UNIT_IDS] : [null, null, null]);
});
