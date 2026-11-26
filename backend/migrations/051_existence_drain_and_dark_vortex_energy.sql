-- Balanceamento de custos. Preserva efeitos, alvos, autoria e snapshots existentes.
UPDATE abilities SET energy_cost=60 WHERE id='soul-drain-plus';
UPDATE abilities SET energy_cost=35 WHERE id='dark-vortex';
