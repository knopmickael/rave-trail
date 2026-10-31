import { spawnSync } from 'node:child_process';
import { access, rename, rm } from 'node:fs/promises';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// Ferramenta de autoria: os WebMs prontos são usados pelo jogo, sem FFmpeg em runtime.
const ffmpeg = process.env.FFMPEG_PATH ?? 'ffmpeg';
const width = 1600;
const height = 900;
const fps = 30;
const duration = 12;
const phase = `2*PI*T/${duration}`;
const videoPhase = `2*PI*t/${duration}`;
const sky = 'exp(-pow((X/W-0.56)/0.27,4))*max(0,1-Y/H/0.28)';
const foliage = '(1-exp(-pow((X/W-0.55)/0.32,4)))*clip((0.60-Y/H)/0.32,0,1)';
const grass = 'max(0,(Y/H-0.72)/0.28)';
const storm = 'exp(-pow((Y/H-0.12)/0.20,2))*(1-exp(-pow((X/W-0.80)/0.12,4))*clip((Y/H-0.12)/0.24,0,1))';
const mist = 'exp(-pow((Y/H-0.49)/0.08,2))';

const scenes = {
  forest: {
    image: 'Clareira Florestal Sob o Céu Azul.png', output: 'battle-clearing.webm',
    horizontal: `128+(${sky})*8*sin(${phase})+(${foliage})*2.8*sin(2*${phase}+Y/H*7+X/W*3)+(${grass})*0.9*sin(3*${phase}+X/W*12)`,
    vertical: `128+(${sky})*0.7*cos(${phase})+(${foliage})*1.2*sin(2*${phase}+X/W*6)+(${grass})*0.4*cos(3*${phase}+X/W*9)`,
    color: [255, 238, 178],
    motes: [[0.12,0.40],[0.23,0.62],[0.31,0.48],[0.42,0.76],[0.55,0.34],[0.63,0.57],[0.73,0.72],[0.84,0.42],[0.90,0.67],[0.40,0.24]],
  },
  final: {
    image: 'evil-fight-background.png', output: 'battle-darkness.webm',
    horizontal: `128+(${storm})*7*sin(${phase}+Y/H*8)+(${mist})*2*sin(2*${phase}+X/W*7)`,
    vertical: `128+(${storm})*2*cos(${phase}+X/W*8)+(${mist})*1.3*sin(2*${phase}+X/W*9)`,
    color: [222, 119, 255],
    motes: [[0.09,0.72],[0.18,0.46],[0.27,0.61],[0.34,0.38],[0.44,0.74],[0.53,0.48],[0.62,0.32],[0.69,0.65],[0.76,0.42],[0.85,0.76],[0.92,0.54],[0.82,0.20]],
  },
};

function displacement(expression, name) {
  return `nullsrc=s=400x225:r=${fps}:d=${duration},format=gbrp,geq=r='${expression}':g='${expression}':b='${expression}',scale=${width}:${height}:flags=bilinear[${name}]`;
}

function glow(name, size, color, opacity, spread = 0.3) {
  return `color=c=black:s=${size}:r=${fps}:d=${duration},format=rgba,geq=r='${color[0]}':g='${color[1]}':b='${color[2]}':a='${opacity}*exp(-pow((X-W/2)/(W*${spread}),2)-pow((Y-H/2)/(H*${spread}),2))'[${name}]`;
}

async function generate(name, scene) {
  const input = fileURLToPath(new URL(`../../frontend/public/media/images/${scene.image}`, import.meta.url));
  const output = fileURLToPath(new URL(`../../frontend/public/media/video/${scene.output}`, import.meta.url));
  const temporary = output.replace(/\.webm$/, '.encoding.webm');
  await access(input);
  await access(dirname(output));
  const filters = [
    `[0:v]scale=${width}:${height}:force_original_aspect_ratio=increase:flags=lanczos,crop=${width}:${height},format=gbrp[scene]`,
    displacement(scene.horizontal, 'horizontal'),
    displacement(scene.vertical, 'vertical'),
    '[scene][horizontal][vertical]displace=edge=smear[wind]',
    glow('mote', name === 'final' ? '18x18' : '14x14', scene.color, name === 'final' ? 190 : 145, 0.22),
    `[mote]split=${scene.motes.length}${scene.motes.map((_, index) => `[mote${index}]`).join('')}`,
  ];
  let previous = 'wind';
  for (const [index, [x, y]] of scene.motes.entries()) {
    const next = `particles${index}`;
    const offset = (index * 1.73).toFixed(2);
    filters.push(`[${previous}][mote${index}]overlay=x='${Math.round(x*width)}+${14+index%4*6}*sin(${videoPhase}+${offset})':y='${Math.round(y*height)}+${18+index%3*7}*cos(${videoPhase}+${offset})':eval=frame:shortest=1:format=auto[${next}]`);
    previous = next;
  }
  if (name === 'final') {
    // Névoa baixa e brilho do portal; as pedras e a arquitetura não recebem movimento de câmera.
    filters.push(glow('portal', '300x240', [180, 45, 255], `22*(0.7+0.3*sin(${phase}))`));
    filters.push(`[${previous}][portal]overlay=x=${Math.round(width*0.77-150)}:y=0:shortest=1:format=auto[portalLight]`);
    filters.push(glow('fog', '680x130', [155, 118, 196], '20', 0.35));
    filters.push(`[portalLight][fog]overlay=x='${width*0.22}+22*sin(${videoPhase})':y='${height*0.46}+6*cos(${videoPhase})':eval=frame:shortest=1:format=auto[atmosphere]`);
    previous = 'atmosphere';
  }
  filters.push(`[${previous}]format=yuv420p[animated]`);

  console.info(`Gerando ${scene.output}: ${width}×${height}, ${fps} fps, ${duration}s / ${fps*duration} quadros, sem áudio.`);
  const result = spawnSync(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-filter_complex_threads', '2',
    '-loop', '1', '-framerate', String(fps), '-i', input,
    '-filter_complex', filters.join(';'), '-map', '[animated]', '-an',
    '-frames:v', String(fps*duration), '-r', String(fps), '-fps_mode', 'cfr',
    '-c:v', 'libvpx-vp9', '-b:v', '0', '-crf', '30', '-deadline', 'good',
    '-cpu-used', '4', '-row-mt', '1', '-threads', '4', '-pix_fmt', 'yuv420p', temporary,
  ], { stdio: 'inherit' });
  if (result.error || result.status !== 0) {
    await rm(temporary, { force: true });
    throw result.error ?? new Error(`FFmpeg encerrou com código ${result.status}.`);
  }
  await rename(temporary, output);
  console.info(`Concluído: ${output}`);
}

const selected = process.argv.slice(2);
try {
  for (const name of selected.length ? selected : Object.keys(scenes)) {
    if (!Object.hasOwn(scenes, name)) throw new Error(`Cenário desconhecido: ${name}. Use forest e/ou final.`);
    await generate(name, scenes[name]);
  }
} catch (error) {
  console.error('Não foi possível gerar a animação. Instale FFmpeg ou configure FFMPEG_PATH.', error.message);
  process.exitCode = 1;
}
