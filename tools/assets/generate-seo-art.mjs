import { readFile } from 'node:fs/promises';
import { fileURLToPath, pathToFileURL } from 'node:url';

const sharpModule = process.env.SHARP_PATH ? pathToFileURL(process.env.SHARP_PATH).href : 'sharp';
const { default: sharp } = await import(sharpModule);
const destination = (file) => fileURLToPath(new URL(`../../frontend/public/${file}`, import.meta.url));
const icon = await readFile(destination('favicon.svg'));
await sharp(icon).resize(96, 96).png().toFile(destination('favicon.png'));
await sharp(icon).resize(180, 180).png().toFile(destination('apple-touch-icon.png'));
const background = Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630">
  <defs><linearGradient id="sky" x2="1" y2="1"><stop stop-color="#123948"/><stop offset="1" stop-color="#233b38"/></linearGradient></defs>
  <rect width="1200" height="630" fill="url(#sky)"/>
  <circle cx="1060" cy="80" r="300" fill="#ffb454" opacity=".08"/>
  <circle cx="100" cy="600" r="240" fill="#389be8" opacity=".12"/>
  <path d="M72 466h1056" stroke="#ffb454" stroke-width="2" opacity=".6"/>
  <text x="600" y="522" text-anchor="middle" fill="#fff9ef" font-size="34" font-family="Arial, sans-serif">RPG de fantasia e estratégia por turnos</text>
  <text x="600" y="575" text-anchor="middle" fill="#ffb454" font-size="26" font-family="Arial, sans-serif">rave-trail.com.br</text>
</svg>`);
const logo = await sharp(destination('media/images/logo-rave-trail.png')).resize(590, 396, { fit: 'inside' }).png().toBuffer();
await sharp(background).composite([{ input: logo, top: 40, left: 305 }])
  .jpeg({ quality: 88, mozjpeg: true }).toFile(destination('media/images/rave-trail-social.jpg'));
console.info('Favicon, ícone de toque e imagem social do Rave Trail gerados.');
