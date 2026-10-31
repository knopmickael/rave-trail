-- Tarefa 13: Ravi Berserk volta a usar Guarda.
UPDATE unit_abilities SET ability_id = 'guard'
WHERE unit_id = 'protagonist-main-transformed' AND ability_id = 'female-special';
-- Os protagonistas são incluídos pela consulta da Batalha rápida.
-- O seed sincroniza a meta adicional de 50 vitórias e o histórico existente.
