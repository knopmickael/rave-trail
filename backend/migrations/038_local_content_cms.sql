-- Metadados de autoria. Não altera progresso ou batalhas existentes.
ALTER TABLE units ADD COLUMN unlock_rule jsonb;
ALTER TABLE campaigns ADD COLUMN map_background_path text;
ALTER TABLE campaigns ADD COLUMN prerequisite_encounter_id text REFERENCES encounters(id);
CREATE TABLE cms_content_overrides (
  entity text NOT NULL CHECK (entity IN ('characters', 'abilities', 'campaigns', 'encounters', 'narrative')),
  id text NOT NULL,
  deleted boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (entity, id)
);
CREATE TABLE cms_ability_setups (
  id text PRIMARY KEY,
  name text NOT NULL,
  config jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE cms_media (
  id uuid PRIMARY KEY,
  mime_type text NOT NULL CHECK (mime_type IN ('image/png', 'image/jpeg', 'image/webp')),
  content bytea NOT NULL CHECK (octet_length(content) BETWEEN 1 AND 5242880)
);
