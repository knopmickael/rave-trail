ALTER TABLE units ADD COLUMN enabled boolean NOT NULL DEFAULT true;

-- Personagens próprios da campanha 02, incluindo os aliados e a Maga Ártemis.
UPDATE units SET enabled = false WHERE id IN (
  'general-abel', 'guardia-da-fronteira', 'samurai-erlang', 'sabio-do-castelo',
  'emissario-do-castelo', 'grande-rei-osiris', 'espadachim-lupus', 'feiticeira-ravina',
  'monge-omero', 'besta-lendaria-ravok', 'besta-lendaria-fenrir', 'besta-lendaria-enkei',
  'combatente-demonio', 'mago-demonio', 'lorde-demonio-rakin', 'verdadeiro-rei-demonio', 'maga-artemis'
);

INSERT INTO cms_content_overrides (entity, id)
SELECT DISTINCT 'encounters', e.encounter_id FROM encounter_enemies e
JOIN units u ON u.id = e.unit_id WHERE NOT u.enabled
ON CONFLICT (entity, id) DO NOTHING;

DELETE FROM encounter_enemies e USING units u WHERE e.unit_id = u.id AND NOT u.enabled;

UPDATE player_progress SET revision = revision + 1, updated_at = now()
WHERE user_id IN (SELECT t.user_id FROM player_team_slots t JOIN units u ON u.id = t.unit_id WHERE NOT u.enabled);
UPDATE player_team_slots t SET unit_id = NULL FROM units u WHERE t.unit_id = u.id AND NOT u.enabled;
