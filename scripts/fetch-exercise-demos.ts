/**
 * Télécharge les illustrations des exercices (Free Exercise DB, domaine public)
 * et les enregistre, réduites et converties en WebP, dans public/exercises/.
 * À relancer seulement après avoir modifié src/domain/exercise-demos.ts.
 *
 * Usage : node scripts/fetch-exercise-demos.ts
 */
import { mkdirSync } from "node:fs";
import sharp from "sharp";
import { EXERCISE_DEMOS } from "../src/domain/exercise-demos.ts";

const SOURCE = "https://raw.githubusercontent.com/yuhonas/free-exercise-db/main/exercises";
const OUTPUT = "public/exercises";

mkdirSync(OUTPUT, { recursive: true });
let count = 0;
for (const [slug, id] of Object.entries(EXERCISE_DEMOS)) {
  for (const index of [0, 1] as const) {
    const response = await fetch(`${SOURCE}/${encodeURIComponent(id)}/${index}.jpg`);
    if (!response.ok) throw new Error(`${slug} : image ${index} introuvable (${response.status})`);
    const image = Buffer.from(await response.arrayBuffer());
    await sharp(image)
      .resize({ width: 480, withoutEnlargement: true })
      .webp({ quality: 70 })
      .toFile(`${OUTPUT}/${slug}-${index + 1}.webp`);
    count += 1;
  }
}
console.log(`${count} images enregistrées dans ${OUTPUT}/`);
