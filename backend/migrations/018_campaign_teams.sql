-- Composições aprovadas da primeira campanha, na ordem de exibição/atuação.
DELETE FROM encounter_enemies WHERE encounter_id IN (
  'path-1-encounter-1', 'path-1-encounter-2', 'path-1-encounter-3',
  'path-1-encounter-4', 'path-1-encounter-5', 'path-1-encounter-6', 'path-1-encounter-7'
);
WITH approved(encounter_id, slot_index, unit_id) AS (VALUES
  ('path-1-encounter-1', 0, 'road-raider-1-base'),
  ('path-1-encounter-1', 1, 'road-raider-2-base'),
  ('path-1-encounter-1', 2, 'road-raider-3-base'),
  ('path-1-encounter-2', 0, 'rival-a-base'),
  ('path-1-encounter-2', 1, 'rival-b-base'),
  ('path-1-encounter-2', 2, 'rival-female-base'),
  ('path-1-encounter-3', 0, 'passage-guardian-base'),
  ('path-1-encounter-3', 1, 'guardian-healer-male-base'),
  ('path-1-encounter-3', 2, 'guardian-healer-female-base'),
  ('path-1-encounter-4', 0, 'guerreiros-habilidosos-a'),
  ('path-1-encounter-4', 1, 'guerreiros-habilidosos-b'),
  ('path-1-encounter-4', 2, 'guerreiros-habilidosos-c'),
  ('path-1-encounter-5', 0, 'rival-a-base'),
  ('path-1-encounter-5', 1, 'rival-b-base'),
  ('path-1-encounter-5', 2, 'rival-female-base'),
  ('path-1-encounter-6', 0, 'rival-a-base'),
  ('path-1-encounter-6', 1, 'rival-b-base'),
  ('path-1-encounter-7', 0, 'rival-b-final-mode')
)
INSERT INTO encounter_enemies (encounter_id, slot_index, unit_id)
SELECT a.encounter_id, a.slot_index, a.unit_id FROM approved a
  JOIN encounters e ON e.id = a.encounter_id JOIN units u ON u.id = a.unit_id;
