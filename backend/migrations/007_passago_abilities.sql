-- Tarefa 09: redistribuição de habilidades somente de Passago de Espinea.
UPDATE unit_abilities
SET ability_id = CASE ability_id
  WHEN 'strong-strike' THEN 'secondary-special'
  WHEN 'retain-energy' THEN 'retain-energy-plus'
  WHEN 'simple-strike' THEN 'main-special'
END
WHERE unit_id = 'guerreiros-habilidosos-c'
  AND ability_id IN ('strong-strike', 'retain-energy', 'simple-strike');
