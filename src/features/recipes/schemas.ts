import { z } from "zod";
import { MEAL_SLOTS } from "@/domain/meal-planner";
import { isoDate, optionalNumber, requiredNumber, tagList } from "@/lib/form-fields";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "textTooLong")
    .transform((value) => (value === "" ? null : value));

// Bornes alignées sur les contraintes CHECK de `recipes` et `recipe_ingredients`.
export const recipeIngredientSchema = z.object({
  foodId: z.uuid("ingredientFood"),
  /** Libellé affiché dans le formulaire ; le serveur reprend le nom de l'aliment. */
  foodName: z.string(),
  quantityG: requiredNumber({ min: 0.1, max: 20000 }),
  displayQuantity: optionalText(60),
  isOptional: z.boolean(),
});

export const recipeSchema = z.object({
  title: z.string().trim().min(1, "required").max(160, "textTooLong"),
  description: optionalText(1000),
  servings: requiredNumber({ min: 0.5, max: 50 }),
  prepMinutes: optionalNumber({ min: 0, max: 600, integer: true }),
  cookMinutes: optionalNumber({ min: 0, max: 600, integer: true }),
  slots: z.preprocess(
    (value) => (Array.isArray(value) ? value : typeof value === "string" ? [value] : []),
    z.array(z.enum(MEAL_SLOTS)),
  ),
  tags: tagList(20),
  /** Une étape par ligne. */
  steps: z
    .string()
    .max(6000, "textTooLong")
    .transform((text) =>
      text
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0)
        .slice(0, 40),
    ),
  ingredients: z
    .array(recipeIngredientSchema)
    .min(1, "ingredientsRequired")
    .max(60, "tooManyItems"),
});

export type RecipeFormValues = z.input<typeof recipeSchema>;
export type RecipeIngredientFormValues = z.input<typeof recipeIngredientSchema>;

export const EMPTY_RECIPE: RecipeFormValues = {
  title: "",
  description: "",
  servings: "2",
  prepMinutes: "",
  cookMinutes: "",
  slots: ["lunch", "dinner"],
  tags: [],
  steps: "",
  ingredients: [],
};

/** Ajout d'une recette au journal : jour, repas, nombre de portions mangées. */
export const recipeEntrySchema = z.object({
  date: isoDate,
  categoryId: z.uuid(),
  portions: requiredNumber({ min: 0.25, max: 20 }),
});
export type RecipeEntryFormValues = z.input<typeof recipeEntrySchema>;
