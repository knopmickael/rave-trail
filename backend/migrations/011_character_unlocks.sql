-- Identifica a origem da vitória; o cliente não escolhe este campo.
ALTER TABLE battles ADD COLUMN mode text NOT NULL DEFAULT 'campaign'
  CHECK (mode IN ('campaign', 'quick', 'multiplayer'));
UPDATE battles SET mode = 'quick' WHERE encounter_id IS NULL;
ALTER TABLE battles ADD CONSTRAINT battles_mode_encounter_check CHECK (
  (mode = 'campaign' AND encounter_id IS NOT NULL)
  OR (mode IN ('quick', 'multiplayer') AND encounter_id IS NULL)
);
CREATE INDEX battles_unlock_victories_idx ON battles (user_id)
  WHERE status = 'victory' AND mode IN ('quick', 'multiplayer');

-- Drak e Ravi Berserk passam a seguir as metas da Tarefa 11.
DELETE FROM encounter_rewards WHERE unit_id IN ('passage-guardian-base', 'protagonist-main-transformed');
