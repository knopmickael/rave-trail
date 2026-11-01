export const SECOND_CAMPAIGN_CHARACTERS = [
  { id: 'general-abel', name: 'General Abel', description: 'Comandante que protege a fronteira e testa as intenções dos viajantes de Berdal.' },
  { id: 'guardia-da-fronteira', name: 'Guardiã da fronteira', description: 'Sentinela responsável por impedir a passagem de forças hostis ao reino.' },
  { id: 'samurai-erlang', name: 'Samurai Erlang', description: 'Espadachim disciplinado que serve ao comando da fronteira.' },
  { id: 'sabio-do-castelo', name: 'Sábio do castelo', description: 'Conselheiro que investiga os antigos selos do reino.' },
  { id: 'emissario-do-castelo', name: 'Emissário do castelo', description: 'Representante da corte encarregado de avaliar os recém-chegados.' },
  { id: 'grande-rei-osiris', name: 'Grande rei Osiris', description: 'Soberano que decide acompanhar os heróis no confronto contra o verdadeiro rei demônio.' },
  { id: 'espadachim-lupus', name: 'Espadachim Lupus', description: 'Guerreiro que guarda a trilha para os santuários esquecidos.' },
  { id: 'feiticeira-ravina', name: 'Feiticeira Ravina', description: 'Feiticeira que reconhece os sinais da corrupção nos selos antigos.' },
  { id: 'monge-omero', name: 'Monge Omero', description: 'Protetor dos santuários e estudioso das energias que sustentam suas barreiras.' },
  { id: 'besta-lendaria-ravok', name: 'Besta lendária Ravok', description: 'Uma das três bestas ancestrais que protegem a passagem para o abismo.' },
  { id: 'besta-lendaria-fenrir', name: 'Besta lendária Fenrir', description: 'Besta ancestral cuja presença anuncia o despertar das forças seladas.' },
  { id: 'besta-lendaria-enkei', name: 'Besta lendária Enkei', description: 'Guardiã ancestral do último selo antes do território demoníaco.' },
  { id: 'combatente-demonio', name: 'Combatente Demônio', description: 'Combatente da vanguarda que defende o acesso ao trono demoníaco.' },
  { id: 'mago-demonio', name: 'Mago demônio', description: 'Conjurador a serviço de Rakin que procura romper as barreiras do reino.' },
  { id: 'lorde-demonio-rakin', name: 'Lorde demônio Rakin', description: 'Lorde que comanda a vanguarda das forças demoníacas.' },
  { id: 'verdadeiro-rei-demonio', name: 'Verdadeiro Rei demônio', description: 'A presença por trás da invasão, revelada quando o último selo é rompido.' },
  { id: 'maga-artemis', name: 'Maga Ártemis', description: 'Maga da corte que auxilia a investigação dos selos após o encontro com Osiris.' },
] as const;

export type SecondCampaignCharacterId = typeof SECOND_CAMPAIGN_CHARACTERS[number]['id'];
export const SECOND_CAMPAIGN_UNIT_IDS = SECOND_CAMPAIGN_CHARACTERS.map((character) => character.id);

export const SECOND_CAMPAIGN_INTRODUCTION = [
  'O confronto com Exal deixou marcas em Ravi, Doko e Anna, mas também revelou que os ataques às rotas de Berdal faziam parte de uma ameaça maior. Entre as pistas recuperadas, um antigo símbolo aponta para o reino de Osiris, além das fronteiras conhecidas pelos três jovens.',
  'Com a vila ainda se recuperando, os companheiros partem em busca de respostas. Notícias de caravanas desaparecidas e de uma energia estranha junto aos santuários sugerem que a mesma força está enfraquecendo a ligação entre os reinos.',
  'Antes de chegar à corte e apresentar suas descobertas ao Grande rei Osiris, o grupo precisa atravessar uma fronteira sob vigilância. O General Abel e seus guardiões aguardam os viajantes para descobrir se vieram oferecer ajuda ou trazer mais perigo.',
] as const;
