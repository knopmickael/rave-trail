-- Tarefa 34: Guarda e Proteção coletiva absorvem 10 de dano por golpe.
UPDATE abilities SET
  description = 'Protege o próprio jogador reduzindo 10 de dano de cada golpe por dois turnos da própria equipe. Não acumula redução.',
  effects = '[{"kind":"guard","reduction":10,"teamTurns":2}]'::jsonb
WHERE id = 'guard';

UPDATE abilities SET
  description = 'Aplica Guarda a todos os aliados vivos: reduz 10 de dano por golpe durante dois turnos da equipe. Não acumula redução.',
  effects = '[{"kind":"guard","reduction":10,"teamTurns":2}]'::jsonb
WHERE id = 'female-special';
