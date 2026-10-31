ALTER TABLE battles DROP CONSTRAINT battles_status_check;
ALTER TABLE battles ADD CONSTRAINT battles_status_check CHECK (status IN ('active', 'victory', 'defeat', 'abandoned'));
ALTER TABLE battles ADD COLUMN log jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(log) = 'array');

-- Recupera os registros dos turnos já persistidos, na ordem oficial de resolução.
UPDATE battles b SET log = COALESCE((
  SELECT jsonb_agg(event.value ORDER BY (command.response #>> '{battle,revision}')::integer, event.ordinality)
  FROM battle_commands command
  CROSS JOIN LATERAL jsonb_array_elements(COALESCE(command.response->'events', '[]'::jsonb)) WITH ORDINALITY AS event(value, ordinality)
  WHERE command.battle_id = b.id
), '[]'::jsonb);
