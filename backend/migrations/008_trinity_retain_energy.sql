-- Trinity de Espinea usa a versão simples de Reter energia.
UPDATE unit_abilities
SET ability_id = 'retain-energy'
WHERE unit_id = 'guerreiros-habilidosos-a'
  AND ability_id = 'retain-energy-plus';
