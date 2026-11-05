import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { seo } from './seo';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  resolve: { alias: { '@game': fileURLToPath(new URL('../shared/src', import.meta.url)) } },
  plugins: [react(), seo()],
  build: {
    rollupOptions: { input: {
      game: fileURLToPath(new URL('./index.html', import.meta.url)),
      about: fileURLToPath(new URL('./sobre/index.html', import.meta.url)),
    } },
  },
  server: {
    port: 5173,
    strictPort: true,
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
    proxy: { '/api': 'http://127.0.0.1:3001' },
  },
});
