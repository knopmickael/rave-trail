// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, expect, it, vi } from 'vitest';
import { STARTER_UNIT_IDS, units } from '@game/content/units';
import { abilities } from '@game/content/abilities';
import { createBattle } from '@game/core/battle';
import { BattleScreen } from '../battle/BattleScreen';
import { LanguageProvider, LANGUAGE_STORAGE_KEY } from '../../i18n/LanguageProvider';
import { api } from '../../api';

afterEach(cleanup);
it('sincroniza adição e remoção por transporte multiplayer sem polling HTTP', async () => {
  window.localStorage.setItem(LANGUAGE_STORAGE_KEY, 'pt-BR');
  const team = STARTER_UNIT_IDS.map((id) => units.find((u) => u.id === id)!);
  const record = { id: 'battle', encounterId: null, revision: 0, state: createBattle(team, team, Object.values(abilities)), turnDeadlineAt: new Date(Date.now() + 45000).toISOString(), log: [] };
  const onDraft = vi.fn().mockResolvedValue(undefined);
  const polling = vi.spyOn(api, 'battle');
  render(<LanguageProvider><BattleScreen initialBattle={record} title="Multiplayer" onBack={vi.fn()} onSessionExpired={vi.fn()}
    multiplayer={{ record, connected: true, onDraft, onTurn: vi.fn(), onSurrender: vi.fn() }} /></LanguageProvider>);
  fireEvent.click(screen.getByRole('button', { name: 'Golpe simples — Ravi de Berdal' }));
  fireEvent.click(screen.getByRole('button', { name: 'Alvo: Ravi de Berdal' }));
  await waitFor(() => expect(onDraft).toHaveBeenCalledWith([{ actorId: 'player-0', abilityId: 'simple-strike', targetId: 'enemy-0' }]));
  await waitFor(() => expect(screen.getByRole('button', { name: 'Remover ação 1' })).toBeEnabled());
  fireEvent.click(screen.getByRole('button', { name: 'Remover ação 1' }));
  await waitFor(() => expect(onDraft).toHaveBeenLastCalledWith([]));
  expect(polling).not.toHaveBeenCalled();
});
