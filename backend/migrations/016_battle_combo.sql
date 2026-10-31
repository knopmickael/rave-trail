ALTER TABLE battles ADD COLUMN combo jsonb CHECK (combo IS NULL OR jsonb_typeof(combo) = 'object');
