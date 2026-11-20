ALTER TABLE battles ALTER COLUMN state DROP NOT NULL;
ALTER TABLE battles ADD COLUMN summary jsonb;
ALTER TABLE battles ADD COLUMN initial_teams jsonb;
ALTER TABLE battles ADD COLUMN round_count integer CHECK (round_count > 0);
ALTER TABLE battles ADD COLUMN executed_turns integer CHECK (executed_turns >= 0);
ALTER TABLE battles ADD CONSTRAINT active_battle_requires_state CHECK (status <> 'active' OR state IS NOT NULL);
CREATE INDEX battles_compaction_idx ON battles(updated_at) WHERE status <> 'active' AND state IS NOT NULL;
