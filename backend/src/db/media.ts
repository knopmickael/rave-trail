import type { Pool } from 'pg';

export async function readMedia(pool: Pool, id: string) {
  const result = await pool.query<{ mimeType: string; content: Buffer }>('SELECT mime_type AS "mimeType", content FROM cms_media WHERE id=$1', [id]);
  return result.rows[0] ?? null;
}
