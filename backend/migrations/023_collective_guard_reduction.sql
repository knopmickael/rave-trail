UPDATE abilities SET
  description = 'Aplica Guarda a todos os aliados vivos: reduz 15 de dano por golpe durante dois turnos da equipe. Não acumula redução.',
  effects = '[{"kind":"guard","reduction":15,"teamTurns":2}]'::jsonb
WHERE id = 'female-special';
