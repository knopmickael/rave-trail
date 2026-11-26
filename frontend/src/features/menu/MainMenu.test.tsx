// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createInitialProgress, type PlayerProgress } from '@game/contracts';
import { FINAL_ENCOUNTER_ID } from '@game/content/campaign-rules';
import { api, clearGameData, gameDataCache } from '../../api';
import { MainMenu } from './MainMenu';

vi.mock('../../api', async (importOriginal) => {
  const original = await importOriginal<typeof import('../../api')>();
  return { ...original, api: { ...original.api, progress: vi.fn() } };
});
const props = () => ({ user: { id: 'menu-user', email: 'menu@example.com', name: 'Aventureiro' }, busy: false, error: '',
  onOpenCharacters: vi.fn(), onOpenStore: vi.fn(), onOpenCampaigns: vi.fn(), onOpenQuickBattle: vi.fn(), onOpenUnlocks: vi.fn(), onOpenProfile: vi.fn(),
  onLogout: vi.fn().mockResolvedValue(undefined), onSaveName: vi.fn().mockResolvedValue(undefined), onSessionExpired: vi.fn(),
  audioVolume: 100, audioMuted: false, onAudioVolumeChange: vi.fn(), onAudioMutedChange: vi.fn() });
beforeEach(() => { clearGameData(); vi.mocked(api.progress).mockResolvedValue(createInitialProgress()); });
afterEach(() => { cleanup(); clearGameData(); });

it('exibe o entardecer pela vitória final salva e o recupera ao remontar o menu', async () => {
  const progress = createInitialProgress(); progress.completedEncounters = [FINAL_ENCOUNTER_ID];
  vi.mocked(api.progress).mockResolvedValue(progress);
  const view = render(<MainMenu {...props()} />);
  await vi.waitFor(() => expect(screen.getByRole('main')).toHaveClass('main-menu-screen--sunset'));
  expect(view.container.querySelector('.main-menu-sunset')).toHaveAttribute('aria-hidden', 'true');
  view.unmount();
  render(<MainMenu {...props()} />);
  await vi.waitFor(() => expect(screen.getByRole('main')).toHaveClass('main-menu-screen--sunset'));
});

it('mantém o céu azul antes de vencer a batalha final', async () => {
  const progress = createInitialProgress(); progress.completedEncounters = Array.from({ length: 6 }, (_, i) => `path-1-encounter-${i + 1}`);
  vi.mocked(api.progress).mockResolvedValue(progress);
  render(<MainMenu {...props()} />);
  await vi.waitFor(() => expect(api.progress).toHaveBeenCalled());
  expect(screen.getByRole('main')).not.toHaveClass('main-menu-screen--sunset');
});

it('não mantém o entardecer ao trocar para uma conta sem a campanha concluída', async () => {
  const progress = createInitialProgress(); progress.completedEncounters = [FINAL_ENCOUNTER_ID];
  gameDataCache.set('progress', progress);
  vi.mocked(api.progress).mockResolvedValue(progress);
  const handlers = props();
  const view = render(<MainMenu {...handlers} />);
  await vi.waitFor(() => expect(screen.getByRole('main')).toHaveClass('main-menu-screen--sunset'));
  clearGameData();
  let finish!: (p: PlayerProgress) => void;
  vi.mocked(api.progress).mockReturnValueOnce(new Promise((resolve) => { finish = resolve; }));
  view.rerender(<MainMenu {...handlers} user={{ ...handlers.user, id: 'another-user' }} />);
  await vi.waitFor(() => expect(screen.getByRole('main')).not.toHaveClass('main-menu-screen--sunset'));
  finish(createInitialProgress());
});
