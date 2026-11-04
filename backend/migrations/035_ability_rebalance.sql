-- Tarefa 35: balanceamento de habilidades solicitado na lista.
UPDATE abilities SET
  description = 'Aumenta em 10 o dano das habilidades usadas por um aliado ou por si mesmo no próximo turno da equipe (não funciona no turno atual). Não acumula bônus.',
  energy_cost = 30,
  effects = '[{"kind":"damage-boost","amount":10,"teamTurns":1}]'::jsonb
WHERE id = 'internal-strength';

UPDATE abilities SET energy_cost = 30 WHERE id = 'secondary-special';

UPDATE abilities SET
  description = 'Uma investida física que causa 35 de dano a um inimigo.',
  effects = '[{"kind":"damage","amount":35}]'::jsonb
WHERE id = 'main-special';

UPDATE abilities SET
  description = 'Causa 35 de dano a cada inimigo vivo.',
  energy_cost = 40,
  effects = '[{"kind":"damage","amount":35}]'::jsonb
WHERE id = 'fury-scream';

UPDATE abilities SET
  description = 'Causa 30 de dano a todos os inimigos vivos e recupera do usuário a mesma quantidade de HP aplicada como dano, sem ultrapassar o HP máximo.',
  energy_cost = 45,
  target = 'all-enemies',
  effects = '[{"kind":"drain","amount":30}]'::jsonb
WHERE id = 'soul-drain-plus';
