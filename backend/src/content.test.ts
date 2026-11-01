import { describe, expect, it } from 'vitest';
import { createInitialProgress } from '@game/contracts.js';
import { abilities } from '@game/content/abilities.js';
import { narrativeCharacters, rosterUnits, units } from '@game/content/units.js';
import { encounters } from '@game/content/encounters.js';
import { SECOND_CAMPAIGN_CHARACTERS } from '@game/content/second-campaign.js';

describe('catálogo compartilhado', () => {
  it('define os seis confrontos provisórios da segunda campanha na ordem solicitada', () => {
    const second = encounters.filter((entry) => entry.campaignId === 'path-2');
    expect(second.map((entry) => entry.position)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(second.map((entry) => entry.enemyUnitIds)).toEqual([
      ['general-abel', 'guardia-da-fronteira', 'samurai-erlang'],
      ['sabio-do-castelo', 'emissario-do-castelo', 'grande-rei-osiris'],
      ['espadachim-lupus', 'feiticeira-ravina', 'monge-omero'],
      ['besta-lendaria-ravok', 'besta-lendaria-fenrir', 'besta-lendaria-enkei'],
      ['lorde-demonio-rakin', 'mago-demonio', 'combatente-demonio'],
      ['verdadeiro-rei-demonio'],
    ]);
    expect(second.every((entry) => entry.provisional && entry.story.length > 100)).toBe(true);
  });
  it('define as sete equipes aprovadas em ordem, incluindo dois inimigos na sexta e o duelo final', () => {
    expect(encounters.filter((entry) => entry.campaignId === 'path-1').map((entry) => entry.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(encounters.filter((entry) => entry.campaignId === 'path-1').map((entry) => entry.enemyUnitIds)).toEqual([
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
      expect(unit.description).not.toMatch(/provisóri|temporári/i);
      expect(unit.abilityIds).toHaveLength(4);
      expect(new Set(unit.abilityIds).size).toBe(4);
      for (const id of unit.abilityIds) expect(abilities[id]).toBeDefined();
    }
    const starters = units.filter((unit) => unit.unlock.kind === 'starter').map((unit) => unit.id);
    expect(starters).toEqual(createInitialProgress().unlockedUnitIds);
  });

  it('preserva os conjuntos aprovados do chefão, curandeiros e protagonistas', () => {
    const guardian = units.find((unit) => unit.id === 'passage-guardian-base')!;
    expect(guardian.abilityIds).toEqual(['main-special', 'fast-move', 'retain-energy', 'extra-turn']);
    for (const unit of units.filter((unit) => unit.characterId.startsWith('guardian-healer'))) {
      expect(unit.abilityIds).toEqual(['simple-strike', 'female-special', 'retain-energy', 'heal']);
    }
    expect(abilities['main-special'].effects).toEqual([{ kind: 'damage', amount: 30 }]);
    expect(abilities['secondary-special'].target).toBe('all-enemies');
    expect(abilities['female-special'].target).toBe('all-allies');
  });

  it('cadastra custos e efeitos do balanceamento e das novas habilidades', () => {
    expect(abilities['retain-energy']).toMatchObject({ energyCost: 0, effects: [{ kind: 'restore-energy', amount: 20 }] });
    expect(abilities['retain-energy-plus']).toMatchObject({ energyCost: 0, effects: [{ kind: 'restore-energy', amount: 35 }] });
    expect(abilities.guard).toMatchObject({ effects: [{ kind: 'guard', reduction: 15, teamTurns: 2 }] });
    expect(abilities['female-special']).toMatchObject({ target: 'all-allies', effects: [{ kind: 'guard', reduction: 15, teamTurns: 2 }] });
    expect(abilities['secondary-special']).toMatchObject({ energyCost: 25, effects: [{ kind: 'damage', amount: 20 }] });
    expect(abilities['strong-strike']).toMatchObject({ energyCost: 30 });
    expect(abilities['internal-strength']).toMatchObject({ energyCost: 35, target: 'ally',
      icon: '/media/abilities/internal-strength.png', effects: [{ kind: 'damage-boost', amount: 15, teamTurns: 1 }] });
    expect(abilities['soul-drain']).toMatchObject({ energyCost: 30 });
    expect(abilities.heal).toMatchObject({ energyCost: 35 });
    expect(abilities['heal-plus']).toMatchObject({ energyCost: 45 });
    expect(abilities.resurrection).toMatchObject({ energyCost: 50 });
    expect(abilities['extra-turn']).toMatchObject({ energyCost: 40 });
    expect(abilities['fury-scream']).toMatchObject({ energyCost: 30 });
    expect(abilities['simple-strike-ii']).toMatchObject({ name: 'Golpe simples II', energyCost: 20, target: 'enemy',
      icon: '/media/abilities/simple-strike-II.png', effects: [{ kind: 'damage', amount: 30 }] });
    expect(abilities['quick-slash']).toMatchObject({ energyCost: 35, target: 'enemy',
      effects: [{ kind: 'damage', amount: 20 }, { kind: 'bleed', amount: 10, turns: 3 }] });
    expect(abilities['dark-vortex']).toMatchObject({ energyCost: 30, target: 'all-enemies',
      effects: [{ kind: 'damage', amount: 15 }, { kind: 'attack-block', teamTurns: 1 }] });
    expect(abilities['fast-move']).toMatchObject({ name: 'Invulnerabilidade', energyCost: 15, target: 'self',
      effects: [{ kind: 'invulnerable', teamTurns: 1 }] });
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
    ['road-raider-1-base', ['simple-strike', 'guard', 'retain-energy', 'internal-strength']],
    ['road-raider-2-base', ['simple-strike', 'guard', 'retain-energy', 'secondary-special']],
    ['rival-a-base', ['simple-strike', 'guard', 'retain-energy', 'main-special']],
    ['jung-de-grimoria-ii', ['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'quick-slash']],
    ['rival-b-base', ['simple-strike', 'guard', 'retain-energy', 'soul-drain']],
    ['passage-guardian-base', ['main-special', 'fast-move', 'retain-energy', 'extra-turn']],
    ['guerreiros-habilidosos-a', ['main-special', 'fast-move', 'retain-energy', 'secondary-special']],
    ['guerreiros-habilidosos-b', ['main-special', 'fast-move', 'retain-energy', 'female-special']],
    ['guerreiros-habilidosos-c', ['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'secondary-special']],
    ['protagonist-main-transformed', ['simple-strike-ii', 'female-special', 'retain-energy-plus', 'fury-scream']],
    ['rival-b-final-mode', ['dark-vortex', 'fast-move', 'retain-energy-plus', 'soul-drain-plus']],
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
      ...SECOND_CAMPAIGN_CHARACTERS.map((character) => character.name),
    ]);
    expect(rosterUnits.map((unit) => unit.rosterOrder)).toEqual(Array.from({ length: units.length }, (_, index) => index));
    expect(rosterUnits[31].id).toBe('combatente-demonio');
    expect(rosterUnits[33].id).toBe('lorde-demonio-rakin');
  });

  it('cadastra Jung II como uma unidade independente com o mesmo personagem e conjunto próprio de habilidades', () => {
    const original = units.find((unit) => unit.id === 'rival-a-base')!;
    const second = units.find((unit) => unit.id === 'jung-de-grimoria-ii')!;
    expect(second.characterId).toBe(original.characterId);
    expect(second.id).not.toBe(original.id);
    expect(second.abilityIds).toEqual(['simple-strike-ii', 'fast-move', 'retain-energy-plus', 'quick-slash']);
    expect(second.abilityIds).not.toEqual(original.abilityIds);
    expect(second.maxHp).toBe(original.maxHp);
    expect(second.portrait).toBe('/media/characters/jung-de-grimoria-ii-face.png');
    expect(second.illustration).toBe('/media/characters/jung-de-grimoria-ii-body.png');
    expect(original.portrait).toBe('/media/characters/jung-de-grimoria-face.png');
    expect(units.find((unit) => unit.id === 'rival-b-base')?.illustration).toBe('/media/characters/exal-de-grimoria-body.png');
    for (const unit of units) {
      if (unit.version === 'Além das Fronteiras') {
        expect(unit.portrait).toBe(`/media/characters/02/${unit.id}-face.png`);
        expect(unit.illustration).toBe(`/media/characters/02/${unit.id}.png`);
        continue;
      }
      expect(unit.portrait).toMatch(/^\/media\/characters\/[a-z0-9-]+-face\.png$/);
      expect(unit.illustration).toMatch(/^\/media\/characters\/[a-z0-9-]+-body\.png$/);
    }
  });
});
