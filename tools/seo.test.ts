import { readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { build } from 'vite';
import type { RollupOutput } from 'rollup';
import { beforeAll, expect, it } from 'vitest';
import { site } from '../frontend/src/seo';

const root = new URL('../', import.meta.url);
let pages: Map<string, Document>;
beforeAll(async () => {
  const result = await build({ configFile: fileURLToPath(new URL('frontend/vite.config.ts', root)),
    logLevel: 'silent', build: { write: false } });
  const outputs = (Array.isArray(result) ? result : [result]) as RollupOutput[];
  pages = new Map(outputs.flatMap((output) => output.output.flatMap((asset) =>
    asset.type === 'asset' && asset.fileName.endsWith('.html')
      ? [[asset.fileName, new JSDOM(String(asset.source)).window.document] as const] : [])));
}, 30_000);

it('publica a apresentação no HTML inicial sem depender de JavaScript nem autenticação', () => {
  const document = pages.get('index.html')!;
  expect(document.querySelectorAll('h1')).toHaveLength(1);
  expect(document.querySelector('h1')?.textContent).toBe('Rave Trail');
  expect(document.querySelector('#root')?.textContent).toContain('RPG de fantasia e estratégia por turnos');
  expect(document.querySelector('#root a[href="/sobre/"]')).not.toBeNull();
  expect(document.querySelector('noscript')?.textContent).toContain('JavaScript');
  expect(document.documentElement.lang).toBe('pt-BR');
});

it('gera metadados e dados estruturados coerentes para as duas páginas públicas', () => {
  for (const [file, url] of [['index.html', site.url], ['sobre/index.html', new URL('sobre/', site.url).href]]) {
    const document = pages.get(file)!;
    expect(document.title).toContain(site.name);
    expect(document.querySelector('meta[name="description"]')?.getAttribute('content')).toContain('ravetrail');
    expect(document.querySelector('link[rel="canonical"]')?.getAttribute('href')).toBe(url);
    expect(document.querySelector('link[rel="icon"]')?.getAttribute('href')).toBe('/media/images/logo-rave-trail.png');
    expect(document.querySelector('meta[property="og:url"]')?.getAttribute('content')).toBe(url);
    expect(document.querySelector('meta[property="og:image"]')?.getAttribute('content')).toBe(new URL(site.socialImage, site.url).href);
    expect(document.querySelector('meta[name="robots"]')?.getAttribute('content')).not.toContain('noindex');
    const data = JSON.parse(document.querySelector('script[type="application/ld+json"]')!.textContent!);
    const website = data['@graph'].find((entry: { '@type': string }) => entry['@type'] === 'WebSite');
    expect(website.url).toBe(site.url);
    expect(website.alternateName).toEqual(['rave-trail', 'ravetrail']);
    expect(data['@graph'].find((entry: { '@type': string }) => entry['@type'] === 'VideoGame').name).toBe(site.name);
  }
});

it('mantém a página Sobre inteiramente legível e navegável sem carregar a SPA', () => {
  const document = pages.get('sobre/index.html')!;
  expect(document.querySelectorAll('h1')).toHaveLength(1);
  expect(document.querySelector('main')?.textContent).toContain('rave-trail');
  expect(document.querySelector('main')?.textContent).toContain('ravetrail');
  expect(document.querySelector('#como-jogar')).not.toBeNull();
  expect(document.querySelector('a[href="/"]')).not.toBeNull();
  expect(document.querySelector('#about-root main')).not.toBeNull();
  expect(document.querySelector('script[type="module"]')?.getAttribute('src')).toMatch(/\/assets\/about-/);
});

it('mantém o sitemap limitado a URLs públicas canônicas e as imagens de descoberta disponíveis', async () => {
  const sitemap = new JSDOM(await readFile(new URL('frontend/public/sitemap.xml', root), 'utf8'), { contentType: 'text/xml' });
  expect([...sitemap.window.document.querySelectorAll('loc')].map((entry) => entry.textContent)).toEqual([
    site.url, new URL('sobre/', site.url).href,
  ]);
  const robots = await readFile(new URL('frontend/public/robots.txt', root), 'utf8');
  expect(robots).toContain(`Sitemap: ${new URL('sitemap.xml', site.url).href}`);
  expect(robots).toContain('Disallow: /api/');
  expect(robots).not.toMatch(/Disallow:\s*\/(?:\s|$)/);
  for (const file of ['media/images/logo-rave-trail.png', site.socialImage.slice(1)]) {
    expect((await stat(new URL(`frontend/public/${file}`, root))).size, file).toBeGreaterThan(0);
  }
});
