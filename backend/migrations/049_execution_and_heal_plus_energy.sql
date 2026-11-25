-- Balanceamento de custos. Não altera efeitos, alvos, autoria nem snapshots.
UPDATE abilities SET energy_cost=50 WHERE id IN ('execution','heal-plus');
