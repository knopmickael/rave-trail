-- Expansão do capítulo 1. O runner fornece transação e lock; partidas e progresso
-- não são reescritos. Campos não solicitados de autoria são preservados.
INSERT INTO abilities (id,name,description,energy_cost,target,effects,icon_path) VALUES
  ('execution','Execução','Aplica um corte certeiro no peito do alvo causando 50 de dano instantaneamente.',40,'enemy',
   '[{"kind":"damage","amount":50}]','/media/abilities/execution.png'),
  ('divine-boon','Benção divina','Protege um aliado vivo contra o próximo dano fatal: ele permanece com 1 HP. A benção é consumida ao impedir a morte e não acumula.',40,'ally',
   '[{"kind":"prevent-defeat"}]','/media/abilities/divine-boon.png')
ON CONFLICT (id) DO UPDATE SET name=EXCLUDED.name,description=EXCLUDED.description,
  energy_cost=EXCLUDED.energy_cost,target=EXCLUDED.target,effects=EXCLUDED.effects,icon_path=EXCLUDED.icon_path;

UPDATE abilities SET description='Concede um turno adicional à equipe após encerrar o turno atual.' WHERE id='extra-turn';
UPDATE abilities SET energy_cost=30,
  description=CASE WHEN description='Causa 20 de dano a um inimigo instantaneamente e aplica sangramento: 10 de dano a cada turno dele por mais 3 turnos.'
    THEN 'Causa 20 de dano a um inimigo instantaneamente e aplica sangramento: 5 de dano a cada turno dele por mais 3 turnos.' ELSE description END,
  effects=(SELECT jsonb_agg(CASE WHEN effect->>'kind'='bleed' THEN jsonb_set(effect,'{amount}','5') ELSE effect END ORDER BY position)
    FROM jsonb_array_elements(effects) WITH ORDINALITY AS entries(effect,position))
WHERE id='quick-slash';
UPDATE abilities SET
  description=CASE WHEN description='Ressuscita um aliado derrotado com metade do HP máximo.'
    THEN 'Ressuscita um aliado derrotado com o HP máximo.' ELSE description END,
  effects=(SELECT jsonb_agg(CASE WHEN effect->>'kind'='revive' THEN jsonb_set(effect,'{hpRatio}','1') ELSE effect END ORDER BY position)
    FROM jsonb_array_elements(effects) WITH ORDINALITY AS entries(effect,position))
WHERE id='resurrection';

-- Substituições pontuais, incluindo conjuntos com destinos já existentes no CMS.
CREATE TEMPORARY TABLE chapter_one_loadouts ON COMMIT DROP AS
WITH swaps(unit_id,old_ability,new_ability) AS (VALUES
  ('passage-guardian-base','simple-strike-ii','simple-strike'),
  ('passage-guardian-base','fast-move','guard'),
  ('guerreiros-habilidosos-a','secondary-special','divine-boon'),
  ('jung-de-grimoria-ii','simple-strike-ii','retaliation'),
  ('jung-de-grimoria-ii','quick-slash','execution')
), approved(unit_id,ability_ids) AS (VALUES
  ('passage-guardian-base',ARRAY['simple-strike','guard','retain-energy-plus','extra-turn']),
  ('guerreiros-habilidosos-a',ARRAY['simple-strike-ii','guard','retain-energy-plus','divine-boon']),
  ('jung-de-grimoria-ii',ARRAY['retaliation','fast-move','retain-energy-plus','execution'])
), mapped AS (
  SELECT ua.unit_id,ua.slot_index,COALESCE(s.new_ability,ua.ability_id) AS ability_id,s.new_ability IS NOT NULL AS changed
  FROM unit_abilities ua LEFT JOIN swaps s ON s.unit_id=ua.unit_id AND s.old_ability=ua.ability_id
  WHERE ua.unit_id IN (SELECT unit_id FROM approved)
), ranked AS (
  SELECT *,row_number() OVER (PARTITION BY unit_id,ability_id ORDER BY changed DESC,slot_index) AS occurrence FROM mapped
), vacancies AS (
  SELECT unit_id,slot_index,row_number() OVER (PARTITION BY unit_id ORDER BY slot_index) AS position FROM ranked WHERE occurrence>1
), missing AS (
  SELECT a.unit_id,slot.ability_id,row_number() OVER (PARTITION BY a.unit_id ORDER BY slot.position) AS position
  FROM approved a CROSS JOIN LATERAL unnest(a.ability_ids) WITH ORDINALITY AS slot(ability_id,position)
  WHERE NOT EXISTS (SELECT 1 FROM mapped m WHERE m.unit_id=a.unit_id AND m.ability_id=slot.ability_id)
)
SELECT unit_id,slot_index,ability_id FROM ranked WHERE occurrence=1
UNION ALL SELECT v.unit_id,v.slot_index,m.ability_id FROM vacancies v JOIN missing m ON m.unit_id=v.unit_id AND m.position=v.position;
DELETE FROM unit_abilities WHERE unit_id IN (SELECT unit_id FROM chapter_one_loadouts);
INSERT INTO unit_abilities (unit_id,slot_index,ability_id) SELECT unit_id,slot_index,ability_id FROM chapter_one_loadouts;
UPDATE units SET description='Segunda versão jogável de Jung de Grimória, enfrentada na fronteira das trevas. Remove as defesas inimigas e desfere um corte de execução.'
WHERE id='jung-de-grimoria-ii' AND description='Segunda versão jogável de Jung de Grimória, enfrentada na fronteira das trevas. Utiliza as mesmas técnicas da versão original.';

INSERT INTO narrative_characters (id,name) VALUES
  ('saqueador-da-estrada-iii','Saqueador da estrada III'),
  ('saqueador-da-estrada-iv','Saqueador da estrada IV'),
  ('saqueadora-da-estrada-ii','Saqueadora da estrada II'),
  ('rival-b','Exal de Grimória'),('rival-female','Monnica de Grimória')
ON CONFLICT (id) DO NOTHING;

WITH additions(id,character_id,name,version,description,asset,position) AS (VALUES
  ('saqueador-da-estrada-iii','saqueador-da-estrada-iii','Saqueador da estrada III','Reforços da estrada',
   'Saqueador veterano que lidera os reforços na estrada. Protege o grupo e acumula energia para manter a ofensiva.','saqueador-iii',1),
  ('saqueador-da-estrada-iv','saqueador-da-estrada-iv','Saqueador da estrada IV','Reforços da estrada',
   'Combatente dos reforços da estrada. Seus cortes rápidos desgastam os viajantes com ferimentos persistentes.','saqueador-iv',2),
  ('saqueadora-da-estrada-ii','saqueadora-da-estrada-ii','Saqueadora da estrada II','Reforços da estrada',
   'Saqueadora experiente que acompanha os reforços. Alterna defesa e cortes rápidos para pressionar a equipe adversária.','saqueadora-ii',3),
  ('exal-de-grimoria-ii','rival-b','Exal de Grimória II','Versão II',
   'Exal retorna à fronteira das trevas com técnicas de drenagem e um vórtex capaz de impedir os ataques inimigos.','exal-ii',4),
  ('monnica-de-grimoria-ii','rival-female','Monnica de Grimória II','Versão II',
   'Monnica retorna ao lado dos Grimorianos. Suas técnicas de cura individual e coletiva sustentam o trio na fronteira das trevas.','monnica-ii',5)
)
INSERT INTO units (id,character_id,name,version,description,max_hp,portrait_path,illustration_path,unlock_condition,enabled,roster_order)
SELECT id,character_id,name,version,description,100,'/media/characters/'||asset||'-face.png','/media/characters/'||asset||'.png',
  '{"kind":"battle-wins","description":"Missão da campanha 1."}'::jsonb,true,(SELECT COALESCE(max(roster_order),-1) FROM units)+position FROM additions
ON CONFLICT (id) DO NOTHING;

INSERT INTO unit_abilities (unit_id,slot_index,ability_id)
SELECT approved.unit_id,slot.position-1,slot.ability_id FROM (VALUES
  ('saqueador-da-estrada-iii',ARRAY['simple-strike-ii','guard','retain-energy-plus','female-special']),
  ('saqueador-da-estrada-iv',ARRAY['simple-strike-ii','guard','retain-energy','quick-slash']),
  ('saqueadora-da-estrada-ii',ARRAY['simple-strike-ii','guard','retain-energy','quick-slash']),
  ('exal-de-grimoria-ii',ARRAY['soul-drain','guard','retain-energy-plus','dark-vortex']),
  ('monnica-de-grimoria-ii',ARRAY['heal','guard','retain-energy-plus','heal-plus'])
) AS approved(unit_id,ability_ids) CROSS JOIN LATERAL unnest(approved.ability_ids) WITH ORDINALITY AS slot(ability_id,position)
-- No banco vazio, o seed ainda criará Guarda e outras habilidades originais.
WHERE NOT EXISTS (SELECT 1 FROM unnest(approved.ability_ids) AS required(id) LEFT JOIN abilities a ON a.id=required.id WHERE a.id IS NULL)
ON CONFLICT (unit_id,slot_index) DO NOTHING;

-- Metas completas, incluindo a distinção entre versões e a exigência de Ravi base.
WITH specs(id,gate,wins,opponent,target,name,with_ravi,second_opponent,second_target,second_name) AS (VALUES
  ('saqueador-da-estrada-iii',4,15,'saqueador-da-estrada-iii',10,'Saqueador da estrada III',false,NULL::text,NULL::int,NULL::text),
  ('saqueador-da-estrada-iv',4,15,'saqueador-da-estrada-iv',10,'Saqueador da estrada IV',false,NULL,NULL,NULL),
  ('saqueadora-da-estrada-ii',4,15,'saqueadora-da-estrada-ii',10,'Saqueadora da estrada II',false,NULL,NULL,NULL),
  ('exal-de-grimoria-ii',6,25,'exal-de-grimoria-ii',20,'Exal de Grimória II',false,NULL,NULL,NULL),
  ('monnica-de-grimoria-ii',6,25,'monnica-de-grimoria-ii',20,'Monnica de Grimória II',false,NULL,NULL,NULL),
  ('guerreiros-habilidosos-a',5,20,'guerreiros-habilidosos-a',15,'Trinity de Espinea',false,NULL,NULL,NULL),
  ('guerreiros-habilidosos-b',5,20,'guerreiros-habilidosos-b',15,'Vlade de Espinea',false,NULL,NULL,NULL),
  ('guerreiros-habilidosos-c',5,20,'guerreiros-habilidosos-c',15,'Passago de Espinea',false,NULL,NULL,NULL),
  ('jung-de-grimoria-ii',6,25,'jung-de-grimoria-ii',20,'Jung de Grimória II',false,'jung-de-grimoria-ii',10,'Jung de Grimória II'),
  ('protagonist-main-transformed',7,30,'jung-de-grimoria-ii',20,'Jung de Grimória II',true,'exal-de-grimoria-ii',20,'Exal de Grimória II')
), requirements AS (
  SELECT id,gate,jsonb_build_array(
    jsonb_build_object('kind','battle-wins','mode','quick','target',wins,'description','Vença '||wins||' partidas no modo Batalha rápida.'),
    jsonb_build_object('kind','battle-wins','mode','quick','opponentUnitIds',jsonb_build_array(opponent),'target',target,
      'description','Derrote '||name||' na Batalha rápida '||target||' vezes'||CASE WHEN with_ravi THEN ' utilizando Ravi de Berdal.' ELSE '.' END)
      ||CASE WHEN with_ravi THEN '{"requiredPlayerUnitIds":["protagonist-main-base"]}'::jsonb ELSE '{}'::jsonb END
  )||CASE WHEN second_opponent IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(
    jsonb_build_object('kind','battle-wins','mode','quick','opponentUnitIds',jsonb_build_array(second_opponent),'target',second_target,
      'description','Derrote '||second_name||' na Batalha rápida '||second_target||' vezes utilizando Ravi de Berdal.',
      'requiredPlayerUnitIds',jsonb_build_array('protagonist-main-base'))) END AS items FROM specs
), rules AS (
  SELECT id,jsonb_build_object('unitId',id,'availableAfterEncounterId','path-1-encounter-'||gate,'requirements',items,
    'description',(SELECT string_agg(item->>'description',' ' ORDER BY position) FROM jsonb_array_elements(items) WITH ORDINALITY AS entries(item,position))) AS rule
  FROM requirements
)
UPDATE units u SET unlock_rule=r.rule,unlock_condition=jsonb_build_object('kind','battle-wins','description',r.rule->>'description')
FROM rules r WHERE u.id=r.id;

UPDATE encounters SET title='Reforços dos saqueadores',
  story='Após a passagem de Pontes, novos saqueadores bloqueiam a estrada. Dois combatentes veteranos e uma saqueadora experiente coordenam os reforços para impedir que os jovens de Berdal descubram quem organiza os ataques às caravanas.'
WHERE id='path-1-encounter-4';
UPDATE encounters SET title='Os guerreiros de Espinea',
  story='Além da passagem, Trinity, Vlade e Passago de Espinea defendem uma rota cercada pela floresta. O grupo precisa superar os três guerreiros para continuar a investigação sobre a circulação de mercenários pela região.'
WHERE id='path-1-encounter-5';
UPDATE encounters SET story='Na fronteira entre a floresta e o território das trevas, Jung, Exal e Monnica de Grimória retornam em suas versões II. O trio combina execução, drenagem e cura para impedir que Ravi, Doko e Anna alcancem o confronto que decidirá o destino da jornada.'
WHERE id='path-1-encounter-6';
DELETE FROM encounter_enemies WHERE encounter_id IN ('path-1-encounter-4','path-1-encounter-5','path-1-encounter-6');
INSERT INTO encounter_enemies (encounter_id,slot_index,unit_id)
SELECT formation.encounter_id,formation.slot_index,formation.unit_id FROM (VALUES
  ('path-1-encounter-4',0,'saqueador-da-estrada-iii'),('path-1-encounter-4',1,'saqueador-da-estrada-iv'),('path-1-encounter-4',2,'saqueadora-da-estrada-ii'),
  ('path-1-encounter-5',0,'guerreiros-habilidosos-a'),('path-1-encounter-5',1,'guerreiros-habilidosos-b'),('path-1-encounter-5',2,'guerreiros-habilidosos-c'),
  ('path-1-encounter-6',0,'jung-de-grimoria-ii'),('path-1-encounter-6',1,'exal-de-grimoria-ii'),('path-1-encounter-6',2,'monnica-de-grimoria-ii')
) AS formation(encounter_id,slot_index,unit_id)
JOIN encounters e ON e.id=formation.encounter_id
JOIN units u ON u.id=formation.unit_id;
