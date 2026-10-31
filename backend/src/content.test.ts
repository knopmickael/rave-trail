import { describe, expect, it } from 'vitest';
import { createInitialProgress } from '@game/contracts.js';
import { abilities } from '@game/content/abilities.js';
import { narrativeCharacters, rosterUnits, units } from '@game/content/units.js';
import { encounters } from '@game/content/encounters.js';

describe('catálogo compartilhado', () => {
  it('define as sete equipes aprovadas em ordem, incluindo dois inimigos na sexta e o duelo final', () => {
    expect(encounters.map((entry) => entry.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(encounters.map((entry) => entry.enemyUnitIds)).toEqual([
      ['road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base'],
      ['rival-a-base', 'rival-b-base', 'rival-female-base'],
      ['passage-guardian-base', 'guardian-healer-male-base', 'guardian-healer-female-base'],
      ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c'],
      ['rival-a-base', 'rival-b-base', 'rival-female-base'],
      ['jung-de-grimoria-ii', 'rival-b-base'],
      ['rival-b-final-mode'],
    ]);
    expect(encounters[3].rewardUnitIds).toEqual([]);
    expect(encounters[5].rewardUnitIds).toEqual([]);
    for (const entry of encounters) {
      expect(entry.enemyUnitIds.length).toBeGreaterThanOrEqual(1);
      expect(entry.enemyUnitIds.length).toBeLessThanOrEqual(3);
      expect(entry.mapX).toBeGreaterThanOrEqual(0); expect(entry.mapX).toBeLessThanOrEqual(100);
      expect(entry.mapY).toBeGreaterThanOrEqual(0); expect(entry.mapY).toBeLessThanOrEqual(100);
      for (const id of [...entry.enemyUnitIds, ...entry.rewardUnitIds]) expect(units.some((unit) => unit.id === id)).toBe(true);
    }
  });
  it('mantém IDs únicos, referências válidas, quatro habilidades e HP inicial 100', () => {
    expect(new Set(units.map((unit) => unit.id)).size).toBe(units.length);
    for (const unit of units) {
      expect(narrativeCharacters[unit.characterId]).toBeDefined();
      expect(unit.maxHp).toBe(100);
      expect(unit.abilityIds).toHaveLength(4);
      expect(new Set(unit.abilityIds).size).toBe(4);
      for (const id of unit.abilityIds) expect(abilities[id]).toBeDefined();
    }
    const starters = units.filter((unit) => unit.unlock.kind === 'starter').map((unit) => unit.id);
    expect(starters).toEqual(createInitialProgress().unlockedUnitIds);
  });

  it('preserva os conjuntos aprovados do chefão, curandeiros e protagonistas', () => {
    const guardian = units.find((unit) => unit.id === 'passage-guardian-base')!;
    expect(guardian.abilityIds).toEqual(['main-special', 'female-special', 'retain-energy', 'extra-turn']);
    for (const unit of units.filter((unit) => unit.characterId.startsWith('guardian-healer'))) {
      expect(unit.abilityIds).toEqual(['simple-strike', 'guard', 'retain-energy', 'heal']);
    }
    expect(abilities['main-special'].effects).toEqual([{ kind: 'damage', amount: 35 }]);
    expect(abilities['secondary-special'].target).toBe('all-enemies');
    expect(abilities['female-special'].target).toBe('all-allies');
  });

  it('representa transformação como outra unidade e identifica conteúdo temporário', () => {
    const base = units.find((unit) => unit.id === 'protagonist-main-base')!;
    const transformed = units.find((unit) => unit.id === 'protagonist-main-transformed')!;
    expect(transformed.id).not.toBe(base.id);
    expect(transformed.characterId).toBe(base.characterId);
    expect(transformed.provisional).toBe(true);
    expect(units.find((unit) => unit.unlock.kind === 'premium')?.provisional).toBe(true);
  });

  it('cadastra inimigos posteriores a Drak e preserva a versão original do rival B', () => {
    const ids = ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c', 'rival-b-final-mode'];
    for (const id of ids) {
      const unit = units.find((entry) => entry.id === id)!;
      expect(unit).toBeDefined();
      expect(unit.provisional).toBe(true);
      expect(unit.rosterOrder).toBeGreaterThanOrEqual(0);
      expect(unit.unlock.kind).toBe(id === 'rival-b-final-mode' ? 'premium' : 'battle-wins');
    }
    const original = units.find((unit) => unit.id === 'rival-b-base')!;
    const final = units.find((unit) => unit.id === 'rival-b-final-mode')!;
    expect(final.characterId).toBe(original.characterId);
    expect(final.id).not.toBe(original.id);
    expect(final.illustration).not.toBe(original.illustration);
    expect(original.name).toBe('Exal de Grimória');
    expect(units.find((unit) => unit.id === 'legendary-beast-premium')?.unlock.kind).toBe('premium');
  });

  it.each([
    ['road-raider-2-base', ['simple-strike', 'guard', 'retain-energy', 'secondary-special']],
    ['rival-a-base', ['simple-strike', 'guard', 'retain-energy', 'main-special']],
    ['jung-de-grimoria-ii', ['simple-strike', 'guard', 'retain-energy', 'main-special']],
    ['rival-b-base', ['simple-strike', 'guard', 'retain-energy', 'soul-drain']],
    ['passage-guardian-base', ['main-special', 'female-special', 'retain-energy', 'extra-turn']],
    ['guerreiros-habilidosos-a', ['main-special', 'guard', 'retain-energy', 'secondary-special']],
    ['guerreiros-habilidosos-b', ['main-special', 'guard', 'retain-energy', 'female-special']],
    ['guerreiros-habilidosos-c', ['main-special', 'guard', 'retain-energy-plus', 'secondary-special']],
    ['protagonist-main-transformed', ['main-special', 'guard', 'retain-energy-plus', 'fury-scream']],
    ['rival-b-final-mode', ['main-special', 'female-special', 'retain-energy-plus', 'soul-drain-plus']],
    ['legendary-beast-premium', ['heal-plus', 'female-special', 'retain-energy-plus', 'resurrection']],
  ])('aplica o conjunto aprovado em %s', (id, expected) => {
    expect(units.find((unit) => unit.id === id)?.abilityIds).toEqual(expected);
  });

  it('mantém os nomes e a ordem aprovada da lista completa', () => {
    expect(rosterUnits.map((unit) => unit.name)).toEqual([
      'Ravi de Berdal', 'Doko de Berdal', 'Anna de Berdal',
      'Saqueador da estrada I', 'Saqueador da estrada II', 'Saqueadora da estrada',
      'Jung de Grimória', 'Exal de Grimória', 'Monnica de Grimória',
      'Curandeiro de Pontes', 'Curandeira de Pontes', 'Drak de Pontes',
      'Trinity de Espinea', 'Vlade de Espinea', 'Passago de Espinea',
      'Jung de Grimória II', 'Ravi Berserk', 'Exal - Verdadeiro poder', 'Fera Lendária',
    ]);
    expect(rosterUnits.map((unit) => unit.rosterOrder)).toEqual(Array.from({ length: 19 }, (_, index) => index));
  });

  it('cadastra Jung II como uma unidade independente com o mesmo personagem e habilidades do Jung original', () => {
    const original = units.find((unit) => unit.id === 'rival-a-base')!;
    const second = units.find((unit) => unit.id === 'jung-de-grimoria-ii')!;
    expect(second.characterId).toBe(original.characterId);
    expect(second.id).not.toBe(original.id);
    expect(second.abilityIds).toEqual(original.abilityIds);
    expect(second.maxHp).toBe(original.maxHp);
    expect(second.portrait).toBe('/media/characters/jung-de-grimoria-ii-face.png');
    expect(second.illustration).toBe('/media/characters/jung-de-grimoria-ii-body.png');
    expect(original.portrait).toBe('/media/characters/jung-de-grimoria-face.png');
    expect(units.find((unit) => unit.id === 'rival-b-base')?.illustration).toBe('/media/characters/exal-de-grimoria-body.png');
    for (const unit of units) {
      expect(unit.portrait).toMatch(/^\/media\/characters\/[a-z0-9-]+-face\.png$/);
      expect(unit.illustration).toMatch(/^\/media\/characters\/[a-z0-9-]+-body\.png$/);
    }
  });
});
