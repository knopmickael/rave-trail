import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { units } from '../../shared/src/content/units.ts';
import { abilities } from '../../shared/src/content/abilities.ts';
import { MockCharacterDrawing } from '../../frontend/src/features/characters/CharacterArt.tsx';
import { MockAbilityDrawing } from '../../frontend/src/features/characters/AbilityIcon.tsx';

// Sharp é ferramenta de autoria opcional, não dependência do jogo.
const sharpModule = process.env.SHARP_PATH ? pathToFileURL(process.env.SHARP_PATH).href : 'sharp';
const { default: sharp } = await import(sharpModule);
const destination = (path) => fileURLToPath(new URL(`../../frontend/public${path}`, import.meta.url));
const requestedIds = process.argv.slice(2);
for (const id of requestedIds) {
  if (!units.some((unit) => unit.id === id)) throw new Error(`Unidade desconhecida: ${id}`);
}
const selectedUnits = requestedIds.length ? units.filter((unit) => requestedIds.includes(unit.id)) : units;
for (const unit of selectedUnits) {
  for (const face of [true, false]) {
    const svg = renderToStaticMarkup(createElement(MockCharacterDrawing, { unit, face }))
      .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ');
    const width = face ? 192 : 600;
    const height = face ? 192 : 1020;
    await sharp(Buffer.from(svg)).resize(width, height).png().toFile(destination(face ? unit.portrait : unit.illustration));
  }
}
const selectedAbilities = requestedIds.length ? [] : Object.values(abilities);
for (const ability of selectedAbilities) {
  const markup = renderToStaticMarkup(createElement(MockAbilityDrawing, { ability }));
  const svg = markup.slice(markup.indexOf('<svg'), markup.indexOf('</svg>') + 6)
    .replace('<svg ', '<svg xmlns="http://www.w3.org/2000/svg" ')
    .replaceAll('currentColor', '#93521f');
  await sharp(Buffer.from(svg)).resize(96, 96).flatten({ background: '#fff0d9' }).jpeg({ quality: 90 }).toFile(destination(ability.icon));
}
console.info(`${selectedUnits.length * 2} PNGs com alpha e ${selectedAbilities.length} ícones JPEG gerados.`);
