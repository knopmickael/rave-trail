-- Metadados operacionais por conta, separados do JSON de progresso. A janela
-- armazena no máximo nove eventos; o décimo limpa a lista e inicia o bloqueio.
ALTER TABLE player_progress ADD COLUMN quick_battle_abandons timestamptz[] NOT NULL DEFAULT '{}';
ALTER TABLE player_progress ADD COLUMN quick_battle_blocked_until timestamptz;
ALTER TABLE player_progress ADD CONSTRAINT quick_battle_abandons_bounded CHECK (cardinality(quick_battle_abandons) < 10);
