export type AbilityEffect =
  | { readonly kind: 'damage'; readonly amount: number }
  | { readonly kind: 'heal'; readonly amount: number }
  | { readonly kind: 'drain'; readonly amount: number }
  | { readonly kind: 'revive'; readonly hpRatio: number }
  | { readonly kind: 'guard'; readonly reduction: number; readonly teamTurns: number; readonly healPerTurn?: number }
  | { readonly kind: 'dispel-shields' }
  | { readonly kind: 'ability-block'; readonly teamTurns: number }
  | { readonly kind: 'prevent-defeat' }
  | { readonly kind: 'restore-energy'; readonly amount: number }
  | { readonly kind: 'extra-turn'; readonly count: number }
  | { readonly kind: 'bleed'; readonly amount: number; readonly turns: number }
  | { readonly kind: 'invulnerable'; readonly teamTurns: number }
  | { readonly kind: 'attack-block'; readonly teamTurns: number }
  | { readonly kind: 'damage-boost'; readonly amount: number; readonly teamTurns: number }
  | { readonly kind: 'burn'; readonly teamTurns: number }
  | { readonly kind: 'damage-reflection'; readonly percent: number; readonly teamTurns: number }
  | { readonly kind: 'concentration'; readonly teamTurns: number };

export interface AbilityDefinition {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly energyCost: number;
  readonly target: 'enemy' | 'ally' | 'self' | 'defeated-ally' | 'all-enemies' | 'all-allies' | 'team';
  readonly effects: readonly AbilityEffect[];
  readonly icon: string;
}

export const abilities = {
  'simple-strike': {
    id: 'simple-strike', name: 'Golpe simples', energyCost: 15, target: 'enemy', icon: '/media/abilities/simple-strike.jpg',
    description: 'Causa 20 de dano a um inimigo.', effects: [{ kind: 'damage', amount: 20 }],
  },
  'simple-strike-ii': {
    id: 'simple-strike-ii', name: 'Golpe simples II', energyCost: 20, target: 'enemy', icon: '/media/abilities/simple-strike-II.png',
    description: 'Causa 30 de dano a um inimigo.', effects: [{ kind: 'damage', amount: 30 }],
  },
  guard: {
    id: 'guard', name: 'Guarda', energyCost: 10, target: 'self', icon: '/media/abilities/guard.jpg',
    description: 'Protege o próprio jogador reduzindo 10 de dano de cada golpe por dois turnos da própria equipe. Não acumula redução.',
    effects: [{ kind: 'guard', reduction: 10, teamTurns: 2 }],
  },
  'retain-energy': {
    id: 'retain-energy', name: 'Reter energia', energyCost: 0, target: 'team', icon: '/media/abilities/retain-energy.jpg',
    description: 'Recupera 20 de energia para a equipe, até o limite de 100.', effects: [{ kind: 'restore-energy', amount: 20 }],
  },
  'retain-energy-plus': {
    id: 'retain-energy-plus', name: 'Reter muita energia', energyCost: 0, target: 'team', icon: '/media/abilities/retain-energy-plus.jpg',
    description: 'Recupera 35 de energia para a equipe, até o limite de 100.', effects: [{ kind: 'restore-energy', amount: 35 }],
  },
  'strong-strike': {
    id: 'strong-strike', name: 'Golpe forte', energyCost: 30, target: 'enemy', icon: '/media/abilities/strong-strike.jpg',
    description: 'Causa 30 de dano a um inimigo.', effects: [{ kind: 'damage', amount: 30 }],
  },
  'internal-strength': {
    id: 'internal-strength', name: 'Força interna', energyCost: 30, target: 'ally', icon: '/media/abilities/internal-strength.png',
    description: 'Aumenta em 10 o dano das habilidades usadas por um aliado ou por si mesmo nos próximos 2 turnos da equipe (não funciona no turno atual). Não acumula bônus.',
    effects: [{ kind: 'damage-boost', amount: 10, teamTurns: 2 }],
  },
  'quick-slash': {
    id: 'quick-slash', name: 'Corte rápido', energyCost: 35, target: 'enemy', icon: '/media/abilities/quick-slash.png',
    description: 'Causa 25 de dano a um inimigo imediatamente e provoca sangramento, causando 5 de dano à cada turno de sua equipe pelos próximos 3 turnos.',
    effects: [{ kind: 'damage', amount: 25 }, { kind: 'bleed', amount: 5, turns: 3 }],
  },
  'dark-vortex': {
    id: 'dark-vortex', name: 'Vórtex negro', energyCost: 35, target: 'all-enemies', icon: '/media/abilities/dark-vortex.png',
    description: 'Golpeia todos os inimigos causando 15 de dano e impedindo que realizem qualquer ataque durante 1 turno. Demais habilidades ainda poderão ser utilizadas.',
    effects: [{ kind: 'damage', amount: 15 }, { kind: 'attack-block', teamTurns: 1 }],
  },
  'fast-move': {
    id: 'fast-move', name: 'Invulnerabilidade', energyCost: 25, target: 'self', icon: '/media/abilities/fast-move.png',
    description: 'Permite que o usuário fique invulnerável pelo próximo turno do time inimigo.',
    effects: [{ kind: 'invulnerable', teamTurns: 1 }],
  },
  heal: {
    id: 'heal', name: 'Recuperar vida', energyCost: 35, target: 'ally', icon: '/media/abilities/heal.jpg',
    description: 'Restaura 25 HP de um aliado vivo, sem ultrapassar o HP máximo.', effects: [{ kind: 'heal', amount: 25 }],
  },
  'soul-drain': {
    id: 'soul-drain', name: 'Drenar alma', energyCost: 35, target: 'enemy', icon: '/media/abilities/soul-drain.jpg',
    description: 'Causa 25 de dano a um inimigo e recupera do usuário a mesma quantidade de HP aplicada como dano, sem ultrapassar o HP máximo.', effects: [{ kind: 'drain', amount: 25 }],
  },
  'soul-drain-plus': {
    id: 'soul-drain-plus', name: 'Drenar existência', energyCost: 60, target: 'all-enemies', icon: '/media/abilities/soul-drain-plus.jpg',
    description: 'Causa 30 de dano a todos os inimigos vivos e recupera do usuário a mesma quantidade de HP aplicada como dano, sem ultrapassar o HP máximo.', effects: [{ kind: 'drain', amount: 30 }],
  },
  'fury-scream': {
    id: 'fury-scream', name: 'Fúria devastadora', energyCost: 60, target: 'all-enemies', icon: '/media/abilities/fury-scream.jpg',
    description: 'Causa 45 de dano a cada inimigo vivo.', effects: [{ kind: 'damage', amount: 45 }],
  },
  'heal-plus': {
    id: 'heal-plus', name: 'Recuperar muita vida', energyCost: 50, target: 'all-allies', icon: '/media/abilities/heal-plus.jpg',
    description: 'Restaura 30 HP de cada aliado vivo, sem ultrapassar o HP máximo.', effects: [{ kind: 'heal', amount: 30 }],
  },
  resurrection: {
    id: 'resurrection', name: 'Trazer dos mortos', energyCost: 50, target: 'defeated-ally', icon: '/media/abilities/resurrection.jpg',
    description: 'Ressuscita um aliado derrotado com o HP máximo.', effects: [{ kind: 'revive', hpRatio: 1 }],
  },
  'main-special': {
    id: 'main-special', name: 'Investida', energyCost: 25, target: 'enemy', icon: '/media/abilities/main-special.jpg',
    description: 'Uma investida física que causa 35 de dano a um inimigo.', effects: [{ kind: 'damage', amount: 35 }],
  },
  'secondary-special': {
    id: 'secondary-special', name: 'Varredura tática', energyCost: 30, target: 'all-enemies', icon: '/media/abilities/secondary-special.jpg',
    description: 'Causa 20 de dano a cada inimigo vivo.', effects: [{ kind: 'damage', amount: 20 }],
  },
  'female-special': {
    id: 'female-special', name: 'Proteção coletiva', energyCost: 20, target: 'all-allies', icon: '/media/abilities/female-special.jpg',
    description: 'Aplica Guarda a todos os aliados vivos: reduz 10 de dano por golpe durante dois turnos da equipe. Não acumula redução.',
    effects: [{ kind: 'guard', reduction: 10, teamTurns: 2 }],
  },
  'extra-turn': {
    id: 'extra-turn', name: 'Turno extra', energyCost: 40, target: 'team', icon: '/media/abilities/extra-turn.jpg',
    description: 'Concede um turno adicional à equipe após encerrar o turno atual.',
    effects: [{ kind: 'extra-turn', count: 1 }],
  },
  'divine-protection': {
    id: 'divine-protection', name: 'Proteção divina', energyCost: 35, target: 'all-allies', icon: '/media/abilities/divine-protection.png',
    description: 'Protege todos os aliados vivos: reduz 10 de dano por golpe durante 3 turnos da equipe e cura 10 HP no início de cada um dos próximos 3 turnos da equipe (30 HP por aliado). Não acumula redução nem cura.',
    effects: [{ kind: 'guard', reduction: 10, teamTurns: 3, healPerTurn: 10 }],
  },
  retaliation: {
    id: 'retaliation', name: 'Retaliação', energyCost: 30, target: 'all-enemies', icon: '/media/abilities/retaliation.png',
    description: 'Remove imediatamente todos os escudos dos inimigos vivos, incluindo Guarda, Proteção coletiva, Proteção divina e Invulnerabilidade. Também interrompe a cura vinculada ao escudo removido.',
    effects: [{ kind: 'dispel-shields' }],
  },
  'wolfs-howl': {
    id: 'wolfs-howl', name: 'Uivo do lobo', energyCost: 35, target: 'enemy', icon: '/media/abilities/wolfs-howl.png',
    description: 'Causa 25 de dano a um inimigo imediatamente e provoca queimadura, impedindo que ele receba curas e escudos pelos próximos 3 turnos de sua equipe.',
    effects: [{ kind: 'damage', amount: 25 }, { kind: 'burn', teamTurns: 3 }],
  },
  execution: {
    id: 'execution', name: 'Execução', energyCost: 50, target: 'enemy', icon: '/media/abilities/execution.png',
    description: 'Aplica um corte certeiro no peito do alvo causando 50 de dano instantaneamente.',
    effects: [{ kind: 'damage', amount: 50 }],
  },
  'divine-boon': {
    id: 'divine-boon', name: 'Benção divina', energyCost: 40, target: 'ally', icon: '/media/abilities/divine-boon.png',
    description: 'Protege um aliado vivo contra o próximo dano fatal: ele permanece com 1 HP. A benção é consumida ao impedir a morte e não acumula.',
    effects: [{ kind: 'prevent-defeat' }],
  },
  'damage-reflection': {
    id: 'damage-reflection', name: 'Repelir dano', energyCost: 35, target: 'ally', icon: '/media/abilities/damage-reflection.png',
    description: 'Protege um aliado no próximo turno inimigo: devolve ao agressor 30% do dano direto efetivamente recebido, sem reduzir o dano sofrido. Não reflete sangramento ou outros danos por turno.',
    effects: [{ kind: 'damage-reflection', percent: 30, teamTurns: 1 }],
  },
  'deep-concentration': {
    id: 'deep-concentration', name: 'Concentração profunda', energyCost: 45, target: 'self', icon: '/media/abilities/deep-concentration.png',
    description: 'O usuário fica sem poder usar habilidades nos próximos 2 turnos de sua equipe. Ao voltar a agir, se estiver vivo, completa a energia da equipe até 100.',
    effects: [{ kind: 'concentration', teamTurns: 2 }],
  },
  'dragons-roar': {
    id: 'dragons-roar', name: 'Rugido do dragão', energyCost: 35, target: 'enemy', icon: '/media/abilities/dragons-roar.png',
    description: 'Causa 25 de dano a um inimigo imediatamente e provoca congelamento, impedindo que ele utilize qualquer habilidade no próximo turno de sua equipe.',
    effects: [{ kind: 'damage', amount: 25 }, { kind: 'ability-block', teamTurns: 1 }],
  },
  'seismic-explosion': {
    id: 'seismic-explosion', name: 'Explosão sísmica', energyCost: 50, target: 'all-enemies', icon: '/media/abilities/seismic-explosion.png',
    description: 'Causa 35 de dano a cada inimigo vivo.', effects: [{ kind: 'damage', amount: 35 }],
  },
  'frozen-throne': {
    id: 'frozen-throne', name: 'Trono de gelo', energyCost: 45, target: 'all-enemies', icon: '/media/abilities/frozen-throne.png',
    description: 'Impede que os inimigos utilizem habilidades ofensivas pelos próximos 2 turnos de sua equipe.',
    effects: [{ kind: 'attack-block', teamTurns: 2 }],
  },
} as const satisfies Record<string, AbilityDefinition>;

export type AbilityId = keyof typeof abilities;
