// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { api } from './api';
import { App } from './App';
import { ApiError } from './api';
import { createInitialProgress } from '@game/contracts';
import { abilities } from '@game/content/abilities';
import { narrativeCharacters, STARTER_UNIT_IDS, units } from '@game/content/units';
import { campaigns } from '@game/content/campaigns';
import { encounters } from '@game/content/encounters';
import { createBattle } from '@game/core/battle';
import { characterUnlockProgress } from '@game/core/unlocks';

vi.mock('./api', async (importOriginal) => {
  const original = await importOriginal<typeof import('./api')>();
  return { ...original, api: { session: vi.fn(), authenticate: vi.fn(), logout: vi.fn(), updateProfile: vi.fn(), progress: vi.fn(), catalog: vi.fn(), characterUnlocks: vi.fn(), setTeamSlot: vi.fn(), campaigns: vi.fn(), campaignMap: vi.fn(), startBattle: vi.fn(), quickBattle: vi.fn(), startQuickBattle: vi.fn(), battle: vi.fn(), abandonBattle: vi.fn(), turn: vi.fn() } };
});
// jsdom não implementa a abertura/fechamento do dialog nativo do navegador.
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
});
beforeEach(() => {
  vi.clearAllMocks();
  window.localStorage.clear();
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR']);
  vi.mocked(api.session).mockResolvedValue(null);
  vi.mocked(api.logout).mockResolvedValue(undefined);
  vi.mocked(api.progress).mockResolvedValue(createInitialProgress());
  vi.mocked(api.catalog).mockResolvedValue({ units, characters: Object.values(narrativeCharacters), abilities: Object.values(abilities) });
  vi.mocked(api.characterUnlocks).mockResolvedValue(characterUnlockProgress(units, [], []));
  vi.mocked(api.quickBattle).mockResolvedValue({ opponents: units.filter((unit) => encounters[0].enemyUnitIds.includes(unit.id)) });
  vi.mocked(api.campaigns).mockResolvedValue(campaigns.map((campaign) => ({ ...campaign, available: campaign.id === 'path-1' })));
  vi.mocked(api.campaignMap).mockResolvedValue({ campaign: { ...campaigns[0], available: true }, encounters: encounters.filter((entry) => entry.campaignId === 'path-1').map((entry) => ({ ...entry, available: entry.position === 1, completed: false, activeBattleId: null })) });
  vi.mocked(api.startBattle).mockResolvedValue({ id: '00000000-0000-4000-8000-000000000001', encounterId: encounters[0].id, revision: 0,
    state: createBattle(STARTER_UNIT_IDS.map((id) => units.find((unit) => unit.id === id)!), encounters[0].enemyUnitIds.map((id) => units.find((unit) => unit.id === id)!), Object.values(abilities)) });
  vi.mocked(api.startQuickBattle).mockResolvedValue({ id: '00000000-0000-4000-8000-000000000002', encounterId: null, revision: 0,
    state: createBattle(STARTER_UNIT_IDS.map((id) => units.find((unit) => unit.id === id)!), encounters[0].enemyUnitIds.map((id) => units.find((unit) => unit.id === id)!), Object.values(abilities)) });
  vi.mocked(api.abandonBattle).mockImplementation(async (id) => ({ id, encounterId: null, revision: 1,
    state: { ...createBattle(STARTER_UNIT_IDS.map((unitId) => units.find((unit) => unit.id === unitId)!), encounters[0].enemyUnitIds.map((unitId) => units.find((unit) => unit.id === unitId)!), Object.values(abilities)), status: 'abandoned' } }));
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('abre as missões e acessa um personagem liberado pelo menu sem exibir notificação de desbloqueio', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro' });
  const progress = createInitialProgress(); progress.unlockedUnitIds.push('road-raider-1-base');
  vi.mocked(api.progress).mockResolvedValue(progress);
  vi.mocked(api.characterUnlocks).mockResolvedValue(characterUnlockProgress(units, progress.unlockedUnitIds,
    Array.from({ length: 5 }, () => ({ mode: 'quick' as const, playerUnitIds: [...STARTER_UNIT_IDS], enemyUnitIds: ['road-raider-1-base'] }))));
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.click(screen.getByRole('button', { name: 'Tabela de missões' }));
  expect(screen.getByRole('heading', { name: 'Tabela de missões' })).toBeInTheDocument();
  const card = await screen.findByRole('region', { name: 'Saqueador da estrada I' });
  expect(within(card).getByText('Disponível')).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Abrir Lista de personagens' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Voltar ao menu principal' }));
  await user.click(screen.getByRole('button', { name: 'Lista de personagens' }));
  await user.click(await screen.findByRole('button', { name: 'Selecionar Saqueador da estrada I' }));
  expect(screen.getByRole('button', { name: 'Adicionar à equipe' })).toBeEnabled();
  expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Voltar ao menu principal' }));
  await user.click(screen.getByRole('button', { name: 'Tabela de missões' }));
  expect(screen.getByRole('heading', { name: 'Tabela de missões' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Voltar ao menu principal' }));
  expect(screen.getByRole('heading', { name: 'Menu principal' })).toBeInTheDocument();
});

it('permite cadastrar e sair sem armazenar credenciais no navegador', async () => {
  const user = userEvent.setup();
  vi.mocked(api.authenticate).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro' });
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.click(screen.getByRole('button', { name: 'Ainda não tem conta? Criar conta' }));
  await user.type(screen.getByLabelText('E-mail'), 'jogador@example.com');
  await user.type(screen.getByLabelText('Senha'), 'uma senha longa');
  await user.click(screen.getByRole('button', { name: 'Criar conta' }));
  expect(api.authenticate).toHaveBeenCalledWith('register', 'jogador@example.com', 'uma senha longa');
  expect(await screen.findByRole('heading', { name: 'Menu principal' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Desconectar' })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Abrir perfil de Aventureiro' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Meu perfil' })).getByRole('button', { name: 'Desconectar' }));
  expect(api.logout).toHaveBeenCalled();
  expect(await screen.findByRole('button', { name: 'Começar jogo' })).toBeInTheDocument();
});

it('restaura uma sessão existente sem pedir a senha novamente', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'existente@example.com', name: 'Aventureiro' });
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  expect(within(screen.getByRole('button', { name: 'Abrir perfil de Aventureiro' })).getByText('existente@example.com')).toBeInTheDocument();
  expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
});

it('exibe erros de autenticação e preserva o formulário para tentar novamente', async () => {
  vi.mocked(api.authenticate).mockRejectedValue(new Error('E-mail ou senha incorretos.'));
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.type(screen.getByLabelText('E-mail'), 'jogador@example.com');
  await user.type(screen.getByLabelText('Senha'), 'senha errada');
  await user.click(screen.getByRole('button', { name: 'Entrar' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled();
});

it('abre a lista pelo menu e retorna pelo botão de seta', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro' });
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.click(screen.getByRole('button', { name: 'Lista de personagens' }));
  expect(screen.getByRole('heading', { name: 'Lista de personagens' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Selecionar Ravi de Berdal' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Voltar ao menu principal' }));
  expect(screen.getByRole('heading', { name: 'Menu principal' })).toBeInTheDocument();
});

it('retorna ao login quando o servidor informa sessão expirada ao abrir personagens', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro' });
  vi.mocked(api.progress).mockRejectedValue(new ApiError('Sessão expirada.', 401));
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.click(screen.getByRole('button', { name: 'Lista de personagens' }));
  expect(await screen.findByLabelText('Senha')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou');
});

it('exibe o logo e nomes dos itens sem textos auxiliares e abre o perfil pelo cartão', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro' });
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  expect(screen.getByRole('img', { name: 'Rave Trail' })).toBeInTheDocument();
  const menu = screen.getByRole('navigation', { name: 'Opções do menu principal' });
  expect(within(menu).getAllByRole('button').map((button) => button.textContent)).toEqual([
    'Campanha', 'Batalha rápida', 'Lista de personagens', 'Tabela de missões', 'Loja', 'Multiplayer', 'Configurações',
  ]);
  expect(within(menu).queryByText('Em breve')).not.toBeInTheDocument();
  expect(within(menu).queryByText('Em desenvolvimento')).not.toBeInTheDocument();
  expect(within(menu).queryByText('→')).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Voltar ao início' })).not.toBeInTheDocument();
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  const card = screen.getByRole('button', { name: 'Abrir perfil de Aventureiro' });
  await user.click(card);
  const dialog = screen.getByRole('dialog', { name: 'Meu perfil' });
  expect(within(dialog).getByText('jogador@example.com')).toBeInTheDocument();
  expect(within(dialog).getByText('Aventureiro')).toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Fechar perfil' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(api.logout).not.toHaveBeenCalled();
  await user.click(card);
  expect(screen.getByRole('dialog', { name: 'Meu perfil' })).toBeInTheDocument();
});

it('mantém o perfil aberto e permite tentar novamente se a desconexão falhar', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro' });
  vi.mocked(api.logout).mockRejectedValueOnce(new Error('Não foi possível conectar ao servidor.'));
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.click(screen.getByRole('button', { name: 'Abrir perfil de Aventureiro' }));
  await user.click(screen.getByRole('button', { name: 'Desconectar' }));
  const dialog = screen.getByRole('dialog', { name: 'Meu perfil' });
  expect(await within(dialog).findByRole('alert')).toHaveTextContent('Não foi possível conectar ao servidor.');
  expect(within(dialog).getByRole('button', { name: 'Desconectar' })).toBeEnabled();
  await user.click(within(dialog).getByRole('button', { name: 'Desconectar' }));
  expect(await screen.findByRole('button', { name: 'Começar jogo' })).toBeInTheDocument();
});

it('salva o nome no perfil, atualiza o cartão e restaura o nome persistido ao reabrir o jogo', async () => {
  const account = { id: '1', email: 'jogador@example.com', name: 'Aventureiro' };
  vi.mocked(api.session).mockResolvedValue(account);
  vi.mocked(api.updateProfile).mockResolvedValue({ ...account, name: 'Guardião de Berdal' });
  const user = userEvent.setup();
  const first = render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.click(screen.getByRole('button', { name: 'Abrir perfil de Aventureiro' }));
  const name = screen.getByLabelText('Nome');
  await user.clear(name);
  await user.type(name, 'Guardião de Berdal');
  await user.click(screen.getByRole('button', { name: 'Salvar nome' }));
  expect(api.updateProfile).toHaveBeenCalledWith('Guardião de Berdal');
  expect(await screen.findByRole('status')).toHaveTextContent('Nome salvo.');
  expect(screen.getByRole('button', { name: 'Abrir perfil de Guardião de Berdal' })).toBeInTheDocument();
  first.unmount();
  vi.mocked(api.session).mockResolvedValue({ ...account, name: 'Guardião de Berdal' });
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  expect(screen.getByRole('button', { name: 'Abrir perfil de Guardião de Berdal' })).toBeInTheDocument();
});

it('preserva o nome anterior se salvar falhar e pede login se a sessão expirar durante a edição', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro' });
  vi.mocked(api.updateProfile).mockRejectedValueOnce(new Error('Falha ao salvar.')).mockRejectedValueOnce(new ApiError('Sessão expirada.', 401));
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.click(screen.getByRole('button', { name: 'Abrir perfil de Aventureiro' }));
  await user.clear(screen.getByLabelText('Nome'));
  await user.type(screen.getByLabelText('Nome'), 'Novo nome');
  await user.click(screen.getByRole('button', { name: 'Salvar nome' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha ao salvar.');
  expect(screen.getByRole('button', { name: 'Abrir perfil de Aventureiro' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Salvar nome' }));
  expect(await screen.findByLabelText('Senha')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou');
});

it('encerra a sessão no horário absoluto recebido do servidor mesmo com o menu ocioso', async () => {
  vi.useFakeTimers();
  const now = Date.now();
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro',
    sessionExpiresAt: new Date(now + 3_600_000).toISOString() });
  render(<App />);
  await act(async () => {});
  fireEvent.click(screen.getByRole('button', { name: 'Começar jogo' }));
  expect(screen.getByRole('heading', { name: 'Menu principal' })).toBeInTheDocument();
  await act(async () => { vi.advanceTimersByTime(3_599_999); });
  expect(screen.queryByLabelText('Senha')).not.toBeInTheDocument();
  await act(async () => { vi.advanceTimersByTime(1); });
  expect(screen.getByLabelText('Senha')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou');
});

it('abre a seleção de campanha pelo menu e retorna pela seta', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro' });
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.click(screen.getByRole('button', { name: 'Campanha' }));
  expect(screen.getByRole('heading', { name: 'Selecionar campanha' })).toBeInTheDocument();
  expect(await screen.findByRole('button', { name: 'Capítulo 1: Pondo o pé na estrada' })).toBeEnabled();
  await user.click(screen.getByRole('button', { name: 'Voltar ao menu principal' }));
  expect(screen.getByRole('heading', { name: 'Menu principal' })).toBeInTheDocument();
});

it('solicita novo login se a sessão expirar ao abrir campanhas', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro' });
  vi.mocked(api.campaigns).mockRejectedValueOnce(new ApiError('Sessão expirada.', 401));
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.click(screen.getByRole('button', { name: 'Campanha' }));
  expect(await screen.findByLabelText('Senha')).toBeInTheDocument();
  expect(screen.getByRole('alert')).toHaveTextContent('Sua sessão expirou');
});

it('navega do capítulo 1 ao mapa, abre o encontro e inicia uma batalha funcional', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro' });
  const progress = createInitialProgress(); progress.selectedTeam = [...STARTER_UNIT_IDS];
  vi.mocked(api.progress).mockResolvedValue(progress);
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.click(screen.getByRole('button', { name: 'Campanha' }));
  await user.click(await screen.findByRole('button', { name: 'Capítulo 1: Pondo o pé na estrada' }));
  expect(await screen.findByRole('region', { name: 'Minha equipe' })).toBeInTheDocument();
  await user.click(await screen.findByRole('button', { name: 'Batalha 1: Saqueadores da estrada' }));
  await user.click(screen.getByRole('button', { name: 'Iniciar batalha' }));
  expect(screen.getByRole('status')).toHaveTextContent('Carregando batalha...');
  expect(await screen.findByRole('button', { name: /^Encerrar turno \d+s$/ }, { timeout: 3000 })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Minha equipe' })).not.toBeInTheDocument();
  expect(api.startBattle).toHaveBeenCalledWith('path-1-encounter-1');
  await user.click(screen.getByRole('button', { name: 'Desistir' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Desistir da batalha?' })).getByRole('button', { name: 'Confirmar desistência' }));
  expect(api.abandonBattle).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000001');
  expect(await screen.findByRole('button', { name: 'Batalha 1: Saqueadores da estrada' })).toBeInTheDocument();
  expect(screen.getByRole('region', { name: 'Minha equipe' })).toBeInTheDocument();
});

it('abre as configurações pelo menu e controla volume e silêncio do áudio', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro' });
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  const settingsButton = screen.getByRole('button', { name: 'Configurações' });
  expect(settingsButton).toBeEnabled();
  await user.click(settingsButton);

  const dialog = screen.getByRole('dialog', { name: 'Configurações' });
  const volume = within(dialog).getByLabelText('Volume do áudio');
  expect(volume).toHaveValue('50');
  expect(within(dialog).getByText('50%')).toBeInTheDocument();

  fireEvent.change(volume, { target: { value: '25' } });
  expect(within(dialog).getByText('25%')).toBeInTheDocument();

  await user.click(within(dialog).getByLabelText('Silenciar áudio'));
  expect(within(dialog).getByText('Silenciado')).toBeInTheDocument();
  expect(JSON.parse(window.localStorage.getItem('rave-trail-audio-settings')!)).toEqual({ volume: 25, muted: true });

  await user.click(within(dialog).getByRole('button', { name: 'Fechar configurações' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
});

it('abre Batalha rápida pelo menu, entra no combate e retorna à página correta', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'jogador@example.com', name: 'Aventureiro' });
  const progress = createInitialProgress(); progress.selectedTeam = [...STARTER_UNIT_IDS];
  vi.mocked(api.progress).mockResolvedValue(progress);
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.click(screen.getByRole('button', { name: 'Batalha rápida' }));
  expect(screen.getByRole('heading', { name: 'Batalha rápida' })).toBeInTheDocument();
  expect(await screen.findByRole('region', { name: 'Minha equipe' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Entrar na batalha' }));
  expect(screen.getByRole('status')).toHaveTextContent('Carregando batalha...');
  expect(await screen.findByRole('button', { name: /^Encerrar turno \d+s$/ }, { timeout: 3000 })).toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Minha equipe' })).not.toBeInTheDocument();
  expect(api.startQuickBattle).toHaveBeenCalledTimes(1);
  expect(api.campaignMap).not.toHaveBeenCalled();
  expect(api.startBattle).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Desistir' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Desistir da batalha?' })).getByRole('button', { name: 'Confirmar desistência' }));
  expect(api.abandonBattle).toHaveBeenCalledWith('00000000-0000-4000-8000-000000000002');
  expect(await screen.findByRole('button', { name: 'Entrar na batalha' })).toBeInTheDocument();
  expect(await screen.findByRole('region', { name: 'Minha equipe' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Voltar ao menu principal' }));
  expect(screen.getByRole('heading', { name: 'Menu principal' })).toBeInTheDocument();
});

it('detecta inglês no navegador e troca o idioma do formulário e do erro sem perder os dados digitados', async () => {
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['en-GB']);
  vi.mocked(api.authenticate).mockRejectedValue(new ApiError('E-mail ou senha incorretos.', 401));
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Start game' }));
  await user.type(screen.getByLabelText('Email'), 'player@example.com');
  await user.type(screen.getByLabelText('Password'), 'incorrect password');
  await user.click(screen.getByRole('button', { name: 'Sign in' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Incorrect email or password.');
  await user.selectOptions(screen.getByLabelText('Language'), 'pt-BR');
  expect(screen.getByRole('heading', { name: 'Continue sua jornada' })).toBeInTheDocument();
  expect(screen.getByLabelText('E-mail')).toHaveValue('player@example.com');
  expect(screen.getByLabelText('Senha')).toHaveValue('incorrect password');
  expect(screen.getByRole('alert')).toHaveTextContent('E-mail ou senha incorretos.');
  expect(api.session).toHaveBeenCalledTimes(1);
});

it('troca para inglês nas configurações e localiza personagens, missões e campanha preservando nomes do jogador e IDs', async () => {
  vi.mocked(api.session).mockResolvedValue({ id: '1', email: 'player@example.com', name: 'Guarda' });
  vi.mocked(api.setTeamSlot).mockResolvedValue(['protagonist-main-base', null, null]);
  const user = userEvent.setup();
  render(<App />);
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  await user.click(screen.getByRole('button', { name: 'Configurações' }));
  await user.selectOptions(screen.getByLabelText('Idioma'), 'en');
  expect(screen.getByRole('dialog', { name: 'Settings' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open Guarda’s profile' })).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Close settings' }));
  await user.click(screen.getByRole('button', { name: 'Character roster' }));
  await user.click(await screen.findByRole('button', { name: 'Select Ravi de Berdal' }));
  expect(screen.getByRole('heading', { name: 'Simple Strike' })).toBeInTheDocument();
  expect(screen.getByText('Deals 20 damage to one enemy.')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Add to team' }));
  await user.click(screen.getByRole('button', { name: 'Use slot 1 — empty' }));
  expect(api.setTeamSlot).toHaveBeenCalledWith(0, 'protagonist-main-base');
  await user.click(screen.getByRole('button', { name: 'Back to main menu' }));
  await user.click(screen.getByRole('button', { name: 'Mission board' }));
  expect(await screen.findByRole('heading', { name: 'Road Raider I' })).toBeInTheDocument();
  expect(screen.getAllByText('Win 3 Quick battles.')).toHaveLength(2);
  await user.click(screen.getByRole('button', { name: 'Back to main menu' }));
  await user.click(screen.getByRole('button', { name: 'Campaign' }));
  await user.click(await screen.findByRole('button', { name: 'Chapter 1: Setting Out on the Road' }));
  await user.click(await screen.findByRole('button', { name: 'Read the story of Rave Trail' }));
  expect(screen.getByText(/On a mystical continent/)).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Close story' }));
  await user.click(screen.getByRole('button', { name: 'Battle 1: Road Raiders' }));
  expect(screen.getByText(/protecting the traveler will be the first real challenge/)).toBeInTheDocument();
  expect(screen.getByRole('img', { name: 'Portrait of Road Raider I' })).toHaveAttribute('src', '/media/characters/saqueador-da-estrada-i-face.png');
  expect(api.session).toHaveBeenCalledTimes(1);
});
