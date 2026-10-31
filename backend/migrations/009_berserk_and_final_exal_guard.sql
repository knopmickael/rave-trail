-- Tarefa 09: Ravi Berserk e Exal - Verdadeiro poder usam Proteção coletiva.
UPDATE unit_abilities
SET ability_id = 'female-special'
WHERE unit_id IN ('protagonist-main-transformed', 'rival-b-final-mode')
  AND ability_id = 'guard';
