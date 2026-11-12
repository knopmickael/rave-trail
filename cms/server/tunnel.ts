import './config.js';
import { spawn } from 'node:child_process';
import { cmsEnvironmentFile } from '../environment.js';

const host = process.env.CMS_SSH_HOST;
const user = process.env.CMS_SSH_USER;
const key = process.env.CMS_SSH_KEY;
if (!host || !user || !/^[\w.-]+$/.test(host) || !/^[\w.-]+$/.test(user)) throw new Error(`Configure CMS_SSH_HOST e CMS_SSH_USER em ${cmsEnvironmentFile()}.`);
const port = (value: string | undefined, fallback: string) => {
  const result = value ?? fallback;
  if (!/^\d+$/.test(result) || +result < 1 || +result > 65535) throw new Error('Porta SSH/DB inválida.');
  return result;
};
const localPort = port(process.env.CMS_SSH_LOCAL_PORT, '5438');
const remotePort = port(process.env.CMS_SSH_DB_PORT, '5432');
const args = ['-N', '-T', '-o', 'ExitOnForwardFailure=yes', '-o', 'ServerAliveInterval=30', '-o', 'ServerAliveCountMax=3',
  '-L', `127.0.0.1:${localPort}:127.0.0.1:${remotePort}`, '-p', port(process.env.CMS_SSH_PORT, '22')];
if (key) args.push('-i', key);
args.push(`${user}@${host}`);
console.info(`Túnel: 127.0.0.1:${localPort} → PostgreSQL remoto :${remotePort}. Mantenha este terminal aberto.`);
const child = spawn('ssh', args, { stdio: 'inherit', shell: false });
child.on('error', () => { console.error('Não foi possível iniciar o cliente OpenSSH.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.on(signal, () => child.kill(signal));
