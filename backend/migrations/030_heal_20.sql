-- Tarefa 30: Recuperar vida restaura 20 HP em vez de 30.
UPDATE abilities SET
  description = 'Restaura 20 HP de um aliado vivo, sem ultrapassar o HP máximo.',
  effects = '[{"kind":"heal","amount":20}]'::jsonb
WHERE id = 'heal';
