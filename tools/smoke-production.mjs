import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
import { once } from 'node:events';
import { createServer } from 'node:net';
import { fileURLToPath } from 'node:url';
import { config } from 'dotenv';
import pg from 'pg';

const root = fileURLToPath(new URL('../', import.meta.url));
config({ path: fileURLToPath(new URL('../.env', import.meta.url)) });
const database = process.env.TEST_DATABASE_URL;
if (!database || !new URL(database).pathname.endsWith('_test') || database === process.env.DATABASE_URL) {
  throw new Error('Configure TEST_DATABASE_URL para um banco exclusivo _test, diferente do banco de desenvolvimento.');
}
const socket = createServer().listen(0, '127.0.0.1');
await once(socket, 'listening');
const port = socket.address().port;
await new Promise((resolve) => socket.close(resolve));
const origin = 'https://production-smoke.example';
const address = `http://127.0.0.1:${port}`;
const output = [];
const child = spawn(process.execPath, ['backend/dist/index.js'], {
  cwd: root,
  env: { ...process.env, DATABASE_URL: database, NODE_ENV: 'production', APP_ORIGIN: origin, HOST: '127.0.0.1', PORT: String(port) },
  stdio: ['ignore', 'pipe', 'pipe'],
});
child.stdout.on('data', (data) => output.push(data.toString()));
child.stderr.on('data', (data) => output.push(data.toString()));
const pool = new pg.Pool({ connectionString: database });
let userId;
try {
  let ready = false;
  for (let i = 0; i < 100; i++) {
    if (child.exitCode !== null) throw new Error(`API compilada encerrou: ${output.join('')}`);
    try { ready = (await fetch(address)).ok; } catch {}
    if (ready) break;
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert(ready, 'A API compilada deve iniciar e servir a SPA.');
  const html = await (await fetch(address)).text();
  const script = html.match(/src="([^"]+\.js)"/u)?.[1];
  assert(script, 'Entrada JavaScript do build não encontrada.');
  assert.equal((await fetch(address + script)).status, 200);
  assert.equal((await fetch(address + '/api/unknown')).status, 404);
  assert.match(html, /<h1[^>]*>Rave Trail<\/h1>/u);
  assert.match(html, /rel="canonical"/u);
  assert.equal((await fetch(address + '/sobre/')).status, 200);
  assert.equal((await fetch(address + '/robots.txt')).status, 200);
  assert.equal((await fetch(address + '/sitemap.xml')).status, 200);
  const missingPage = await fetch(address + '/pagina-inexistente');
  assert.equal(missingPage.status, 404);
  assert.equal(missingPage.headers.get('x-robots-tag'), 'noindex, follow');
  for (const path of ['/media/images/logo-rave-trail.png', '/media/images/sky-background.webp',
    '/media/images/fight-background.png', '/media/images/fight-exal-background.png', '/media/images/mapa-campanha-01.png',
    '/media/characters/ravi-de-berdal-face.png', '/media/characters/jung-de-grimoria-ii-face.png', '/media/characters/jung-de-grimoria-ii-body.png',
    '/media/abilities/retain-energy.jpg', '/media/campaigns/path-1.webp',
    '/media/audio/click-menu.wav', '/media/audio/battle-win.wav', '/media/audio/battle-lose.mp3']) {
    assert.equal((await fetch(address + path, { method: 'HEAD' })).status, 200, path);
  }
  for (const path of ['/media/video/sky-background.webm']) {
    const response = await fetch(address + path, { headers: { Range: 'bytes=0-63' } });
    assert.equal(response.status, 206, path);
    assert.equal((await response.arrayBuffer()).byteLength, 64);
  }
  const registration = await fetch(address + '/api/auth/register', {
    method: 'POST', headers: { Origin: origin, 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: `production-smoke-${randomUUID()}@example.com`, password: randomUUID() }),
  });
  assert.equal(registration.status, 201);
  const registered = (await registration.json()).user;
  userId = registered.id;
  const rawCookie = registration.headers.get('set-cookie');
  assert.match(rawCookie, /Secure/iu);
  assert.match(rawCookie, /Max-Age=3600/iu);
  const cookie = rawCookie.split(';')[0];
  const headers = { Origin: origin, Cookie: cookie, 'Content-Type': 'application/json' };
  const missions = (await (await fetch(address + '/api/character-unlocks', { headers })).json()).unlocks.characters;
  assert.equal(missions.length, 33);
  assert(missions.every((mission) => mission.campaignAvailable === (mission.kind === 'premium')));
  assert.equal((await fetch(address + '/api/profile', { method: 'PATCH', headers, body: JSON.stringify({ name: 'Guardião do build' }) })).status, 200);
  const session = (await (await fetch(address + '/api/auth/me', { headers })).json()).user;
  assert.equal(session.name, 'Guardião do build');
  assert.equal(session.sessionExpiresAt, registered.sessionExpiresAt);
  assert.equal((await fetch(address + '/api/team/slots/0', { method: 'PUT', headers, body: JSON.stringify({ unitId: 'protagonist-main-base' }) })).status, 200);
  const started = await fetch(address + '/api/quick-battle/battles', { method: 'POST', headers, body: '{}' });
  assert.equal(started.status, 201);
  const battle = (await started.json()).battle;
  const turn = await fetch(address + `/api/battles/${battle.id}/turns`, { method: 'POST', headers,
    body: JSON.stringify({ revision: 0, requestId: randomUUID(), actions: [{ actorId: 'player-0', abilityId: 'retain-energy' }] }) });
  assert.equal(turn.status, 200);
  assert.equal((await turn.json()).battle.revision, 1);
  assert.equal((await fetch(address + `/api/battles/${battle.id}/abandon`, { method: 'POST', headers, body: '{}' })).status, 200);
  assert.equal((await fetch(address + '/api/auth/logout', { method: 'POST', headers, body: '{}' })).status, 204);
  assert.equal((await fetch(address + '/api/auth/me', { headers })).status, 401);
  console.info('Smoke de produção aprovado: SPA, mídias/Range, API compilada, sessão, perfil, missões, equipe e turno oficial.');
} finally {
  if (child.exitCode === null) {
    child.kill('SIGTERM');
    await Promise.race([once(child, 'exit'), new Promise((resolve) => setTimeout(resolve, 5000))]);
    if (child.exitCode === null) child.kill('SIGKILL');
  }
  if (userId) await pool.query('DELETE FROM users WHERE id = $1', [userId]);
  await pool.end();
}
