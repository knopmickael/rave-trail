import { config } from 'dotenv';
import { fileURLToPath } from 'node:url';
import pg from 'pg';
import { cmsEnvironmentFile } from '../environment.js';

const environmentFile = cmsEnvironmentFile();
const loaded = config({ path: fileURLToPath(new URL(`../../${environmentFile}`, import.meta.url)), quiet: true } as Parameters<typeof config>[0]);
if (process.env.CMS_PROFILE && loaded.error) throw new Error(`Não foi possível carregar ${environmentFile}. Crie o arquivo na raiz do projeto.`);
function port(value: string | undefined, fallback: number) {
  const number = value === undefined ? fallback : Number(value);
  if (!Number.isInteger(number) || number < 1024 || number > 65535) throw new Error('CMS_API_PORT/CMS_WEB_PORT inválida (1024–65535).');
  return number;
}
export const cmsPort = port(process.env.CMS_API_PORT, 3188);
export const cmsWebPort = port(process.env.CMS_WEB_PORT, 5188);
export const cmsOrigin = `http://127.0.0.1:${cmsWebPort}`;
export function createPool() {
  if (!process.env.CMS_DATABASE_URL) throw new Error(`Configure CMS_DATABASE_URL no arquivo ${environmentFile}.`);
  return new pg.Pool({ connectionString: process.env.CMS_DATABASE_URL, max: 4, connectionTimeoutMillis: 5000, statement_timeout: 15000, application_name: 'rave-trail-local-cms' });
}
