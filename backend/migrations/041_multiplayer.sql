-- Estado temporário separado de resultados competitivos permanentes.
CREATE TABLE multiplayer_matches (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enemy_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  data jsonb NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (player_id <> enemy_id)
);
CREATE TABLE multiplayer_entries (
  user_id uuid PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
  position bigint GENERATED ALWAYS AS IDENTITY UNIQUE,
  match_id uuid REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
  connection_id text NOT NULL,
  data jsonb NOT NULL
);
CREATE INDEX multiplayer_queue_idx ON multiplayer_entries(position) WHERE match_id IS NULL;
CREATE INDEX multiplayer_entries_match_idx ON multiplayer_entries(match_id);
CREATE TABLE multiplayer_commands (
  match_id uuid NOT NULL REFERENCES multiplayer_matches(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  request_id uuid NOT NULL,
  signature text NOT NULL,
  PRIMARY KEY (match_id, user_id, request_id)
);
CREATE TABLE multiplayer_results (
  id uuid PRIMARY KEY,
  player_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  enemy_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  winner_id uuid REFERENCES users(id) ON DELETE CASCADE,
  loser_id uuid REFERENCES users(id) ON DELETE CASCADE,
  completed_at timestamptz NOT NULL,
  data jsonb NOT NULL,
  CHECK (player_id <> enemy_id),
  CHECK ((winner_id IS NULL AND loser_id IS NULL) OR
    (winner_id IS NOT NULL AND loser_id IS NOT NULL AND winner_id <> loser_id
      AND winner_id IN (player_id, enemy_id) AND loser_id IN (player_id, enemy_id)))
);
CREATE INDEX multiplayer_results_winner_idx ON multiplayer_results(winner_id, completed_at) WHERE winner_id IS NOT NULL;
CREATE INDEX multiplayer_results_player_idx ON multiplayer_results(player_id, completed_at);
CREATE INDEX multiplayer_results_enemy_idx ON multiplayer_results(enemy_id, completed_at);
