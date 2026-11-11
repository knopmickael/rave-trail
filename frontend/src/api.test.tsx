// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { api, clearGameData, gameDataCache, preloadGameData } from './api';
import { App } from './App';
import { createInitialProgress, type CampaignMapData, type PlayerProgress } from '@game/contracts';
import { campaigns } from '@game/content/campaigns';
import { encounters } from '@game/content/encounters';
import { abilities } from '@game/content/abilities';
import { units, narrativeCharacters } from '@game/content/units';
import { createBattle, type BattleRecord } from '@game/core/battle';

vi.mock('./audio/useGameAudio', () => ({ useGameAudio: () => {} }));

const account = { id: 'player-1', email: 'player@example.com', name: 'Guarda' };
const catalog = { units, characters: Object.values(narrativeCharacters), abilities: Object.values(abilities) };
let progress: PlayerProgress;
let secondCampaignAvailable: boolean;
let record: BattleRecord;
const fetchMock = vi.fn<typeof fetch>();
const paths = () => fetchMock.mock.calls.map(([path]) => String(path));
const count = (path: string) => paths().filter((entry) => entry === `/api${path}`).length;

beforeEach(() => {
  clearGameData();
  fetchMock.mockReset();
  window.localStorage.clear();
  vi.spyOn(navigator, 'languages', 'get').mockReturnValue(['pt-BR']);
  vi.stubGlobal('fetch', fetchMock);
  progress = createInitialProgress();
  secondCampaignAvailable = false;
  record = { id: 'battle-1', encounterId: 'path-1-encounter-1', revision: 1,
    state: createBattle(units.slice(0, 3), units.slice(3, 6), Object.values(abilities)) };
  fetchMock.mockImplementation(async (input, init) => {
    const path = String(input).replace('/api', '');
    let body: unknown;
    if (path === '/auth/me' || path === '/auth/login' || path === '/profile') body = { user: account };
    else if (path === '/auth/logout') return new Response(null, { status: 204 });
    else if (path === '/catalog') body = { catalog };
    else if (path === '/progress') body = { progress };
    else if (path === '/character-unlocks') body = { unlocks: { characters: [] } };
    else if (path === '/quick-battle') body = { quickBattle: { opponents: units.slice(0, 3) } };
    else if (path === '/campaigns') body = { campaigns: campaigns.map((entry, index) => ({ ...entry, available: index === 0 || secondCampaignAvailable })) };
    else if (path.endsWith('/map')) {
      const id = path.split('/')[2];
      body = { map: { campaign: { ...campaigns.find((entry) => entry.id === id), available: true },
        encounters: encounters.filter((entry) => entry.campaignId === id).map((entry) => ({ ...entry,
          available: true, completed: progress.completedEncounters.includes(entry.id), activeBattleId: null })) } };
    } else if (path.startsWith('/team/slots/')) {
      const team = [...progress.selectedTeam];
      team[Number(path.split('/').at(-1))] = JSON.parse(String(init?.body)).unitId;
      body = { team };
    } else if (path.endsWith('/turns')) body = { battle: record, events: [] };
    else if (path.startsWith('/battles/')) body = { battle: record };
    else throw new Error(`Unexpected request: ${path}`);
    return Response.json(body);
  });
});

afterEach(() => { cleanup(); clearGameData(); vi.unstubAllGlobals(); });

it('baixa os dados no boot e navega repetidamente sem GETs extras nem loading intermediário', async () => {
  const user = userEvent.setup();
  render(<App />);
  await vi.waitFor(() => expect(gameDataCache.peek('map:path-1')).not.toBeNull());
  expect(count('/auth/me')).toBe(1);
  for (const path of ['/catalog', '/progress', '/character-unlocks', '/quick-battle', '/campaigns', '/campaigns/path-1/map']) expect(count(path)).toBe(1);
  expect(count('/campaigns/path-2/map')).toBe(0);
  const requests = paths().length;
  await user.click(await screen.findByRole('button', { name: 'Começar jogo' }));
  for (let visit = 0; visit < 2; visit++) {
    await user.click(screen.getByRole('button', { name: 'Campanha' }));
    expect(screen.queryByText('Carregando campanhas…')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Capítulo 1: Pondo o pé na estrada' }));
    expect(screen.getByRole('button', { name: 'Batalha 1: Saqueadores da estrada' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Voltar às campanhas' }));
    await user.click(screen.getByRole('button', { name: 'Voltar ao menu principal' }));
    for (const name of ['Lista de personagens', 'Loja', 'Tabela de missões', 'Batalha rápida']) {
      await user.click(screen.getByRole('button', { name }));
      expect(screen.queryByText(/Carregando/)).not.toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Voltar ao menu principal' }));
    }
  }
  expect(paths()).toHaveLength(requests);
});

it('compartilha requisições em andamento e usa o time retornado pelo PUT sem GET extra', async () => {
  await Promise.all([preloadGameData(), preloadGameData(), api.progress(), api.catalog()]);
  expect(count('/progress')).toBe(1);
  expect(count('/catalog')).toBe(1);
  await api.setTeamSlot(1, 'protagonist-main-base');
  expect((await api.progress()).selectedTeam).toEqual([null, 'protagonist-main-base', null]);
  expect(count('/progress')).toBe(1);
  await api.setTeamSlot(1, null);
  expect((await api.progress()).selectedTeam).toEqual([null, null, null]);
  expect(count('/progress')).toBe(1);
});

it('atualiza progresso, missões, oponentes e mapas uma vez por vitória, incluindo capítulos recém-liberados', async () => {
  await preloadGameData();
  progress.completedEncounters.push('path-1-encounter-1');
  secondCampaignAvailable = true;
  record.state.status = 'victory';
  await api.turn(record.id, 0, 'request-1', []);
  await preloadGameData();
  await api.battle(record.id);
  expect(count('/progress')).toBe(2);
  expect(count('/character-unlocks')).toBe(2);
  expect(count('/quick-battle')).toBe(2);
  expect(count('/campaigns')).toBe(2);
  expect(count('/campaigns/path-1/map')).toBe(2);
  expect(count('/campaigns/path-2/map')).toBe(1);
  expect(count('/catalog')).toBe(1);
  expect(gameDataCache.peek<CampaignMapData>('map:path-1')?.encounters[0].completed).toBe(true);
});

it('atualiza apenas os dados afetados pela vitória rápida e mantém polling e ações fora do cache', async () => {
  await preloadGameData();
  await api.battle(record.id);
  await api.battle(record.id);
  await api.turn(record.id, 0, 'request-1', []);
  expect(count('/progress')).toBe(1);
  record = { ...record, encounterId: null, state: { ...record.state, status: 'victory' } };
  await api.battle(record.id);
  await Promise.all([api.progress(), api.characterUnlocks(), api.quickBattle()]);
  expect(count('/progress')).toBe(2);
  expect(count('/character-unlocks')).toBe(2);
  expect(count('/quick-battle')).toBe(2);
  expect(count('/campaigns')).toBe(1);
  expect(count('/campaigns/path-1/map')).toBe(1);
  expect(count(`/battles/${record.id}`)).toBe(3);
});

it('permite tentar novamente após falha de rede e descarta o cache ao sair/trocar de conta', async () => {
  fetchMock.mockRejectedValueOnce(new Error('offline'));
  await expect(api.progress()).rejects.toMatchObject({ status: 0 });
  await api.progress();
  expect(count('/progress')).toBe(2);
  await api.logout();
  expect(gameDataCache.peek('progress')).toBeNull();
  await api.progress();
  await api.authenticate('login', 'next@example.com', 'password');
  expect(gameDataCache.peek('progress')).toBeNull();
  await preloadGameData();
  fetchMock.mockResolvedValueOnce(Response.json({ message: 'Sessão expirada.' }, { status: 401 }));
  await expect(api.battle(record.id)).rejects.toMatchObject({ status: 401 });
  expect(gameDataCache.peek('progress')).toBeNull();
  expect(gameDataCache.peek('catalog')).toBeNull();
});

it('não deixa uma resposta anterior à saída repopular o cache da próxima conta', async () => {
  let finish!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const previous = api.progress();
  await api.logout();
  progress.selectedTeam[0] = 'protagonist-main-base';
  await api.progress();
  finish(Response.json({ progress: createInitialProgress() }));
  await previous;
  expect((await api.progress()).selectedTeam[0]).toBe('protagonist-main-base');
});

it('preserva a equipe após um PUT rejeitado e ignora uma resposta de salvamento da conta anterior', async () => {
  await preloadGameData();
  fetchMock.mockResolvedValueOnce(Response.json({ message: 'Falha ao salvar.' }, { status: 500 }));
  await expect(api.setTeamSlot(0, 'protagonist-main-base')).rejects.toMatchObject({ status: 500 });
  expect((await api.progress()).selectedTeam).toEqual([null, null, null]);
  let finish!: (response: Response) => void;
  fetchMock.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve; }));
  const saving = api.setTeamSlot(0, 'protagonist-main-base');
  await api.logout();
  await api.progress();
  finish(Response.json({ team: ['protagonist-main-base', null, null] }));
  await saving;
  expect((await api.progress()).selectedTeam).toEqual([null, null, null]);
});

it('não recarrega recompensas na derrota ou desistência', async () => {
  await preloadGameData();
  record.state.status = 'defeat';
  await api.battle(record.id);
  record.state.status = 'abandoned';
  await api.abandonBattle(record.id);
  await preloadGameData();
  for (const path of ['/progress', '/character-unlocks', '/quick-battle', '/campaigns', '/campaigns/path-1/map', '/catalog']) expect(count(path)).toBe(1);
});
