import { z } from "zod";
import { ALLERGEN_CODES } from "@/domain/food-classification";
import { isoDate, optionalNumber, requiredNumber } from "@/lib/form-fields";

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max, "textTooLong")
    .transform((value) => (value === "" ? null : value));

// Bornes alignées sur les contraintes CHECK de la table `foods`.
export const foodSchema = z
  .object({
    name: z.string().trim().min(1, "required").max(200, "textTooLong"),
    brand: optionalText(120),
    basis: z.enum(["100g", "100ml"]),
    preparationState: z.enum(["as_sold", "raw", "cooked", "unknown"]),
    kcal: requiredNumber({ min: 0, max: 900 }),
    proteinG: requiredNumber({ min: 0, max: 100 }),
    carbsG: requiredNumber({ min: 0, max: 100 }),
    fatG: requiredNumber({ min: 0, max: 100 }),
    fiberG: optionalNumber({ min: 0, max: 100 }),
    servingSizeG: optionalNumber({ min: 0.1, max: 5000 }),
    servingLabel: optionalText(60),
    // Une case cochée seule peut arriver sous forme de chaîne, aucune sous forme de `false`.
    allergens: z.preprocess(
      (value) => (Array.isArray(value) ? value : typeof value === "string" ? [value] : []),
      z.array(z.enum(ALLERGEN_CODES)),
    ),
  })
  .refine((values) => values.proteinG + values.carbsG + values.fatG <= 100.5, {
    path: ["carbsG"],
    message: "macrosOver100",
  });

export const quantitySchema = z
  .object({
    unit: z.enum(["grams", "servings"]),
    quantity: requiredNumber({ min: 0.1, max: 5000 }),
  })
  .refine((values) => values.unit === "grams" || values.quantity <= 50, {
    path: ["quantity"],
    message: "servingsTooMany",
  });

export const quickEntrySchema = z.object({
  description: z.string().trim().min(1, "required").max(200, "textTooLong"),
  kcal: requiredNumber({ min: 0, max: 20000 }),
  proteinG: requiredNumber({ min: 0, max: 2000 }),
  carbsG: requiredNumber({ min: 0, max: 2000 }),
  fatG: requiredNumber({ min: 0, max: 2000 }),
});

/** Portions d'une recette enregistrée dans le journal. */
export const portionsSchema = z.object({ portions: requiredNumber({ min: 0.25, max: 20 }) });
export type PortionsFormValues = z.input<typeof portionsSchema>;

/** Contexte d'une entrée de journal : quel jour, quel repas. */
export const slotSchema = z.object({ date: isoDate, categoryId: z.uuid() });

export type FoodFormValues = z.input<typeof foodSchema>;
export type QuantityFormValues = z.input<typeof quantitySchema>;
export type QuickEntryFormValues = z.input<typeof quickEntrySchema>;
export type Slot = z.infer<typeof slotSchema>;

export const EMPTY_FOOD: FoodFormValues = {
  name: "",
  brand: "",
  basis: "100g",
  preparationState: "as_sold",
  kcal: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
  fiberG: "",
  servingSizeG: "",
  servingLabel: "",
  allergens: [],
};
