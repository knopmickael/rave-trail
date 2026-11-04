-- Tarefa 33: drenagem recupera a mesma quantidade de dano aplicado após a Guarda.
UPDATE abilities SET
  description = 'Causa 25 de dano a um inimigo e recupera do usuário a mesma quantidade de HP aplicada como dano, sem ultrapassar o HP máximo.'
WHERE id = 'soul-drain';

UPDATE abilities SET
  description = 'Causa 40 de dano a um inimigo e recupera do usuário a mesma quantidade de HP aplicada como dano, sem ultrapassar o HP máximo.'
WHERE id = 'soul-drain-plus';
