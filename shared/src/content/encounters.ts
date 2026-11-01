export interface EncounterDefinition {
  readonly id: string;
  readonly campaignId: string;
  readonly position: number;
  readonly title: string;
  readonly story: string;
  readonly enemyUnitIds: readonly string[];
  readonly rewardUnitIds: readonly string[];
  readonly mapX: number;
  readonly mapY: number;
  readonly provisional: boolean;
}

export interface EncounterOption extends EncounterDefinition {
  readonly available: boolean;
  readonly completed: boolean;
  readonly activeBattleId: string | null;
}

export const encounters: readonly EncounterDefinition[] = [
  {
    id: 'path-1-encounter-1', campaignId: 'path-1', position: 1, title: 'Saqueadores da estrada',
    story: 'Ravi, Doko e Anna deixam Berdal pela primeira vez como integrantes da guarda. A missão de reconhecimento mal começou quando encontram uma carroça cercada por saqueadores. As mercadorias que restam são importantes para famílias que já sofrem com o colapso das rotas comerciais. Sem o comandante por perto para decidir por eles, os três precisam trabalhar juntos: proteger o viajante será o primeiro desafio real de sua jornada.',
    enemyUnitIds: ['road-raider-1-base', 'road-raider-2-base', 'road-raider-3-base'], rewardUnitIds: [],
    mapX: 46.3, mapY: 67.5, provisional: false,
  },
  {
    id: 'path-1-encounter-2', campaignId: 'path-1', position: 2, title: 'Os Grimorianos',
    story: 'Jung, Exal e Monnica de Grimória interceptam o grupo em uma encruzilhada. Os três jovens mercenários parecem saber mais do que dizem sobre os ataques às caravanas. O confronto coloca frente a frente duas equipes da mesma geração e deixa uma pergunta: a quem os Grimorianos realmente obedecem?',
    enemyUnitIds: ['rival-a-base', 'rival-b-base', 'rival-female-base'], rewardUnitIds: [],
    mapX: 35.8, mapY: 50.2, provisional: false,
  },
  {
    id: 'path-1-encounter-3', campaignId: 'path-1', position: 3, title: 'Drak de Pontes — Guardião da passagem',
    story: 'A passagem sobre as águas está sob o controle de Drak de Pontes. Ao lado do Curandeiro e da Curandeira de Pontes, ele exige que os recém-chegados demonstrem preparo antes de atravessar. Para seguir a investigação, Ravi, Doko e Anna terão de enfrentar uma equipe capaz de recuperar ferimentos e manipular a sequência dos turnos.',
    enemyUnitIds: ['passage-guardian-base', 'guardian-healer-male-base', 'guardian-healer-female-base'], rewardUnitIds: [],
    mapX: 43.5, mapY: 41.8, provisional: false,
  },
  {
    id: 'path-1-encounter-4', campaignId: 'path-1', position: 4, title: 'Os guerreiros de Espinea',
    story: 'Além da passagem, Trinity, Vlade e Passago de Espinea defendem uma rota cercada pela floresta. O grupo precisa superar os três guerreiros para continuar a investigação sobre a circulação de mercenários pela região.',
    enemyUnitIds: ['guerreiros-habilidosos-a', 'guerreiros-habilidosos-b', 'guerreiros-habilidosos-c'], rewardUnitIds: [],
    mapX: 67.8, mapY: 70.2, provisional: false,
  },
  {
    id: 'path-1-encounter-5', campaignId: 'path-1', position: 5, title: 'O retorno dos Grimorianos',
    story: 'Jung, Exal e Monnica voltam a bloquear o caminho dos jovens de Berdal. O reencontro revela que os interesses dos mercenários alcançam a região tomada pelas trevas. O grupo precisa vencê-los para se aproximar das respostas que procura.',
    enemyUnitIds: ['rival-a-base', 'rival-b-base', 'rival-female-base'], rewardUnitIds: [],
    mapX: 64.6, mapY: 38.8, provisional: false,
  },
  {
    id: 'path-1-encounter-6', campaignId: 'path-1', position: 6, title: 'Na fronteira das trevas',
    story: 'Na fronteira entre a floresta e o território das trevas, Jung de Grimória II e Exal enfrentam o grupo sem Monnica. Ravi, Doko e Anna precisam atravessar esta última resistência para alcançar o confronto que decidirá o destino da jornada.',
    enemyUnitIds: ['jung-de-grimoria-ii', 'rival-b-base'], rewardUnitIds: [],
    mapX: 74.5, mapY: 33, provisional: false,
  },
  {
    id: 'path-1-encounter-7', campaignId: 'path-1', position: 7, title: 'Exal — Verdadeiro poder',
    story: 'No coração do território das trevas, Exal revela seu verdadeiro poder. Ravi de Berdal desperta como Ravi Berserk e avança ao lado de seus companheiros para enfrentar o inimigo. As respostas encontradas na estrada apontam para interesses maiores do que os ataques a um único vilarejo.',
    enemyUnitIds: ['rival-b-final-mode'], rewardUnitIds: [],
    mapX: 85.4, mapY: 25.2, provisional: false,
  },
  {
    id: 'path-2-encounter-1', campaignId: 'path-2', position: 1, title: 'Os guardiões da fronteira',
    story: 'Após a queda de Exal, pistas sobre os ataques levam Ravi, Doko e Anna para além de Berdal. Na fronteira do reino de Osiris, o General Abel, a Guardiã da fronteira e o Samurai Erlang exigem uma prova de suas intenções antes de permitir que alcancem a corte.',
    enemyUnitIds: ['general-abel', 'guardia-da-fronteira', 'samurai-erlang'], rewardUnitIds: [],
    mapX: 46.3, mapY: 67.5, provisional: true,
  },
  {
    id: 'path-2-encounter-2', campaignId: 'path-2', position: 2, title: 'A prova da corte',
    story: 'O Sábio e o Emissário do castelo recebem os viajantes diante do Grande rei Osiris. A corte suspeita que as mesmas forças que arruinaram as rotas de Berdal estejam enfraquecendo os selos do reino. Um confronto de avaliação decide se os heróis estão preparados para investigar. Após a prova, Maga Ártemis compartilha os registros dos santuários esquecidos.',
    enemyUnitIds: ['sabio-do-castelo', 'emissario-do-castelo', 'grande-rei-osiris'], rewardUnitIds: [],
    mapX: 35.8, mapY: 50.2, provisional: true,
  },
  {
    id: 'path-2-encounter-3', campaignId: 'path-2', position: 3, title: 'O caminho dos santuários',
    story: 'Guiados pelos registros da corte, os heróis encontram Espadachim Lupus, Feiticeira Ravina e Monge Omero. Os três protegem a trilha dos santuários e recusam entregar seus segredos a desconhecidos. Superar a prova permitirá descobrir quem está corrompendo os selos antigos.',
    enemyUnitIds: ['espadachim-lupus', 'feiticeira-ravina', 'monge-omero'], rewardUnitIds: [],
    mapX: 43.5, mapY: 41.8, provisional: true,
  },
  {
    id: 'path-2-encounter-4', campaignId: 'path-2', position: 4, title: 'As três bestas ancestrais',
    story: 'Ravok, Fenrir e Enkei despertam diante do último santuário. A corrupção transformou seus instintos de proteção em fúria. Os heróis precisam enfrentar as três bestas lendárias para alcançar o selo e revelar a passagem usada pelas forças demoníacas.',
    enemyUnitIds: ['besta-lendaria-ravok', 'besta-lendaria-fenrir', 'besta-lendaria-enkei'], rewardUnitIds: [],
    mapX: 67.8, mapY: 70.2, provisional: true,
  },
  {
    id: 'path-2-encounter-5', campaignId: 'path-2', position: 5, title: 'A vanguarda de Rakin',
    story: 'Além do selo rompido, Lorde demônio Rakin reúne um Mago demônio e um Combatente Demônio para abrir caminho até o reino. Derrotar a vanguarda interromperá a invasão, mas a energia por trás de Rakin revela um inimigo ainda maior. Osiris decide acompanhar pessoalmente o confronto final.',
    enemyUnitIds: ['lorde-demonio-rakin', 'mago-demonio', 'combatente-demonio'], rewardUnitIds: [],
    mapX: 74.5, mapY: 33, provisional: true,
  },
  {
    id: 'path-2-encounter-6', campaignId: 'path-2', position: 6, title: 'O verdadeiro rei demônio',
    story: 'No trono além da fenda, o Verdadeiro Rei demônio revela que os ataques às rotas comerciais eram parte de um plano para isolar os reinos. Grande rei Osiris ocupa um dos três slots da equipe para ajudar os heróis a enfrentar a entidade e fechar a passagem. A vitória encerra esta etapa da investigação e prepara a próxima jornada.',
    enemyUnitIds: ['verdadeiro-rei-demonio'], rewardUnitIds: [],
    mapX: 85.4, mapY: 25.2, provisional: true,
  },
];
