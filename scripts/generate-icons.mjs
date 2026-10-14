// Génère les icônes de l'application installable à partir du symbole du logo
// (même dessin que src/components/brand/logo.tsx). Usage : node scripts/generate-icons.mjs
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const PRIMARY = "#2336d9";
const OUT = join(import.meta.dirname, "..", "public", "icons");
mkdirSync(OUT, { recursive: true });

/** Symbole sur fond plein. `inset` : marge (fraction) pour les icônes « maskable ». */
const mark = ({ size, inset = 0, rounded = true }) => {
  const pad = size * inset;
  const inner = size - 2 * pad;
  const scale = inner / 32;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <rect width="${size}" height="${size}" rx="${rounded ? size * 0.28 : 0}" fill="${PRIMARY}"/>
  <g transform="translate(${pad} ${pad}) scale(${scale})">
    <path d="M9 21.5 23 10.5" fill="none" stroke="#fff" stroke-width="4.25" stroke-linecap="round"/>
  </g>
</svg>`;
};

/** Petite icône monochrome de la barre d'état Android (blanc sur transparent). */
const badge = (
  size,
) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 32 32">
  <path d="M7 23.5 25 8.5" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round"/>
</svg>`;

const render = (svg, file) => sharp(Buffer.from(svg)).png().toFile(join(OUT, file));

await Promise.all([
  render(mark({ size: 192 }), "icon-192.png"),
  render(mark({ size: 512 }), "icon-512.png"),
  // Android découpe ces icônes en cercle : symbole dans la zone sûre, fond plein.
  render(mark({ size: 512, inset: 0.18, rounded: false }), "maskable-512.png"),
  // iOS arrondit lui-même les angles.
  render(mark({ size: 180, rounded: false }), "apple-touch-icon.png"),
  render(badge(96), "badge-96.png"),
]);
console.log(`Icônes écrites dans ${OUT}`);
