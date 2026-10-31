CREATE TABLE narrative_characters (
  id text PRIMARY KEY,
  name text NOT NULL
);

CREATE TABLE abilities (
  id text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL,
  energy_cost integer NOT NULL CHECK (energy_cost BETWEEN 0 AND 100),
  target text NOT NULL CHECK (target IN ('enemy', 'ally', 'all-enemies', 'all-allies', 'team')),
  effects jsonb NOT NULL CHECK (jsonb_typeof(effects) = 'array' AND jsonb_array_length(effects) > 0),
  icon_path text NOT NULL
);

CREATE TABLE units (
  id text PRIMARY KEY,
  character_id text NOT NULL REFERENCES narrative_characters(id),
  name text NOT NULL,
  version text NOT NULL,
  description text NOT NULL,
  max_hp integer NOT NULL CHECK (max_hp > 0),
  portrait_path text NOT NULL,
  illustration_path text NOT NULL,
  unlock_condition jsonb NOT NULL,
  provisional boolean NOT NULL DEFAULT false,
  roster_order integer UNIQUE CHECK (roster_order >= 0)
);

CREATE TABLE unit_abilities (
  unit_id text NOT NULL REFERENCES units(id),
  slot_index smallint NOT NULL CHECK (slot_index BETWEEN 0 AND 3),
  ability_id text NOT NULL REFERENCES abilities(id),
  PRIMARY KEY (unit_id, slot_index),
  UNIQUE (unit_id, ability_id)
);

CREATE TABLE player_team_slots (
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  slot_index smallint NOT NULL CHECK (slot_index BETWEEN 0 AND 2),
  unit_id text REFERENCES units(id),
  PRIMARY KEY (user_id, slot_index),
  UNIQUE (user_id, unit_id)
);

INSERT INTO player_team_slots (user_id, slot_index)
SELECT users.id, slot_index FROM users CROSS JOIN generate_series(0, 2) AS slot_index;
