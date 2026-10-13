import { z } from "zod";
import { KCAL_PER_GRAM } from "@/domain/energy";
import { requiredNumber } from "@/lib/form-fields";

export const manualTargetsSchema = z
  .object({
    kcal: requiredNumber({ min: 800, max: 8000, integer: true }),
    proteinG: requiredNumber({ min: 0, max: 600, integer: true }),
    fatG: requiredNumber({ min: 0, max: 500, integer: true }),
  })
  .refine(
    (values) =>
      values.proteinG * KCAL_PER_GRAM.protein + values.fatG * KCAL_PER_GRAM.fat <= values.kcal,
    { path: ["proteinG"], message: "macrosTooHigh" },
  );

export type ManualTargetsFormValues = z.input<typeof manualTargetsSchema>;

/** Glucides déduits de l'énergie restante une fois protéines et lipides fixés. */
export function carbsFromRemainder(values: {
  kcal: number;
  proteinG: number;
  fatG: number;
}): number {
  const remaining =
    values.kcal - values.proteinG * KCAL_PER_GRAM.protein - values.fatG * KCAL_PER_GRAM.fat;
  return Math.max(0, Math.round(remaining / KCAL_PER_GRAM.carbs));
}
