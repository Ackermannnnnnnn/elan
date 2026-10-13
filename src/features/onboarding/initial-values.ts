import "server-only";
import { ACTIVITY_LEVELS, PACES, type ActivityLevel, type Pace } from "@/domain/energy";
import { getActiveGoal, getOwnPreferences, getTargetsOn } from "@/data/plan";
import { getOwnProfile, getToday } from "@/data/profile";
import { listWeights } from "@/data/tracking";
import { EU_ALLERGENS, KITCHEN_EQUIPMENT, MEAL_STYLES, TRAINING_EQUIPMENT } from "./options";
import { EMPTY_ONBOARDING_VALUES, type OnboardingFormValues } from "./schema";

/** Nombre → texte de champ, avec la virgule décimale française. */
const text = (value: number | null | undefined) =>
  value === null || value === undefined ? "" : String(value).replace(".", ",");

const only = <T extends string>(allowed: readonly T[], values: string[]): T[] =>
  values.filter((value): value is T => (allowed as readonly string[]).includes(value));

/**
 * Valeurs de départ du parcours : vides à la première visite, reprises de la
 * base lorsqu'on modifie son profil.
 */
export async function loadOnboardingValues(): Promise<OnboardingFormValues> {
  const today = await getToday();
  const [profile, preferences, goal, targets, weights] = await Promise.all([
    getOwnProfile(),
    getOwnPreferences(),
    getActiveGoal(),
    getTargetsOn(today),
    listWeights(),
  ]);

  const empty = EMPTY_ONBOARDING_VALUES;
  const latestWeight = weights.at(-1)?.weight_kg;
  const inputs = (targets?.inputs ?? {}) as Record<string, unknown>;
  const savedPace = PACES.find((pace) => pace === inputs.pace) satisfies Pace | undefined;
  const allergies = preferences?.allergies ?? [];

  return {
    ...empty,
    birthDate: profile?.birth_date ?? empty.birthDate,
    sex: profile?.sex ?? "unspecified",
    heightCm: text(profile?.height_cm),
    weightKg: text(latestWeight),
    waistCm: "",
    healthConsent: Boolean(profile?.health_data_consent_at) as true,
    goalType: goal?.goal_type ?? empty.goalType,
    pace: savedPace ?? empty.pace,
    targetWeightKg: text(goal?.target_weight_kg),
    occupation: profile?.occupation_type ?? empty.occupation,
    avgDailySteps: text(profile?.avg_daily_steps),
    sessionsPerWeek: text(preferences?.sessions_per_week) || empty.sessionsPerWeek,
    sessionMinutes: text(preferences?.session_duration_minutes) || empty.sessionMinutes,
    trainingLevel: profile?.training_level ?? empty.trainingLevel,
    trainingLocation: preferences?.training_location ?? empty.trainingLocation,
    equipment: only(TRAINING_EQUIPMENT, preferences?.equipment ?? []),
    sports: preferences?.sports ?? [],
    activityLevel:
      (ACTIVITY_LEVELS.find((level) => level === profile?.activity_level) satisfies
        ActivityLevel | undefined) ?? empty.activityLevel,
    weeklyFoodBudgetEur: text(preferences?.weekly_food_budget_eur),
    mealsPerDay: text(preferences?.meals_per_day) || empty.mealsPerDay,
    snacksPerDay: text(preferences?.snacks_per_day) || empty.snacksPerDay,
    dietType: preferences?.diet_type ?? empty.dietType,
    // Les allergènes réglementaires et les saisies libres partagent une colonne.
    allergies: only(EU_ALLERGENS, allergies),
    otherAllergies: allergies.filter(
      (value) => !(EU_ALLERGENS as readonly string[]).includes(value),
    ),
    intolerances: preferences?.intolerances ?? [],
    excludedIngredients: preferences?.excluded_ingredients ?? [],
    likedFoods: preferences?.liked_foods ?? [],
    dislikedFoods: preferences?.disliked_foods ?? [],
    cookingTimeMinutes: text(preferences?.cooking_time_minutes) || empty.cookingTimeMinutes,
    cookingSkill: preferences?.cooking_skill ?? empty.cookingSkill,
    mealPrep: preferences?.meal_prep ?? false,
    mealStyle: only(MEAL_STYLES, preferences?.meal_style ?? []),
    // La ligne de préférences existe dès l'inscription (vide) : tant que
    // l'onboarding n'est pas fait, on propose l'équipement le plus courant.
    kitchenEquipment: profile?.onboarding_completed_at
      ? only(KITCHEN_EQUIPMENT, preferences?.kitchen_equipment ?? [])
      : empty.kitchenEquipment,
    timeZone: profile?.timezone ?? empty.timeZone,
  };
}
