-- Tarefa 37: Força interna passa a durar dois turnos da equipe, mantendo +10 de dano.
UPDATE abilities SET
  description = 'Aumenta em 10 o dano das habilidades usadas por um aliado ou por si mesmo nos próximos 2 turnos da equipe (não funciona no turno atual). Não acumula bônus.',
  effects = '[{"kind":"damage-boost","amount":10,"teamTurns":2}]'::jsonb
WHERE id = 'internal-strength';
