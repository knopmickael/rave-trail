-- Novo Quadro de missões. Atualiza somente as missões solicitadas e nomes indicados.
-- Não revoga aquisições, não redefine contadores e não altera equipes/snapshots.
CREATE OR REPLACE FUNCTION pg_temp.mission_board_win(
  target integer, description text, opponents text[] DEFAULT NULL,
  players text[] DEFAULT NULL, no_deaths boolean DEFAULT NULL
) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$
  SELECT jsonb_strip_nulls(jsonb_build_object('kind','battle-wins','mode','quick',
    'target',target,'description',description,'opponentUnitIds',opponents,
    'requiredPlayerUnitIds',players,'requireNoDeaths',no_deaths));
$$;

CREATE TEMPORARY TABLE mission_board_revision (id text PRIMARY KEY, gate text, requirements jsonb NOT NULL) ON COMMIT DROP;
INSERT INTO mission_board_revision
WITH groups AS (SELECT
  ARRAY['road-raider-1-base','road-raider-2-base','road-raider-3-base','saqueador-da-estrada-iii','saqueador-da-estrada-iv','saqueadora-da-estrada-ii'] AS raiders,
  ARRAY['guardian-healer-male-base','guardian-healer-female-base','passage-guardian-base'] AS pontes
)
SELECT id,gate,jsonb_build_array(
    pg_temp.mission_board_win(total,format('Vença %s partidas no modo Batalha rápida.',total)),
    pg_temp.mission_board_win(defeats,format('Derrote %s na Batalha rápida %s %s.',name,defeats,CASE WHEN defeats=1 THEN 'vez' ELSE 'vezes' END),ARRAY[id]))
  || CASE WHEN players IS NULL THEN '[]'::jsonb ELSE jsonb_build_array(
    pg_temp.mission_board_win(extra_count,CASE WHEN same_opponent
      THEN format('Derrote %s na Batalha rápida %s %s utilizando %s.',name,extra_count,CASE WHEN extra_count=1 THEN 'vez' ELSE 'vezes' END,player_label)
      ELSE format('Vença %s partidas no modo Batalha rápida utilizando %s.',extra_count,player_label) END,
      CASE WHEN same_opponent THEN ARRAY[id] ELSE NULL::text[] END,players)) END
FROM groups g CROSS JOIN LATERAL (VALUES
  ('road-raider-1-base','Saqueador da estrada I',3,1,'path-1-encounter-1',NULL::text[],NULL::integer,NULL::text,false),
  ('road-raider-2-base','Saqueador da estrada II',3,1,'path-1-encounter-1',NULL,NULL,NULL,false),
  ('road-raider-3-base','Saqueadora da estrada',3,1,'path-1-encounter-1',NULL,NULL,NULL,false),
  ('rival-a-base','Jung de Grimória',5,3,'path-1-encounter-2',ARRAY['protagonist-main-base'],1,'Ravi de Berdal',true),
  ('rival-b-base','Exal de Grimória',5,3,'path-1-encounter-2',ARRAY['protagonist-secondary-base'],1,'Doko de Berdal',true),
  ('rival-female-base','Monnica de Grimória',5,3,'path-1-encounter-2',ARRAY['protagonist-female-base'],1,'Anna de Berdal',true),
  ('guardian-healer-male-base','Curandeiro de Pontes',5,3,'path-1-encounter-3',g.raiders,1,'Saqueadores da estrada',true),
  ('guardian-healer-female-base','Curandeira de Pontes',5,3,'path-1-encounter-3',g.raiders,1,'Saqueadores da estrada',true),
  ('passage-guardian-base','Drak de Pontes',10,5,'path-1-encounter-3',g.raiders,3,'Saqueadores da estrada',true),
  ('saqueador-da-estrada-iii','Saqueador da estrada III',10,5,'path-1-encounter-4',NULL,NULL,NULL,false),
  ('saqueador-da-estrada-iv','Saqueador da estrada IV',10,5,'path-1-encounter-4',NULL,NULL,NULL,false),
  ('saqueadora-da-estrada-ii','Saqueadora da estrada II',10,5,'path-1-encounter-4',NULL,NULL,NULL,false),
  ('guerreiros-habilidosos-a','Trinity de Espinea',10,5,'path-1-encounter-5',g.pontes,3,'personagens de Pontes',true),
  ('guerreiros-habilidosos-b','Vlade de Espinea',10,5,'path-1-encounter-5',g.pontes,3,'personagens de Pontes',true),
  ('guerreiros-habilidosos-c','Passago de Espinea',10,5,'path-1-encounter-5',g.pontes,3,'personagens de Pontes',true),
  ('jung-de-grimoria-ii','Jung de Grimória II',15,10,'path-1-encounter-6',ARRAY['rival-a-base'],5,'Jung de Grimória',false),
  ('exal-de-grimoria-ii','Exal de Grimória II',15,10,'path-1-encounter-6',ARRAY['rival-b-base'],5,'Exal de Grimória',false),
  ('monnica-de-grimoria-ii','Monnica de Grimória II',15,10,'path-1-encounter-6',ARRAY['rival-female-base'],5,'Monnica de Grimória',false),
  ('general-abel','General Abel',10,5,'path-2-encounter-1',NULL,NULL,NULL,false),
  ('guardia-da-fronteira','Guardiã da fronteira',10,5,'path-2-encounter-1',NULL,NULL,NULL,false),
  ('samurai-erlang','Samurai Erlang',10,5,'path-2-encounter-1',NULL,NULL,NULL,false),
  ('sabio-do-castelo','Sábio do castelo',15,10,'path-2-encounter-2',NULL,NULL,NULL,false),
  ('emissario-do-castelo','Emissário do castelo',15,10,'path-2-encounter-2',NULL,NULL,NULL,false),
  ('grande-rei-osiris','Grande rei Osiris',25,15,'path-2-encounter-2',NULL,NULL,NULL,false)
) AS b(id,name,total,defeats,gate,players,extra_count,player_label,same_opponent);

INSERT INTO mission_board_revision VALUES
('protagonist-main-transformed','path-1-encounter-7',jsonb_build_array(
  pg_temp.mission_board_win(25,'Vença 25 partidas no modo Batalha rápida.'),
  pg_temp.mission_board_win(15,'Derrote Jung de Grimória II na Batalha rápida 15 vezes.',ARRAY['jung-de-grimoria-ii']),
  pg_temp.mission_board_win(15,'Derrote Exal de Grimória II na Batalha rápida 15 vezes.',ARRAY['exal-de-grimoria-ii']),
  pg_temp.mission_board_win(15,'Derrote Monnica de Grimória II na Batalha rápida 15 vezes.',ARRAY['monnica-de-grimoria-ii']),
  pg_temp.mission_board_win(10,'Vença 10 partidas no modo Batalha rápida utilizando Ravi de Berdal.',NULL,ARRAY['protagonist-main-base']))),
('rival-b-final-mode','path-1-encounter-7',jsonb_build_array(
  pg_temp.mission_board_win(50,'Vença 50 partidas no modo Batalha rápida.'),
  pg_temp.mission_board_win(30,'Derrote Ravi Berzerk na Batalha rápida 30 vezes.',ARRAY['protagonist-main-transformed']),
  pg_temp.mission_board_win(30,'Vença 30 partidas no modo Batalha rápida utilizando Exal de Grimória II.',NULL,ARRAY['exal-de-grimoria-ii']),
  pg_temp.mission_board_win(15,'Vença 15 partidas no modo Batalha rápida utilizando Exal de Grimória.',NULL,ARRAY['rival-b-base']))),
('legendary-beast-premium','path-1-encounter-7',jsonb_build_array(
  pg_temp.mission_board_win(100,'Vença 100 partidas no modo Batalha rápida.'),
  pg_temp.mission_board_win(50,'Vença 50 partidas no modo Batalha rápida sem que nenhum membro da equipe morra.',NULL,NULL,true),
  pg_temp.mission_board_win(30,'Vença 30 partidas no modo Batalha rápida contra alguém de Grimória.',ARRAY['rival-a-base','rival-b-base','rival-female-base','jung-de-grimoria-ii','exal-de-grimoria-ii','monnica-de-grimoria-ii','rival-b-final-mode']),
  pg_temp.mission_board_win(30,'Vença 30 partidas no modo Batalha rápida contra alguém de Pontes.',ARRAY['guardian-healer-male-base','guardian-healer-female-base','passage-guardian-base']),
  pg_temp.mission_board_win(30,'Vença 30 partidas no modo Batalha rápida contra alguém de Espinea.',ARRAY['guerreiros-habilidosos-a','guerreiros-habilidosos-b','guerreiros-habilidosos-c'])));

WITH configured AS (
  SELECT r.*, (SELECT string_agg(goal->>'description',' ' ORDER BY position)
    FROM jsonb_array_elements(r.requirements) WITH ORDINALITY AS goals(goal,position)) AS description
  FROM mission_board_revision r
)
UPDATE units u SET unlock_rule=(COALESCE(u.unlock_rule,'{}'::jsonb)-'availableFromStart'-'availableAfterEncounterId')
  || jsonb_build_object('unitId',u.id,'description',c.description,'requirements',c.requirements)
  || CASE WHEN u.id IN ('rival-b-final-mode','legendary-beast-premium') THEN jsonb_build_object('availableAfterEncounterId','path-1-encounter-7')
    WHEN u.unlock_rule->>'availableFromStart'='true' THEN '{"availableFromStart":true}'::jsonb
    WHEN u.unlock_rule->>'availableAfterEncounterId' IS NOT NULL THEN jsonb_build_object('availableAfterEncounterId',u.unlock_rule->>'availableAfterEncounterId')
    ELSE jsonb_build_object('availableAfterEncounterId',c.gate) END,
  unlock_condition=CASE WHEN u.id IN ('rival-b-final-mode','legendary-beast-premium')
    THEN u.unlock_condition || jsonb_build_object('kind','premium','priceUsd',COALESCE(NULLIF(u.unlock_condition->'priceUsd','null'::jsonb),'9.9'::jsonb))
    ELSE u.unlock_condition || jsonb_build_object('kind','battle-wins','description',c.description) END
FROM configured c WHERE u.id=c.id;

UPDATE units SET name='Ravi Berzerk' WHERE id='protagonist-main-transformed';
UPDATE units SET name='Besta Lendária Zéfiro' WHERE id='legendary-beast-premium' AND name='Besta Lendária';
