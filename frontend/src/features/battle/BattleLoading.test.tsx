// @vitest-environment jsdom
import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { BattleLoading } from './BattleLoading';

afterEach(cleanup);

it('mostra o carregamento em um modal sobre o céu', () => {
  render(<BattleLoading />);
  const modal = screen.getByRole('status');
  expect(modal).toHaveTextContent('Carregando batalha...');
  expect(modal).toHaveClass('battle-loading-modal');
  expect(modal.closest('main')?.style.backgroundImage).toContain('sky-background.webp');
});
