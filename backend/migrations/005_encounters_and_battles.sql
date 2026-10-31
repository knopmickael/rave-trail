CREATE TABLE encounters (
  id text PRIMARY KEY,
  campaign_id text NOT NULL REFERENCES campaigns(id),
  position integer NOT NULL CHECK (position > 0),
  title text NOT NULL,
  story text NOT NULL,
  map_x numeric NOT NULL CHECK (map_x BETWEEN 0 AND 100),
  map_y numeric NOT NULL CHECK (map_y BETWEEN 0 AND 100),
  provisional boolean NOT NULL DEFAULT false,
  UNIQUE (campaign_id, position)
);
CREATE TABLE encounter_enemies (
  encounter_id text NOT NULL REFERENCES encounters(id),
  slot_index smallint NOT NULL CHECK (slot_index BETWEEN 0 AND 2),
  unit_id text NOT NULL REFERENCES units(id),
  PRIMARY KEY (encounter_id, slot_index)
);
CREATE TABLE encounter_rewards (
  encounter_id text NOT NULL REFERENCES encounters(id),
  unit_id text NOT NULL REFERENCES units(id),
  PRIMARY KEY (encounter_id, unit_id)
);
CREATE TABLE battles (
  id uuid PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  encounter_id text NOT NULL REFERENCES encounters(id),
  state jsonb NOT NULL,
  status text NOT NULL CHECK (status IN ('active', 'victory', 'defeat')),
  revision integer NOT NULL DEFAULT 0 CHECK (revision >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX battles_active_encounter_idx ON battles(user_id, encounter_id) WHERE status = 'active';
CREATE TABLE battle_commands (
  battle_id uuid NOT NULL REFERENCES battles(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  response jsonb NOT NULL,
  PRIMARY KEY (battle_id, request_id)
);

UPDATE units SET unlock_condition = jsonb_build_object(
  'kind', 'encounter', 'encounterId', 'path-1-encounter-4',
  'description', 'Vença o combate 4: Drak de Pontes — Guardião da passagem.'
) WHERE id = 'passage-guardian-base';
