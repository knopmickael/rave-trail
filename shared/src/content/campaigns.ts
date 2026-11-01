export interface CampaignDefinition {
  readonly id: string;
  readonly chapterNumber: number;
  readonly title: string;
  readonly description: string;
  readonly background: string;
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
    description: 'Ravi, Doko e Anna deixam Berdal em uma missão de reconhecimento pelas rotas comerciais.',
    background: '/media/campaigns/path-1.webp', sortOrder: 0, released: true,
  },
  {
    id: 'path-2', chapterNumber: 2, title: 'Além das Fronteiras',
    description: 'Os heróis procuram a corte de Osiris e enfrentam a ameaça que desperta além das fronteiras.',
    background: '/media/campaigns/path-2.webp', sortOrder: 1, released: true,
  },
];
