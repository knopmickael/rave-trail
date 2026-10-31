import { fileURLToPath, pathToFileURL } from 'node:url';

const sharpModule = process.env.SHARP_PATH ? pathToFileURL(process.env.SHARP_PATH).href : 'sharp';
const { default: sharp } = await import(sharpModule);
const input = fileURLToPath(new URL('../../frontend/public/media/images/Clareira Florestal Sob o Céu Azul.png', import.meta.url));
const output = (name) => fileURLToPath(new URL(`../../frontend/public/media/campaigns/${name}.webp`, import.meta.url));

await sharp(input).resize(640, 1280, { fit: 'cover', position: 'centre' }).webp({ quality: 85 }).toFile(output('path-1'));
await sharp(input).resize(640, 1280, { fit: 'cover', position: 'east' }).modulate({ hue: 18, saturation: .75, brightness: .9 }).webp({ quality: 85 }).toFile(output('path-2'));
console.info('Duas imagens de capítulos geradas. A página utiliza o céu compartilhado.');
