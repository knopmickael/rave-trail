import { mkdtemp, mkdir, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import Fastify from 'fastify';
import { afterAll, beforeAll, expect, it } from 'vitest';
import { registerFrontend } from './frontend.js';

const app = Fastify();
app.addHook('onRequest', async (_request, reply) => { reply.header('Cache-Control', 'no-store'); });
let root: string;
beforeAll(async () => {
  root = await mkdtemp(join(tmpdir(), 'rave-trail-frontend-'));
  await mkdir(join(root, 'sobre'));
  await mkdir(join(root, 'assets'));
  await writeFile(join(root, 'index.html'), '<!doctype html><html><body><h1>Rave Trail</h1></body></html>');
  await writeFile(join(root, 'sobre/index.html'), '<!doctype html><html><body><h1>Sobre Rave Trail</h1></body></html>');
  await writeFile(join(root, 'assets/index-abc123.js'), 'console.info("Rave Trail");');
  await writeFile(join(root, 'robots.txt'), 'User-agent: *\nAllow: /');
  await registerFrontend(app, root);
  await app.ready();
});
afterAll(async () => { await app.close(); if (root) await rm(root, { recursive: true, force: true }); });

it('serve o HTML público e a apresentação sem exigir sessão', async () => {
  const home = await app.inject('/');
  expect(home.statusCode).toBe(200);
  expect(home.body).toContain('<h1>Rave Trail</h1>');
  expect(home.headers['x-robots-tag']).toBeUndefined();
  expect(home.headers['cache-control']).toBe('no-cache');
  const about = await app.inject('/sobre/');
  expect(about.statusCode).toBe(200);
  expect(about.body).toContain('Sobre Rave Trail');
  expect((await app.inject('/robots.txt')).statusCode).toBe(200);
});

it('normaliza URLs públicas duplicadas com redirecionamento permanente', async () => {
  for (const [url, location] of [['/index.html', '/'], ['/sobre', '/sobre/'], ['/sobre/index.html', '/sobre/']]) {
    const response = await app.inject(url);
    expect(response.statusCode).toBe(301);
    expect(response.headers.location).toBe(location);
  }
});

it('serve o aviso para computadores sem indexá-lo como outra página do jogo', async () => {
  const response = await app.inject('/acesse-pelo-computador');
  expect(response.statusCode).toBe(200);
  expect(response.headers['x-robots-tag']).toBe('noindex, follow');
});

it('retorna 404 real para URLs, APIs e arquivos inexistentes', async () => {
  for (const path of ['/pagina-inexistente', '/api/unknown', '/media/missing.png', '/assets/missing.js', '/missing.xml']) {
    const response = await app.inject(path);
    expect(response.statusCode, path).toBe(404);
    expect(response.headers['x-robots-tag'], path).toBe('noindex, follow');
    if (path !== '/pagina-inexistente') expect(response.headers['content-type']).toContain('application/json');
  }
});

it('permite cache de longo prazo somente nos assets versionados do build', async () => {
  const response = await app.inject('/assets/index-abc123.js');
  expect(response.statusCode).toBe(200);
  expect(response.headers['cache-control']).toBe('public, max-age=31536000, immutable');
});
