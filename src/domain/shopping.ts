/**
 * Liste de courses : quantités nécessaires aux recettes d'un plan, additionnées
 * par aliment et rangées par rayon. Aucun prix n'est inventé : seuls les prix
 * saisis par l'utilisateur sont additionnés.
 */
import type { Aisle } from "./food-classification";

export const AISLE_ORDER: readonly Aisle[] = [
  "produce",
  "bakery",
  "meat_fish",
  "dairy_eggs",
  "grocery",
  "frozen",
  "drinks",
  "other",
];

export type ShoppingRecipe = {
  /** Nombre de portions que donnent les quantités des ingrédients. */
  servings: number;
  ingredients: readonly {
    foodId: string | null;
    name: string;
    quantityG: number;
    isOptional: boolean;
    aisle: Aisle;
  }[];
};

export type ShoppingNeed = {
  foodId: string | null;
  name: string;
  quantityG: number;
  aisle: Aisle;
};

/** Arrondi à l'unité supérieure, par 5 g au-delà de 20 g : on n'achète pas 137,4 g. */
export function roundUpQuantity(grams: number): number {
  if (grams <= 0) return 0;
  if (grams < 20) return Math.ceil(grams);
  return Math.ceil(grams / 5) * 5;
}

/**
 * Additionne les ingrédients de chaque repas planifié, au prorata des portions
 * (`portions` / `servings` de la recette). Les ingrédients optionnels sont omis.
 */
export function aggregateShopping(
  planned: readonly { recipeId: string | null; portions: number }[],
  recipes: ReadonlyMap<string, ShoppingRecipe>,
): ShoppingNeed[] {
  const needs = new Map<string, ShoppingNeed>();
  for (const meal of planned) {
    const recipe = meal.recipeId ? recipes.get(meal.recipeId) : undefined;
    if (!recipe || recipe.servings <= 0) continue;
    const factor = meal.portions / recipe.servings;
    for (const ingredient of recipe.ingredients) {
      if (ingredient.isOptional) continue;
      const key = ingredient.foodId ?? `name:${ingredient.name.trim().toLowerCase()}`;
      const current = needs.get(key);
      const grams = ingredient.quantityG * factor;
      if (current) current.quantityG += grams;
      else {
        needs.set(key, {
          foodId: ingredient.foodId,
          name: ingredient.name,
          quantityG: grams,
          aisle: ingredient.aisle,
        });
      }
    }
  }
  return [...needs.values()]
    .map((need) => ({ ...need, quantityG: roundUpQuantity(need.quantityG) }))
    .sort(
      (a, b) =>
        AISLE_ORDER.indexOf(a.aisle) - AISLE_ORDER.indexOf(b.aisle) ||
        a.name.localeCompare(b.name, "fr"),
    );
}

/** Total des prix connus ; `unpriced` compte les articles sans prix (non estimés). */
export function shoppingTotal(
  items: readonly { estimatedPriceEur: number | null; alreadyOwned: boolean }[],
): { totalEur: number; priced: number; unpriced: number } {
  let total = 0;
  let priced = 0;
  let unpriced = 0;
  for (const item of items) {
    if (item.alreadyOwned) continue;
    if (item.estimatedPriceEur === null) unpriced += 1;
    else {
      priced += 1;
      total += item.estimatedPriceEur;
    }
  }
  return { totalEur: Math.round(total * 100) / 100, priced, unpriced };
}
