/**
 * Génère la migration qui alimente la bibliothèque d'exercices partagée
 * (`exercise_library`, owner_id NULL) à partir de src/domain/exercise-catalog.ts.
 *
 * Usage : node scripts/build-exercise-migration.ts <migration.sql>
 */
import { writeFileSync } from "node:fs";
import { EXERCISE_CATALOG } from "../src/domain/exercise-catalog.ts";

const [output] = process.argv.slice(2);
if (!output) {
  console.error("Usage : node scripts/build-exercise-migration.ts <migration.sql>");
  process.exit(1);
}

const text = (value: string) => `'${value.replaceAll("'", "''")}'`;
const array = (values: readonly string[]) => `array[${values.map(text).join(", ")}]::text[]`;

const rows = EXERCISE_CATALOG.map((exercise) =>
  [
    text(exercise.slug),
    text(exercise.name),
    text(exercise.primary),
    array(exercise.secondary),
    text(exercise.pattern),
    array(exercise.equipment),
    text(exercise.difficulty),
    String(exercise.compound),
    String(exercise.timed ?? false),
    array(exercise.caution),
    text(exercise.instructions),
  ].join(", "),
);

writeFileSync(
  output,
  `-- =============================================================================
-- Bibliothèque d'exercices de référence (${EXERCISE_CATALOG.length} exercices).
-- Fichier GÉNÉRÉ par scripts/build-exercise-migration.ts depuis
-- src/domain/exercise-catalog.ts — ne pas modifier à la main.
-- =============================================================================

insert into public.exercise_library (
  slug, name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty,
  is_compound, is_timed, caution_areas, instructions
)
values
${rows.map((row) => `  (${row})`).join(",\n")}
on conflict (slug) where owner_id is null do update set
  name = excluded.name,
  primary_muscle = excluded.primary_muscle,
  secondary_muscles = excluded.secondary_muscles,
  movement_pattern = excluded.movement_pattern,
  equipment = excluded.equipment,
  difficulty = excluded.difficulty,
  is_compound = excluded.is_compound,
  is_timed = excluded.is_timed,
  caution_areas = excluded.caution_areas,
  instructions = excluded.instructions;
`,
);
console.log(`${EXERCISE_CATALOG.length} exercices écrits dans ${output}`);
