-- Tarefa 31: Doko usa Proteção coletiva e Anna usa Varredura tática.
UPDATE unit_abilities SET ability_id = 'female-special'
WHERE unit_id = 'protagonist-secondary-base' AND ability_id = 'secondary-special';

UPDATE unit_abilities SET ability_id = 'secondary-special'
WHERE unit_id = 'protagonist-female-base' AND ability_id = 'female-special';
