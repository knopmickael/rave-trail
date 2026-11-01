-- Reajustes de energia definidos em todo-list.md.
UPDATE abilities SET energy_cost = 30 WHERE id = 'soul-drain';
UPDATE abilities SET energy_cost = 35 WHERE id = 'heal';
UPDATE abilities SET energy_cost = 45 WHERE id = 'heal-plus';
UPDATE abilities SET energy_cost = 50 WHERE id = 'resurrection';
