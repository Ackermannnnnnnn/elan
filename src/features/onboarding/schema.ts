import { z } from "zod";
import { ACTIVITY_LEVELS, GOAL_TYPES, PACES } from "@/domain/energy";
import { defaultTimeZone } from "@/i18n/config";
import { isoDate, optionalNumber, requiredNumber, tagList, timeZoneOr } from "@/lib/form-fields";
import {
  COOKING_SKILLS,
  DIET_TYPES,
  EU_ALLERGENS,
  KITCHEN_EQUIPMENT,
  MEAL_STYLES,
  OCCUPATION_TYPES,
  SEX_OPTIONS,
  TRAINING_EQUIPMENT,
  TRAINING_LEVELS,
  TRAINING_LOCATIONS,
} from "./options";

// Bornes alignées sur les contraintes CHECK de la base (voir supabase/migrations).

const personal = {
  birthDate: isoDate,
  sex: z.enum(SEX_OPTIONS, "required"),
  heightCm: requiredNumber({ min: 100, max: 250 }),
  weightKg: requiredNumber({ min: 30, max: 300 }),
  waistCm: optionalNumber({ min: 30, max: 250 }),
  // Case à cocher obligatoire : sans consentement, aucune donnée de santé n'est enregistrée.
  healthConsent: z.literal(true, "consentRequired"),
};

const goal = {
  goalType: z.enum(GOAL_TYPES, "required"),
  pace: z.enum(PACES, "required"),
  targetWeightKg: optionalNumber({ min: 30, max: 300 }),
};

const activity = {
  occupation: z.enum(OCCUPATION_TYPES, "required"),
  avgDailySteps: optionalNumber({ min: 0, max: 100000, integer: true }),
  sessionsPerWeek: requiredNumber({ min: 0, max: 14, integer: true }),
  sessionMinutes: requiredNumber({ min: 0, max: 300, integer: true }),
  trainingLevel: z.enum(TRAINING_LEVELS, "required"),
  trainingLocation: z.enum(TRAINING_LOCATIONS, "required"),
  equipment: z.array(z.enum(TRAINING_EQUIPMENT)),
  sports: tagList(30),
  activityLevel: z.enum(ACTIVITY_LEVELS, "required"),
};

const food = {
  weeklyFoodBudgetEur: optionalNumber({ min: 0, max: 2000 }),
  mealsPerDay: requiredNumber({ min: 1, max: 8, integer: true }),
  snacksPerDay: requiredNumber({ min: 0, max: 6, integer: true }),
  dietType: z.enum(DIET_TYPES, "required"),
  allergies: z.array(z.enum(EU_ALLERGENS)),
  otherAllergies: tagList(20),
  intolerances: tagList(40),
  excludedIngredients: tagList(60),
  likedFoods: tagList(100),
  dislikedFoods: tagList(100),
  cookingTimeMinutes: requiredNumber({ min: 0, max: 240, integer: true }),
  cookingSkill: z.enum(COOKING_SKILLS, "required"),
  mealPrep: z.boolean(),
  mealStyle: z.array(z.enum(MEAL_STYLES)),
  kitchenEquipment: z.array(z.enum(KITCHEN_EQUIPMENT)),
};

/** Schémas partiels : utilisés pour contrôler une étape avant que les suivantes soient remplies. */
export const personalSchema = z.object(personal);
export const personalAndGoalSchema = z.object({ ...personal, ...goal });

/** Champs validés à chaque étape du parcours (l'étape 5 est le récapitulatif). */
export const STEP_FIELDS = {
  personal: Object.keys(personal),
  goal: Object.keys(goal),
  activity: Object.keys(activity),
  food: Object.keys(food),
} as const satisfies Record<string, readonly string[]>;

export const STEPS = ["personal", "goal", "activity", "food", "result"] as const;
export type Step = (typeof STEPS)[number];

export const onboardingSchema = z
  .object({
    ...personal,
    ...goal,
    ...activity,
    ...food,
    timeZone: timeZoneOr(defaultTimeZone),
  })
  .superRefine((values, context) => {
    // Un poids cible est indispensable pour perdre ou prendre du poids.
    const needsTarget =
      values.goalType === "fat_loss" ||
      values.goalType === "recomposition" ||
      values.goalType === "muscle_gain";
    if (needsTarget && values.targetWeightKg === null) {
      context.addIssue({ code: "custom", path: ["targetWeightKg"], message: "required" });
    }
    // Des séances déclarées doivent avoir une durée.
    if (values.sessionsPerWeek > 0 && values.sessionMinutes < 5) {
      context.addIssue({ code: "custom", path: ["sessionMinutes"], message: "numberTooLow" });
    }
  });

/** Valeurs brutes du formulaire (les nombres sont encore du texte). */
export type OnboardingFormValues = z.input<typeof onboardingSchema>;
/** Valeurs validées et converties. */
export type OnboardingValues = z.output<typeof onboardingSchema>;

export const EMPTY_ONBOARDING_VALUES: OnboardingFormValues = {
  birthDate: "",
  sex: "unspecified",
  heightCm: "",
  weightKg: "",
  waistCm: "",
  healthConsent: false as unknown as true,
  goalType: "fat_loss",
  pace: "moderate",
  targetWeightKg: "",
  occupation: "sedentary",
  avgDailySteps: "",
  sessionsPerWeek: "3",
  sessionMinutes: "45",
  trainingLevel: "beginner",
  trainingLocation: "gym",
  equipment: [],
  sports: [],
  activityLevel: "light",
  weeklyFoodBudgetEur: "",
  mealsPerDay: "3",
  snacksPerDay: "1",
  dietType: "omnivore",
  allergies: [],
  otherAllergies: [],
  intolerances: [],
  excludedIngredients: [],
  likedFoods: [],
  dislikedFoods: [],
  cookingTimeMinutes: "30",
  cookingSkill: "beginner",
  mealPrep: false,
  mealStyle: [],
  kitchenEquipment: ["stove", "oven", "microwave"],
  timeZone: defaultTimeZone,
};
