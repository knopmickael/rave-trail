import { SECOND_CAMPAIGN_INTRODUCTION } from './second-campaign.js';

export const FIRST_CAMPAIGN_INTRODUCTION = [
  'Em um continente místico, onde diferentes povos, reinos e organizações disputam influência, três jovens camponeses vivem pacificamente em uma vila comercial, sem imaginar o potencial extraordinário que carregam.',
  'A tranquilidade termina quando ataques coordenados destroem estruturas comerciais importantes, provocando uma crise econômica e enfraquecendo a segurança da região.',
  'Diante do caos, os três protagonistas ingressam na guarda da vila e recebem de seu comandante a missão de investigar os responsáveis pelos ataques.',
] as const;
export const DEFAULT_CAMPAIGN_MAP = '/media/campaigns/mapa-campanha-01.png';

export interface CampaignDefinition {
  readonly id: string;
  readonly chapterNumber: number;
  readonly title: string;
  readonly description: string;
  readonly background: string;
  readonly mapBackground?: string | null;
  readonly prerequisiteEncounterId?: string | null;
  readonly sortOrder: number;
  readonly released: boolean;
}

export interface CampaignOption extends CampaignDefinition {
  readonly available: boolean;
}

// Apenas dois capítulos cadastrados inicialmente; a lista aceita novos registros do banco.
export const campaigns: readonly CampaignDefinition[] = [
  {
    id: 'path-1', chapterNumber: 1, title: 'Pondo o pé na estrada',
    description: FIRST_CAMPAIGN_INTRODUCTION.join('\n\n'),
    background: '/media/campaigns/path-1.webp', mapBackground: DEFAULT_CAMPAIGN_MAP, sortOrder: 0, released: true,
  },
  {
    id: 'path-2', chapterNumber: 2, title: 'Além das Fronteiras',
    description: SECOND_CAMPAIGN_INTRODUCTION.join('\n\n'),
    background: '/media/campaigns/path-2.webp', mapBackground: DEFAULT_CAMPAIGN_MAP, sortOrder: 1, released: false,
  },
];
