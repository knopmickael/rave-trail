import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const [profile, action = 'studio'] = process.argv.slice(2);
const commands = {
  studio: ['node_modules/concurrently/dist/bin/concurrently.js', '-k', '-n', 'cms-web,cms-api', 'npm:cms:web', 'npm:cms:api'],
  tunnel: ['node_modules/tsx/dist/cli.mjs', '--tsconfig', 'cms/tsconfig.json', 'cms/server/tunnel.ts'],
  setup: ['node_modules/tsx/dist/cli.mjs', '--tsconfig', 'cms/tsconfig.json', 'cms/server/setup-db.ts'],
};
if (!['local', 'prod'].includes(profile) || !Object.hasOwn(commands, action)) throw new Error('Uso: node cms/run.mjs <local|prod> [studio|tunnel|setup]');
const child = spawn(process.execPath, commands[action], {
  cwd: fileURLToPath(new URL('..', import.meta.url)), stdio: 'inherit', shell: false,
  env: { ...process.env, CMS_PROFILE: profile },
});
child.on('error', () => { console.error('Não foi possível iniciar o comando do CMS.'); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
for (const signal of ['SIGINT', 'SIGTERM']) process.once(signal, () => child.kill(signal));
