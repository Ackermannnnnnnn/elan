import "server-only";
import { randomInt } from "node:crypto";
import {
  type Diet,
  type GeneratedPlan,
  generateMealPlan,
  type MealSlot,
  type MealStyle,
  portionsFor,
  type PlannerRecipe,
  SLOT_SHARES,
} from "@/domain/meal-planner";
import { addDays, type IsoDate } from "@/lib/dates";
import type { Row } from "@/types/database";
import { DataError, fail, getDb } from "./client";
import { listMealCategories } from "./nutrition";
import { getOwnPreferences, getTargetsOn } from "./plan";
import { addRecipeEntry, listRecipes, type Recipe } from "./recipes";

export type MealPlan = Pick<
  Row<"meal_plans">,
  "id" | "week_start" | "target_kcal" | "target_protein_g" | "constraints" | "created_at"
>;
export type MealPlanItem = Pick<
  Row<"meal_plan_items">,
  | "id"
  | "day_index"
  | "meal_slot"
  | "recipe_id"
  | "title"
  | "servings"
  | "kcal"
  | "protein_g"
  | "carbs_g"
  | "fat_g"
  | "logged_at"
>;

const ITEM_COLUMNS =
  "id, day_index, meal_slot, recipe_id, title, servings, kcal, protein_g, carbs_g, fat_g, logged_at" as const;

/** Recette vue par le planificateur. */
export function toPlannerRecipe(recipe: Recipe): PlannerRecipe {
  return {
    id: recipe.id,
    title: recipe.title,
    slots: recipe.slots,
    perServing: {
      kcal: recipe.perServing.kcal,
      proteinG: recipe.perServing.proteinG,
      carbsG: recipe.perServing.carbsG,
      fatG: recipe.perServing.fatG,
    },
    isComplete: recipe.isComplete,
    allergens: recipe.allergens,
    dietClass: recipe.dietClass,
    totalMinutes: recipe.totalMinutes,
    ingredientNames: recipe.ingredients.map((ingredient) => ingredient.name),
  };
}

/** Contraintes du profil, appliquées par le planificateur. */
export async function getPlannerContext() {
  const [preferences, recipes] = await Promise.all([getOwnPreferences(), listRecipes()]);
  return {
    recipes,
    constraints: {
      allergies: preferences?.allergies ?? [],
      excludedIngredients: preferences?.excluded_ingredients ?? [],
      diet: (preferences?.diet_type ?? "omnivore") as Diet,
      maxMinutes: preferences?.cooking_time_minutes ?? null,
      styles: (preferences?.meal_style ?? []) as MealStyle[],
    },
  };
}

export async function getMealPlan(
  weekStart: IsoDate,
): Promise<{ plan: MealPlan; items: MealPlanItem[] } | null> {
  const { supabase, user } = await getDb();
  const { data: plan, error } = await supabase
    .from("meal_plans")
    .select("id, week_start, target_kcal, target_protein_g, constraints, created_at")
    .eq("user_id", user.id)
    .eq("week_start", weekStart)
    .eq("status", "active")
    .maybeSingle();
  if (error) fail("getMealPlan", error);
  if (!plan) return null;

  const { data: items, error: itemsError } = await supabase
    .from("meal_plan_items")
    .select(ITEM_COLUMNS)
    .eq("meal_plan_id", plan.id)
    .eq("user_id", user.id)
    .order("day_index", { ascending: true })
    .order("position", { ascending: true });
  if (itemsError) fail("getMealPlan.items", itemsError);
  return { plan, items };
}

export type GenerationOutcome =
  | { ok: true; plan: GeneratedPlan }
  | { ok: false; reason: "noTargets" | "noRecipes"; plan?: GeneratedPlan };

/**
 * Génère et enregistre le plan d'une semaine (il remplace le précédent, et sa
 * liste de courses est supprimée car elle ne correspond plus).
 */
export async function generateAndSaveMealPlan(weekStart: IsoDate): Promise<GenerationOutcome> {
  const { supabase, user } = await getDb();
  const [targets, context] = await Promise.all([getTargetsOn(weekStart), getPlannerContext()]);
  if (!targets) return { ok: false, reason: "noTargets" };

  const seed = randomInt(0, 2 ** 31);
  const generated = generateMealPlan({
    recipes: context.recipes.map(toPlannerRecipe),
    targets: { kcal: targets.target_kcal, proteinG: targets.protein_g },
    constraints: context.constraints,
    seed,
  });
  if (generated.meals.length === 0) return { ok: false, reason: "noRecipes", plan: generated };

  await deleteMealPlan(weekStart);
  const { data: plan, error } = await supabase
    .from("meal_plans")
    .insert({
      user_id: user.id,
      week_start: weekStart,
      status: "active",
      origin: "generated",
      target_kcal: Math.round(targets.target_kcal),
      target_protein_g: Math.round(targets.protein_g),
      // Instantané des contraintes appliquées, pour pouvoir expliquer le plan.
      constraints: { ...context.constraints, seed, excluded: generated.excluded },
    })
    .select("id")
    .single();
  if (error) fail("generateAndSaveMealPlan", error, "saveFailed");

  const position = new Map<number, number>();
  const { error: itemsError } = await supabase.from("meal_plan_items").insert(
    generated.meals.map((meal) => {
      const index = position.get(meal.dayIndex) ?? 0;
      position.set(meal.dayIndex, index + 1);
      return {
        user_id: user.id,
        meal_plan_id: plan.id,
        day_index: meal.dayIndex,
        meal_slot: meal.slot,
        position: index,
        recipe_id: meal.recipeId,
        title: meal.title.slice(0, 160),
        servings: meal.portions,
        kcal: meal.kcal,
        protein_g: meal.proteinG,
        carbs_g: meal.carbsG,
        fat_g: meal.fatG,
      };
    }),
  );
  if (itemsError) {
    await supabase.from("meal_plans").delete().eq("id", plan.id).eq("user_id", user.id);
    fail("generateAndSaveMealPlan.items", itemsError, "saveFailed");
  }
  return { ok: true, plan: generated };
}

/** Supprime le plan de la semaine et sa liste de courses. */
export async function deleteMealPlan(weekStart: IsoDate): Promise<void> {
  const { supabase, user } = await getDb();
  const { data: plans, error } = await supabase
    .from("meal_plans")
    .select("id")
    .eq("user_id", user.id)
    .eq("week_start", weekStart);
  if (error) fail("deleteMealPlan.find", error, "deleteFailed");
  const ids = plans.map((plan) => plan.id);
  if (ids.length === 0) return;

  const { error: listsError } = await supabase
    .from("shopping_lists")
    .delete()
    .eq("user_id", user.id)
    .in("meal_plan_id", ids);
  if (listsError) fail("deleteMealPlan.lists", listsError, "deleteFailed");
  const { error: deleteError } = await supabase
    .from("meal_plans")
    .delete()
    .eq("user_id", user.id)
    .in("id", ids);
  if (deleteError) fail("deleteMealPlan", deleteError, "deleteFailed");
}

async function getItem(itemId: string) {
  const { supabase, user } = await getDb();
  const { data: item, error } = await supabase
    .from("meal_plan_items")
    .select(`${ITEM_COLUMNS}, meal_plan_id`)
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) fail("getMealPlanItem", error);
  if (!item) throw new DataError("itemNotFound");
  const { data: plan, error: planError } = await supabase
    .from("meal_plans")
    .select("id, week_start, target_kcal")
    .eq("id", item.meal_plan_id)
    .eq("user_id", user.id)
    .single();
  if (planError) fail("getMealPlanItem.plan", planError);
  return { item, plan };
}

/**
 * Remplace la recette d'un repas du plan. Les portions sont recalculées pour
 * viser la même part de la cible journalière que le repas remplacé.
 */
export async function swapMealPlanItem(itemId: string, recipeId: string): Promise<IsoDate> {
  const { supabase, user } = await getDb();
  const { item, plan } = await getItem(itemId);
  const context = await getPlannerContext();
  const recipe = context.recipes.find((candidate) => candidate.id === recipeId);
  if (!recipe || !recipe.slots.includes(item.meal_slot)) throw new DataError("itemNotFound");

  // Même part de la journée que le repas remplacé (ou, à défaut, la part type du repas).
  const target = item.kcal ?? (plan.target_kcal ?? 0) * SLOT_SHARES[item.meal_slot as MealSlot];
  const portions = portionsFor(target, recipe.perServing.kcal);
  const { error } = await supabase
    .from("meal_plan_items")
    .update({
      recipe_id: recipe.id,
      title: recipe.title.slice(0, 160),
      servings: portions,
      kcal: Math.round(recipe.perServing.kcal * portions * 10) / 10,
      protein_g: Math.round(recipe.perServing.proteinG * portions * 10) / 10,
      carbs_g: Math.round(recipe.perServing.carbsG * portions * 10) / 10,
      fat_g: Math.round(recipe.perServing.fatG * portions * 10) / 10,
      logged_at: null,
    })
    .eq("id", item.id)
    .eq("user_id", user.id);
  if (error) fail("swapMealPlanItem", error, "saveFailed");
  return plan.week_start;
}

export async function removeMealPlanItem(itemId: string): Promise<IsoDate> {
  const { supabase, user } = await getDb();
  const { item, plan } = await getItem(itemId);
  const { error } = await supabase
    .from("meal_plan_items")
    .delete()
    .eq("id", item.id)
    .eq("user_id", user.id);
  if (error) fail("removeMealPlanItem", error, "deleteFailed");
  return plan.week_start;
}

/** Enregistre un repas du plan dans le journal du jour correspondant. */
export async function logMealPlanItem(itemId: string, today: IsoDate): Promise<IsoDate> {
  const { supabase, user } = await getDb();
  const { item, plan } = await getItem(itemId);
  const date = addDays(plan.week_start, item.day_index);
  if (date > today) throw new DataError("futureDay");
  if (item.logged_at) throw new DataError("alreadyLogged");
  if (!item.recipe_id) throw new DataError("itemNotFound");

  const categories = await listMealCategories();
  const category = categories.find((candidate) => candidate.key === item.meal_slot);
  if (!category) throw new DataError("itemNotFound");

  await addRecipeEntry({
    date,
    categoryId: category.id,
    recipeId: item.recipe_id,
    portions: item.servings,
    origin: "meal_plan",
  });
  const { error } = await supabase
    .from("meal_plan_items")
    .update({ logged_at: new Date().toISOString() })
    .eq("id", item.id)
    .eq("user_id", user.id);
  if (error) fail("logMealPlanItem", error, "saveFailed");
  return plan.week_start;
}
