import { createPool, cmsPort, cmsOrigin } from './config.js';
import { createCmsApp } from './app.js';

const pool = process.env.CMS_DATABASE_URL ? createPool() : null;
pool?.on('error', () => console.error('Conexão ociosa do CMS encerrada; verifique o túnel SSH.'));
const app = createCmsApp(pool, cmsOrigin, cmsPort);
app.addHook('onClose', async () => { await pool?.end(); });
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { void app.close(); });
await app.listen({ host: '127.0.0.1', port: cmsPort });
console.info(`API local do CMS em http://127.0.0.1:${cmsPort}. Interface: ${cmsOrigin}`);
