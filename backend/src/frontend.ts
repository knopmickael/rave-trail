import type { FastifyInstance } from 'fastify';
import fastifyStatic from '@fastify/static';
import { relative, sep } from 'node:path';

/** Public HTML routes are explicit so missing SPA URLs do not become indexable soft 404s. */
export async function registerFrontend(app: FastifyInstance, root: string) {
  app.addHook('onRequest', async (request, reply) => {
    const pathname = request.url.split('?')[0];
    if (pathname === '/acesse-pelo-computador') reply.header('X-Robots-Tag', 'noindex, follow');
  });
  await app.register(fastifyStatic, {
    root,
    setHeaders(response, file) {
      const local = relative(root, file).split(sep).join('/');
      if (local.startsWith('assets/')) response.header('Cache-Control', 'public, max-age=31536000, immutable');
      else if (local.startsWith('media/') || /\.(png|svg)$/.test(local)) response.header('Cache-Control', 'public, max-age=86400');
      else if (local.endsWith('.html')) response.header('Cache-Control', 'no-cache');
      else response.header('Cache-Control', 'public, max-age=3600');
    },
  });
  app.get('/index.html', async (_request, reply) => reply.redirect('/', 301));
  app.get('/sobre', async (_request, reply) => reply.redirect('/sobre/', 301));
  app.get('/sobre/index.html', async (_request, reply) => reply.redirect('/sobre/', 301));
  app.get('/sobre/', async (_request, reply) => reply.sendFile('sobre/index.html'));
  app.get('/acesse-pelo-computador', async (_request, reply) => reply.sendFile('index.html'));
  app.setNotFoundHandler((request, reply) => {
    reply.header('X-Robots-Tag', 'noindex, follow');
    const pathname = request.url.split('?')[0];
    if (pathname.startsWith('/api/') || pathname.startsWith('/media/') || pathname.startsWith('/assets/')
      || !['GET', 'HEAD'].includes(request.method) || /\.[^/]+$/.test(pathname)) {
      return reply.code(404).send({ message: 'Recurso não encontrado.' });
    }
    return reply.code(404).sendFile('index.html');
  });
}
