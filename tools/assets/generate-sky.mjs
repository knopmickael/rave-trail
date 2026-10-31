import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

// Ferramenta de autoria opcional; o FFmpeg não é necessário para rodar o jogo.
const ffmpeg = process.env.FFMPEG_PATH ?? process.argv[2] ?? 'ffmpeg';
const input = fileURLToPath(new URL('../../frontend/public/media/images/sky-background.webp', import.meta.url));
const output = fileURLToPath(new URL('../../frontend/public/media/video/sky-background.webm', import.meta.url));
const duration = 24;
const horizontal = `128+10*sin(2*PI*T/${duration}+Y/H*2*PI)`;
const vertical = `128+5*cos(2*PI*T/${duration}+X/W*2*PI)`;
const displacementMap = (expression, label) =>
  `nullsrc=s=320x214:r=24:d=${duration},format=gbrp,geq=r='${expression}':g='${expression}':b='${expression}',scale=1280:854:flags=bilinear[${label}]`;

const filters = [
  `[0:v]scale=1440:960:flags=lanczos,format=gbrp,crop=1280:854:x='80+44*sin(2*PI*t/${duration})':y='53+22*cos(2*PI*t/${duration})'[sky]`,
  displacementMap(horizontal, 'horizontal'),
  displacementMap(vertical, 'vertical'),
  '[sky][horizontal][vertical]displace=edge=smear,format=yuv420p[animated]',
].join(';');

console.info('Gerando céu WebM VP9: 24 segundos, 1280×854, 24 fps, sem áudio.');
const result = spawnSync(ffmpeg, [
  '-hide_banner', '-loglevel', 'error', '-y', '-filter_complex_threads', '2',
  '-loop', '1', '-framerate', '24', '-i', input,
  '-filter_complex', filters, '-map', '[animated]', '-t', String(duration),
  '-an', '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '34', '-deadline', 'good',
  '-cpu-used', '4', '-row-mt', '1', '-threads', '4', '-pix_fmt', 'yuv420p', output,
], { stdio: 'inherit' });

if (result.error) {
  console.error('FFmpeg não encontrado. Instale-o ou configure FFMPEG_PATH.', result.error.message);
  process.exitCode = 1;
} else if (result.status !== 0) {
  process.exitCode = result.status ?? 1;
} else {
  console.info(`Céu gerado: ${output}`);
}
