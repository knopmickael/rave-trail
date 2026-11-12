import { randomUUID } from 'node:crypto';
import type { Pool } from 'pg';
import { createInitialProgress, type PlayerProgress, type User } from '@game/contracts.js';
import { EmailAlreadyUsedError, type AuthRepository, type Credentials, type SessionInput } from '../auth/repository.js';
import { readTeam } from './game-repository.js';
import { synchronizeCharacterUnlocks } from './character-unlocks.js';

export class PostgresAuthRepository implements AuthRepository {
  constructor(private readonly pool: Pool) {}

  async register(email: string, passwordHash: string, session: SessionInput): Promise<User> {
    const client = await this.pool.connect();
    const user = { id: randomUUID(), email, name: 'Aventureiro' };
    try {
      await client.query('BEGIN');
      await client.query('INSERT INTO users (id, email, password_hash) VALUES ($1, $2, $3)', [user.id, email, passwordHash]);
      const { selectedTeam: _team, ...progress } = createInitialProgress();
      const starters = await client.query<{ id: string }>("SELECT id FROM units WHERE unlock_condition->>'kind'='starter' ORDER BY roster_order NULLS LAST, id");
      progress.unlockedUnitIds = starters.rows.map((unit) => unit.id);
      await client.query('INSERT INTO player_progress (user_id, data) VALUES ($1, $2)', [user.id, JSON.stringify(progress)]);
      await client.query('INSERT INTO player_team_slots (user_id, slot_index) SELECT $1, generate_series(0, 2)', [user.id]);
      await client.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [session.tokenHash, user.id, session.expiresAt]);
      await client.query('COMMIT');
      return user;
    } catch (error) {
      await client.query('ROLLBACK');
      if ((error as { code?: string; constraint?: string }).code === '23505'
        && (error as { constraint?: string }).constraint === 'users_email_key') {
        throw new EmailAlreadyUsedError();
      }
      throw error;
    } finally {
      client.release();
    }
  }

  async findCredentials(email: string): Promise<Credentials | null> {
    const result = await this.pool.query<Credentials>('SELECT id, email, name, password_hash AS "passwordHash" FROM users WHERE email = $1', [email]);
    return result.rows[0] ?? null;
  }

  async createSession(userId: string, session: SessionInput): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE user_id = $1 AND expires_at <= now()', [userId]);
    await this.pool.query('INSERT INTO sessions (token_hash, user_id, expires_at) VALUES ($1, $2, $3)', [session.tokenHash, userId, session.expiresAt]);
  }

  async findSession(tokenHash: string): Promise<User | null> {
    const result = await this.pool.query<User>(
      `SELECT u.id, u.email, u.name,
        to_char(s.expires_at AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"') AS "sessionExpiresAt"
        FROM sessions s JOIN users u ON u.id = s.user_id WHERE s.token_hash = $1 AND s.expires_at > now()`, [tokenHash],
    );
    return result.rows[0] ?? null;
  }

  async deleteSession(tokenHash: string): Promise<void> {
    await this.pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
  }

  async updateName(userId: string, name: string): Promise<User> {
    const result = await this.pool.query<User>('UPDATE users SET name = $2 WHERE id = $1 RETURNING id, email, name', [userId, name]);
    return result.rows[0];
  }

  async getProgress(userId: string): Promise<PlayerProgress | null> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const found = await client.query<{ data: PlayerProgress }>('SELECT data FROM player_progress WHERE user_id=$1 FOR UPDATE', [userId]);
      if (!found.rows[0]) { await client.query('COMMIT'); return null; }
      await synchronizeCharacterUnlocks(client, userId, found.rows[0].data);
      const result = await client.query<{ data: PlayerProgress }>('SELECT data FROM player_progress WHERE user_id=$1', [userId]);
      const selectedTeam = await readTeam(client, userId);
      await client.query('COMMIT');
      return { ...result.rows[0].data, selectedTeam };
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
}
