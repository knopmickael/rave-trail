-- O mapa e a história do pergaminho passam a ser dados editáveis da campanha.
UPDATE campaigns SET map_background_path = '/media/campaigns/mapa-campanha-01.png'
WHERE id IN ('path-1', 'path-2');
UPDATE campaigns SET map_background_path = '/media/campaigns/mapa-campanha-01.png'
WHERE map_background_path = '/media/images/mapa-campanha-01.png';

UPDATE campaigns SET description = E'Em um continente místico, onde diferentes povos, reinos e organizações disputam influência, três jovens camponeses vivem pacificamente em uma vila comercial, sem imaginar o potencial extraordinário que carregam.\n\nA tranquilidade termina quando ataques coordenados destroem estruturas comerciais importantes, provocando uma crise econômica e enfraquecendo a segurança da região.\n\nDiante do caos, os três protagonistas ingressam na guarda da vila e recebem de seu comandante a missão de investigar os responsáveis pelos ataques.'
WHERE id = 'path-1' AND description = 'Ravi, Doko e Anna deixam Berdal em uma missão de reconhecimento pelas rotas comerciais.';
UPDATE campaigns SET description = E'O confronto com Exal deixou marcas em Ravi, Doko e Anna, mas também revelou que os ataques às rotas de Berdal faziam parte de uma ameaça maior. Entre as pistas recuperadas, um antigo símbolo aponta para o reino de Osiris, além das fronteiras conhecidas pelos três jovens.\n\nCom a vila ainda se recuperando, os companheiros partem em busca de respostas. Notícias de caravanas desaparecidas e de uma energia estranha junto aos santuários sugerem que a mesma força está enfraquecendo a ligação entre os reinos.\n\nAntes de chegar à corte e apresentar suas descobertas ao Grande rei Osiris, o grupo precisa atravessar uma fronteira sob vigilância. O General Abel e seus guardiões aguardam os viajantes para descobrir se vieram oferecer ajuda ou trazer mais perigo.'
WHERE id = 'path-2' AND description = 'Os heróis procuram a corte de Osiris e enfrentam a ameaça que desperta além das fronteiras.';

-- Converte autoria legada sem revogar personagens já conquistados pelos jogadores.
UPDATE units SET unlock_rule = COALESCE(unlock_rule, jsonb_build_object(
  'unitId', id, 'description', unlock_condition->>'description',
  'availableAfterEncounterId', unlock_condition->>'encounterId',
  'requirements', jsonb_build_array(jsonb_build_object('kind', 'encounter',
    'encounterId', unlock_condition->>'encounterId', 'target', 1, 'description', unlock_condition->>'description')))),
  unlock_condition = (unlock_condition - 'encounterId') || '{"kind":"battle-wins"}'::jsonb
WHERE unlock_condition->>'kind' = 'encounter';
UPDATE units SET unlock_condition = unlock_condition || '{"kind":"premium","priceUsd":9.9}'::jsonb,
  unlock_rule = NULL WHERE unlock_condition->>'kind' = 'unavailable';

-- Substitui a revelação implícita por uma batalha explícita (ou desde o início).
WITH gates AS (
  SELECT u.id, COALESCE(
    (SELECT e.id FROM encounter_enemies ee JOIN encounters e ON e.id = ee.encounter_id
      JOIN campaigns c ON c.id = e.campaign_id WHERE ee.unit_id = u.id ORDER BY c.sort_order, e.position LIMIT 1),
    (SELECT r->>'encounterId' FROM jsonb_array_elements(u.unlock_rule->'requirements') r
      WHERE r->>'kind' = 'encounter' LIMIT 1)) AS encounter_id
  FROM units u WHERE unlock_rule IS NOT NULL
    AND NOT COALESCE((unlock_rule->>'availableFromStart')::boolean, false)
    AND NOT (unlock_rule ? 'availableAfterEncounterId')
)
UPDATE units u SET unlock_rule = (u.unlock_rule - 'availableFromStart') || CASE
  WHEN g.encounter_id IS NULL THEN '{"availableFromStart":true}'::jsonb
  ELSE jsonb_build_object('availableAfterEncounterId', g.encounter_id) END
FROM gates g WHERE u.id = g.id;
UPDATE units SET unlock_rule = unlock_rule - 'availableAfterEncounterId'
WHERE unlock_rule->>'availableFromStart' = 'true';
UPDATE units SET unlock_rule = NULL WHERE unlock_condition->>'kind' <> 'battle-wins';
ALTER TABLE units ADD CONSTRAINT units_unlock_kind CHECK (unlock_condition->>'kind' IN ('starter', 'premium', 'battle-wins'));

-- Colunas legadas ficam inertes por compatibilidade com ferramentas antigas de
-- migração; não fazem parte dos contratos, consultas ou gravações da aplicação.
UPDATE units SET provisional = false;
UPDATE encounters SET provisional = false;
DELETE FROM encounter_rewards;
ALTER TABLE encounter_rewards ADD CONSTRAINT no_direct_character_rewards CHECK (false);
