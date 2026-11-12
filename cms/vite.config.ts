import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';
import { cmsPort, cmsWebPort } from './server/config';

export default defineConfig({
  root: fileURLToPath(new URL('.', import.meta.url)),
  publicDir: fileURLToPath(new URL('../frontend/public', import.meta.url)),
  plugins: [react()],
  server: { host: '127.0.0.1', port: cmsWebPort, strictPort: true,
    fs: { allow: [fileURLToPath(new URL('..', import.meta.url))] },
    proxy: { '/api': `http://127.0.0.1:${cmsPort}`, '/media/cms': `http://127.0.0.1:${cmsPort}` } },
});
