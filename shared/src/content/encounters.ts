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
    story: 'No coração do território das trevas, Exal revela seu verdadeiro poder. Ravi de Berdal avança sozinho para enfrentá-lo e desperta como Ravi Berserk durante o duelo. As respostas encontradas na estrada apontam para interesses maiores do que os ataques a um único vilarejo.',
    enemyUnitIds: ['rival-b-final-mode'], rewardUnitIds: [],
    mapX: 85.4, mapY: 25.2, provisional: false,
  },
];
