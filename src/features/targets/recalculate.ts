import "server-only";
import { DataError } from "@/data/client";
import { getActiveGoal, getTargetsOn, saveTargets } from "@/data/plan";
import { getOwnProfile, getToday } from "@/data/profile";
import { listWeights } from "@/data/tracking";
import {
  ACTIVITY_LEVELS,
  buildNutritionPlan,
  PACES,
  type NutritionPlan,
  type PlanInput,
} from "@/domain/energy";
import { ageOn, type IsoDate } from "@/lib/dates";

export type CurrentPlan = {
  plan: NutritionPlan;
  input: PlanInput;
  goalId: string | null;
  today: IsoDate;
};

/**
 * Reconstruit le plan à partir du profil enregistré et de la DERNIÈRE pesée.
 * Renvoie `null` si le profil est incomplet (onboarding non terminé).
 */
export async function buildCurrentPlan(): Promise<CurrentPlan | null> {
  const today = await getToday();
  const [profile, goal, targets, weights] = await Promise.all([
    getOwnProfile(),
    getActiveGoal(),
    getTargetsOn(today),
    listWeights(),
  ]);
  const latestWeight = weights.at(-1)?.weight_kg;
  const activityLevel = ACTIVITY_LEVELS.find((level) => level === profile?.activity_level);
  if (!profile?.birth_date || !profile.height_cm || !latestWeight || !activityLevel || !goal)
    return null;

  // Le rythme choisi à l'onboarding est conservé avec les cibles.
  const savedPace = (targets?.inputs as { pace?: unknown } | null)?.pace;
  const input: PlanInput = {
    age: ageOn(profile.birth_date, today),
    sex: profile.sex,
    heightCm: profile.height_cm,
    weightKg: latestWeight,
    activityLevel,
    goalType: goal.goal_type,
    pace: PACES.find((pace) => pace === savedPace) ?? "moderate",
    targetWeightKg: goal.target_weight_kg,
  };
  return { plan: buildNutritionPlan(input), input, goalId: goal.id, today };
}

/** Recalcule les cibles avec le poids actuel et les enregistre à compter d'aujourd'hui. */
export async function recalculateTargets(): Promise<void> {
  const current = await buildCurrentPlan();
  if (!current) throw new DataError("generic");
  const { plan, input, goalId, today } = current;
  if (plan.assessment.blocking.length > 0) throw new DataError("goalNotAllowed");

  await saveTargets({
    goal_id: goalId,
    effective_from: today,
    source: "calculated",
    formula: plan.bmr.formula,
    bmr_kcal: plan.bmr.kcal,
    maintenance_kcal: plan.maintenanceKcal,
    target_kcal: plan.calories.targetKcal,
    protein_g: plan.macros.proteinG,
    carbs_g: plan.macros.carbsG,
    fat_g: plan.macros.fatG,
    fiber_g: plan.macros.fiberG,
    inputs: {
      weight_kg: input.weightKg,
      height_cm: input.heightCm,
      age: input.age,
      sex: input.sex,
      activity_level: input.activityLevel,
      goal_type: input.goalType,
      pace: input.pace,
      adjustments: plan.calories.adjustments,
      expected_weekly_rate_kg: plan.calories.expectedWeeklyRateKg,
    },
  });
}
