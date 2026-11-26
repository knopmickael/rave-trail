-- Reativa o elenco, sem conceder propriedade ou mudar regras/HP/progresso.
UPDATE units SET enabled=true WHERE id IN (
  'general-abel','guardia-da-fronteira','samurai-erlang','sabio-do-castelo',
  'emissario-do-castelo','grande-rei-osiris','espadachim-lupus','feiticeira-ravina',
  'monge-omero','besta-lendaria-ravok','besta-lendaria-fenrir','besta-lendaria-enkei',
  'combatente-demonio','mago-demonio','lorde-demonio-rakin','verdadeiro-rei-demonio','maga-artemis'
);

-- A migration 040 removeu os inimigos desabilitados e marcou os encontros como
-- gerenciados pelo CMS. Restaura apenas formações vazias; autoria não vazia fica intacta.
WITH formations(encounter_id,enemy_ids) AS (VALUES
  ('path-2-encounter-1',ARRAY['general-abel','guardia-da-fronteira','samurai-erlang']),
  ('path-2-encounter-2',ARRAY['sabio-do-castelo','emissario-do-castelo','grande-rei-osiris']),
  ('path-2-encounter-3',ARRAY['espadachim-lupus','feiticeira-ravina','monge-omero']),
  ('path-2-encounter-4',ARRAY['besta-lendaria-ravok','besta-lendaria-fenrir','besta-lendaria-enkei']),
  ('path-2-encounter-5',ARRAY['lorde-demonio-rakin','mago-demonio','combatente-demonio']),
  ('path-2-encounter-6',ARRAY['verdadeiro-rei-demonio'])
)
INSERT INTO encounter_enemies (encounter_id,slot_index,unit_id)
SELECT f.encounter_id,enemy.position-1,enemy.unit_id
FROM formations f JOIN encounters e ON e.id=f.encounter_id
CROSS JOIN LATERAL unnest(f.enemy_ids) WITH ORDINALITY AS enemy(unit_id,position)
JOIN units u ON u.id=enemy.unit_id AND u.enabled
WHERE NOT EXISTS (SELECT 1 FROM encounter_enemies present WHERE present.encounter_id=f.encounter_id);
