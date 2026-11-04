import type { Pool } from 'pg';
import { createInitialProgress } from '@game/contracts.js';

export interface ResetProgressResult {
  userId: string;
  email: string;
  battlesDeleted: number;
}

export async function resetPlayerProgress(pool: Pool, email: string): Promise<ResetProgressResult> {
  const normalizedEmail = email.trim().toLowerCase();
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const account = await client.query<{ id: string; email: string }>(
      'SELECT id, email FROM users WHERE email = $1 FOR UPDATE', [normalizedEmail]);
    const user = account.rows[0];
    if (!user) throw new Error(`Conta não encontrada: ${normalizedEmail}`);
    const progress = await client.query('SELECT 1 FROM player_progress WHERE user_id = $1 FOR UPDATE', [user.id]);
    if (!progress.rowCount) throw new Error(`Progresso não encontrado para: ${normalizedEmail}`);
    const deleted = await client.query('DELETE FROM battles WHERE user_id = $1', [user.id]);
    const { selectedTeam: _selectedTeam, ...initialProgress } = createInitialProgress();
    await client.query('UPDATE player_progress SET data = $2, revision = revision + 1, updated_at = now() WHERE user_id = $1',
      [user.id, JSON.stringify(initialProgress)]);
    await client.query('UPDATE player_team_slots SET unit_id = NULL WHERE user_id = $1', [user.id]);
    await client.query('COMMIT');
    return { userId: user.id, email: user.email, battlesDeleted: deleted.rowCount ?? 0 };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}
