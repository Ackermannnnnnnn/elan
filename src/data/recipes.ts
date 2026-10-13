import "server-only";
import type { DietClass } from "@/domain/food-classification";
import type { MealSlot } from "@/domain/meal-planner";
import type { Macros } from "@/domain/nutrition";
import { type RecipeIngredient, recipeNutrition, recipeTraits, scaleMacros } from "@/domain/recipe";
import { STARTER_RECIPES } from "@/features/recipes/starter-recipes";
import type { IsoDate } from "@/lib/dates";
import type { Row } from "@/types/database";
import { DataError, fail, getDb } from "./client";
import { type Food, getFoodsByIds } from "./nutrition";

const RECIPE_COLUMNS =
  "id, title, description, origin, servings, prep_minutes, cook_minutes, difficulty, steps, tags, meal_slots, starter_key, is_favorite, created_at" as const;
const INGREDIENT_COLUMNS =
  "id, recipe_id, food_id, name, quantity_g, display_quantity, is_optional, position" as const;

type RecipeRow = Pick<
  Row<"recipes">,
  | "id"
  | "title"
  | "description"
  | "origin"
  | "servings"
  | "prep_minutes"
  | "cook_minutes"
  | "difficulty"
  | "steps"
  | "tags"
  | "meal_slots"
  | "starter_key"
  | "is_favorite"
  | "created_at"
>;
type IngredientRow = Pick<
  Row<"recipe_ingredients">,
  | "id"
  | "recipe_id"
  | "food_id"
  | "name"
  | "quantity_g"
  | "display_quantity"
  | "is_optional"
  | "position"
>;

export type RecipeIngredientView = {
  id: string;
  foodId: string | null;
  name: string;
  quantityG: number;
  displayQuantity: string | null;
  isOptional: boolean;
  food: Food | null;
};

/** Recette avec ses apports et ses caractéristiques, recalculés à chaque lecture. */
export type Recipe = {
  id: string;
  title: string;
  description: string | null;
  origin: RecipeRow["origin"];
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  totalMinutes: number | null;
  difficulty: RecipeRow["difficulty"];
  steps: string[];
  tags: string[];
  slots: MealSlot[];
  starterKey: string | null;
  ingredients: RecipeIngredientView[];
  perServing: Macros;
  isComplete: boolean;
  allergens: string[];
  dietClass: DietClass;
};

function toDomainIngredient(ingredient: RecipeIngredientView): RecipeIngredient {
  const { food } = ingredient;
  return {
    quantityG: ingredient.quantityG,
    isOptional: ingredient.isOptional,
    food: food
      ? {
          kcal: food.kcal,
          proteinG: food.protein_g,
          carbsG: food.carbs_g,
          fatG: food.fat_g,
          fiberG: food.fiber_g,
          allergens: food.allergens,
          dietClass: food.diet_class,
        }
      : null,
  };
}

function assemble(row: RecipeRow, rows: IngredientRow[], foods: Map<string, Food>): Recipe {
  const ingredients = rows
    .filter((ingredient) => ingredient.recipe_id === row.id)
    .sort((a, b) => a.position - b.position)
    .map((ingredient) => ({
      id: ingredient.id,
      foodId: ingredient.food_id,
      name: ingredient.name,
      quantityG: ingredient.quantity_g,
      displayQuantity: ingredient.display_quantity,
      isOptional: ingredient.is_optional,
      food: ingredient.food_id ? (foods.get(ingredient.food_id) ?? null) : null,
    }));
  const domain = ingredients.map(toDomainIngredient);
  const nutrition = recipeNutrition(domain, row.servings);
  const traits = recipeTraits(domain);
  const steps = Array.isArray(row.steps)
    ? row.steps.filter((step): step is string => typeof step === "string")
    : [];
  const total =
    row.prep_minutes === null && row.cook_minutes === null
      ? null
      : (row.prep_minutes ?? 0) + (row.cook_minutes ?? 0);
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    origin: row.origin,
    servings: row.servings,
    prepMinutes: row.prep_minutes,
    cookMinutes: row.cook_minutes,
    totalMinutes: total,
    difficulty: row.difficulty,
    steps,
    tags: row.tags,
    slots: row.meal_slots,
    starterKey: row.starter_key,
    ingredients,
    perServing: nutrition.perServing,
    isComplete: nutrition.isComplete,
    allergens: traits.allergens,
    dietClass: traits.dietClass,
  };
}

/** Toutes les recettes de l'utilisateur, apports calculés depuis les aliments actuels. */
export async function listRecipes(): Promise<Recipe[]> {
  const { supabase, user } = await getDb();
  const [recipes, ingredients] = await Promise.all([
    supabase
      .from("recipes")
      .select(RECIPE_COLUMNS)
      .eq("user_id", user.id)
      .order("title", { ascending: true })
      .limit(500),
    supabase
      .from("recipe_ingredients")
      .select(INGREDIENT_COLUMNS)
      .eq("user_id", user.id)
      .limit(10000),
  ]);
  if (recipes.error) fail("listRecipes", recipes.error);
  if (ingredients.error) fail("listRecipes.ingredients", ingredients.error);
  const foods = await getFoodsByIds(
    ingredients.data.flatMap((ingredient) => (ingredient.food_id ? [ingredient.food_id] : [])),
  );
  return recipes.data.map((row) => assemble(row, ingredients.data, foods));
}

export async function getRecipe(id: string): Promise<Recipe | null> {
  const { supabase, user } = await getDb();
  const { data: row, error } = await supabase
    .from("recipes")
    .select(RECIPE_COLUMNS)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) fail("getRecipe", error);
  if (!row) return null;

  const { data: ingredients, error: ingredientsError } = await supabase
    .from("recipe_ingredients")
    .select(INGREDIENT_COLUMNS)
    .eq("recipe_id", id)
    .eq("user_id", user.id);
  if (ingredientsError) fail("getRecipe.ingredients", ingredientsError);
  const foods = await getFoodsByIds(
    ingredients.flatMap((ingredient) => (ingredient.food_id ? [ingredient.food_id] : [])),
  );
  return assemble(row, ingredients, foods);
}

export type RecipeInput = {
  title: string;
  description: string | null;
  servings: number;
  prepMinutes: number | null;
  cookMinutes: number | null;
  slots: MealSlot[];
  tags: string[];
  steps: string[];
  ingredients: {
    foodId: string;
    quantityG: number;
    displayQuantity: string | null;
    isOptional: boolean;
  }[];
};

/** Colonnes d'apports mises en cache dans la table (les pages recalculent toujours). */
function cachedNutrition(ingredients: RecipeIngredient[], servings: number) {
  const nutrition = recipeNutrition(ingredients, servings);
  return {
    kcal_per_serving: nutrition.perServing.kcal,
    protein_g_per_serving: nutrition.perServing.proteinG,
    carbs_g_per_serving: nutrition.perServing.carbsG,
    fat_g_per_serving: nutrition.perServing.fatG,
    nutrition_is_complete: nutrition.isComplete,
  };
}

async function resolveIngredients(input: RecipeInput) {
  const foods = await getFoodsByIds(input.ingredients.map((ingredient) => ingredient.foodId));
  // Un aliment inconnu ou invisible (supprimé, ou appartenant à quelqu'un d'autre) est refusé.
  if (input.ingredients.some((ingredient) => !foods.has(ingredient.foodId))) {
    throw new DataError("itemNotFound");
  }
  const rows = input.ingredients.map((ingredient, position) => {
    const food = foods.get(ingredient.foodId) as Food;
    return {
      food_id: food.id,
      name: food.brand ? `${food.name} (${food.brand})` : food.name,
      quantity_g: ingredient.quantityG,
      display_quantity: ingredient.displayQuantity,
      is_optional: ingredient.isOptional,
      position,
    };
  });
  const domain: RecipeIngredient[] = input.ingredients.map((ingredient) => {
    const food = foods.get(ingredient.foodId) as Food;
    return {
      quantityG: ingredient.quantityG,
      isOptional: ingredient.isOptional,
      food: {
        kcal: food.kcal,
        proteinG: food.protein_g,
        carbsG: food.carbs_g,
        fatG: food.fat_g,
        fiberG: food.fiber_g,
        allergens: food.allergens,
        dietClass: food.diet_class,
      },
    };
  });
  return { rows, domain };
}

const recipeColumns = (input: RecipeInput) => ({
  title: input.title,
  description: input.description,
  servings: input.servings,
  prep_minutes: input.prepMinutes,
  cook_minutes: input.cookMinutes,
  meal_slots: input.slots,
  tags: input.tags,
  steps: input.steps,
});

export async function createRecipe(input: RecipeInput): Promise<string> {
  const { supabase, user } = await getDb();
  const { rows, domain } = await resolveIngredients(input);
  const { data, error } = await supabase
    .from("recipes")
    .insert({
      ...recipeColumns(input),
      ...cachedNutrition(domain, input.servings),
      user_id: user.id,
      origin: "user",
    })
    .select("id")
    .single();
  if (error) fail("createRecipe", error, "saveFailed");

  const { error: ingredientsError } = await supabase
    .from("recipe_ingredients")
    .insert(rows.map((row) => ({ ...row, user_id: user.id, recipe_id: data.id })));
  if (ingredientsError) {
    // Pas de recette sans ingrédients : on annule la création.
    await supabase.from("recipes").delete().eq("id", data.id).eq("user_id", user.id);
    fail("createRecipe.ingredients", ingredientsError, "saveFailed");
  }
  return data.id;
}

export async function updateRecipe(id: string, input: RecipeInput): Promise<void> {
  const { supabase, user } = await getDb();
  const { rows, domain } = await resolveIngredients(input);
  const { data, error } = await supabase
    .from("recipes")
    .update({ ...recipeColumns(input), ...cachedNutrition(domain, input.servings) })
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) fail("updateRecipe", error, "saveFailed");
  if (data.length === 0) throw new DataError("itemNotFound");

  const { error: deleteError } = await supabase
    .from("recipe_ingredients")
    .delete()
    .eq("recipe_id", id)
    .eq("user_id", user.id);
  if (deleteError) fail("updateRecipe.clear", deleteError, "saveFailed");
  const { error: insertError } = await supabase
    .from("recipe_ingredients")
    .insert(rows.map((row) => ({ ...row, user_id: user.id, recipe_id: id })));
  if (insertError) fail("updateRecipe.ingredients", insertError, "saveFailed");
}

export async function deleteRecipe(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase.from("recipes").delete().eq("id", id).eq("user_id", user.id);
  if (error) fail("deleteRecipe", error, "deleteFailed");
}

/**
 * Copie les recettes de départ que l'utilisateur n'a pas encore. Les
 * ingrédients pointent vers le catalogue CIQUAL partagé. Renvoie le nombre ajouté.
 */
export async function addStarterRecipes(): Promise<number> {
  const { supabase, user } = await getDb();
  const { data: existing, error: existingError } = await supabase
    .from("recipes")
    .select("starter_key")
    .eq("user_id", user.id)
    .not("starter_key", "is", null);
  if (existingError) fail("addStarterRecipes.existing", existingError);
  const owned = new Set(existing.map((row) => row.starter_key));
  const missing = STARTER_RECIPES.filter((recipe) => !owned.has(recipe.key));
  if (missing.length === 0) return 0;

  const codes = [...new Set(missing.flatMap((recipe) => recipe.ingredients.map((i) => i.ciqual)))];
  const { data: foods, error: foodsError } = await supabase
    .from("foods")
    .select("id, source_ref, name, kcal, protein_g, carbs_g, fat_g, fiber_g, allergens, diet_class")
    .eq("source", "ciqual")
    .is("owner_id", null)
    .in("source_ref", codes);
  if (foodsError) fail("addStarterRecipes.foods", foodsError);
  const byCode = new Map(foods.map((food) => [food.source_ref, food]));
  // Catalogue absent (migration CIQUAL non appliquée) : rien n'est copié.
  if (codes.some((code) => !byCode.has(code))) throw new DataError("catalogueMissing");

  const { data: inserted, error: insertError } = await supabase
    .from("recipes")
    .insert(
      missing.map((recipe) => {
        const domain: RecipeIngredient[] = recipe.ingredients.map((ingredient) => {
          const food = byCode.get(ingredient.ciqual);
          return {
            quantityG: ingredient.grams,
            isOptional: ingredient.optional ?? false,
            food: food
              ? {
                  kcal: food.kcal,
                  proteinG: food.protein_g,
                  carbsG: food.carbs_g,
                  fatG: food.fat_g,
                  fiberG: food.fiber_g,
                  allergens: food.allergens,
                  dietClass: food.diet_class,
                }
              : null,
          };
        });
        return {
          user_id: user.id,
          origin: "starter" as const,
          starter_key: recipe.key,
          title: recipe.title,
          description: recipe.description,
          servings: recipe.servings,
          prep_minutes: recipe.prepMinutes,
          cook_minutes: recipe.cookMinutes,
          difficulty: recipe.difficulty,
          meal_slots: recipe.slots,
          tags: recipe.tags,
          steps: recipe.steps,
          ...cachedNutrition(domain, recipe.servings),
        };
      }),
    )
    .select("id, starter_key");
  if (insertError) fail("addStarterRecipes.recipes", insertError, "saveFailed");

  const idByKey = new Map(inserted.map((row) => [row.starter_key, row.id]));
  const ingredientRows = missing.flatMap((recipe) => {
    const recipeId = idByKey.get(recipe.key);
    if (!recipeId) return [];
    return recipe.ingredients.map((ingredient, position) => {
      const food = byCode.get(ingredient.ciqual);
      return {
        user_id: user.id,
        recipe_id: recipeId,
        food_id: food?.id ?? null,
        name: food?.name ?? ingredient.ciqual,
        quantity_g: ingredient.grams,
        display_quantity: ingredient.display ?? null,
        is_optional: ingredient.optional ?? false,
        position,
      };
    });
  });
  const { error: ingredientsError } = await supabase
    .from("recipe_ingredients")
    .insert(ingredientRows);
  if (ingredientsError) {
    await supabase
      .from("recipes")
      .delete()
      .eq("user_id", user.id)
      .in(
        "id",
        inserted.map((row) => row.id),
      );
    fail("addStarterRecipes.ingredients", ingredientsError, "saveFailed");
  }
  return inserted.length;
}

/** Ajoute des portions d'une recette au journal. Apports figés, calculés ici. */
export async function addRecipeEntry(input: {
  date: IsoDate;
  categoryId: string;
  recipeId: string;
  portions: number;
  origin?: "manual" | "meal_plan";
}): Promise<void> {
  const { supabase, user } = await getDb();
  const recipe = await getRecipe(input.recipeId);
  if (!recipe) throw new DataError("itemNotFound");
  const macros = scaleMacros(recipe.perServing, input.portions);
  const { error } = await supabase.from("food_diary_entries").insert({
    user_id: user.id,
    entry_date: input.date,
    category_id: input.categoryId,
    recipe_id: recipe.id,
    description: recipe.title.slice(0, 200),
    servings: input.portions,
    kcal: macros.kcal,
    protein_g: macros.proteinG,
    carbs_g: macros.carbsG,
    fat_g: macros.fatG,
    fiber_g: macros.fiberG,
    origin: input.origin ?? "manual",
    // Recette dont un ingrédient n'a pas de valeurs : le total est un minimum.
    is_estimate: !recipe.isComplete,
  });
  if (error) fail("addRecipeEntry", error, "saveFailed");
}

/** Modifie le nombre de portions d'une recette du journal (apports recalculés). */
export async function updateRecipeEntry(input: {
  id: string;
  categoryId: string;
  portions: number;
}): Promise<void> {
  const { supabase, user } = await getDb();
  const { data: entry, error: entryError } = await supabase
    .from("food_diary_entries")
    .select("id, recipe_id")
    .eq("id", input.id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (entryError) fail("updateRecipeEntry.find", entryError);
  if (!entry?.recipe_id) throw new DataError("itemNotFound");
  const recipe = await getRecipe(entry.recipe_id);
  if (!recipe) throw new DataError("itemNotFound");

  const macros = scaleMacros(recipe.perServing, input.portions);
  const { error } = await supabase
    .from("food_diary_entries")
    .update({
      category_id: input.categoryId,
      servings: input.portions,
      kcal: macros.kcal,
      protein_g: macros.proteinG,
      carbs_g: macros.carbsG,
      fat_g: macros.fatG,
      fiber_g: macros.fiberG,
      is_estimate: !recipe.isComplete,
    })
    .eq("id", input.id)
    .eq("user_id", user.id);
  if (error) fail("updateRecipeEntry", error, "saveFailed");
}
