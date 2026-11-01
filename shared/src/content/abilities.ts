export type AbilityEffect =
  | { readonly kind: 'damage'; readonly amount: number }
  | { readonly kind: 'heal'; readonly amount: number }
  | { readonly kind: 'drain'; readonly amount: number }
  | { readonly kind: 'revive'; readonly hpRatio: number }
  | { readonly kind: 'guard'; readonly reduction: number; readonly teamTurns: number }
  | { readonly kind: 'restore-energy'; readonly amount: number }
  | { readonly kind: 'extra-turn'; readonly count: number }
  | { readonly kind: 'bleed'; readonly amount: number; readonly turns: number }
  | { readonly kind: 'invulnerable'; readonly teamTurns: number }
  | { readonly kind: 'attack-block'; readonly teamTurns: number }
  | { readonly kind: 'damage-boost'; readonly amount: number; readonly teamTurns: number };

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
    description: 'Protege o próprio jogador reduzindo 15 de dano de cada golpe por dois turnos da própria equipe. Não acumula redução.',
    effects: [{ kind: 'guard', reduction: 15, teamTurns: 2 }],
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
    id: 'internal-strength', name: 'Força interna', energyCost: 35, target: 'ally', icon: '/media/abilities/internal-strength.png',
    description: 'Aumenta em 15 o dano das habilidades usadas por um aliado ou por si mesmo no próximo turno da equipe. Não acumula bônus.',
    effects: [{ kind: 'damage-boost', amount: 15, teamTurns: 1 }],
  },
  'quick-slash': {
    id: 'quick-slash', name: 'Corte rápido', energyCost: 35, target: 'enemy', icon: '/media/abilities/quick-slash.png',
    description: 'Causa 20 de dano a um inimigo instantaneamente e aplica sangramento: 10 de dano a cada turno dele por mais 3 turnos.',
    effects: [{ kind: 'damage', amount: 20 }, { kind: 'bleed', amount: 10, turns: 3 }],
  },
  'dark-vortex': {
    id: 'dark-vortex', name: 'Vórtex negro', energyCost: 30, target: 'all-enemies', icon: '/media/abilities/dark-vortex.png',
    description: 'Golpeia todos os inimigos causando 15 de dano e impedindo que realizem qualquer ataque durante 1 turno. Demais habilidades ainda poderão ser utilizadas.',
    effects: [{ kind: 'damage', amount: 15 }, { kind: 'attack-block', teamTurns: 1 }],
  },
  'fast-move': {
    id: 'fast-move', name: 'Invulnerabilidade', energyCost: 15, target: 'self', icon: '/media/abilities/fast-move.png',
    description: 'Permite que o usuário fique invulnerável pelo próximo turno do time inimigo.',
    effects: [{ kind: 'invulnerable', teamTurns: 1 }],
  },
  heal: {
    id: 'heal', name: 'Recuperar vida', energyCost: 35, target: 'ally', icon: '/media/abilities/heal.jpg',
    description: 'Restaura 30 HP de um aliado vivo, sem ultrapassar o HP máximo.', effects: [{ kind: 'heal', amount: 30 }],
  },
  'soul-drain': {
    id: 'soul-drain', name: 'Drenar alma', energyCost: 30, target: 'enemy', icon: '/media/abilities/soul-drain.jpg',
    description: 'Causa 25 de dano a um inimigo e recupera 25 HP do usuário, sem ultrapassar o HP máximo.', effects: [{ kind: 'drain', amount: 25 }],
  },
  'soul-drain-plus': {
    id: 'soul-drain-plus', name: 'Drenar existência', energyCost: 35, target: 'enemy', icon: '/media/abilities/soul-drain-plus.jpg',
    description: 'Causa 40 de dano a um inimigo e recupera 40 HP do usuário, sem ultrapassar o HP máximo.', effects: [{ kind: 'drain', amount: 40 }],
  },
  'fury-scream': {
    id: 'fury-scream', name: 'Fúria devastadora', energyCost: 30, target: 'all-enemies', icon: '/media/abilities/fury-scream.jpg',
    description: 'Causa 25 de dano a cada inimigo vivo.', effects: [{ kind: 'damage', amount: 25 }],
  },
  'heal-plus': {
    id: 'heal-plus', name: 'Recuperar muita vida', energyCost: 45, target: 'all-allies', icon: '/media/abilities/heal-plus.jpg',
    description: 'Restaura 30 HP de cada aliado vivo, sem ultrapassar o HP máximo.', effects: [{ kind: 'heal', amount: 30 }],
  },
  resurrection: {
    id: 'resurrection', name: 'Trazer dos mortos', energyCost: 50, target: 'defeated-ally', icon: '/media/abilities/resurrection.jpg',
    description: 'Ressuscita um aliado derrotado com metade do HP máximo.', effects: [{ kind: 'revive', hpRatio: 0.5 }],
  },
  'main-special': {
    id: 'main-special', name: 'Investida', energyCost: 25, target: 'enemy', icon: '/media/abilities/main-special.jpg',
    description: 'Uma investida física que causa 30 de dano a um inimigo.', effects: [{ kind: 'damage', amount: 30 }],
  },
  'secondary-special': {
    id: 'secondary-special', name: 'Varredura tática', energyCost: 25, target: 'all-enemies', icon: '/media/abilities/secondary-special.jpg',
    description: 'Causa 20 de dano a cada inimigo vivo.', effects: [{ kind: 'damage', amount: 20 }],
  },
  'female-special': {
    id: 'female-special', name: 'Proteção coletiva', energyCost: 20, target: 'all-allies', icon: '/media/abilities/female-special.jpg',
    description: 'Aplica Guarda a todos os aliados vivos: reduz 15 de dano por golpe durante dois turnos da equipe. Não acumula redução.',
    effects: [{ kind: 'guard', reduction: 15, teamTurns: 2 }],
  },
  'extra-turn': {
    id: 'extra-turn', name: 'Turno extra', energyCost: 40, target: 'team', icon: '/media/abilities/extra-turn.jpg',
    description: 'Concede um turno adicional à equipe após o combo atual. Turnos adicionais são acumuláveis e cada um regenera 15 de energia.',
    effects: [{ kind: 'extra-turn', count: 1 }],
  },
} as const satisfies Record<string, AbilityDefinition>;

export type AbilityId = keyof typeof abilities;
