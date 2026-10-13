/**
 * Transforme la table CIQUAL (ANSES) en migration SQL qui alimente le catalogue
 * partagé `public.foods` (owner_id NULL, source 'ciqual').
 *
 * Source : fichier CSV français de la table Ciqual, séparé par des tabulations
 * (ex. CIQUAL2025_FR_2025_11_03.csv). Licence Ouverte Etalab : réutilisation
 * libre avec mention de la source (« ANSES. Table de composition nutritionnelle
 * des aliments Ciqual »).
 *
 * Usage : node scripts/build-ciqual-migration.ts <fichier.csv> <migration.sql>
 *
 * Règles de lecture des valeurs (documentées dans docs/CALCULS.md) :
 *   « - » ou vide → inconnu · « traces » → 0 · « < x » → x / 2 · « 1,5 » → 1.5
 * Les aliments sans énergie, protéines, glucides ou lipides connus sont écartés,
 * ainsi que les aliments infantiles (application réservée aux adultes).
 */
import { readFileSync, writeFileSync } from "node:fs";
import {
  aisleForCiqual,
  classifyDiet,
  detectAllergens,
  preparationFromName,
} from "../src/domain/food-classification.ts";

const [input, output] = process.argv.slice(2);
if (!input || !output) {
  console.error("Usage : node scripts/build-ciqual-migration.ts <fichier.csv> <migration.sql>");
  process.exit(1);
}

/** Lecteur TSV minimal qui gère les champs entre guillemets (sur plusieurs lignes). */
function parseTsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    if (quoted) {
      if (char === '"' && text[i + 1] === '"') {
        field += '"';
        i += 1;
      } else if (char === '"') {
        quoted = false;
      } else {
        field += char;
      }
    } else if (char === '"' && field === "") {
      quoted = true;
    } else if (char === "\t") {
      row.push(field);
      field = "";
    } else if (char === "\n" || char === "\r") {
      if (char === "\r" && text[i + 1] === "\n") i += 1;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function parseCiqualValue(raw: string | undefined): number | null {
  const value = (raw ?? "").trim();
  if (value === "" || value === "-") return null;
  if (value.toLowerCase() === "traces") return 0;
  const below = /^<\s*([\d,.]+)$/.exec(value);
  if (below?.[1]) return Number(below[1].replace(",", ".")) / 2;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

const rows = parseTsv(readFileSync(input, "utf8")).filter((row) => row.length > 1);
const header = (rows.shift() ?? []).map((cell) => cell.replace(/\s+/g, " ").trim());
const column = (prefix: string) => {
  const index = header.findIndex((cell) => cell.startsWith(prefix));
  if (index < 0) throw new Error(`Colonne introuvable : ${prefix}`);
  return index;
};

const COLUMNS = {
  group: column("alim_grp_code"),
  subgroup: column("alim_ssgrp_code"),
  subsubgroup: column("alim_ssssgrp_code"),
  code: column("alim_code"),
  name: column("alim_nom_fr"),
  kcalEu: column("Energie, Règlement UE N° 1169 2011 (kcal"),
  kcalJones: column("Energie, N x facteur Jones, avec fibres (kcal"),
  protein: column("Protéines, N x facteur de Jones"),
  protein625: column("Protéines, N x 6.25"),
  carbs: column("Glucides"),
  fat: column("Lipides"),
  sugars: column("Sucres"),
  fiber: column("Fibres alimentaires"),
  saturated: column("AG saturés"),
  salt: column("Sel chlorure de sodium"),
};

const round = (value: number | null, digits: number) =>
  value === null ? null : Math.round(value * 10 ** digits) / 10 ** digits;
const clamp = (value: number | null, max: number) =>
  value === null ? null : Math.min(Math.max(value, 0), max);
const sqlText = (value: string) => `'${value.replaceAll("'", "''")}'`;
const sqlNumber = (value: number | null) => (value === null ? "null" : String(value));

type Food = {
  code: string;
  name: string;
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
  fiber: number | null;
  sugars: number | null;
  saturated: number | null;
  salt: number | null;
  allergens: string[];
  aisle: string;
  diet: string;
  preparation: string;
};

const foods: Food[] = [];
const skipped: string[] = [];
for (const row of rows) {
  const cell = (index: number) => row[index] ?? "";
  const group = cell(COLUMNS.group);
  const code = cell(COLUMNS.code).trim();
  const name = cell(COLUMNS.name).replace(/\s+/g, " ").trim();
  // Groupe 00 : aliments « moyens » génériques ; groupe 11 : alimentation infantile.
  if (!code || !name || group === "00" || group === "11") continue;

  const protein =
    parseCiqualValue(cell(COLUMNS.protein)) ?? parseCiqualValue(cell(COLUMNS.protein625));
  const carbs = parseCiqualValue(cell(COLUMNS.carbs));
  const fat = parseCiqualValue(cell(COLUMNS.fat));
  const kcal = parseCiqualValue(cell(COLUMNS.kcalEu)) ?? parseCiqualValue(cell(COLUMNS.kcalJones));
  if (kcal === null || protein === null || carbs === null || fat === null) {
    skipped.push(`${code} ${name}`);
    continue;
  }

  const ciqual = {
    group,
    subgroup: cell(COLUMNS.subgroup),
    subsubgroup: cell(COLUMNS.subsubgroup),
  };
  foods.push({
    code,
    name: name.slice(0, 200),
    kcal: round(clamp(kcal, 900), 1) ?? 0,
    protein: round(clamp(protein, 100), 2) ?? 0,
    carbs: round(clamp(carbs, 100), 2) ?? 0,
    fat: round(clamp(fat, 100), 2) ?? 0,
    fiber: round(clamp(parseCiqualValue(cell(COLUMNS.fiber)), 100), 2),
    sugars: round(clamp(parseCiqualValue(cell(COLUMNS.sugars)), 100), 2),
    saturated: round(clamp(parseCiqualValue(cell(COLUMNS.saturated)), 100), 2),
    salt: round(clamp(parseCiqualValue(cell(COLUMNS.salt)), 100), 2),
    allergens: detectAllergens(name),
    aisle: aisleForCiqual(ciqual),
    diet: classifyDiet(name, ciqual),
    preparation: preparationFromName(name),
  });
}

const values = foods.map(
  (food) =>
    `(${[
      sqlText(food.code),
      sqlText(food.name),
      sqlText(food.preparation),
      sqlNumber(food.kcal),
      sqlNumber(food.protein),
      sqlNumber(food.carbs),
      sqlNumber(food.fat),
      sqlNumber(food.fiber),
      sqlNumber(food.sugars),
      sqlNumber(food.saturated),
      sqlNumber(food.salt),
      `array[${food.allergens.map(sqlText).join(", ")}]::text[]`,
      sqlText(food.aisle),
      sqlText(food.diet),
    ].join(", ")})`,
);

const CHUNK = 400;
const statements: string[] = [];
for (let start = 0; start < values.length; start += CHUNK) {
  statements.push(`insert into public.foods (
  source, data_quality, basis, fetched_at,
  source_ref, name, preparation_state, kcal, protein_g, carbs_g, fat_g, fiber_g, sugars_g,
  saturated_fat_g, salt_g, allergens, aisle, diet_class
)
select 'ciqual', 'verified', '100g', timestamptz '2025-11-03', v.*
from (values
${values.slice(start, start + CHUNK).join(",\n")}
) as v (source_ref, name, preparation_state, kcal, protein_g, carbs_g, fat_g, fiber_g, sugars_g, saturated_fat_g, salt_g, allergens, aisle, diet_class)
on conflict (source, source_ref) where owner_id is null do update set
  name = excluded.name,
  preparation_state = excluded.preparation_state,
  kcal = excluded.kcal,
  protein_g = excluded.protein_g,
  carbs_g = excluded.carbs_g,
  fat_g = excluded.fat_g,
  fiber_g = excluded.fiber_g,
  sugars_g = excluded.sugars_g,
  saturated_fat_g = excluded.saturated_fat_g,
  salt_g = excluded.salt_g,
  allergens = excluded.allergens,
  aisle = excluded.aisle,
  diet_class = excluded.diet_class,
  fetched_at = excluded.fetched_at;`);
}

writeFileSync(
  output,
  `-- =============================================================================
-- Catalogue partagé : table CIQUAL 2025 (ANSES), ${foods.length} aliments.
-- Fichier GÉNÉRÉ par scripts/build-ciqual-migration.ts — ne pas modifier à la main.
-- Source : ANSES. Table de composition nutritionnelle des aliments Ciqual 2025.
-- Licence Ouverte Etalab. Valeurs pour 100 g.
-- Allergènes, régime et rayon : déduits du nom et du groupe par le code (prudence).
-- =============================================================================

${statements.join("\n\n")}
`,
);

console.log(`${foods.length} aliments écrits dans ${output}`);
console.log(`${skipped.length} aliments écartés (valeurs principales inconnues)`);
if (process.env.VERBOSE) for (const line of skipped) console.log(`  écarté : ${line}`);
