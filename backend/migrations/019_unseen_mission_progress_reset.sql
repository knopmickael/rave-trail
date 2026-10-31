-- Correção solicitada para esta conta: zerar apenas as missões ainda não reveladas
-- pela campanha. O histórico das batalhas e os demais campos do progresso são mantidos.
-- O bloqueio também serializa a correção com resultados de partidas em andamento.
SELECT p.user_id FROM player_progress p JOIN users u ON u.id = p.user_id
  WHERE u.email = 'knopmickael@gmail.com' FOR UPDATE OF p;

WITH resets AS (
  SELECT p.user_id, jsonb_object_agg(c.id,
    to_char(clock_timestamp() AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')) AS cutoffs
  FROM player_progress p JOIN users u ON u.id = p.user_id
    CROSS JOIN units c
  WHERE u.email = 'knopmickael@gmail.com'
    AND c.unlock_condition->>'kind' = 'battle-wins'
    AND NOT EXISTS (
      SELECT 1 FROM encounter_enemies e
      WHERE e.unit_id = c.id AND (p.data->'completedEncounters') ? e.encounter_id
    )
  GROUP BY p.user_id
)
UPDATE player_progress p SET
  data = jsonb_set(p.data, '{missionProgressResets}', COALESCE(p.data->'missionProgressResets', '{}'::jsonb) || r.cutoffs),
  revision = p.revision + 1, updated_at = now()
FROM resets r WHERE p.user_id = r.user_id;
