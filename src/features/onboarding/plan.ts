import { buildNutritionPlan, type NutritionPlan, type PlanInput } from "@/domain/energy";
import { ageOn, type IsoDate } from "@/lib/dates";
import type { OnboardingValues } from "./schema";

export type PlanPreview = { plan: NutritionPlan; input: PlanInput; age: number };

/**
 * Traduit les réponses de l'onboarding en entrées du moteur de calcul.
 * Utilisé à l'identique dans le navigateur (aperçu) et sur le serveur
 * (enregistrement) : ce que l'utilisateur voit est ce qui est sauvegardé.
 */
export function planFromOnboarding(values: OnboardingValues, today: IsoDate): PlanPreview {
  const age = ageOn(values.birthDate, today);
  const input: PlanInput = {
    age,
    sex: values.sex === "unspecified" ? null : values.sex,
    heightCm: values.heightCm,
    weightKg: values.weightKg,
    activityLevel: values.activityLevel,
    goalType: values.goalType,
    pace: values.pace,
    targetWeightKg: values.targetWeightKg,
  };
  return { plan: buildNutritionPlan(input), input, age };
}
