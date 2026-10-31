-- Segunda unidade de Jung: não substitui a identidade ou os desbloqueios da primeira.
-- Em um banco vazio, o seed cadastra ambas após as migrações.
INSERT INTO units (id, character_id, name, version, description, max_hp, portrait_path,
  illustration_path, unlock_condition, provisional, roster_order)
SELECT 'jung-de-grimoria-ii', character_id, 'Jung de Grimória II', 'Versão II',
  'Segunda versão jogável de Jung de Grimória, enfrentada na fronteira das trevas. Utiliza as mesmas técnicas da versão original.',
  max_hp, '/media/characters/jung-de-grimoria-ii-face.png', '/media/characters/jung-de-grimoria-ii-body.png',
  jsonb_build_object('kind', 'battle-wins', 'description', 'Derrote Jung de Grimória II na Batalha rápida 25 vezes utilizando Ravi de Berdal.'),
  false, NULL
FROM units WHERE id = 'rival-a-base'
ON CONFLICT (id) DO NOTHING;

INSERT INTO unit_abilities (unit_id, slot_index, ability_id)
SELECT 'jung-de-grimoria-ii', slot_index, ability_id FROM unit_abilities
WHERE unit_id = 'rival-a-base' AND EXISTS (SELECT 1 FROM units WHERE id = 'jung-de-grimoria-ii')
ON CONFLICT DO NOTHING;

UPDATE encounter_enemies SET unit_id = 'jung-de-grimoria-ii'
WHERE encounter_id = 'path-1-encounter-6' AND slot_index = 0 AND unit_id = 'rival-a-base'
  AND EXISTS (SELECT 1 FROM units WHERE id = 'jung-de-grimoria-ii');
