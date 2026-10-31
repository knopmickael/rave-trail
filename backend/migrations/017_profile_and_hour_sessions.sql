ALTER TABLE users ADD COLUMN name varchar(40) NOT NULL DEFAULT 'Aventureiro'
  CHECK (length(btrim(name)) BETWEEN 1 AND 40 AND name = btrim(name));

-- A regra também vale para sessões criadas antes desta atualização.
UPDATE sessions SET expires_at = LEAST(expires_at, created_at + interval '1 hour');
