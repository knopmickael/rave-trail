-- Tarefa 12: Drak de Pontes passa a usar Proteção coletiva.
UPDATE unit_abilities
SET ability_id = 'female-special'
WHERE unit_id = 'passage-guardian-base'
  AND ability_id = 'guard';
-- O seed atualiza as descrições das metas de Espinea e recalcula o histórico de vitórias.
