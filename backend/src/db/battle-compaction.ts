import type { Pool } from 'pg';

/** Keep terminal details briefly for HTTP retries/polling, then retain only mission/ranking inputs. */
export async function compactCompletedBattles(pool: Pool, before = new Date(Date.now() - 5 * 60_000)): Promise<number> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const rows = await client.query<{ id: string }>(`SELECT id FROM battles
      WHERE status <> 'active' AND state IS NOT NULL AND updated_at < $1
      ORDER BY updated_at LIMIT 100 FOR UPDATE SKIP LOCKED`, [before]);
    if (!rows.rowCount) { await client.query('COMMIT'); return 0; }
    const ids = rows.rows.map((row) => row.id);
    await client.query(`UPDATE battles SET summary = jsonb_build_object(
      'mode',mode,'encounterId',encounter_id,'status',status,'userId',user_id,
      'winnerId',CASE WHEN status='victory' THEN user_id ELSE NULL END,
      'loserId',CASE WHEN status IN ('defeat','abandoned') THEN user_id ELSE NULL END,
      'startedAt',created_at,'completedAt',updated_at,'initialTeams',initial_teams,
      'playerUnitIds',(SELECT jsonb_agg(f->>'unitId') FROM jsonb_array_elements(state #> '{teams,player,units}') f),
      'enemyUnitIds',(SELECT jsonb_agg(f->>'unitId') FROM jsonb_array_elements(state #> '{teams,enemy,units}') f),
      'rounds',COALESCE(round_count, (state #>> '{teams,player,turns}')::int),
      'totalTurns',COALESCE(executed_turns, GREATEST(0,(state->>'turn')::int-CASE WHEN status='abandoned' THEN 1 ELSE 0 END)),
      'countersExact',counters_exact,
      'terminalState',jsonb_build_object('status',status,'activeSide',state->>'activeSide','turn',state->'turn',
        'abilities','{}'::jsonb,'teams',jsonb_build_object(
          'player',jsonb_build_object('units','[]'::jsonb,'energy',0,'turns',0,'extraTurns',0),
          'enemy',jsonb_build_object('units','[]'::jsonb,'energy',0,'turns',0,'extraTurns',0))))
      WHERE id=ANY($1::uuid[])`, [ids]);
    await client.query('DELETE FROM battle_commands WHERE battle_id=ANY($1::uuid[])', [ids]);
    await client.query("UPDATE battles SET state=NULL, log='[]'::jsonb, combo=NULL, turn_deadline_at=NULL, bot_acts_at=NULL WHERE id=ANY($1::uuid[])", [ids]);
    await client.query('COMMIT');
    return rows.rowCount!;
  } catch (error) { await client.query('ROLLBACK'); throw error; }
  finally { client.release(); }
}
