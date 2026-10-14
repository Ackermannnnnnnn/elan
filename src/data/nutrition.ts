import "server-only";
import {
  type AllergenCode,
  aisleFromName,
  classifyDiet,
  detectAllergens,
} from "@/domain/food-classification";
import { macrosForQuantity } from "@/domain/nutrition";
import type { IsoDate } from "@/lib/dates";
import type { OpenFoodFactsFood } from "@/lib/open-food-facts/map";
import type { Row } from "@/types/database";
import { DataError, fail, getDb } from "./client";

export type Food = Pick<
  Row<"foods">,
  | "id"
  | "owner_id"
  | "source"
  | "data_quality"
  | "name"
  | "brand"
  | "basis"
  | "preparation_state"
  | "kcal"
  | "protein_g"
  | "carbs_g"
  | "fat_g"
  | "fiber_g"
  | "serving_size_g"
  | "serving_label"
  | "package_size_g"
  | "package_label"
  | "source_ref"
  | "allergens"
  | "diet_class"
  | "aisle"
>;

const FOOD_COLUMNS =
  "id, owner_id, source, data_quality, name, brand, basis, preparation_state, kcal, protein_g, carbs_g, fat_g, fiber_g, serving_size_g, serving_label, package_size_g, package_label, source_ref, allergens, diet_class, aisle" as const;

const pickFood = (row: Food): Food => ({
  id: row.id,
  owner_id: row.owner_id,
  source: row.source,
  data_quality: row.data_quality,
  name: row.name,
  brand: row.brand,
  basis: row.basis,
  preparation_state: row.preparation_state,
  kcal: row.kcal,
  protein_g: row.protein_g,
  carbs_g: row.carbs_g,
  fat_g: row.fat_g,
  fiber_g: row.fiber_g,
  serving_size_g: row.serving_size_g,
  serving_label: row.serving_label,
  package_size_g: row.package_size_g ?? null,
  package_label: row.package_label ?? null,
  source_ref: row.source_ref,
  allergens: row.allergens,
  diet_class: row.diet_class,
  aisle: row.aisle,
});

export type MealCategory = Pick<Row<"meal_categories">, "id" | "key" | "label" | "sort_order">;

export type DiaryEntry = Pick<
  Row<"food_diary_entries">,
  | "id"
  | "entry_date"
  | "category_id"
  | "food_id"
  | "recipe_id"
  | "description"
  | "quantity_g"
  | "servings"
  | "kcal"
  | "protein_g"
  | "carbs_g"
  | "fat_g"
  | "fiber_g"
  | "origin"
  | "is_estimate"
>;

const ENTRY_COLUMNS =
  "id, entry_date, category_id, food_id, recipe_id, description, quantity_g, servings, kcal, protein_g, carbs_g, fat_g, fiber_g, origin, is_estimate" as const;

// --- Aliments ----------------------------------------------------------------------

/** Même normalisation que la colonne `search_text` : minuscules, sans accents. */
export function normalizeSearch(term: string): string {
  return term
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9 ]+/g, " ")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 60);
}

/**
 * Recherche parmi les aliments visibles de l'utilisateur : les siens, puis le
 * catalogue partagé CIQUAL (la RLS fait le tri, la fonction `search_foods`
 * classe les résultats). Sans terme : ses propres aliments, les plus récents d'abord.
 */
export async function searchFoods(term: string, limit = 30): Promise<Food[]> {
  const { supabase, user } = await getDb();
  const normalized = normalizeSearch(term);

  if (!normalized) {
    const { data, error } = await supabase
      .from("foods")
      .select(FOOD_COLUMNS)
      .eq("owner_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(limit);
    if (error) fail("searchFoods.own", error);
    return data;
  }

  const { data, error } = await supabase.rpc("search_foods", {
    search: normalized,
    max_results: limit,
  });
  if (error) fail("searchFoods", error);
  return data.map(pickFood);
}

/** Aliments visibles par l'utilisateur, par identifiant (les autres sont ignorés). */
export async function getFoodsByIds(ids: readonly string[]): Promise<Map<string, Food>> {
  const unique = [...new Set(ids)];
  if (unique.length === 0) return new Map();
  const { supabase } = await getDb();
  const { data, error } = await supabase.from("foods").select(FOOD_COLUMNS).in("id", unique);
  if (error) fail("getFoodsByIds", error);
  return new Map(data.map((food) => [food.id, food]));
}

export async function getFood(id: string): Promise<Food | null> {
  const { supabase } = await getDb();
  const { data, error } = await supabase
    .from("foods")
    .select(FOOD_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getFood", error);
  return data;
}

export type FoodInput = {
  name: string;
  brand: string | null;
  basis: "100g" | "100ml";
  preparationState: "raw" | "cooked" | "as_sold" | "unknown";
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  servingSizeG: number | null;
  servingLabel: string | null;
  /** Allergènes cochés par l'utilisateur ; ceux que le nom révèle s'y ajoutent. */
  allergens: readonly AllergenCode[];
};

/**
 * Allergènes : union de la déclaration de l'utilisateur et de ce que le nom
 * révèle (prudence). Régime et rayon sont déduits du nom.
 */
const foodColumns = (input: FoodInput) => {
  const dietClass = classifyDiet(input.name);
  return {
    ...baseFoodColumns(input),
    allergens: [...new Set([...input.allergens, ...detectAllergens(input.name)])].sort(),
    diet_class: dietClass,
    aisle: aisleFromName(input.name, dietClass),
  };
};

const baseFoodColumns = (input: FoodInput) => ({
  name: input.name,
  brand: input.brand,
  basis: input.basis,
  preparation_state: input.preparationState,
  kcal: input.kcal,
  protein_g: input.proteinG,
  carbs_g: input.carbsG,
  fat_g: input.fatG,
  fiber_g: input.fiberG,
  serving_size_g: input.servingSizeG,
  serving_label: input.servingLabel,
});

/** Crée un aliment personnel : privé, et marqué comme saisi par l'utilisateur. */
export async function createFood(input: FoodInput): Promise<string> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("foods")
    .insert({ ...foodColumns(input), owner_id: user.id, source: "user", data_quality: "user" })
    .select("id")
    .single();
  if (error) fail("createFood", error, "saveFailed");
  return data.id;
}

export async function updateFood(id: string, input: FoodInput): Promise<void> {
  const { supabase, user } = await getDb();
  // `owner_id` : on ne modifie que ses propres aliments (la RLS le garantit aussi).
  const { data, error } = await supabase
    .from("foods")
    // Modifié à la main : ce n'est plus la donnée d'origine (Open Food Facts…).
    .update({ ...foodColumns(input), data_quality: "user" })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id");
  if (error) fail("updateFood", error, "saveFailed");
  if (data.length === 0) throw new DataError("itemNotFound");
}

export async function deleteFood(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase.from("foods").delete().eq("id", id).eq("owner_id", user.id);
  if (error) fail("deleteFood", error, "deleteFailed");
}

// --- Catégories de repas ---------------------------------------------------------------

const DEFAULT_CATEGORIES = [
  { key: "breakfast", sort_order: 10 },
  { key: "lunch", sort_order: 20 },
  { key: "dinner", sort_order: 30 },
  { key: "snack", sort_order: 40 },
] as const;

export async function listMealCategories(): Promise<MealCategory[]> {
  const { supabase, user } = await getDb();
  const load = () =>
    supabase
      .from("meal_categories")
      .select("id, key, label, sort_order")
      .eq("user_id", user.id)
      .is("archived_at", null)
      .order("sort_order", { ascending: true });

  const { data, error } = await load();
  if (error) fail("listMealCategories", error);
  if (data.length > 0) return data;

  // Filet de sécurité : compte créé sans le déclencheur d'initialisation.
  const { error: insertError } = await supabase
    .from("meal_categories")
    .insert(DEFAULT_CATEGORIES.map((category) => ({ ...category, user_id: user.id })));
  if (insertError) fail("listMealCategories.seed", insertError);

  const { data: seeded, error: reloadError } = await load();
  if (reloadError) fail("listMealCategories.reload", reloadError);
  return seeded;
}

// --- Journal ---------------------------------------------------------------------------

export async function listDiary(date: IsoDate): Promise<DiaryEntry[]> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("food_diary_entries")
    .select(ENTRY_COLUMNS)
    .eq("user_id", user.id)
    .eq("entry_date", date)
    .order("created_at", { ascending: true });
  if (error) fail("listDiary", error);
  return data;
}

export type DayTotals = { date: IsoDate; kcal: number; proteinG: number; entries: number };

/** Totaux par jour sur une période (pour l'historique des calories et des protéines). */
export async function listDiaryTotals(from: IsoDate, to: IsoDate): Promise<DayTotals[]> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("food_diary_entries")
    .select("entry_date, kcal, protein_g")
    .eq("user_id", user.id)
    .gte("entry_date", from)
    .lte("entry_date", to)
    .limit(5000);
  if (error) fail("listDiaryTotals", error);

  const byDay = new Map<IsoDate, DayTotals>();
  for (const row of data) {
    const day = byDay.get(row.entry_date) ?? {
      date: row.entry_date,
      kcal: 0,
      proteinG: 0,
      entries: 0,
    };
    day.kcal += row.kcal;
    day.proteinG += row.protein_g;
    day.entries += 1;
    byDay.set(row.entry_date, day);
  }
  return [...byDay.values()].map((day) => ({
    ...day,
    kcal: Math.round(day.kcal),
    proteinG: Math.round(day.proteinG),
  }));
}

export async function getDiaryEntry(id: string): Promise<DiaryEntry | null> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("food_diary_entries")
    .select(ENTRY_COLUMNS)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) fail("getDiaryEntry", error);
  return data;
}

/** Quantité consommée : en grammes, ou en portions si l'aliment en définit une. */
export type Quantity = { grams: number } | { servings: number };

function resolveGrams(food: Food, quantity: Quantity): { grams: number; servings: number | null } {
  if ("grams" in quantity) return { grams: quantity.grams, servings: null };
  if (!food.serving_size_g) throw new DataError("servingUndefined");
  return { grams: quantity.servings * food.serving_size_g, servings: quantity.servings };
}

/** Colonnes d'apports FIGÉES au moment de la saisie, calculées par le moteur métier. */
function snapshot(food: Food, quantity: Quantity) {
  const { grams, servings } = resolveGrams(food, quantity);
  const macros = macrosForQuantity(
    {
      kcal: food.kcal,
      proteinG: food.protein_g,
      carbsG: food.carbs_g,
      fatG: food.fat_g,
      fiberG: food.fiber_g,
    },
    grams,
  );
  return {
    food_id: food.id,
    description: food.brand ? `${food.name} (${food.brand})` : food.name,
    quantity_g: Math.round(grams * 10) / 10,
    servings,
    kcal: macros.kcal,
    protein_g: macros.proteinG,
    carbs_g: macros.carbsG,
    fat_g: macros.fatG,
    fiber_g: macros.fiberG,
    // Seules les données vérifiées ou saisies par l'utilisateur ne sont pas des estimations.
    is_estimate: food.data_quality === "estimated",
  };
}

/** Ajoute un aliment au journal. Les apports sont recalculés ici, jamais reçus du navigateur. */
export async function addFoodEntry(input: {
  date: IsoDate;
  categoryId: string;
  foodId: string;
  quantity: Quantity;
}): Promise<void> {
  const { supabase, user } = await getDb();
  const food = await getFood(input.foodId);
  if (!food) throw new DataError("itemNotFound");

  const { error } = await supabase.from("food_diary_entries").insert({
    ...snapshot(food, input.quantity),
    user_id: user.id,
    entry_date: input.date,
    category_id: input.categoryId,
    origin: "manual",
  });
  if (error) fail("addFoodEntry", error, "saveFailed");
}

export type QuickEntryInput = {
  description: string;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

/** Saisie rapide : l'utilisateur déclare lui-même les apports d'un repas. */
export async function addQuickEntry(input: {
  date: IsoDate;
  categoryId: string;
  entry: QuickEntryInput;
}): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase.from("food_diary_entries").insert({
    user_id: user.id,
    entry_date: input.date,
    category_id: input.categoryId,
    description: input.entry.description,
    servings: 1,
    kcal: input.entry.kcal,
    protein_g: input.entry.proteinG,
    carbs_g: input.entry.carbsG,
    fat_g: input.entry.fatG,
    origin: "manual",
  });
  if (error) fail("addQuickEntry", error, "saveFailed");
}

/** Modifie la quantité (les apports sont recalculés) et éventuellement le repas. */
export async function updateFoodEntry(input: {
  id: string;
  categoryId: string;
  quantity: Quantity;
}): Promise<void> {
  const { supabase, user } = await getDb();
  const entry = await getDiaryEntry(input.id);
  if (!entry?.food_id) throw new DataError("itemNotFound");
  const food = await getFood(entry.food_id);
  if (!food) throw new DataError("itemNotFound");

  // On ne touche ni au nom ni au lien vers l'aliment : seuls quantité et apports changent.
  const recalculated = snapshot(food, input.quantity);
  const { error } = await supabase
    .from("food_diary_entries")
    .update({
      category_id: input.categoryId,
      quantity_g: recalculated.quantity_g,
      servings: recalculated.servings,
      kcal: recalculated.kcal,
      protein_g: recalculated.protein_g,
      carbs_g: recalculated.carbs_g,
      fat_g: recalculated.fat_g,
      fiber_g: recalculated.fiber_g,
      is_estimate: recalculated.is_estimate,
    })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) fail("updateFoodEntry", error, "saveFailed");
}

export async function updateQuickEntry(input: {
  id: string;
  categoryId: string;
  entry: QuickEntryInput;
}): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase
    .from("food_diary_entries")
    .update({
      category_id: input.categoryId,
      description: input.entry.description,
      kcal: input.entry.kcal,
      protein_g: input.entry.proteinG,
      carbs_g: input.entry.carbsG,
      fat_g: input.entry.fatG,
    })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) fail("updateQuickEntry", error, "saveFailed");
}

export async function deleteDiaryEntry(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase
    .from("food_diary_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) fail("deleteDiaryEntry", error, "deleteFailed");
}

/**
 * Copie un repas d'un autre jour. Les apports copiés sont ceux enregistrés à
 * l'époque : c'est le même repas, pas un recalcul. Renvoie le nombre de lignes copiées.
 */
export async function copyMeal(input: {
  fromDate: IsoDate;
  toDate: IsoDate;
  categoryId: string;
}): Promise<number> {
  const { supabase, user } = await getDb();
  const source = (await listDiary(input.fromDate)).filter(
    (entry) => entry.category_id === input.categoryId,
  );
  if (source.length === 0) return 0;

  const { error } = await supabase.from("food_diary_entries").insert(
    source.map((entry) => ({
      user_id: user.id,
      entry_date: input.toDate,
      category_id: entry.category_id,
      food_id: entry.food_id,
      recipe_id: entry.recipe_id,
      description: entry.description,
      quantity_g: entry.quantity_g,
      servings: entry.servings,
      kcal: entry.kcal,
      protein_g: entry.protein_g,
      carbs_g: entry.carbs_g,
      fat_g: entry.fat_g,
      fiber_g: entry.fiber_g,
      is_estimate: entry.is_estimate,
      origin: "copy" as const,
    })),
  );
  if (error) fail("copyMeal", error, "saveFailed");
  return source.length;
}

// --- Produits Open Food Facts -----------------------------------------------------------

/** Copie personnelle d'un produit déjà scanné, s'il existe. */
export async function findOwnBarcodeFood(barcode: string): Promise<string | null> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("foods")
    .select("id")
    .eq("owner_id", user.id)
    .eq("source", "open_food_facts")
    .eq("source_ref", barcode)
    .maybeSingle();
  if (error) fail("findOwnBarcodeFood", error);
  return data?.id ?? null;
}

/**
 * Enregistre (ou rafraîchit) la copie personnelle d'un produit Open Food Facts.
 * Données communautaires : marquées comme telles, jamais comme vérifiées.
 */
export async function saveOpenFoodFactsFood(food: OpenFoodFactsFood): Promise<string> {
  const { supabase, user } = await getDb();
  const columns = {
    name: food.name,
    brand: food.brand,
    basis: food.basis,
    preparation_state: "as_sold" as const,
    kcal: food.kcal,
    protein_g: food.proteinG,
    carbs_g: food.carbsG,
    fat_g: food.fatG,
    fiber_g: food.fiberG,
    sugars_g: food.sugarsG,
    saturated_fat_g: food.saturatedFatG,
    salt_g: food.saltG,
    serving_size_g: food.servingSizeG,
    serving_label: food.servingLabel,
    package_size_g: food.packageSizeG,
    package_label: food.packageLabel,
    allergens: food.allergens,
    diet_class: food.dietClass,
    aisle: food.aisle,
    fetched_at: new Date().toISOString(),
  };

  const existing = await findOwnBarcodeFood(food.barcode);
  if (existing) {
    const { error } = await supabase
      .from("foods")
      .update(columns)
      .eq("id", existing)
      .eq("owner_id", user.id);
    if (error) fail("saveOpenFoodFactsFood.update", error, "saveFailed");
    return existing;
  }

  const { data, error } = await supabase
    .from("foods")
    .insert({
      ...columns,
      owner_id: user.id,
      source: "open_food_facts",
      source_ref: food.barcode,
      data_quality: "community",
    })
    .select("id")
    .single();
  if (error) fail("saveOpenFoodFactsFood.insert", error, "saveFailed");
  return data.id;
}
