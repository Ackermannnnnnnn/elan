"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ROUTES } from "@/config/routes";
import { normalizeSearch, searchFoods } from "@/data/nutrition";
import { getToday } from "@/data/profile";
import {
  addRecipeEntry,
  addStarterRecipes,
  createRecipe,
  deleteRecipe,
  type RecipeInput,
  updateRecipe,
} from "@/data/recipes";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/run-action";
import { diaryUrl, recipeUrl } from "@/features/nutrition/urls";
import {
  recipeEntrySchema,
  type RecipeEntryFormValues,
  type RecipeFormValues,
  recipeSchema,
} from "./schemas";

const refresh = () => revalidatePath("/", "layout");

const toInput = (values: z.output<typeof recipeSchema>): RecipeInput => ({
  title: values.title,
  description: values.description,
  servings: values.servings,
  prepMinutes: values.prepMinutes,
  cookMinutes: values.cookMinutes,
  slots: values.slots,
  tags: values.tags,
  steps: values.steps,
  ingredients: values.ingredients.map((ingredient) => ({
    foodId: ingredient.foodId,
    quantityG: ingredient.quantityG,
    displayQuantity: ingredient.displayQuantity,
    isOptional: ingredient.isOptional,
  })),
});

export async function createRecipeAction(input: RecipeFormValues): Promise<ActionResult<string>> {
  let id = "";
  const result = await runAction(recipeSchema, input, async (values) => {
    id = await createRecipe(toInput(values));
    refresh();
  });
  if (!result.ok) return result;
  redirect(recipeUrl(id));
}

export async function updateRecipeAction(
  id: string,
  input: RecipeFormValues,
): Promise<ActionResult<string>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, formError: "itemNotFound" };
  const result = await runAction(recipeSchema, input, async (values) => {
    await updateRecipe(id, toInput(values));
    refresh();
  });
  if (!result.ok) return result;
  redirect(recipeUrl(id));
}

export async function deleteRecipeAction(id: string): Promise<ActionResult<string>> {
  const result = await runAction(z.uuid(), id, async (recipeId) => {
    await deleteRecipe(recipeId);
    refresh();
  });
  if (!result.ok) return result;
  redirect(ROUTES.recipes);
}

export async function addStarterRecipesAction(): Promise<ActionResult<string>> {
  let added = 0;
  const result = await runAction(z.undefined(), undefined, async () => {
    added = await addStarterRecipes();
    refresh();
  });
  if (!result.ok) return result;
  return added > 0 ? { ok: true } : { ok: false, formError: "nothingToAdd" };
}

export async function addRecipeEntryAction(
  recipeId: string,
  input: RecipeEntryFormValues,
): Promise<ActionResult<string>> {
  if (!z.uuid().safeParse(recipeId).success) return { ok: false, formError: "itemNotFound" };
  let date = "";
  const result = await runAction(recipeEntrySchema, input, async (values) => {
    // Le journal ne s'écrit pas dans le futur.
    if (values.date > (await getToday()))
      return { ok: false, fieldErrors: { date: "dateInFuture" } };
    await addRecipeEntry({
      date: values.date,
      categoryId: values.categoryId,
      recipeId,
      portions: values.portions,
    });
    date = values.date;
    refresh();
  });
  if (!result.ok) return result;
  redirect(diaryUrl(date));
}

export type FoodOption = {
  id: string;
  name: string;
  brand: string | null;
  kcal: number;
  proteinG: number;
  source: "ciqual" | "open_food_facts" | "user" | "ai_estimate";
};

/** Recherche d'aliments pour le sélecteur d'ingrédients (appelée depuis le navigateur). */
export async function searchFoodOptionsAction(term: string): Promise<FoodOption[]> {
  const parsed = z.string().max(80).safeParse(term);
  if (!parsed.success || normalizeSearch(parsed.data).length < 2) return [];
  try {
    const foods = await searchFoods(parsed.data, 12);
    return foods.map((food) => ({
      id: food.id,
      name: food.name,
      brand: food.brand,
      kcal: food.kcal,
      proteinG: food.protein_g,
      source: food.source,
    }));
  } catch {
    return [];
  }
}
