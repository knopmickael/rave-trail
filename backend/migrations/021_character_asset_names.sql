CREATE TEMP TABLE character_asset_names (old_prefix text PRIMARY KEY, new_prefix text NOT NULL) ON COMMIT DROP;
INSERT INTO character_asset_names VALUES
  ('protagonist-main-base', 'ravi-de-berdal'),
  ('protagonist-secondary-base', 'doko-de-berdal'),
  ('protagonist-female-base', 'anna-de-berdal'),
  ('road-raider-1-base', 'saqueador-da-estrada-i'),
  ('road-raider-2-base', 'saqueador-da-estrada-ii'),
  ('road-raider-3-base', 'saqueadora-da-estrada'),
  ('rival-a-base', 'jung-de-grimoria'),
  ('rival-b-base', 'exal-de-grimoria'),
  ('rival-female-base', 'monnica-de-grimoria'),
  ('guardian-healer-male-base', 'curandeiro-de-pontes'),
  ('guardian-healer-female-base', 'curandeira-de-pontes'),
  ('passage-guardian-base', 'drak-de-pontes'),
  ('guerreiros-habilidosos-a', 'trinity-de-espinea'),
  ('guerreiros-habilidosos-b', 'vlade-de-espinea'),
  ('guerreiros-habilidosos-c', 'passago-de-espinea'),
  ('protagonist-main-transformed', 'ravi-berserk'),
  ('rival-b-final-mode', 'exal-verdadeiro-poder'),
  ('legendary-beast-premium', 'fera-lendaria');

CREATE TEMP TABLE character_asset_paths (old_path text PRIMARY KEY, new_path text NOT NULL) ON COMMIT DROP;
INSERT INTO character_asset_paths
SELECT '/media/characters/' || old_prefix || '-face.png', '/media/characters/' || new_prefix || '-face.png' FROM character_asset_names
UNION ALL
SELECT '/media/characters/' || old_prefix || '-full.png', '/media/characters/' || new_prefix || '-body.png' FROM character_asset_names;
INSERT INTO character_asset_paths VALUES
  ('/media/characters/jung-de-grimoria-II-face.png', '/media/characters/jung-de-grimoria-ii-face.png'),
  ('/media/characters/jung-de-grimoria-II.png', '/media/characters/jung-de-grimoria-ii-body.png');

UPDATE units u SET
  portrait_path = COALESCE((SELECT new_path FROM character_asset_paths WHERE old_path = u.portrait_path), u.portrait_path),
  illustration_path = COALESCE((SELECT new_path FROM character_asset_paths WHERE old_path = u.illustration_path), u.illustration_path);

-- Substitui somente valores JSON que sejam exatamente um caminho antigo.
-- Inclui snapshots históricos e respostas idempotentes, sem alterar IDs, combate,
-- revisão, resultado, datas de vitória, progresso ou os comandos processados.
CREATE OR REPLACE FUNCTION pg_temp.rename_character_asset_paths(document jsonb) RETURNS jsonb
LANGUAGE plpgsql STRICT AS $$
DECLARE
  result_text text := document::text;
  replacement record;
BEGIN
  FOR replacement IN SELECT old_path, new_path FROM character_asset_paths ORDER BY old_path LOOP
    result_text := replace(result_text, to_jsonb(replacement.old_path)::text, to_jsonb(replacement.new_path)::text);
  END LOOP;
  RETURN result_text::jsonb;
END;
$$;

UPDATE battles SET state = pg_temp.rename_character_asset_paths(state),
  log = pg_temp.rename_character_asset_paths(log), combo = pg_temp.rename_character_asset_paths(combo);
UPDATE battle_commands SET response = pg_temp.rename_character_asset_paths(response);
