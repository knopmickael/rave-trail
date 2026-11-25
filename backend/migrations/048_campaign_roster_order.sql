-- Ordem solicitada para a Lista de personagens e o Quadro de missões.
-- Atualiza somente a posição, inclusive em registros editados pelo CMS.
-- Demais unidades mantêm a ordem relativa após os 26 personagens indicados.
CREATE TEMPORARY TABLE campaign_roster_order ON COMMIT DROP AS
WITH approved AS (
  SELECT id,(position-1)::int AS roster_order FROM unnest(ARRAY[
    'protagonist-main-base','protagonist-secondary-base','protagonist-female-base',
    'capitao-da-guarda-kalis-base','capitao-da-guarda-ridan-base',
    'road-raider-1-base','road-raider-2-base','road-raider-3-base',
    'rival-a-base','rival-b-base','rival-female-base',
    'guardian-healer-male-base','guardian-healer-female-base','passage-guardian-base',
    'saqueador-da-estrada-iii','saqueador-da-estrada-iv','saqueadora-da-estrada-ii',
    'guerreiros-habilidosos-a','guerreiros-habilidosos-b','guerreiros-habilidosos-c',
    'jung-de-grimoria-ii','exal-de-grimoria-ii','monnica-de-grimoria-ii',
    'protagonist-main-transformed','rival-b-final-mode','legendary-beast-premium'
  ]) WITH ORDINALITY AS entries(id,position)
)
SELECT u.id,a.roster_order FROM units u JOIN approved a ON a.id=u.id
UNION ALL
SELECT u.id,((SELECT count(*) FROM approved)+row_number() OVER (ORDER BY u.roster_order NULLS LAST,u.id)-1)::int
FROM units u LEFT JOIN approved a ON a.id=u.id WHERE a.id IS NULL;

-- Duas etapas evitam conflitos transitórios no índice UNIQUE de posições.
UPDATE units SET roster_order=NULL;
UPDATE units u SET roster_order=ordered.roster_order FROM campaign_roster_order ordered WHERE ordered.id=u.id;
