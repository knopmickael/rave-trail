// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeAll, beforeEach, expect, it, vi } from 'vitest';
import { abilities } from '@game/content/abilities';
import { STARTER_UNIT_IDS, units } from '@game/content/units';
import { createBattle, executeTurn, previewActions, resolvePlayerTurn, type BattleRecord } from '@game/core/battle';
import { api, ApiError } from '../../api';
import { BattleScreen } from './BattleScreen';
import { FINAL_ENCOUNTER_ID } from '@game/content/campaign-rules';
import { SOUND_EFFECT_EVENT } from '../../audio/soundEffects';

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, turn: vi.fn(), battle: vi.fn(), abandonBattle: vi.fn() } };
});
const initial = (): BattleRecord => ({ id: '00000000-0000-4000-8000-000000000001', encounterId: 'path-1-encounter-1', revision: 0,
  state: createBattle(STARTER_UNIT_IDS.map((id) => units.find((unit) => unit.id === id)!), ['road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base'].map((id) => units.find((unit) => unit.id === id)!), Object.values(abilities)), log: [] });
const handlers = () => ({ onBack: vi.fn(), onSessionExpired: vi.fn() });
const skill = (name: string, actor = 'Ravi de Berdal') => screen.getByRole('button', { name: `${name} — ${actor}` });
const energy = () => screen.getByRole('progressbar', { name: 'Energia prevista da equipe' });
const endTurn = () => screen.getByRole('button', { name: /^(?:Encerrar turno|Aguardando inimigo) \d+s$/ });
beforeAll(() => {
  HTMLDialogElement.prototype.showModal = function () { this.setAttribute('open', ''); };
  HTMLDialogElement.prototype.close = function () { this.removeAttribute('open'); };
  HTMLMediaElement.prototype.play = vi.fn().mockResolvedValue(undefined);
  HTMLMediaElement.prototype.pause = vi.fn();
});
beforeEach(() => {
  vi.clearAllMocks();
  let server = initial();
  vi.mocked(api.turn).mockImplementation(async (_id, _revision, _requestId, actions) => {
    const outcome = resolvePlayerTurn(server.state, actions);
    server = { ...server, revision: server.revision + 1, state: outcome.state, log: [...(server.log ?? []), ...outcome.events] };
    return { battle: server, events: outcome.events };
  });
  vi.mocked(api.abandonBattle).mockResolvedValue({ ...initial(), state: { ...initial().state, status: 'abandoned' }, revision: 1 });
});
afterEach(() => { cleanup(); vi.useRealTimers(); });

it('apresenta todos os personagens com suas quatro habilidades e a energia de cada trio', () => {
  render(<BattleScreen initialBattle={initial()} title="Saqueadores da estrada" {...handlers()} />);
  expect(energy()).toHaveAttribute('aria-valuenow', '15');
  expect(screen.getByRole('progressbar', { name: 'Energia da equipe inimiga' })).toHaveAttribute('aria-valuenow', '0');
  for (const name of ['Ravi de Berdal', 'Doko de Berdal', 'Anna de Berdal']) {
    const row = screen.getByRole('group', { name: `Aliado: ${name}` });
    expect(row.querySelector('.fighter-abilities')).toContainElement(row.querySelector('.fighter-card'));
    expect(row.querySelector('.fighter-card')?.children).toHaveLength(2);
    expect(within(row).queryByText(name)).not.toBeInTheDocument();
    expect(within(row).getAllByRole('button', { name: new RegExp(` — ${name}$`) })).toHaveLength(4);
    expect(within(row).getByRole('progressbar', { name: `HP de ${name}` })).toHaveAttribute('aria-valuenow', '100');
  }
  expect(screen.getByRole('button', { name: 'Golpe forte — Saqueador da estrada I (inimigo)' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: /Voltar ao mapa|Voltar à Batalha rápida|Retomar/ })).not.toBeInTheDocument();
  expect(endTurn()).toBeEnabled();
  expect(screen.queryByText('VS')).not.toBeInTheDocument();
  expect(screen.queryByRole('region', { name: 'Detalhes da habilidade' })).not.toBeInTheDocument();
});

it.each([[100, ''], [66, ''], [65, 'hp-track--warning'], [31, 'hp-track--warning'], [30, 'hp-track--critical'], [0, 'hp-track--critical']])(
  'colore a barra de vida em %i HP conforme o limite', (hp, modifier) => {
    const record = initial();
    record.state.teams.player.units[0].hp = hp;
    render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
    const track = screen.getByRole('progressbar', { name: 'HP de Ravi de Berdal' });
    expect(track).toHaveClass('hp-track', ...(modifier ? [modifier] : []));
    expect(track).not.toHaveClass(...(modifier === 'hp-track--critical' ? ['hp-track--warning'] : modifier === 'hp-track--warning' ? ['hp-track--critical'] : ['hp-track--warning', 'hp-track--critical']));
  });

it('marca personagens derrotados com X vermelho e desativa suas habilidades', () => {
  const record = initial();
  const enemy = record.state.teams.enemy.units[0];
  enemy.hp = 0;
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  const row = screen.getByRole('group', { name: `Inimigo: ${enemy.name}` });
  expect(row).toHaveClass('fighter-row--defeated');
  expect(row.querySelector('.fighter-card')).toHaveClass('fighter-card--defeated');
  expect(row.querySelector('.fighter-defeated-mark')).toBeInTheDocument();
  const abilities = within(row).getAllByRole('button').filter((button) => button.classList.contains('battle-skill'));
  expect(abilities).toHaveLength(4);
  expect(abilities.every((button) => (button as HTMLButtonElement).disabled)).toBe(true);
});

it.each(['path-1-encounter-1', 'path-1-encounter-6', FINAL_ENCOUNTER_ID, null])('usa o cenário das trevas somente na batalha final (%s)', (encounterId) => {
  const { container } = render(<BattleScreen initialBattle={{ ...initial(), encounterId }} title="Batalha" {...handlers()} />);
  expect((container.firstElementChild as HTMLElement).style.backgroundImage).toContain(encounterId === FINAL_ENCOUNTER_ID
    ? 'fight-exal-background.png' : 'fight-background.png');
  expect(container.querySelector('video')).toBeNull();
});

it('substitui o único Ravi por Berserk com novas habilidades e registra a transformação após o turno oficial', async () => {
  const record = { ...initial(), encounterId: FINAL_ENCOUNTER_ID };
  record.state = createBattle([units.find((unit) => unit.id === 'protagonist-main-base')!],
    [units.find((unit) => unit.id === 'rival-b-final-mode')!], Object.values(abilities));
  record.state.pendingTransformation = { actorId: 'player-0', unit: units.find((unit) => unit.id === 'protagonist-main-transformed')! };
  vi.mocked(api.turn).mockImplementation(async (_id, _revision, _requestId, actions) => {
    const outcome = resolvePlayerTurn(record.state, actions);
    return { battle: { ...record, revision: 2, state: outcome.state, log: outcome.events }, events: outcome.events };
  });
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={record} title="Exal — Verdadeiro poder" {...handlers()} />);
  await user.click(skill('Reter energia'));
  expect(screen.queryByRole('group', { name: 'Aliado: Ravi Berserk' })).not.toBeInTheDocument();
  await user.click(endTurn());
  const ravi = await screen.findByRole('group', { name: 'Aliado: Ravi Berserk' });
  expect(within(screen.getByRole('region', { name: 'Sua equipe' })).getAllByRole('group')).toHaveLength(1);
  expect(within(screen.getByRole('region', { name: 'Equipe inimiga' })).getAllByRole('group')).toHaveLength(1);
  expect(ravi.querySelector('.fighter-portrait img')).toHaveAttribute('src', '/media/characters/ravi-berserk-face.png');
  expect(skill('Reter muita energia', 'Ravi Berserk')).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Reter energia — Ravi de Berdal' })).not.toBeInTheDocument();
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Registro do combate' }));
  expect(within(screen.getByRole('dialog', { name: 'Registro do combate' })).getByText('Ravi de Berdal despertou como Ravi Berserk!')).toBeInTheDocument();
});

it.each(['victory', 'defeat'] as const)('emite o som de %s ao concluir a batalha oficialmente, sem tocar na prévia ou repetir no histórico', async (status) => {
  const record = initial();
  record.log = [{ kind: 'defeated', message: 'Evento histórico já reproduzido.' }];
  if (status === 'victory') record.state.teams.enemy.units.forEach((unit, index) => { unit.hp = index === 0 ? 1 : 0; });
  else {
    record.state.teams.player.units.forEach((unit, index) => { unit.hp = index === 0 ? 1 : 0; });
    record.state.teams.enemy.energy = 100;
  }
  const sounds: string[] = [];
  const listen = (event: Event) => sounds.push((event as CustomEvent<string>).detail);
  document.addEventListener(SOUND_EFFECT_EVENT, listen);
  vi.mocked(api.turn).mockImplementation(async (_id, _revision, _requestId, actions) => {
    const outcome = resolvePlayerTurn(record.state, actions);
    return { battle: { ...record, revision: 1, state: outcome.state, log: [...record.log!, ...outcome.events] }, events: outcome.events };
  });
  try {
    const user = userEvent.setup();
    render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
    expect(sounds).toEqual([]);
    if (status === 'victory') {
      await user.click(skill('Golpe simples'));
      await user.click(screen.getByRole('button', { name: 'Alvo: Saqueador da estrada I' }));
    } else await user.click(skill('Reter energia'));
    expect(sounds).toEqual([]);
    await user.click(endTurn());
    const expected = status === 'victory' ? ['defeated', 'victory'] : ['turn', 'defeated', 'defeat'];
    await vi.waitFor(() => expect(sounds).toEqual(expected));
    expect(screen.getByRole('heading', { name: status === 'victory' ? 'Vitória!' : 'Derrota' })).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Registro do combate' }));
    expect(sounds).toEqual(expected);
  } finally { document.removeEventListener(SOUND_EFFECT_EVENT, listen); }
});

it('usa somente ícones nas habilidades e no combo, com apenas o botão de remoção', async () => {
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={initial()} title="Batalha" {...handlers()} />);
  expect(skill('Reter energia').textContent).toBe('');
  expect(skill('Reter energia')).not.toHaveAttribute('title');
  await user.click(skill('Reter energia'));
  const arena = screen.getByLabelText('Campo de batalha');
  const combo = screen.getByRole('region', { name: 'Combo do turno' });
  const [playerTeam, comboColumn, enemyTeam] = Array.from(arena.children);
  expect(playerTeam).toHaveClass('battle-team--player');
  expect(comboColumn).toBe(combo);
  expect(enemyTeam).toHaveClass('battle-team--enemy');
  expect(document.querySelector('.battle-bottom-panel')).not.toBeInTheDocument();
  expect(within(combo).getByRole('img', { name: 'Ravi de Berdal' })).toBeInTheDocument();
  expect(within(combo).getByRole('img', { name: 'Reter energia' })).toBeInTheDocument();
  expect(within(combo).getAllByRole('img', { name: /^Alvo: / })).toHaveLength(3);
  expect(within(combo).queryByText('Ravi de Berdal')).not.toBeInTheDocument();
  expect(within(combo).getAllByRole('button')).toHaveLength(1);
  expect(within(combo).queryByRole('button', { name: /Mover ação/ })).not.toBeInTheDocument();
  await user.click(within(combo).getByRole('button', { name: 'Remover ação 1' }));
  expect(energy()).toHaveAttribute('aria-valuenow', '15');
});

it('mostra o ícone do efeito de Proteção coletiva acima das habilidades em vez do nome sob o retrato', () => {
  const record = initial();
  record.state.teams.player.units[0].guardExpiresAt = 3;
  record.state.teams.player.units[0].guardAbilityId = 'female-special';
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  const row = screen.getByRole('group', { name: 'Aliado: Ravi de Berdal' });
  const effects = within(row).getByRole('list', { name: 'Efeitos ativos de Ravi de Berdal' });
  expect(within(effects).getByRole('img', { name: 'Efeito ativo: Proteção coletiva' })).toHaveAttribute('src', abilities['female-special'].icon);
  expect(within(row).queryByText('Guarda ativa')).not.toBeInTheDocument();
});

it('reserva energia assim que escolhe a habilidade e bloqueia as demais opções do personagem', async () => {
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={initial()} title="Batalha" {...handlers()} />);
  await user.click(skill('Golpe simples'));
  await user.click(screen.getByRole('button', { name: 'Alvo: Saqueador da estrada I' }));
  expect(energy()).toHaveAttribute('aria-valuenow', '0');
  expect(skill('Guarda')).toBeDisabled();
  expect(skill('Reter energia')).toBeDisabled();
  expect(endTurn()).toBeEnabled();
  expect(skill('Guarda')).toBeDisabled();
  expect(skill('Reter energia', 'Doko de Berdal')).toBeEnabled();
  await user.click(endTurn());
  await vi.waitFor(() => expect(api.turn).toHaveBeenCalledWith(initial().id, 0, expect.any(String), [{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }]));
  expect(await screen.findByRole('button', { name: /^Encerrar turno \d+s$/ })).toBeEnabled();
});

it('mantém a batalha visível na escolha de alvo, sem opção de cancelar, e destaca o inimigo selecionável', async () => {
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={initial()} title="Batalha" {...handlers()} />);
  await user.click(skill('Golpe simples'));
  expect(document.querySelector('.battle-page')).toHaveClass('battle-page--targeting');
  expect(screen.getByRole('group', { name: 'Aliado: Ravi de Berdal' })).toHaveClass('fighter-row--acting');
  expect(screen.getByRole('group', { name: 'Aliado: Doko de Berdal' })).not.toHaveClass('fighter-row--acting');
  expect(screen.getByRole('region', { name: 'Combo do turno' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Desistir' })).toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Cancelar seleção' })).not.toBeInTheDocument();
  expect(document.querySelector('.battle-target-picker')).not.toBeInTheDocument();
  const target = screen.getByRole('button', { name: 'Alvo: Saqueador da estrada I' });
  expect(target).toHaveClass('fighter-card--target');
  await user.click(target);
  expect(document.querySelector('.battle-page')).not.toHaveClass('battle-page--targeting');
  expect(energy()).toHaveAttribute('aria-valuenow', '0');
  expect(skill('Golpe simples')).toHaveAttribute('aria-pressed', 'true');
  expect(api.turn).not.toHaveBeenCalled();
});

it('seleciona uma ação por personagem, mantém a ordem do combo e remove somente pela lista central', async () => {
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={initial()} title="Batalha" {...handlers()} />);
  expect(skill('Varredura tática', 'Anna de Berdal')).toBeDisabled();
  await user.click(skill('Reter energia'));
  expect(energy()).toHaveAttribute('aria-valuenow', '35');
  expect(skill('Varredura tática', 'Anna de Berdal')).toBeEnabled();
  await user.click(skill('Varredura tática', 'Anna de Berdal'));
  const combo = screen.getByRole('region', { name: 'Combo do turno' });
  const comboRows = within(combo).getAllByRole('listitem');
  expect(comboRows).toHaveLength(2);
  expect(within(comboRows[1]).getAllByRole('img', { name: /^Alvo: / })).toHaveLength(3);
  await user.click(skill('Reter energia', 'Doko de Berdal'));
  expect(energy()).toHaveAttribute('aria-valuenow', '25');
  expect(skill('Guarda', 'Anna de Berdal')).toBeDisabled();
  await user.click(skill('Reter energia', 'Doko de Berdal'));
  expect(energy()).toHaveAttribute('aria-valuenow', '25');
  const rowsAfterDoko = within(combo).getAllByRole('listitem');
  expect(rowsAfterDoko).toHaveLength(3);
  await user.click(within(rowsAfterDoko[2]).getByRole('button', { name: 'Remover ação 3' }));
  expect(energy()).toHaveAttribute('aria-valuenow', '5');
  await user.click(endTurn());
  await vi.waitFor(() => expect(api.turn).toHaveBeenCalledWith(initial().id, 0, expect.any(String), [
    { actorId: 'player-0', abilityId: 'retain-energy' }, { actorId: 'player-2', abilityId: 'secondary-special' },
  ]));
});

it('Guarda entra diretamente na fila e não permite proteger outro aliado', async () => {
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={initial()} title="Batalha" {...handlers()} />);
  await user.click(skill('Guarda'));
  expect(energy()).toHaveAttribute('aria-valuenow', '5');
  expect(screen.queryByRole('status')).not.toBeInTheDocument();
  await user.click(endTurn());
  await vi.waitFor(() => expect(api.turn).toHaveBeenCalledWith(initial().id, 0, expect.any(String), [{ actorId: 'player-0', abilityId: 'guard' }]));
});

it('permite direcionar Força interna a um aliado e exibe seu efeito após a confirmação', async () => {
  const record = initial();
  record.state = createBattle(['capitao-da-guarda-ridan-base', 'protagonist-secondary-base'].map((id) => units.find((unit) => unit.id === id)!),
    [units.find((unit) => unit.id === 'road-raider-3-base')!], Object.values(abilities));
  record.state.teams.player.energy = 100;
  vi.mocked(api.turn).mockImplementation(async (_id, _revision, _requestId, actions) => {
    const outcome = executeTurn(record.state, actions);
    return { battle: { ...record, revision: 1, state: outcome.state, log: outcome.events }, events: outcome.events };
  });
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  await user.click(skill('Força interna', 'Capitão da guarda Ridan'));
  expect(energy()).toHaveAttribute('aria-valuenow', '70');
  expect(screen.getByRole('status')).toHaveTextContent('Escolha um aliado');
  await user.click(screen.getByRole('button', { name: 'Alvo: Doko de Berdal' }));
  await user.click(endTurn());
  expect(await screen.findByRole('img', { name: 'Efeito ativo: Força interna' })).toHaveAttribute('src', '/media/abilities/internal-strength.png');
  expect(api.turn).toHaveBeenCalledWith(record.id, 0, expect.any(String), [{ actorId: 'player-0', abilityId: 'internal-strength', targetId: 'player-1' }]);
});

it('ressurreição reserva 50 de energia e permite selecionar somente um aliado derrotado', async () => {
  const record = initial();
  record.state = createBattle(['legendary-beast-premium', ...STARTER_UNIT_IDS.slice(0, 2)].map((id) => units.find((unit) => unit.id === id)!), [units.find((unit) => unit.id === 'road-raider-1-base')!], Object.values(abilities));
  record.state.teams.player.energy = 100;
  record.state.teams.player.units[1].hp = 0;
  vi.mocked(api.turn).mockImplementation(async (_id, _revision, _requestId, actions) => {
    const outcome = previewActions(record.state, actions);
    return { battle: { ...record, revision: 1, state: outcome.state, log: outcome.events }, events: outcome.events };
  });
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  await user.click(skill('Trazer dos mortos', 'Besta Lendária'));
  expect(energy()).toHaveAttribute('aria-valuenow', '50');
  expect(screen.getByRole('status')).toHaveTextContent('Escolha um aliado derrotado');
  expect(screen.getByRole('button', { name: 'Personagem: Besta Lendária' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Adversário: Saqueador da estrada I' })).toBeDisabled();
  await user.click(screen.getByRole('button', { name: 'Alvo: Ravi de Berdal' }));
  await user.click(endTurn());
  await vi.waitFor(() => expect(screen.getByRole('progressbar', { name: 'HP de Ravi de Berdal' })).toHaveAttribute('aria-valuenow', '50'));
  expect(api.turn).toHaveBeenCalledWith(record.id, 0, expect.any(String), [{ actorId: 'player-0', abilityId: 'resurrection', targetId: 'player-1' }]);
});

it('impede remover uma ação com dependentes e orienta remover as dependentes primeiro', async () => {
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={initial()} title="Batalha" {...handlers()} />);
  await user.click(skill('Reter energia'));
  await user.click(skill('Varredura tática', 'Anna de Berdal'));
  const combo = screen.getByRole('region', { name: 'Combo do turno' });
  expect(within(combo).getAllByRole('listitem')).toHaveLength(2);
  await user.click(within(combo).getByRole('button', { name: 'Remover ação 1' }));
  const dialog = screen.getByRole('dialog', { name: 'Não é possível remover a ação' });
  expect(within(dialog).getByText(/Remover "Reter energia"/)).toBeInTheDocument();
  expect(within(dialog).getByRole('listitem')).toHaveTextContent('Anna de Berdal: Varredura tática');
  expect(within(combo).getAllByRole('listitem')).toHaveLength(2);
  expect(endTurn()).toBeEnabled();
  await user.click(within(dialog).getByRole('button', { name: 'Entendi' }));
  expect(screen.queryByRole('dialog', { name: 'Não é possível remover a ação' })).not.toBeInTheDocument();
  await user.click(within(combo).getByRole('button', { name: 'Remover ação 2' }));
  expect(within(combo).getAllByRole('listitem')).toHaveLength(1);
  await user.click(within(combo).getByRole('button', { name: 'Remover ação 1' }));
  expect(within(combo).queryAllByRole('listitem')).toHaveLength(0);
  expect(endTurn()).toBeEnabled();
});

it('abre o registro completo em modal sem truncar ações e fecha preservando a seleção', async () => {
  const record = initial();
  record.log = Array.from({ length: 150 }, (_, index) => ({ kind: 'damage', message: `Evento histórico ${index + 1}`,
    actionId: `action-${index}`, actorId: 'player-0', abilityId: 'simple-strike', targetIds: ['enemy-0'] }));
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  await user.click(skill('Reter energia'));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Registro do combate' }));
  const dialog = screen.getByRole('dialog', { name: 'Registro do combate' });
  const rows = within(dialog).getAllByRole('listitem');
  expect(rows).toHaveLength(150);
  expect(within(rows[0]).getAllByRole('img')).toHaveLength(3);
  expect(within(rows[0]).getByRole('img', { name: 'Ravi de Berdal' })).toBeInTheDocument();
  expect(within(rows[0]).getByRole('img', { name: 'Golpe simples' })).toBeInTheDocument();
  expect(within(rows[0]).getByRole('img', { name: 'Alvo: Saqueador da estrada I' })).toBeInTheDocument();
  expect(within(dialog).queryByText(/Evento histórico/)).not.toBeInTheDocument();
  await user.click(within(dialog).getByRole('button', { name: 'Fechar registro do combate' }));
  expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  expect(skill('Reter energia')).toHaveAttribute('aria-pressed', 'true');
});

it('desiste no servidor somente após confirmar no modal', async () => {
  let finish!: (record: BattleRecord) => void;
  vi.mocked(api.abandonBattle).mockReturnValue(new Promise((resolve) => { finish = resolve; }));
  const callbacks = handlers(); const user = userEvent.setup();
  render(<BattleScreen initialBattle={initial()} title="Batalha" {...callbacks} />);
  await user.click(screen.getByRole('button', { name: 'Desistir' }));
  const dialog = screen.getByRole('dialog', { name: 'Desistir da batalha?' });
  expect(api.abandonBattle).not.toHaveBeenCalled();
  expect(callbacks.onBack).not.toHaveBeenCalled();
  await user.click(within(dialog).getByRole('button', { name: 'Confirmar desistência' }));
  expect(screen.queryByRole('dialog', { name: 'Desistir da batalha?' })).not.toBeInTheDocument();
  expect(api.abandonBattle).toHaveBeenCalledWith(initial().id);
  expect(callbacks.onBack).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Desistir' })).toBeDisabled();
  finish({ ...initial(), revision: 1, state: { ...initial().state, status: 'abandoned' } });
  await vi.waitFor(() => expect(callbacks.onBack).toHaveBeenCalledTimes(1));
});

it('permite continuar na batalha ao cancelar a desistência', async () => {
  const callbacks = handlers(); const user = userEvent.setup();
  render(<BattleScreen initialBattle={initial()} title="Batalha" {...callbacks} />);
  await user.click(screen.getByRole('button', { name: 'Desistir' }));
  const dialog = screen.getByRole('dialog', { name: 'Desistir da batalha?' });
  await user.click(within(dialog).getByRole('button', { name: 'Continuar na batalha' }));
  expect(screen.queryByRole('dialog', { name: 'Desistir da batalha?' })).not.toBeInTheDocument();
  expect(api.abandonBattle).not.toHaveBeenCalled();
  expect(screen.getByRole('button', { name: 'Desistir' })).toBeEnabled();
});

it('preserva a batalha se a desistência falhar e permite repetir', async () => {
  vi.mocked(api.abandonBattle).mockRejectedValueOnce(new Error('Falha de rede.'));
  const callbacks = handlers(); const user = userEvent.setup();
  render(<BattleScreen initialBattle={initial()} title="Batalha" {...callbacks} />);
  await user.click(screen.getByRole('button', { name: 'Desistir' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Desistir da batalha?' })).getByRole('button', { name: 'Confirmar desistência' }));
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha de rede.');
  expect(callbacks.onBack).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Desistir' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Desistir da batalha?' })).getByRole('button', { name: 'Confirmar desistência' }));
  await vi.waitFor(() => expect(callbacks.onBack).toHaveBeenCalledTimes(1));
});

it.each(['victory', 'defeat', 'abandoned'] as const)('permite sair de uma batalha rápida somente após seu encerramento: %s', async (status) => {
  const record: BattleRecord = { ...initial(), encounterId: null, state: { ...initial().state, status } };
  const callbacks = handlers(); const user = userEvent.setup();
  render(<BattleScreen initialBattle={record} title="Batalha rápida" {...callbacks} />);
  expect(screen.queryByRole('button', { name: 'Desistir' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Encerrar turno \d+s$/ })).not.toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Voltar à Batalha rápida' }));
  expect(callbacks.onBack).toHaveBeenCalledTimes(1);
});

it('reutiliza o identificador do turno ao repetir após falha de rede', async () => {
  vi.mocked(api.turn).mockRejectedValueOnce(new Error('Falha de rede.'));
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={initial()} title="Batalha" {...handlers()} />);
  await user.click(skill('Reter energia'));
  await user.click(endTurn());
  expect(await screen.findByRole('alert')).toHaveTextContent('Falha de rede.');
  const requestId = vi.mocked(api.turn).mock.calls[0][2];
  await user.click(endTurn());
  await vi.waitFor(() => expect(api.turn).toHaveBeenCalledTimes(2));
  expect(vi.mocked(api.turn).mock.calls[1][2]).toBe(requestId);
});

it('recupera o resultado oficial e o registro em caso de conflito na desistência', async () => {
  vi.mocked(api.abandonBattle).mockRejectedValueOnce(new ApiError('Esta batalha já terminou.', 409));
  vi.mocked(api.battle).mockResolvedValue({ ...initial(), state: { ...initial().state, status: 'victory' },
    log: [{ kind: 'damage', message: 'Vitória oficial.', actionId: 'final', actorId: 'player-0', abilityId: 'simple-strike', targetIds: ['enemy-0'] }] });
  const callbacks = handlers(); const user = userEvent.setup();
  render(<BattleScreen initialBattle={initial()} title="Batalha" {...callbacks} />);
  await user.click(screen.getByRole('button', { name: 'Desistir' }));
  await user.click(within(screen.getByRole('dialog', { name: 'Desistir da batalha?' })).getByRole('button', { name: 'Confirmar desistência' }));
  expect(await screen.findByRole('heading', { name: 'Vitória!' })).toBeInTheDocument();
  expect(callbacks.onBack).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Registro do combate' }));
  const dialog = screen.getByRole('dialog', { name: 'Registro do combate' });
  expect(within(dialog).getByRole('img', { name: 'Golpe simples' })).toBeInTheDocument();
  expect(screen.queryByText('Vitória oficial.')).not.toBeInTheDocument();
});

it('atualizações de relógio e consultas da mesma revisão preservam a fila escolhida', async () => {
  vi.useFakeTimers();
  const record = { ...initial(), turnDeadlineAt: new Date(Date.now() + 45000).toISOString(), botActsAt: null };
  vi.mocked(api.battle).mockResolvedValue(record);
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  fireEvent.click(skill('Reter energia'));
  await act(async () => { await vi.advanceTimersByTimeAsync(1000); });
  expect(within(endTurn()).getByRole('timer')).toHaveTextContent('44s');
  expect(skill('Reter energia')).toHaveAttribute('aria-pressed', 'true');
  expect(energy()).toHaveAttribute('aria-valuenow', '35');
});

it('bloqueia os controles durante o turno do bot e libera somente após a resposta oficial atrasada', async () => {
  vi.useFakeTimers();
  const started = Date.now();
  const record: BattleRecord = { ...initial(), revision: 1, state: { ...initial().state, activeSide: 'enemy', turn: 2 },
    turnDeadlineAt: new Date(started + 45000).toISOString(), botActsAt: new Date(started + 7000).toISOString() };
  vi.mocked(api.battle).mockImplementation(async () => Date.now() < started + 7000 ? record : {
    ...record, revision: 2, state: { ...record.state, activeSide: 'player', turn: 3 },
    turnDeadlineAt: new Date(started + 52000).toISOString(), botActsAt: null,
  });
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  expect(screen.getByText(/Turno do BOT COM/)).toBeInTheDocument();
  expect(endTurn()).toHaveTextContent(/^Aguardando inimigo \d+s$/);
  expect(endTurn()).toBeDisabled();
  expect(skill('Reter energia')).toBeDisabled();
  await act(async () => { await vi.advanceTimersByTimeAsync(6999); });
  expect(endTurn()).toBeDisabled();
  await act(async () => { await vi.advanceTimersByTimeAsync(1); });
  expect(endTurn()).toBeEnabled();
  expect(screen.getByRole('timer')).toHaveTextContent('45s');
  expect(api.turn).not.toHaveBeenCalled();
});

it('revela o combo planejado do inimigo uma ação por vez, sem botão de remoção', () => {
  vi.useFakeTimers();
  const source = initial();
  const record: BattleRecord = { ...source, revision: 1, state: { ...source.state, activeSide: 'enemy', turn: 2 },
    combo: { side: 'enemy', actions: [
      { actorId: 'enemy-0', abilityId: 'strong-strike', targetId: 'player-0' },
      { actorId: 'enemy-1', abilityId: 'secondary-special' },
    ] },
    turnDeadlineAt: new Date(Date.now() + 45000).toISOString(), botActsAt: new Date(Date.now() + 7000).toISOString() };
  vi.mocked(api.battle).mockResolvedValue(record);
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  const combo = screen.getByRole('region', { name: 'Combo do turno' });
  expect(within(combo).getByText('Aguardando ações do inimigo…')).toBeInTheDocument();
  expect(within(combo).queryAllByRole('listitem')).toHaveLength(0);
  act(() => vi.advanceTimersByTime(1200));
  expect(within(combo).getAllByRole('listitem')).toHaveLength(1);
  act(() => vi.advanceTimersByTime(1200));
  const rows = within(combo).getAllByRole('listitem');
  expect(rows).toHaveLength(2);
  expect(within(rows[0]).getByRole('img', { name: 'Saqueador da estrada I' })).toBeInTheDocument();
  expect(within(rows[0]).getByRole('img', { name: 'Golpe forte' })).toBeInTheDocument();
  expect(within(rows[0]).getByRole('img', { name: 'Alvo: Ravi de Berdal' })).toBeInTheDocument();
  expect(within(rows[1]).getAllByRole('img', { name: /^Alvo: / })).toHaveLength(3);
  expect(within(combo).queryByRole('button')).not.toBeInTheDocument();
});

it.each(['victory', 'defeat'] as const)('mantém a lista de combo no layout de três colunas após %s', (status) => {
  const record = initial();
  const enemyAction = status === 'defeat';
  record.state.status = status;
  record.state.activeSide = enemyAction ? 'enemy' : 'player';
  record.state.turn = 1;
  record.log = [enemyAction
    ? { kind: 'damage', message: 'Derrota.', actionId: 'enemy:1:0', actorId: 'enemy-0', abilityId: 'strong-strike', targetIds: ['player-0'] }
    : { kind: 'damage', message: 'Vitória.', actionId: 'player:1:0', actorId: 'player-0', abilityId: 'simple-strike', targetIds: ['enemy-0'] }];
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  const arena = screen.getByLabelText('Campo de batalha');
  expect(Array.from(arena.children)).toHaveLength(3);
  const combo = within(arena).getByRole('region', { name: 'Combo do turno' });
  const row = within(combo).getByRole('listitem');
  expect(within(row).getByRole('img', { name: enemyAction ? 'Saqueador da estrada I' : 'Ravi de Berdal' })).toBeInTheDocument();
  expect(within(combo).queryByRole('button', { name: /Remover ação/ })).not.toBeInTheDocument();
});

it('alinha à direita as ações inimigas no registro do combate', async () => {
  const record = initial();
  record.log = [
    { kind: 'damage', message: 'Ataque aliado.', actionId: 'player:1:0', actorId: 'player-0', abilityId: 'simple-strike', targetIds: ['enemy-0'] },
    { kind: 'damage', message: 'Ataque inimigo.', actionId: 'enemy:1:0', actorId: 'enemy-0', abilityId: 'strong-strike', targetIds: ['player-0'] },
  ];
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  await user.click(screen.getByRole('button', { name: 'Registro do combate' }));
  const rows = within(screen.getByRole('dialog', { name: 'Registro do combate' })).getAllByRole('listitem');
  expect(rows[0]).toHaveClass('battle-log-entry--enemy');
  expect(rows[1]).not.toHaveClass('battle-log-entry--enemy');
});

it('agrupa o registro por turnos decrescentes e lista os movimentos do último para o primeiro', async () => {
  const record = initial();
  record.log = [
    { kind: 'damage', message: 'Ataque aliado 1.', actionId: 'player:1:0', actorId: 'player-0', abilityId: 'simple-strike', targetIds: ['enemy-0'] },
    { kind: 'damage', message: 'Ataque aliado 2.', actionId: 'player:1:1', actorId: 'player-1', abilityId: 'simple-strike', targetIds: ['enemy-0'] },
    { kind: 'damage', message: 'Ataque inimigo 1.', actionId: 'enemy:2:0', actorId: 'enemy-0', abilityId: 'strong-strike', targetIds: ['player-0'] },
    { kind: 'damage', message: 'Ataque inimigo 2.', actionId: 'enemy:2:1', actorId: 'enemy-1', abilityId: 'simple-strike', targetIds: ['player-1'] },
  ];
  const user = userEvent.setup();
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  await user.click(screen.getByRole('button', { name: 'Registro do combate' }));
  const dialog = screen.getByRole('dialog', { name: 'Registro do combate' });
  expect(within(dialog).getAllByRole('heading', { level: 3 }).map((heading) => heading.textContent)).toEqual(['Turno 2', 'Turno 1']);
  const rows = within(dialog).getAllByRole('listitem');
  expect(rows).toHaveLength(4);
  expect(within(rows[0]).getByRole('img', { name: 'Saqueador da estrada II' })).toBeInTheDocument();
  expect(within(rows[1]).getByRole('img', { name: 'Saqueador da estrada I' })).toBeInTheDocument();
  expect(within(rows[2]).getByRole('img', { name: 'Doko de Berdal' })).toBeInTheDocument();
  expect(within(rows[3]).getByRole('img', { name: 'Ravi de Berdal' })).toBeInTheDocument();
});

it('descarta a fila quando o servidor encerra automaticamente o turno de 45 segundos', async () => {
  vi.useFakeTimers();
  const started = Date.now();
  const record: BattleRecord = { ...initial(), turnDeadlineAt: new Date(started + 45000).toISOString(), botActsAt: null };
  vi.mocked(api.battle).mockImplementation(async () => Date.now() < started + 45000 ? record : {
    ...record, revision: 1, state: { ...record.state, activeSide: 'enemy', turn: 2 },
    turnDeadlineAt: new Date(started + 90000).toISOString(), botActsAt: new Date(started + 52000).toISOString(),
  });
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  fireEvent.click(skill('Reter energia'));
  await act(async () => { await vi.advanceTimersByTimeAsync(45000); });
  expect(endTurn()).toBeDisabled();
  expect(within(screen.getByRole('region', { name: 'Combo do turno' })).getByText('Aguardando ações do inimigo…')).toBeInTheDocument();
  expect(api.turn).not.toHaveBeenCalled();
});

it('sincroniza imediatamente ao recuperar o foco, sem esperar o próximo intervalo de consulta', async () => {
  vi.useFakeTimers();
  const record: BattleRecord = { ...initial(), turnDeadlineAt: new Date(Date.now() + 45000).toISOString(), botActsAt: null };
  vi.mocked(api.battle).mockResolvedValue(record);
  render(<BattleScreen initialBattle={record} title="Batalha" {...handlers()} />);
  await act(async () => { await Promise.resolve(); });
  vi.mocked(api.battle).mockResolvedValue({ ...record, revision: 1, state: { ...record.state, activeSide: 'enemy' },
    botActsAt: new Date(Date.now() + 7000).toISOString() });
  await act(async () => { fireEvent.focus(window); await Promise.resolve(); });
  expect(endTurn()).toBeDisabled();
  expect(screen.getByText(/Turno do BOT COM/)).toBeInTheDocument();
});
