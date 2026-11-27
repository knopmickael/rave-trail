import { describe, expect, it } from 'vitest';
import { createInitialProgress } from '@game/contracts.js';
import { abilities } from '@game/content/abilities.js';
import { narrativeCharacters, rosterUnits, units } from '@game/content/units.js';
import { encounters } from '@game/content/encounters.js';
import { SECOND_CAMPAIGN_CHARACTERS } from '@game/content/second-campaign.js';

describe('catálogo compartilhado', () => {
  it('define os seis confrontos da segunda campanha na ordem solicitada', () => {
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
    expect(second.every((entry) => entry.story.length > 100)).toBe(true);
  });
  it('define as sete equipes aprovadas em ordem, incluindo o trio II na sexta e o duelo final', () => {
    expect(encounters.filter((entry) => entry.campaignId === 'path-1').map((entry) => entry.position)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(encounters.filter((entry) => entry.campaignId === 'path-1').map((entry) => entry.enemyUnitIds)).toEqual([
      ['road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base'],
      ['rival-a-base', 'rival-b-base', 'rival-female-base'],
      ['passage-guardian-base', 'guardian-healer-male-base', 'guardian-healer-female-base'],
      ['saqueador-da-estrada-iii', 'saqueador-da-estrada-iv', 'saqueadora-da-estrada-ii'],
      ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c'],
      ['jung-de-grimoria-ii', 'exal-de-grimoria-ii', 'monnica-de-grimoria-ii'],
      ['rival-b-final-mode'],
    ]);
    for (const entry of encounters) {
      expect(entry.enemyUnitIds.length).toBeGreaterThanOrEqual(1);
      expect(entry.enemyUnitIds.length).toBeLessThanOrEqual(3);
      expect(entry.mapX).toBeGreaterThanOrEqual(0); expect(entry.mapX).toBeLessThanOrEqual(100);
      expect(entry.mapY).toBeGreaterThanOrEqual(0); expect(entry.mapY).toBeLessThanOrEqual(100);
      for (const id of entry.enemyUnitIds) expect(units.some((unit) => unit.id === id)).toBe(true);
    }
  });
  it('mantém IDs únicos, referências válidas, quatro habilidades e HP inicial 100', () => {
    expect(new Set(units.map((unit) => unit.id)).size).toBe(units.length);
    for (const unit of units) {
      expect(narrativeCharacters).toHaveProperty(unit.characterId);
      expect(unit.maxHp).toBe(100);
      expect(unit.description).not.toMatch(/provisóri|temporári/i);
      expect(unit.abilityIds).toHaveLength(4);
      expect(new Set(unit.abilityIds).size).toBe(4);
      for (const id of unit.abilityIds) expect(abilities).toHaveProperty(id);
    }
    const starters = units.filter((unit) => unit.unlock.kind === 'starter').map((unit) => unit.id);
    expect(starters).toEqual(createInitialProgress().unlockedUnitIds);
  });

  it('preserva os conjuntos aprovados do chefão, curandeiros e protagonistas', () => {
    const guardian = units.find((unit) => unit.id === 'passage-guardian-base')!;
    expect(guardian.abilityIds).toEqual(['simple-strike', 'guard', 'retain-energy-plus', 'extra-turn']);
    for (const unit of units.filter((unit) => unit.characterId.startsWith('guardian-healer'))) {
      expect(unit.abilityIds).toEqual(['simple-strike', 'female-special', 'retain-energy', 'heal']);
    }
    expect(abilities['main-special'].effects).toEqual([{ kind: 'damage', amount: 35 }]);
    expect(abilities['secondary-special'].target).toBe('all-enemies');
    expect(abilities['female-special'].target).toBe('all-allies');
  });

  it('cadastra custos e efeitos do balanceamento e das novas habilidades', () => {
    expect(abilities['retain-energy']).toMatchObject({ energyCost: 0, effects: [{ kind: 'restore-energy', amount: 20 }] });
    expect(abilities['retain-energy-plus']).toMatchObject({ energyCost: 0, effects: [{ kind: 'restore-energy', amount: 35 }] });
    expect(abilities.guard).toMatchObject({ effects: [{ kind: 'guard', reduction: 10, teamTurns: 2 }] });
    expect(abilities['female-special']).toMatchObject({ target: 'all-allies', effects: [{ kind: 'guard', reduction: 10, teamTurns: 2 }] });
    expect(abilities['secondary-special']).toMatchObject({ energyCost: 30, effects: [{ kind: 'damage', amount: 20 }] });
    expect(abilities['strong-strike']).toMatchObject({ energyCost: 30 });
    expect(abilities['internal-strength']).toMatchObject({ energyCost: 30, target: 'ally',
      icon: '/media/abilities/internal-strength.png', effects: [{ kind: 'damage-boost', amount: 10, teamTurns: 2 }] });
    expect(abilities['soul-drain']).toMatchObject({ energyCost: 35,
      description: 'Causa 25 de dano a um inimigo e recupera do usuário a mesma quantidade de HP aplicada como dano, sem ultrapassar o HP máximo.' });
    expect(abilities['soul-drain-plus']).toMatchObject({ target: 'all-enemies', energyCost: 60,
      description: 'Causa 30 de dano a todos os inimigos vivos e recupera do usuário a mesma quantidade de HP aplicada como dano, sem ultrapassar o HP máximo.',
      effects: [{ kind: 'drain', amount: 30 }] });
    expect(abilities.heal).toMatchObject({ energyCost: 35, effects: [{ kind: 'heal', amount: 25 }] });
    expect(abilities['heal-plus']).toMatchObject({ energyCost: 50, effects: [{ kind: 'heal', amount: 30 }] });
    expect(abilities.resurrection).toMatchObject({ energyCost: 50 });
    expect(abilities['extra-turn']).toMatchObject({ energyCost: 40 });
    expect(abilities['fury-scream']).toMatchObject({ energyCost: 60, effects: [{ kind: 'damage', amount: 45 }] });
    expect(abilities['simple-strike-ii']).toMatchObject({ name: 'Golpe simples II', energyCost: 20, target: 'enemy',
      icon: '/media/abilities/simple-strike-II.png', effects: [{ kind: 'damage', amount: 30 }] });
    expect(abilities['quick-slash']).toMatchObject({ energyCost: 35, target: 'enemy',
      effects: [{ kind: 'damage', amount: 25 }, { kind: 'bleed', amount: 5, turns: 3 }] });
    expect(abilities['dark-vortex']).toMatchObject({ energyCost: 35, target: 'all-enemies',
      effects: [{ kind: 'damage', amount: 15 }, { kind: 'attack-block', teamTurns: 1 }] });
    expect(abilities['fast-move']).toMatchObject({ name: 'Invulnerabilidade', energyCost: 25, target: 'self',
      effects: [{ kind: 'invulnerable', teamTurns: 1 }] });
  });

  it('representa transformação como outra unidade do mesmo personagem', () => {
    const base = units.find((unit) => unit.id === 'protagonist-main-base')!;
    const transformed = units.find((unit) => unit.id === 'protagonist-main-transformed')!;
    expect(transformed.id).not.toBe(base.id);
    expect(transformed.characterId).toBe(base.characterId);
  });

  it('cadastra inimigos posteriores a Drak e preserva a versão original do rival B', () => {
    const ids = ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c', 'rival-b-final-mode'];
    for (const id of ids) {
      const unit = units.find((entry) => entry.id === id)!;
      expect(unit).toBeDefined();
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
    ['protagonist-secondary-base', ['simple-strike', 'guard', 'retain-energy', 'female-special']],
    ['protagonist-female-base', ['simple-strike', 'guard', 'retain-energy', 'secondary-special']],
    ['road-raider-1-base', ['simple-strike', 'guard', 'retain-energy', 'strong-strike']],
    ['road-raider-2-base', ['simple-strike', 'guard', 'retain-energy', 'secondary-special']],
    ['rival-a-base', ['simple-strike', 'guard', 'retain-energy', 'retaliation']],
    ['jung-de-grimoria-ii', ['retaliation', 'fast-move', 'retain-energy-plus', 'execution']],
    ['rival-b-base', ['simple-strike', 'guard', 'retain-energy', 'soul-drain']],
    ['rival-female-base', ['simple-strike', 'guard', 'retain-energy', 'heal']],
    ['passage-guardian-base', ['simple-strike', 'guard', 'retain-energy-plus', 'extra-turn']],
    ['guerreiros-habilidosos-a', ['simple-strike-ii', 'guard', 'retain-energy-plus', 'divine-boon']],
    ['guerreiros-habilidosos-b', ['simple-strike-ii', 'guard', 'retain-energy', 'divine-protection']],
    ['guerreiros-habilidosos-c', ['simple-strike-ii', 'guard', 'retain-energy', 'wolfs-howl']],
    ['protagonist-main-transformed', ['quick-slash', 'female-special', 'retain-energy-plus', 'fury-scream']],
    ['rival-b-final-mode', ['dark-vortex', 'fast-move', 'retain-energy-plus', 'soul-drain-plus']],
    ['legendary-beast-premium', ['heal-plus', 'divine-protection', 'retain-energy-plus', 'resurrection']],
  ])('aplica o conjunto aprovado em %s', (id, expected) => {
    expect(units.find((unit) => unit.id === id)?.abilityIds).toEqual(expected);
  });

  it('mantém os nomes e a ordem aprovada da lista completa', () => {
    expect(rosterUnits.map((unit) => unit.name)).toEqual([
      'Ravi de Berdal', 'Doko de Berdal', 'Anna de Berdal',
      'Capitão da guarda Kalis', 'Capitão da guarda Ridan',
      'Saqueador da estrada I', 'Saqueador da estrada II', 'Saqueadora da estrada',
      'Jung de Grimória', 'Exal de Grimória', 'Monnica de Grimória',
      'Curandeiro de Pontes', 'Curandeira de Pontes', 'Drak de Pontes',
      'Saqueador da estrada III', 'Saqueador da estrada IV', 'Saqueadora da estrada II',
      'Trinity de Espinea', 'Vlade de Espinea', 'Passago de Espinea',
      'Jung de Grimória II', 'Exal de Grimória II', 'Monnica de Grimória II',
      'Ravi Berserk', 'Exal - Verdadeiro poder', 'Besta Lendária',
      ...SECOND_CAMPAIGN_CHARACTERS.map((character) => character.name),
    ]);
    expect(rosterUnits.map((unit) => unit.rosterOrder)).toEqual(Array.from({ length: units.length }, (_, index) => index));
    expect(rosterUnits.findIndex((unit) => unit.id === 'combatente-demonio')).toBe(38);
    expect(rosterUnits.findIndex((unit) => unit.id === 'lorde-demonio-rakin')).toBe(40);
  });

  it('cadastra Jung II como uma unidade independente com o mesmo personagem e conjunto próprio de habilidades', () => {
    const original = units.find((unit) => unit.id === 'rival-a-base')!;
    const second = units.find((unit) => unit.id === 'jung-de-grimoria-ii')!;
    expect(second.characterId).toBe(original.characterId);
    expect(second.id).not.toBe(original.id);
    expect(second.abilityIds).toEqual(['retaliation', 'fast-move', 'retain-energy-plus', 'execution']);
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
      if (['saqueador-da-estrada-iii', 'saqueador-da-estrada-iv', 'saqueadora-da-estrada-ii', 'exal-de-grimoria-ii', 'monnica-de-grimoria-ii'].includes(unit.id)) {
        expect(unit.illustration).toMatch(/^\/media\/characters\/(saqueador-iii|saqueador-iv|saqueadora-ii|exal-ii|monnica-ii)\.png$/);
        continue;
      }
      expect(unit.portrait).toMatch(/^\/media\/characters\/[a-z0-9-]+-face\.png$/);
      expect(unit.illustration).toMatch(/^\/media\/characters\/[a-z0-9-]+-body\.png$/);
    }
  });
});
