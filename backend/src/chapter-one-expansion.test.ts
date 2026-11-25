import { expect, it } from 'vitest';
import { abilities } from '@game/content/abilities.js';
import { units } from '@game/content/units.js';
import { encounters } from '@game/content/encounters.js';
import { battleUnlockRules } from '@game/content/unlocks.js';
import { createBattle } from '@game/core/battle.js';
import { characterUnlockProgress, type BattleVictory } from '@game/core/unlocks.js';

const victory = (enemy: string, player = 'protagonist-main-base'): BattleVictory => ({ mode: 'quick', playerUnitIds: [player], enemyUnitIds: [enemy] });
const mission = (id: string, history: BattleVictory[]) => {
  const entry = characterUnlockProgress(units, [], history).characters.find((u) => u.id === id)!;
  expect(entry?.kind).toBe('battle-wins');
  if (entry.kind !== 'battle-wins') throw new Error('Missão esperada.');
  return entry.requirements;
};

it.each([
  ['saqueador-da-estrada-iii', 4, 15, 10, '/media/characters/saqueador-iii.png'],
  ['saqueador-da-estrada-iv', 4, 15, 10, '/media/characters/saqueador-iv.png'],
  ['saqueadora-da-estrada-ii', 4, 15, 10, '/media/characters/saqueadora-ii.png'],
  ['exal-de-grimoria-ii', 6, 25, 20, '/media/characters/exal-ii.png'],
  ['monnica-de-grimoria-ii', 6, 25, 20, '/media/characters/monnica-ii.png'],
] as const)('integra %s ao combate e à missão após a batalha %s', (id, gate, wins, defeats, illustration) => {
  const unit = units.find((u) => u.id === id)!;
  expect(unit).toBeDefined();
  expect(unit.illustration).toBe(illustration);
  expect(createBattle([unit], [units[0]], Object.values(abilities)).teams.player.units[0]).toMatchObject({ unitId: id, hp: 100 });
  expect(battleUnlockRules.find((r) => r.unitId === id)?.availableAfterEncounterId).toBe(`path-1-encounter-${gate}`);
  const history = Array.from({ length: wins }, (_, i) => victory(i < defeats ? id : 'protagonist-secondary-base'));
  expect(mission(id, history).map((r) => [r.current, r.target])).toEqual([[wins, wins], [defeats, defeats]]);
});

it('Jung II distingue o original e exige Ravi base; Berserk exige as duas versões II com Ravi', () => {
  const baseHistory = Array.from({ length: 30 }, () => victory('rival-a-base'));
  expect(mission('jung-de-grimoria-ii', baseHistory).map((r) => r.current)).toEqual([25, 0, 0]);
  const qualified = [...Array.from({ length: 20 }, () => victory('jung-de-grimoria-ii')),
    ...Array.from({ length: 20 }, () => victory('exal-de-grimoria-ii'))];
  expect(mission('protagonist-main-transformed', qualified).map((r) => r.current)).toEqual([30, 20, 20]);
  expect(mission('protagonist-main-transformed', qualified.map((v) => ({ ...v, playerUnitIds: ['protagonist-main-transformed'] }))).map((r) => r.current)).toEqual([30, 0, 0]);
});

it('as batalhas 4, 5 e 6 mantêm IDs e usam as novas formações', () => {
  expect(encounters.filter((e) => e.campaignId === 'path-1').slice(3, 6).map((e) => [e.id, e.enemyUnitIds])).toEqual([
    ['path-1-encounter-4', ['saqueador-da-estrada-iii', 'saqueador-da-estrada-iv', 'saqueadora-da-estrada-ii']],
    ['path-1-encounter-5', ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c']],
    ['path-1-encounter-6', ['jung-de-grimoria-ii', 'exal-de-grimoria-ii', 'monnica-de-grimoria-ii']],
  ]);
});
