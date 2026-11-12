// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { abilities } from '../../shared/src/content/abilities';
import { campaigns } from '../../shared/src/content/campaigns';
import { units } from '../../shared/src/content/units';
import type { Catalog, Character, Entity } from '../contracts';
import { request } from './api';
import { Studio } from './main';

vi.mock('./api', () => ({ request: vi.fn(), setToken: vi.fn() }));
let catalog: Catalog;
beforeEach(() => {
  catalog = { characters: units.slice(0, 2).map((u) => ({ ...u, abilityIds: [...u.abilityIds], unlockRule: null, priceUsd: null } as Character)),
    abilities: Object.values(abilities), campaigns: campaigns.map((c) => ({ ...c, mapBackground: c.mapBackground ?? null, prerequisiteEncounterId: null })),
    encounters: [{ id: 'test-battle', campaignId: 'path-1', position: 1, title: 'Confronto de teste', story: 'História do confronto.', enemyUnitIds: [units[0].id], mapX: 50, mapY: 50 }], setups: [] };
  vi.spyOn(window, 'confirm').mockReturnValue(true);
  vi.mocked(request).mockReset().mockImplementation(async (path, method, body) => {
    if (path === '/api/status') return { ready: true, token: 'test', database: 'Testes', aiReady: false };
    if (path === '/api/catalog') return structuredClone(catalog);
    if (path === '/api/characters/order') {
      const ids = (body as { ids: string[] }).ids;
      catalog.characters = ids.map((id, rosterOrder) => ({ ...catalog.characters.find((c) => c.id === id)!, rosterOrder }));
    }
    if (method === 'DELETE') {
      const [, , entity, id] = path.split('/');
      (catalog[entity as Entity] as { id: string }[]) = catalog[entity as Entity].filter((item) => item.id !== id);
    }
    return { ok: true };
  });
});
afterEach(() => { cleanup(); vi.restoreAllMocks(); });

it.each([
  ['Personagens', 'Ravi de Berdal', 'Nome', 'characters'],
  ['Habilidades', 'Guarda', 'Nome da habilidade', 'abilities'],
  ['Campanhas', 'Pondo o pé na estrada', 'Título da campanha', 'campaigns'],
  ['Confrontos', 'Confronto de teste', 'Título do confronto', 'encounters'],
] as const)('abre %s sem confirmação e exige confirmação para salvar, descartar e excluir', async (section, name, label, entity) => {
  const user = userEvent.setup(); render(<Studio />);
  await screen.findByRole('region', { name: 'Lista de personagens' });
  await user.click(screen.getByRole('button', { name: new RegExp(`^${section}`) }));
  const library = screen.getByRole('region', { name: `Lista de ${section.toLowerCase()}` });
  vi.mocked(window.confirm).mockReturnValue(false);
  await user.click(within(library).getByRole('button', { name: new RegExp(`^${name}`) }));
  expect(screen.getByRole('button', { name: 'Salvar alterações' })).toBeInTheDocument();
  expect(window.confirm).not.toHaveBeenCalled();
  await user.type(screen.getByLabelText(label, { exact: true }), ' editado');
  expect(window.confirm).not.toHaveBeenCalled();
  vi.mocked(request).mockClear(); vi.mocked(window.confirm).mockReturnValue(false);
  await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  expect(request).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Descartar' }));
  expect(screen.getByLabelText(label, { exact: true })).toHaveValue(`${name} editado`);
  await user.click(screen.getByRole('button', { name: 'Excluir' }));
  expect(request).not.toHaveBeenCalled();
  vi.mocked(window.confirm).mockReturnValue(true);
  await user.click(screen.getByRole('button', { name: 'Salvar alterações' }));
  await screen.findByText('Alterações salvas no banco com sucesso.');
  expect(request).toHaveBeenCalledWith(expect.stringContaining(`/api/${entity}/`), 'PUT', expect.any(Object));
  await user.click(screen.getByRole('button', { name: 'Excluir' }));
  await screen.findByText('Registro excluído.');
  expect(request).toHaveBeenCalledWith(expect.stringContaining(`/api/${entity}/`), 'DELETE');
});

it('reordena pela lista sem confirmação e mantém as posições globais durante a pesquisa', async () => {
  const user = userEvent.setup(); render(<Studio />);
  const down = await screen.findByRole('button', { name: 'Descer Ravi de Berdal' });
  expect(screen.getByRole('button', { name: 'Subir Ravi de Berdal' })).toBeDisabled();
  vi.mocked(request).mockClear(); vi.mocked(window.confirm).mockReturnValue(false);
  await user.click(down); await screen.findByText('Ordem dos personagens atualizada no jogo.');
  expect(window.confirm).not.toHaveBeenCalled();
  expect(request).toHaveBeenCalledWith('/api/characters/order', 'PUT', { ids: [units[1].id, units[0].id] });
  await user.type(screen.getByRole('searchbox', { name: 'Buscar personagens' }), 'Ravi');
  expect(screen.getByRole('button', { name: 'Subir Ravi de Berdal' })).toBeEnabled();
  expect(screen.getByRole('button', { name: 'Descer Ravi de Berdal' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Subir Ravi de Berdal' }));
  await screen.findByText('Ordem dos personagens atualizada no jogo.');
  expect(request).toHaveBeenLastCalledWith('/api/catalog');
  expect(request).toHaveBeenCalledWith('/api/characters/order', 'PUT', { ids: [units[0].id, units[1].id] });
  expect(window.confirm).not.toHaveBeenCalled();
});

it('pesquisa habilidades e apresenta imagem, custo, alvo e efeitos; oferece somente os desbloqueios solicitados', async () => {
  const user = userEvent.setup(); render(<Studio />);
  await user.click(await screen.findByRole('button', { name: /^Ravi de Berdal/ }));
  const search = screen.getByRole('searchbox', { name: 'Pesquisar habilidade 1 por nome' });
  await user.type(search, 'guarda');
  await user.selectOptions(screen.getByRole('combobox', { name: 'Habilidade 1' }), 'guard');
  expect(screen.getAllByRole('img', { name: 'Ícone de Guarda' }).length).toBeGreaterThan(0);
  expect(screen.getAllByText(`${abilities.guard.energyCost} energia · Próprio usuário`).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/Redução por golpe: 10/).length).toBeGreaterThan(0);
  const unlock = screen.getByRole('combobox', { name: 'Forma de desbloqueio' });
  expect(within(unlock).getAllByRole('option')).toHaveLength(3);
  await user.selectOptions(unlock, 'battle-wins');
  const reveal = screen.getByRole('combobox', { name: 'Quando revelar a lista de requisitos' });
  expect(within(reveal).getAllByRole('option')).toHaveLength(2);
  await user.selectOptions(reveal, 'encounter');
  expect(screen.getByRole('combobox', { name: 'Campanha para revelar requisitos' })).toHaveValue('path-1');
  expect(screen.getByRole('combobox', { name: 'Batalha mínima para revelar requisitos' })).toHaveValue('test-battle');
  expect(screen.queryByLabelText('Descrição do desbloqueio')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Conteúdo provisório')).not.toBeInTheDocument();
});
