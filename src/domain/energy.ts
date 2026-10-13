/**
 * Moteur de calcul des besoins énergétiques et des macronutriments.
 *
 * Tout est déterministe, explicite et testé : aucune valeur n'est produite
 * par l'IA. Les résultats sont des ESTIMATIONS (l'erreur individuelle d'une
 * formule de métabolisme atteint couramment ±10 %) ; l'application les
 * présente comme telles et les laisse modifiables.
 *
 * Sources des formules et des seuils :
 *  - Métabolisme de base : Mifflin MD, St Jeor ST et al., Am J Clin Nutr 1990.
 *  - Niveaux d'activité : coefficients usuels (1,2 à 1,9) dérivés des PAL FAO/OMS/UNU.
 *  - 7 700 kcal par kg : équivalent énergétique usuel du tissu adipeux (approximation).
 *  - Protéines : 1,6 à 2,2 g/kg, positions ISSN 2017 et Morton et al. 2018.
 *  - Fibres : 14 g pour 1 000 kcal (Institute of Medicine / Dietary Guidelines for Americans).
 *  - IMC : seuils OMS (18,5 / 25 / 30 / 35 / 40).
 */

export type Sex = "female" | "male";
export type ActivityLevel = "sedentary" | "light" | "moderate" | "active" | "very_active";
export type GoalType = "fat_loss" | "maintenance" | "muscle_gain" | "recomposition" | "fitness";
export type Pace = "gentle" | "moderate" | "fast";

export const ACTIVITY_LEVELS: readonly ActivityLevel[] = [
  "sedentary",
  "light",
  "moderate",
  "active",
  "very_active",
];
export const GOAL_TYPES: readonly GoalType[] = [
  "fat_loss",
  "maintenance",
  "muscle_gain",
  "recomposition",
  "fitness",
];
export const PACES: readonly Pace[] = ["gentle", "moderate", "fast"];

/** Coefficient multiplicateur du métabolisme de base selon l'activité. */
export const ACTIVITY_FACTORS: Record<ActivityLevel, number> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  active: 1.725,
  very_active: 1.9,
};

export const KCAL_PER_KG = 7700;
export const KCAL_PER_GRAM = { protein: 4, carbs: 4, fat: 9 } as const;

/** Rythme visé, en % du poids corporel par semaine. */
export const LOSS_PACE_PERCENT: Record<Pace, number> = { gentle: 0.25, moderate: 0.5, fast: 0.75 };
export const GAIN_PACE_PERCENT: Record<Pace, number> = { gentle: 0.1, moderate: 0.25, fast: 0.4 };

/** Garde-fous. */
export const MAX_DEFICIT_RATIO = 0.25; // au plus 25 % sous le maintien
export const MAX_SURPLUS_RATIO = 0.15; // au plus 15 % au-dessus du maintien
export const MAX_SURPLUS_KCAL = 500;
export const RECOMPOSITION_DEFICIT_RATIO = 0.1;
/** Planchers caloriques en dessous desquels un suivi professionnel s'impose. */
export const CALORIE_FLOOR: Record<Sex | "unspecified", number> = {
  female: 1200,
  male: 1500,
  unspecified: 1500,
};
export const MIN_ADULT_AGE = 18;
export const MIN_HEALTHY_BMI = 18.5;

const round = (value: number, step = 1) => Math.round(value / step) * step;
const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

// --- Indice de masse corporelle ------------------------------------------------

export function bmi(weightKg: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return weightKg / (heightM * heightM);
}

/** Poids correspondant à un IMC donné pour une taille. */
export function weightAtBmi(targetBmi: number, heightCm: number): number {
  const heightM = heightCm / 100;
  return targetBmi * heightM * heightM;
}

// --- Métabolisme de base et maintien ---------------------------------------------

export type BmrResult = {
  kcal: number;
  formula: "mifflin_st_jeor";
  /** true si le sexe n'est pas précisé : la constante est la moyenne des deux, l'estimation est moins précise. */
  sexAveraged: boolean;
};

/**
 * Mifflin-St Jeor : 10 × poids (kg) + 6,25 × taille (cm) − 5 × âge + s
 * avec s = +5 (homme) ou −161 (femme). Sans sexe précisé : s = −78, la moyenne.
 */
export function basalMetabolicRate(input: {
  weightKg: number;
  heightCm: number;
  age: number;
  sex: Sex | null;
}): BmrResult {
  const constant = input.sex === "male" ? 5 : input.sex === "female" ? -161 : -78;
  const kcal = 10 * input.weightKg + 6.25 * input.heightCm - 5 * input.age + constant;
  return { kcal: Math.round(kcal), formula: "mifflin_st_jeor", sexAveraged: input.sex === null };
}

export function maintenanceCalories(bmrKcal: number, activityLevel: ActivityLevel): number {
  return Math.round(bmrKcal * ACTIVITY_FACTORS[activityLevel]);
}

// --- Suggestion du niveau d'activité ---------------------------------------------

export type OccupationType = "sedentary" | "standing" | "active" | "physical";

/**
 * Propose un niveau d'activité à partir du métier, des pas et du sport.
 * Heuristique transparente (un barème de points), que l'utilisateur peut
 * toujours corriger : c'est le niveau retenu, pas ce barème, qui sert au calcul.
 */
export function suggestActivityLevel(input: {
  occupation: OccupationType;
  dailySteps: number | null;
  sessionsPerWeek: number;
  sessionMinutes: number;
}): ActivityLevel {
  const occupationPoints = { sedentary: 0, standing: 1, active: 2, physical: 3 }[input.occupation];

  const steps = input.dailySteps;
  const stepPoints =
    steps === null ? 0 : steps >= 10000 ? 3 : steps >= 7500 ? 2 : steps >= 5000 ? 1 : 0;

  const weeklyMinutes = input.sessionsPerWeek * input.sessionMinutes;
  const trainingPoints =
    weeklyMinutes >= 300 ? 3 : weeklyMinutes >= 150 ? 2 : weeklyMinutes >= 60 ? 1 : 0;

  const total = occupationPoints + stepPoints + trainingPoints;
  if (total >= 8) return "very_active";
  if (total >= 6) return "active";
  if (total >= 4) return "moderate";
  if (total >= 2) return "light";
  return "sedentary";
}

// --- Objectif calorique ----------------------------------------------------------

export type CalorieAdjustment =
  /** Le déficit demandé dépassait 25 % du maintien. */
  | "deficit_capped"
  /** Le plancher calorique a été appliqué. */
  | "floor_applied"
  /** Le surplus demandé dépassait la limite. */
  | "surplus_capped";

export type CalorieTarget = {
  targetKcal: number;
  /** Écart quotidien au maintien : négatif = déficit, positif = surplus. */
  dailyDeltaKcal: number;
  /** Rythme demandé (kg/semaine, négatif = perte). */
  requestedWeeklyRateKg: number;
  /** Rythme réellement attendu une fois les garde-fous appliqués. */
  expectedWeeklyRateKg: number;
  adjustments: CalorieAdjustment[];
};

export function calorieTarget(input: {
  goalType: GoalType;
  pace: Pace;
  weightKg: number;
  maintenanceKcal: number;
  sex: Sex | null;
}): CalorieTarget {
  const { goalType, pace, weightKg, maintenanceKcal } = input;
  const floor = CALORIE_FLOOR[input.sex ?? "unspecified"];
  const adjustments: CalorieAdjustment[] = [];

  let requestedWeeklyRateKg = 0;
  let delta = 0;

  if (goalType === "fat_loss") {
    requestedWeeklyRateKg = -(weightKg * LOSS_PACE_PERCENT[pace]) / 100;
    delta = (requestedWeeklyRateKg * KCAL_PER_KG) / 7;
    const maxDeficit = maintenanceKcal * MAX_DEFICIT_RATIO;
    if (-delta > maxDeficit) {
      delta = -maxDeficit;
      adjustments.push("deficit_capped");
    }
  } else if (goalType === "muscle_gain") {
    requestedWeeklyRateKg = (weightKg * GAIN_PACE_PERCENT[pace]) / 100;
    delta = (requestedWeeklyRateKg * KCAL_PER_KG) / 7;
    const maxSurplus = Math.min(maintenanceKcal * MAX_SURPLUS_RATIO, MAX_SURPLUS_KCAL);
    if (delta > maxSurplus) {
      delta = maxSurplus;
      adjustments.push("surplus_capped");
    }
  } else if (goalType === "recomposition") {
    delta = -maintenanceKcal * RECOMPOSITION_DEFICIT_RATIO;
    requestedWeeklyRateKg = (delta * 7) / KCAL_PER_KG;
  }

  let targetKcal = round(maintenanceKcal + delta, 10);

  // Le plancher ne s'applique qu'aux objectifs en déficit : on ne « remonte »
  // pas artificiellement un maintien déjà bas, on le signale par un avertissement.
  if (delta < 0 && targetKcal < floor) {
    targetKcal = Math.min(floor, round(maintenanceKcal, 10));
    adjustments.push("floor_applied");
  }

  const dailyDeltaKcal = targetKcal - maintenanceKcal;
  return {
    targetKcal,
    dailyDeltaKcal,
    requestedWeeklyRateKg: round2(requestedWeeklyRateKg),
    expectedWeeklyRateKg:
      goalType === "maintenance" || goalType === "fitness"
        ? 0
        : round2((dailyDeltaKcal * 7) / KCAL_PER_KG),
    adjustments,
  };
}

// --- Macronutriments ---------------------------------------------------------------

/** Protéines visées, en g par kg de poids de référence. */
export const PROTEIN_G_PER_KG: Record<GoalType, number> = {
  fat_loss: 2.0,
  recomposition: 2.0,
  muscle_gain: 1.8,
  maintenance: 1.6,
  fitness: 1.6,
};
export const MAX_PROTEIN_ENERGY_RATIO = 0.35;
export const FAT_ENERGY_RATIO = 0.25;
export const MIN_FAT_G_PER_KG = 0.6;
export const FIBER_G_PER_1000_KCAL = 14;

/**
 * Poids de référence pour les besoins en protéines et en lipides.
 * Au-delà d'un IMC de 30, le poids réel surestime ces besoins : on utilise un
 * poids ajusté = poids à IMC 25 + 40 % de l'écart (usage courant en diététique).
 */
export function referenceWeight(weightKg: number, heightCm: number): number {
  if (bmi(weightKg, heightCm) <= 30) return weightKg;
  const weightAtBmi25 = weightAtBmi(25, heightCm);
  return weightAtBmi25 + 0.4 * (weightKg - weightAtBmi25);
}

export type MacroTargets = {
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number;
  /** Part de l'énergie apportée par chaque macronutriment (somme ≈ 100). */
  energyShare: { protein: number; carbs: number; fat: number };
  referenceWeightKg: number;
};

export function macroTargets(input: {
  targetKcal: number;
  goalType: GoalType;
  weightKg: number;
  heightCm: number;
}): MacroTargets {
  const { targetKcal, goalType } = input;
  const reference = referenceWeight(input.weightKg, input.heightCm);

  const maxProteinG = (targetKcal * MAX_PROTEIN_ENERGY_RATIO) / KCAL_PER_GRAM.protein;
  const proteinG = Math.round(Math.min(reference * PROTEIN_G_PER_KG[goalType], maxProteinG));

  const fatFromEnergy = (targetKcal * FAT_ENERGY_RATIO) / KCAL_PER_GRAM.fat;
  const fatG = Math.round(Math.max(fatFromEnergy, reference * MIN_FAT_G_PER_KG));

  const remainingKcal = targetKcal - proteinG * KCAL_PER_GRAM.protein - fatG * KCAL_PER_GRAM.fat;
  const carbsG = Math.max(0, Math.round(remainingKcal / KCAL_PER_GRAM.carbs));

  const energy = {
    protein: proteinG * KCAL_PER_GRAM.protein,
    carbs: carbsG * KCAL_PER_GRAM.carbs,
    fat: fatG * KCAL_PER_GRAM.fat,
  };
  const total = energy.protein + energy.carbs + energy.fat;

  return {
    proteinG,
    carbsG,
    fatG,
    fiberG: Math.round((targetKcal / 1000) * FIBER_G_PER_1000_KCAL),
    energyShare: {
      protein: Math.round((energy.protein / total) * 100),
      carbs: Math.round((energy.carbs / total) * 100),
      fat: Math.round((energy.fat / total) * 100),
    },
    referenceWeightKg: round1(reference),
  };
}

/** Énergie correspondant à des macros (pour contrôler une saisie manuelle). */
export function energyFromMacros(macros: {
  proteinG: number;
  carbsG: number;
  fatG: number;
}): number {
  return Math.round(
    macros.proteinG * KCAL_PER_GRAM.protein +
      macros.carbsG * KCAL_PER_GRAM.carbs +
      macros.fatG * KCAL_PER_GRAM.fat,
  );
}

// --- Durée estimée -----------------------------------------------------------------

/** Nombre de semaines pour atteindre le poids cible au rythme attendu, ou `null` si non pertinent. */
export function weeksToTarget(input: {
  weightKg: number;
  targetWeightKg: number | null;
  expectedWeeklyRateKg: number;
}): number | null {
  const { weightKg, targetWeightKg, expectedWeeklyRateKg } = input;
  if (targetWeightKg === null || expectedWeeklyRateKg === 0) return null;
  const remaining = targetWeightKg - weightKg;
  if (remaining === 0) return 0;
  // Le rythme doit aller dans le sens de l'objectif.
  if (Math.sign(remaining) !== Math.sign(expectedWeeklyRateKg)) return null;
  return Math.ceil(remaining / expectedWeeklyRateKg);
}

// --- Hydratation -------------------------------------------------------------------

/** Repère indicatif : environ 33 ml par kg, borné entre 1,5 et 3,5 litres. */
export function suggestedWaterMl(weightKg: number): number {
  return Math.min(3500, Math.max(1500, round(weightKg * 33, 100)));
}

// --- Garde-fous sur l'objectif --------------------------------------------------------

export type BlockingIssue =
  /** Application réservée aux adultes. */
  | { code: "under_age" }
  /** Le poids cible correspond à un IMC inférieur à 18,5. */
  | { code: "target_underweight"; minimumWeightKg: number }
  /** Perte de poids demandée alors que l'IMC est déjà inférieur à 18,5. */
  | { code: "already_underweight" }
  /** Le poids cible n'est pas dans le sens de l'objectif. */
  | { code: "target_not_below_current" }
  | { code: "target_not_above_current" };

export type GoalWarning =
  /** IMC ≥ 35 : un accompagnement médical est recommandé. */
  | "bmi_high"
  /** Perte visée supérieure à 20 % du poids. */
  | "large_loss"
  /** 65 ans et plus : préserver la masse musculaire prime, avis professionnel conseillé. */
  | "senior"
  /** Perte de poids avec un IMC déjà dans le bas de la zone normale (< 20). */
  | "low_bmi_loss"
  /** Le maintien estimé est déjà sous le plancher calorique. */
  | "low_maintenance";

export type GoalAssessment = { blocking: BlockingIssue[]; warnings: GoalWarning[] };

export function assessGoal(input: {
  age: number;
  sex: Sex | null;
  weightKg: number;
  heightCm: number;
  goalType: GoalType;
  targetWeightKg: number | null;
  maintenanceKcal: number;
}): GoalAssessment {
  const { age, weightKg, heightCm, goalType, targetWeightKg } = input;
  const blocking: BlockingIssue[] = [];
  const warnings: GoalWarning[] = [];
  const currentBmi = bmi(weightKg, heightCm);

  if (age < MIN_ADULT_AGE) blocking.push({ code: "under_age" });

  if (goalType === "fat_loss" && currentBmi < MIN_HEALTHY_BMI) {
    blocking.push({ code: "already_underweight" });
  }

  if (targetWeightKg !== null) {
    if (bmi(targetWeightKg, heightCm) < MIN_HEALTHY_BMI) {
      blocking.push({
        code: "target_underweight",
        // Arrondi au demi-kilo supérieur pour rester au-dessus du seuil.
        minimumWeightKg: Math.ceil(weightAtBmi(MIN_HEALTHY_BMI, heightCm) * 2) / 2,
      });
    }
    if (goalType === "fat_loss" && targetWeightKg >= weightKg) {
      blocking.push({ code: "target_not_below_current" });
    }
    if (goalType === "muscle_gain" && targetWeightKg <= weightKg) {
      blocking.push({ code: "target_not_above_current" });
    }
    if (goalType === "fat_loss" && (weightKg - targetWeightKg) / weightKg > 0.2) {
      warnings.push("large_loss");
    }
  }

  if (currentBmi >= 35) warnings.push("bmi_high");
  if (age >= 65) warnings.push("senior");
  if (goalType === "fat_loss" && currentBmi >= MIN_HEALTHY_BMI && currentBmi < 20) {
    warnings.push("low_bmi_loss");
  }
  if (input.maintenanceKcal < CALORIE_FLOOR[input.sex ?? "unspecified"]) {
    warnings.push("low_maintenance");
  }

  return { blocking, warnings };
}

// --- Plan complet ------------------------------------------------------------------

export type PlanInput = {
  age: number;
  sex: Sex | null;
  heightCm: number;
  weightKg: number;
  activityLevel: ActivityLevel;
  goalType: GoalType;
  pace: Pace;
  targetWeightKg: number | null;
};

export type NutritionPlan = {
  bmr: BmrResult;
  maintenanceKcal: number;
  calories: CalorieTarget;
  macros: MacroTargets;
  weeksToTarget: number | null;
  bmi: number;
  assessment: GoalAssessment;
};

/** Enchaîne tous les calculs à partir des données du profil. */
export function buildNutritionPlan(input: PlanInput): NutritionPlan {
  const bmr = basalMetabolicRate(input);
  const maintenanceKcal = maintenanceCalories(bmr.kcal, input.activityLevel);
  const calories = calorieTarget({ ...input, maintenanceKcal });
  const macros = macroTargets({ ...input, targetKcal: calories.targetKcal });

  return {
    bmr,
    maintenanceKcal,
    calories,
    macros,
    weeksToTarget: weeksToTarget({
      weightKg: input.weightKg,
      targetWeightKg: input.targetWeightKg,
      expectedWeeklyRateKg: calories.expectedWeeklyRateKg,
    }),
    bmi: round1(bmi(input.weightKg, input.heightCm)),
    assessment: assessGoal({ ...input, maintenanceKcal }),
  };
}

/** Un écart de 2 kg ou plus depuis le dernier calcul justifie de réévaluer les besoins. */
export const RECALCULATION_THRESHOLD_KG = 2;

export function shouldRecalculate(weightAtCalculationKg: number, currentWeightKg: number): boolean {
  return Math.abs(currentWeightKg - weightAtCalculationKg) >= RECALCULATION_THRESHOLD_KG;
}
