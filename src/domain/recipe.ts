/**
 * Apports et caractéristiques d'une recette, calculés à partir de ses
 * ingrédients (valeurs pour 100 g de chaque aliment). Rien n'est estimé : un
 * ingrédient sans aliment rattaché rend le calcul « incomplet ».
 */
import { type FoodPer100, type Macros, macrosForQuantity, sumMacros } from "./nutrition";
import type { DietClass } from "./food-classification";

export type RecipeIngredient = {
  quantityG: number;
  isOptional: boolean;
  /** `null` si l'aliment a été supprimé ou n'a jamais été choisi. */
  food: (FoodPer100 & { allergens: readonly string[]; dietClass: DietClass }) | null;
};

export type RecipeNutrition = {
  total: Macros;
  perServing: Macros;
  /** false si un ingrédient (non optionnel) n'a pas de valeurs nutritionnelles. */
  isComplete: boolean;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Les ingrédients optionnels ne comptent pas : la recette de base est celle qui est cuisinée. */
export function recipeNutrition(
  ingredients: readonly RecipeIngredient[],
  servings: number,
): RecipeNutrition {
  const counted = ingredients.filter((ingredient) => !ingredient.isOptional);
  const isComplete = counted.length > 0 && counted.every((ingredient) => ingredient.food !== null);
  const total = sumMacros(
    counted.flatMap((ingredient) =>
      ingredient.food ? [macrosForQuantity(ingredient.food, ingredient.quantityG)] : [],
    ),
  );
  const divisor = servings > 0 ? servings : 1;
  const totalMacros: Macros = {
    kcal: total.kcal,
    proteinG: total.proteinG,
    carbsG: total.carbsG,
    fatG: total.fatG,
    fiberG: total.fiberIsPartial ? null : total.fiberG,
  };
  return {
    total: totalMacros,
    perServing: scaleMacros(totalMacros, 1 / divisor),
    isComplete,
  };
}

export function scaleMacros(macros: Macros, factor: number): Macros {
  return {
    kcal: round1(macros.kcal * factor),
    proteinG: round1(macros.proteinG * factor),
    carbsG: round1(macros.carbsG * factor),
    fatG: round1(macros.fatG * factor),
    fiberG: macros.fiberG === null ? null : round1(macros.fiberG * factor),
  };
}

const DIET_RANK: Record<Exclude<DietClass, "unknown">, number> = {
  plant: 0,
  vegetarian: 1,
  fish: 2,
  meat: 3,
};

/**
 * Allergènes (union, optionnels compris : on ne sert pas un plat dont la
 * garniture est dangereuse) et classe de régime (la plus restrictive).
 * Un ingrédient inconnu rend la classe « inconnue », sauf si une viande ou un
 * poisson est déjà présent (la recette n'est alors de toute façon pas végétale).
 */
export function recipeTraits(ingredients: readonly RecipeIngredient[]): {
  allergens: string[];
  dietClass: DietClass;
} {
  const allergens = new Set<string>();
  let highest: Exclude<DietClass, "unknown"> = "plant";
  let hasUnknown = ingredients.length === 0;
  for (const ingredient of ingredients) {
    if (!ingredient.food) {
      hasUnknown = true;
      continue;
    }
    for (const code of ingredient.food.allergens) allergens.add(code);
    const dietClass = ingredient.food.dietClass;
    if (dietClass === "unknown") hasUnknown = true;
    else if (DIET_RANK[dietClass] > DIET_RANK[highest]) highest = dietClass;
  }
  const dietClass = hasUnknown && DIET_RANK[highest] < DIET_RANK.fish ? "unknown" : highest;
  return { allergens: [...allergens].sort(), dietClass };
}
