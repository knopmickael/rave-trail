ALTER TABLE battles ADD COLUMN turn_deadline_at timestamptz DEFAULT (now() + interval '45 seconds');
ALTER TABLE battles ADD COLUMN bot_acts_at timestamptz;
UPDATE battles SET turn_deadline_at = NULL WHERE status <> 'active';
UPDATE battles SET bot_acts_at = now() + interval '7 seconds'
WHERE status = 'active' AND mode <> 'multiplayer' AND state->>'activeSide' = 'enemy';
CREATE INDEX battles_turn_deadlines_idx ON battles (turn_deadline_at) WHERE status = 'active';
CREATE INDEX battles_bot_actions_idx ON battles (bot_acts_at) WHERE status = 'active' AND bot_acts_at IS NOT NULL;
