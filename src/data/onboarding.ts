import "server-only";
import { suggestedWaterMl, type NutritionPlan } from "@/domain/energy";
import type { OnboardingValues } from "@/features/onboarding/schema";
import type { IsoDate } from "@/lib/dates";
import { fail, getDb } from "./client";
import { getActiveGoal, saveTargets } from "./plan";
import { listWeights, saveWeight } from "./tracking";

/**
 * Enregistre le résultat de l'onboarding (ou d'une modification du profil).
 *
 * Supabase n'offre pas de transaction côté client : les écritures sont donc
 * toutes idempotentes et `onboarding_completed_at` n'est posé qu'en dernier.
 * Si une étape échoue, rien n'est marqué comme terminé et un nouvel envoi
 * reprend simplement tout depuis le début, sans doublon.
 */
export async function saveOnboarding(input: {
  values: OnboardingValues;
  plan: NutritionPlan;
  age: number;
  today: IsoDate;
}): Promise<void> {
  const { values, plan, today } = input;
  const { supabase, user } = await getDb();
  const now = new Date().toISOString();

  // 1. Préférences
  const { error: preferencesError } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      weekly_food_budget_eur: values.weeklyFoodBudgetEur,
      meals_per_day: values.mealsPerDay,
      snacks_per_day: values.snacksPerDay,
      diet_type: values.dietType,
      // Allergènes réglementaires + saisies libres : tous des contraintes strictes.
      allergies: [...values.allergies, ...values.otherAllergies],
      intolerances: values.intolerances,
      excluded_ingredients: values.excludedIngredients,
      liked_foods: values.likedFoods,
      disliked_foods: values.dislikedFoods,
      cooking_time_minutes: values.cookingTimeMinutes,
      cooking_skill: values.cookingSkill,
      meal_prep: values.mealPrep,
      meal_style: values.mealStyle,
      kitchen_equipment: values.kitchenEquipment,
      sessions_per_week: values.sessionsPerWeek,
      session_duration_minutes: values.sessionsPerWeek > 0 ? values.sessionMinutes : null,
      training_location: values.trainingLocation,
      equipment: values.equipment,
      sports: values.sports,
      // Repère indicatif d'hydratation, recalculé avec le poids.
      daily_water_goal_ml: suggestedWaterMl(values.weightKg),
    },
    { onConflict: "user_id" },
  );
  if (preferencesError) fail("saveOnboarding.preferences", preferencesError, "saveFailed");

  // 2. Poids du jour et tour de taille. Lors d'une modification du profil, un
  //    poids inchangé n'est pas réenregistré : ce serait inventer une pesée.
  const latestWeight = (await listWeights()).at(-1);
  if (
    !latestWeight ||
    latestWeight.weight_kg !== values.weightKg ||
    latestWeight.measured_on === today
  ) {
    await saveWeight({ date: today, weightKg: values.weightKg });
  }
  if (values.waistCm !== null) {
    const { error } = await supabase
      .from("body_measurements")
      .upsert(
        { user_id: user.id, measured_on: today, waist_cm: values.waistCm },
        { onConflict: "user_id,measured_on" },
      );
    if (error) fail("saveOnboarding.waist", error, "saveFailed");
  }

  // 3. Objectif : on met à jour l'objectif en cours s'il est de même nature,
  //    sinon on l'archive (« remplacé ») et on en ouvre un nouveau.
  const goalColumns = {
    goal_type: values.goalType,
    target_weight_kg: values.targetWeightKg,
    weekly_rate_kg: Math.min(1, Math.max(-1.5, plan.calories.expectedWeeklyRateKg)),
  };
  const activeGoal = await getActiveGoal();
  let goalId: string;

  if (activeGoal && activeGoal.goal_type === values.goalType) {
    const { error } = await supabase
      .from("user_goals")
      .update(goalColumns)
      .eq("id", activeGoal.id)
      .eq("user_id", user.id);
    if (error) fail("saveOnboarding.goal.update", error, "saveFailed");
    goalId = activeGoal.id;
  } else {
    if (activeGoal) {
      const { error } = await supabase
        .from("user_goals")
        .update({ status: "replaced", ended_at: now })
        .eq("id", activeGoal.id)
        .eq("user_id", user.id);
      if (error) fail("saveOnboarding.goal.replace", error, "saveFailed");
    }
    const { data, error } = await supabase
      .from("user_goals")
      .insert({
        ...goalColumns,
        user_id: user.id,
        kind: "primary",
        status: "active",
        start_weight_kg: values.weightKg,
        started_on: today,
      })
      .select("id")
      .single();
    if (error) fail("saveOnboarding.goal.insert", error, "saveFailed");
    goalId = data.id;
  }

  // 4. Cibles nutritionnelles, avec les données d'entrée du calcul.
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
      weight_kg: values.weightKg,
      height_cm: values.heightCm,
      age: input.age,
      sex: values.sex === "unspecified" ? null : values.sex,
      activity_level: values.activityLevel,
      goal_type: values.goalType,
      pace: values.pace,
      adjustments: plan.calories.adjustments,
      expected_weekly_rate_kg: plan.calories.expectedWeeklyRateKg,
    },
  });

  // 5. Profil — en dernier : c'est ce qui marque l'onboarding comme terminé.
  const { data: existing, error: readError } = await supabase
    .from("profiles")
    .select("onboarding_completed_at, health_data_consent_at")
    .eq("id", user.id)
    .maybeSingle();
  if (readError) fail("saveOnboarding.profile.read", readError, "saveFailed");

  const { error: profileError } = await supabase.from("profiles").upsert(
    {
      id: user.id,
      birth_date: values.birthDate,
      sex: values.sex === "unspecified" ? null : values.sex,
      height_cm: values.heightCm,
      activity_level: values.activityLevel,
      occupation_type: values.occupation,
      avg_daily_steps: values.avgDailySteps,
      training_level: values.trainingLevel,
      timezone: values.timeZone,
      // Les dates d'origine sont conservées lors d'une simple modification.
      health_data_consent_at: existing?.health_data_consent_at ?? now,
      onboarding_completed_at: existing?.onboarding_completed_at ?? now,
    },
    { onConflict: "id" },
  );
  if (profileError) fail("saveOnboarding.profile", profileError, "saveFailed");
}
