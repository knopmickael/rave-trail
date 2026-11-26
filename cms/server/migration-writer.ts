import { randomUUID } from 'node:crypto';
import { link, open, readFile, readdir, unlink } from 'node:fs/promises';
import pg, { type PoolClient } from 'pg';

function literal(value: unknown): string {
  if (value === null || value === undefined) return 'NULL';
  if (typeof value === 'boolean') return value ? 'TRUE' : 'FALSE';
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Buffer.isBuffer(value)) return `decode('${value.toString('hex')}', 'hex')`;
  if (Array.isArray(value)) {
    const array = '{' + value.map((item: string) => '"' + item.replaceAll('\\', '\\\\').replaceAll('"', '\\"') + '"').join(',') + '}';
    return pg.escapeLiteral(array);
  }
  if (typeof value === 'string') return pg.escapeLiteral(value);
  throw new Error('Tipo de parâmetro não suportado na migration do CMS.');
}

/** Records actual repository writes, not snapshots or local player data. */
export class CmsMigrationWriter {
  constructor(readonly directory: URL) {}

  capture(client: PoolClient) {
    const statements: string[] = [];
    const recordingClient = new Proxy(client, {
      get(target, property) {
        if (property !== 'query') return Reflect.get(target, property);
        return async (text: string, values?: unknown[]) => {
          const result = await target.query(text, values);
          if (/^\s*(INSERT|UPDATE|DELETE|WITH|DO)\b/i.test(text)) {
            const sql = text.replace(/\$(\d+)\b/g, (_match, index: string) => literal(values?.[Number(index) - 1]));
            statements.push(sql.replace(/;\s*$/, '') + ';');
          }
          return result;
        };
      },
    });
    return { client: recordingClient, statements };
  }

  async journal(client: PoolClient, statements: string[]) {
    const applied = await client.query<{ name: string }>('SELECT name FROM schema_migrations');
    const files = [...await readdir(this.directory), ...applied.rows.map((row) => row.name)].filter((name) => /^\d+_.*\.sql$/.test(name)).sort();
    const prefix = files.at(-1)?.match(/^\d+/)?.[0] ?? '000';
    const previousTimes = files.filter((name) => name.startsWith(`${prefix}_zz_cms_`)).map((name) => Number(name.split('_')[3]));
    const time = Math.max(Date.now(), ...previousTimes.map((time) => time + 1));
    const name = `${prefix}_zz_cms_${time}_${randomUUID()}.sql`;
    const sql = '-- Gerada automaticamente pelo CMS local. Não editar após publicação.\n'
      + '-- A transação e o controle de aplicação são responsabilidade do migrador.\n\n' + statements.join('\n\n') + '\n';
    await client.query('INSERT INTO cms_migration_journal (name,sql) VALUES ($1,$2)', [name, sql]);
    await client.query('INSERT INTO schema_migrations (name) VALUES ($1)', [name]);
  }

  /** Caller holds the same advisory lock as the migrator and repository. */
  async exportPending(client: PoolClient) {
    const pending = await client.query<{ name: string; sql: string }>('SELECT name,sql FROM cms_migration_journal WHERE exported_at IS NULL ORDER BY name');
    for (const row of pending.rows) {
      if (!/^\d+_zz_cms_\d+_[\da-f-]+\.sql$/.test(row.name)) throw new Error('Nome inválido no journal de migrations.');
      const destination = new URL(row.name, this.directory);
      const temporary = new URL(`.${row.name}.${randomUUID()}.pending`, this.directory);
      try {
        const file = await open(temporary, 'wx');
        try { await file.writeFile(row.sql, 'utf8'); await file.sync(); } finally { await file.close(); }
        try { await link(temporary, destination); }
        catch (error) {
          if ((error as NodeJS.ErrnoException).code !== 'EEXIST' || await readFile(destination, 'utf8') !== row.sql) throw error;
        }
      } finally { await unlink(temporary).catch((error: NodeJS.ErrnoException) => { if (error.code !== 'ENOENT') throw error; }); }
      await client.query('UPDATE cms_migration_journal SET exported_at=now() WHERE name=$1', [row.name]);
    }
  }
}
