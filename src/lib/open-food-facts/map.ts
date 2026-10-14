/**
 * Conversion d'une fiche produit Open Food Facts (API v2) en aliment Élan.
 * Les valeurs nutritionnelles viennent des champs « _100g » ; un produit sans
 * énergie, protéines, glucides ou lipides n'est pas importé (pas d'estimation).
 * Données Open Food Facts : licence ODbL, à créditer dans l'interface.
 */
import { z } from "zod";
import {
  type Aisle,
  type AllergenCode,
  classifyDiet,
  type DietClass,
  detectAllergens,
} from "@/domain/food-classification";

/** Code-barres EAN-8, UPC-A, EAN-13 ou GTIN-14. */
export function normalizeBarcode(raw: string): string | null {
  const digits = raw.replace(/[\s-]/g, "");
  return /^\d{8,14}$/.test(digits) ? digits : null;
}

const number = z.preprocess(
  (value) => (typeof value === "string" && value.trim() !== "" ? Number(value) : value),
  z.number().finite().nonnegative(),
);
const optionalNumber = number.optional().catch(undefined);
const tags = z.array(z.string()).optional().catch(undefined);
const text = z.string().trim().optional().catch(undefined);

const productSchema = z.object({
  product_name_fr: text,
  product_name: text,
  generic_name_fr: text,
  brands: text,
  serving_quantity: optionalNumber,
  serving_size: text,
  product_quantity: optionalNumber,
  product_quantity_unit: text,
  quantity: text,
  allergens_tags: tags,
  traces_tags: tags,
  ingredients_analysis_tags: tags,
  categories_tags: tags,
  nutriments: z
    .object({
      "energy-kcal_100g": optionalNumber,
      energy_100g: optionalNumber,
      proteins_100g: optionalNumber,
      carbohydrates_100g: optionalNumber,
      fat_100g: optionalNumber,
      fiber_100g: optionalNumber,
      sugars_100g: optionalNumber,
      "saturated-fat_100g": optionalNumber,
      salt_100g: optionalNumber,
    })
    .optional()
    .catch(undefined),
});

export const openFoodFactsResponseSchema = z.object({
  status: z.preprocess((value) => Number(value), z.number()),
  product: z.unknown().optional(),
});

/** Étiquettes OFF des 14 allergènes UE. */
const ALLERGEN_TAGS: Record<string, AllergenCode> = {
  "en:gluten": "gluten",
  "en:crustaceans": "crustaceans",
  "en:eggs": "eggs",
  "en:fish": "fish",
  "en:peanuts": "peanuts",
  "en:soybeans": "soy",
  "en:milk": "milk",
  "en:nuts": "nuts",
  "en:celery": "celery",
  "en:mustard": "mustard",
  "en:sesame-seeds": "sesame",
  "en:sulphur-dioxide-and-sulphites": "sulphites",
  "en:lupin": "lupin",
  "en:molluscs": "molluscs",
};

export type OpenFoodFactsFood = {
  barcode: string;
  name: string;
  brand: string | null;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  sugarsG: number | null;
  saturatedFatG: number | null;
  saltG: number | null;
  servingSizeG: number | null;
  servingLabel: string | null;
  /** Contenu de l'emballage (g ou ml), ex. 330 pour une canette de 33 cl. */
  packageSizeG: number | null;
  packageLabel: string | null;
  /** Valeurs pour 100 ml (boisson) ou pour 100 g. */
  basis: "100g" | "100ml";
  allergens: AllergenCode[];
  dietClass: DietClass;
  aisle: Aisle;
};

export type MapResult =
  { ok: true; food: OpenFoodFactsFood } | { ok: false; reason: "notFound" | "incomplete" };

const round = (value: number, digits: number) => Math.round(value * 10 ** digits) / 10 ** digits;
const within = (value: number | undefined, max: number) =>
  value === undefined ? undefined : Math.min(value, max);

function dietFromAnalysis(tagsList: readonly string[], name: string): DietClass {
  if (tagsList.includes("en:vegan")) return "plant";
  const byName = classifyDiet(name);
  if (tagsList.includes("en:non-vegetarian")) return byName === "fish" ? "fish" : "meat";
  if (tagsList.includes("en:vegetarian") && tagsList.includes("en:non-vegan")) {
    return byName === "plant" || byName === "unknown" ? "vegetarian" : byName;
  }
  if (tagsList.includes("en:vegetarian")) return byName === "unknown" ? "vegetarian" : byName;
  return byName;
}

function aisleFromCategories(categories: readonly string[]): Aisle {
  const has = (...tagsToFind: string[]) => tagsToFind.some((tag) => categories.includes(tag));
  if (has("en:frozen-foods")) return "frozen";
  if (has("en:meats", "en:fishes", "en:seafood", "en:poultries")) return "meat_fish";
  if (has("en:dairies", "en:eggs", "en:cheeses", "en:yogurts")) return "dairy_eggs";
  if (has("en:breads", "en:viennoiseries")) return "bakery";
  if (has("en:beverages")) return "drinks";
  if (has("en:fresh-vegetables", "en:fresh-fruits")) return "produce";
  return "grocery";
}

export function mapOpenFoodFactsProduct(barcode: string, payload: unknown): MapResult {
  const response = openFoodFactsResponseSchema.safeParse(payload);
  if (!response.success || response.data.status !== 1 || !response.data.product) {
    return { ok: false, reason: "notFound" };
  }
  const parsed = productSchema.safeParse(response.data.product);
  if (!parsed.success) return { ok: false, reason: "incomplete" };
  const product = parsed.data;

  const name = (product.product_name_fr || product.product_name || product.generic_name_fr || "")
    .replace(/\s+/g, " ")
    .slice(0, 200);
  const nutriments = product.nutriments ?? {};
  const kcal =
    nutriments["energy-kcal_100g"] ??
    (nutriments.energy_100g === undefined ? undefined : nutriments.energy_100g / 4.184);
  const protein = nutriments.proteins_100g;
  const carbs = nutriments.carbohydrates_100g;
  const fat = nutriments.fat_100g;
  if (
    !name ||
    kcal === undefined ||
    protein === undefined ||
    carbs === undefined ||
    fat === undefined
  ) {
    return { ok: false, reason: "incomplete" };
  }
  // Valeurs hors des bornes physiques : fiche erronée, on ne l'importe pas.
  if (kcal > 900 || protein > 100 || carbs > 100 || fat > 100)
    return { ok: false, reason: "incomplete" };

  const allergens = new Set<AllergenCode>(detectAllergens(name));
  for (const tag of [...(product.allergens_tags ?? []), ...(product.traces_tags ?? [])]) {
    const code = ALLERGEN_TAGS[tag];
    if (code) allergens.add(code);
  }

  const servingSizeG =
    product.serving_quantity !== undefined &&
    product.serving_quantity > 0 &&
    product.serving_quantity <= 5000
      ? round(product.serving_quantity, 1)
      : null;
  const brand = product.brands?.split(",")[0]?.trim().slice(0, 120) || null;
  const packageSizeG =
    product.product_quantity !== undefined &&
    product.product_quantity > 0 &&
    product.product_quantity <= 10000
      ? round(product.product_quantity, 1)
      : null;
  // Boisson : quantité exprimée en ml, cl ou l (les valeurs « _100g » d'OFF sont alors pour 100 ml).
  const liquid =
    product.product_quantity_unit?.toLowerCase() === "ml" ||
    /\d\s*(ml|cl|l)\b/i.test(product.quantity ?? "");

  return {
    ok: true,
    food: {
      barcode,
      name,
      brand,
      kcal: round(kcal, 1),
      proteinG: round(protein, 2),
      carbsG: round(carbs, 2),
      fatG: round(fat, 2),
      fiberG: nullable(within(nutriments.fiber_100g, 100)),
      sugarsG: nullable(within(nutriments.sugars_100g, 100)),
      saturatedFatG: nullable(within(nutriments["saturated-fat_100g"], 100)),
      saltG: nullable(within(nutriments.salt_100g, 100)),
      servingSizeG,
      servingLabel: servingSizeG ? (product.serving_size?.slice(0, 60) ?? null) : null,
      packageSizeG,
      packageLabel: packageSizeG ? (product.quantity?.slice(0, 60) ?? null) : null,
      basis: liquid ? "100ml" : "100g",
      allergens: [...allergens].sort(),
      dietClass: dietFromAnalysis(product.ingredients_analysis_tags ?? [], name),
      aisle: aisleFromCategories(product.categories_tags ?? []),
    },
  };
}

const nullable = (value: number | undefined) => (value === undefined ? null : round(value, 2));
