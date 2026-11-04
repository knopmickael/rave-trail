-- Tarefa 29: Monnica de Grimória volta a usar Guarda no lugar de Proteção coletiva.
UPDATE unit_abilities SET ability_id = 'guard'
WHERE unit_id = 'rival-female-base' AND ability_id = 'female-special';
