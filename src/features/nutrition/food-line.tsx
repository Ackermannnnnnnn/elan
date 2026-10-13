import { getFormatter, getTranslations } from "next-intl/server";
import type { Food } from "@/data/nutrition";

/** Résumé d'un aliment sur une ligne : valeurs pour 100 g ou 100 ml. */
export async function FoodPer100({ food }: { food: Food }) {
  const t = await getTranslations("Nutrition.add");
  const tOptions = await getTranslations("Options");
  const format = await getFormatter();
  const number = (value: number) => format.number(value, { maximumFractionDigits: 1 });

  return (
    <>
      {t("per100", {
        basis: food.basis === "100ml" ? "100 ml" : "100 g",
        kcal: number(food.kcal),
        protein: number(food.protein_g),
        carbs: number(food.carbs_g),
        fat: number(food.fat_g),
      })}
      {food.preparation_state === "raw" || food.preparation_state === "cooked"
        ? ` (${tOptions(`preparationState.${food.preparation_state}`).toLowerCase()})`
        : ""}
    </>
  );
}
