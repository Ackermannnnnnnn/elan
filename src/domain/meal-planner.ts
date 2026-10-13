/**
 * Génération d'un plan de repas hebdomadaire, SANS IA : un algorithme
 * déterministe choisit, pour chaque repas, une recette compatible et ajuste
 * le nombre de portions pour approcher la cible calorique.
 *
 * Contraintes STRICTES (jamais enfreintes) : allergies, ingrédients exclus,
 * régime alimentaire, temps de préparation maximal, recettes au calcul complet.
 * Objectifs SOUPLES (optimisés) : calories et protéines par repas, variété.
 * Détail des règles et des pondérations : docs/CALCULS.md.
 */
import { type DietClass, dietAllows, normalizeFoodName } from "./food-classification";

export const MEAL_SLOTS = ["breakfast", "lunch", "dinner", "snack"] as const;
export type MealSlot = (typeof MEAL_SLOTS)[number];

/** Répartition des calories de la journée entre les repas. */
export const SLOT_SHARES: Record<MealSlot, number> = {
  breakfast: 0.25,
  lunch: 0.35,
  dinner: 0.3,
  snack: 0.1,
};

/** Portions proposées : par quarts, entre une demi-portion et deux portions et demie. */
export const PORTION_STEP = 0.25;
export const MIN_PORTIONS = 0.5;
export const MAX_PORTIONS = 2.5;
/** Écart toléré entre le total d'une journée et la cible, avant avertissement. */
export const DAY_TOLERANCE = 0.1;

export type Diet = "omnivore" | "flexitarian" | "pescatarian" | "vegetarian" | "vegan";
export type MealStyle = "budget" | "quick" | "varied" | "repetitive";

export type PlannerRecipe = {
  id: string;
  title: string;
  slots: readonly MealSlot[];
  /** Apports d'UNE portion de la recette. */
  perServing: { kcal: number; proteinG: number; carbsG: number; fatG: number };
  isComplete: boolean;
  allergens: readonly string[];
  dietClass: DietClass;
  /** Préparation + cuisson, en minutes ; `null` si non renseigné. */
  totalMinutes: number | null;
  /** Noms des ingrédients, pour les exclusions et les allergies saisies librement. */
  ingredientNames: readonly string[];
};

export type PlannerConstraints = {
  /** Codes d'allergènes UE et saisies libres (« kiwi »). */
  allergies: readonly string[];
  excludedIngredients: readonly string[];
  diet: Diet;
  /** Temps maximal par recette ; `null` : pas de limite. */
  maxMinutes: number | null;
  styles: readonly MealStyle[];
};

export type ExclusionReason = "allergy" | "excluded" | "diet" | "time" | "incomplete" | "noSlot";

export type PlannedMeal = {
  dayIndex: number;
  slot: MealSlot;
  recipeId: string;
  title: string;
  portions: number;
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
};

export type PlanWarning =
  | { kind: "slotWithoutRecipe"; slot: MealSlot }
  | { kind: "dayOffTarget"; dayIndex: number; kcal: number; target: number }
  | { kind: "lowProtein"; dayIndex: number; proteinG: number; target: number };

export type GeneratedPlan = {
  meals: PlannedMeal[];
  days: { dayIndex: number; kcal: number; proteinG: number; carbsG: number; fatG: number }[];
  warnings: PlanWarning[];
  /** Nombre de recettes écartées, par raison (pour l'expliquer à l'utilisateur). */
  excluded: Record<ExclusionReason, number>;
  eligibleCount: number;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Générateur pseudo-aléatoire déterministe (mulberry32) : même graine, même plan. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const EU_ALLERGENS = new Set([
  "gluten",
  "crustaceans",
  "eggs",
  "fish",
  "peanuts",
  "soy",
  "milk",
  "nuts",
  "celery",
  "mustard",
  "sesame",
  "sulphites",
  "lupin",
  "molluscs",
]);

/** Pourquoi une recette est écartée, ou `null` si elle est utilisable. */
export function exclusionReason(
  recipe: PlannerRecipe,
  constraints: PlannerConstraints,
): ExclusionReason | null {
  const names = recipe.ingredientNames.map(normalizeFoodName);
  const mentions = (term: string) => {
    const needle = normalizeFoodName(term);
    return needle !== "" && names.some((name) => ` ${name} `.includes(` ${needle}`));
  };

  for (const allergy of constraints.allergies) {
    if (EU_ALLERGENS.has(allergy) ? recipe.allergens.includes(allergy) : mentions(allergy)) {
      return "allergy";
    }
  }
  if (constraints.excludedIngredients.some(mentions)) return "excluded";
  if (!dietAllows(constraints.diet, recipe.dietClass)) return "diet";
  if (!recipe.isComplete || recipe.perServing.kcal <= 0) return "incomplete";
  if (
    constraints.maxMinutes !== null &&
    recipe.totalMinutes !== null &&
    recipe.totalMinutes > constraints.maxMinutes
  ) {
    return "time";
  }
  if (recipe.slots.length === 0) return "noSlot";
  return null;
}

/** Portions qui approchent `targetKcal`, arrondies au quart et bornées. */
export function portionsFor(targetKcal: number, kcalPerServing: number): number {
  if (kcalPerServing <= 0) return 1;
  const raw = targetKcal / kcalPerServing;
  const stepped = Math.round(raw / PORTION_STEP) * PORTION_STEP;
  return Math.min(MAX_PORTIONS, Math.max(MIN_PORTIONS, stepped));
}

export function generateMealPlan(input: {
  recipes: readonly PlannerRecipe[];
  targets: { kcal: number; proteinG: number };
  constraints: PlannerConstraints;
  seed: number;
  days?: number;
}): GeneratedPlan {
  const { targets, constraints } = input;
  const dayCount = input.days ?? 7;
  const random = seededRandom(input.seed);

  const excluded: Record<ExclusionReason, number> = {
    allergy: 0,
    excluded: 0,
    diet: 0,
    time: 0,
    incomplete: 0,
    noSlot: 0,
  };
  const eligible: PlannerRecipe[] = [];
  for (const recipe of input.recipes) {
    const reason = exclusionReason(recipe, constraints);
    if (reason) excluded[reason] += 1;
    else eligible.push(recipe);
  }

  // Repas sans recette compatible : on les retire et on répartit leur part
  // sur les autres, pour que la journée vise toujours la cible.
  const bySlot = new Map<MealSlot, PlannerRecipe[]>();
  for (const slot of MEAL_SLOTS) {
    bySlot.set(
      slot,
      eligible.filter((recipe) => recipe.slots.includes(slot)),
    );
  }
  const activeSlots = MEAL_SLOTS.filter((slot) => (bySlot.get(slot) ?? []).length > 0);
  const warnings: PlanWarning[] = MEAL_SLOTS.filter((slot) => !activeSlots.includes(slot)).map(
    (slot) => ({ kind: "slotWithoutRecipe" as const, slot }),
  );
  const shareTotal = activeSlots.reduce((sum, slot) => sum + SLOT_SHARES[slot], 0);

  const varied = constraints.styles.includes("varied");
  const repetitive = constraints.styles.includes("repetitive");
  const quick = constraints.styles.includes("quick");
  const repeatWeight = varied ? 2 : repetitive ? 0.25 : 1;

  const meals: PlannedMeal[] = [];
  const usage = new Map<string, number>();
  const lastDayBySlot = new Map<string, number>();

  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const usedToday = new Set<string>();
    for (const slot of activeSlots) {
      const share = SLOT_SHARES[slot] / shareTotal;
      const slotKcal = targets.kcal * share;
      const slotProtein = targets.proteinG * share;

      let best: { recipe: PlannerRecipe; portions: number; score: number } | null = null;
      for (const recipe of bySlot.get(slot) ?? []) {
        const portions = portionsFor(slotKcal, recipe.perServing.kcal);
        const kcal = recipe.perServing.kcal * portions;
        const protein = recipe.perServing.proteinG * portions;

        let score = Math.abs(kcal - slotKcal) / slotKcal;
        if (slotProtein > 0) score += (0.5 * Math.max(0, slotProtein - protein)) / slotProtein;

        const key = `${slot}:${recipe.id}`;
        const uses = usage.get(key) ?? 0;
        if (lastDayBySlot.get(key) === dayIndex - 1) score += 0.6 * repeatWeight;
        // Le même plat deux fois dans la journée (midi et soir) : à éviter, même en mode répétitif.
        if (usedToday.has(recipe.id)) score += 0.5;
        score += 0.25 * uses * repeatWeight;
        if (quick && recipe.totalMinutes !== null && recipe.totalMinutes > 20) score += 0.15;
        // Petite part de hasard (déterministe) pour départager et varier entre deux générations.
        score += random() * 0.2;

        if (!best || score < best.score) best = { recipe, portions, score };
      }
      if (!best) continue;

      const key = `${slot}:${best.recipe.id}`;
      usage.set(key, (usage.get(key) ?? 0) + 1);
      lastDayBySlot.set(key, dayIndex);
      usedToday.add(best.recipe.id);
      const { perServing } = best.recipe;
      meals.push({
        dayIndex,
        slot,
        recipeId: best.recipe.id,
        title: best.recipe.title,
        portions: best.portions,
        kcal: round1(perServing.kcal * best.portions),
        proteinG: round1(perServing.proteinG * best.portions),
        carbsG: round1(perServing.carbsG * best.portions),
        fatG: round1(perServing.fatG * best.portions),
      });
    }
  }

  // Équilibrage de la journée : on ajuste les portions par quarts, repas par
  // repas, tant que cela rapproche le total du jour de la cible.
  const perServingOf = new Map(eligible.map((recipe) => [recipe.id, recipe.perServing]));
  for (let dayIndex = 0; dayIndex < dayCount; dayIndex += 1) {
    const ofDay = meals.filter((meal) => meal.dayIndex === dayIndex);
    for (let round = 0; round < 12; round += 1) {
      const total = ofDay.reduce((sum, meal) => sum + meal.kcal, 0);
      const gap = targets.kcal - total;
      let bestMove: { meal: PlannedMeal; portions: number; remaining: number } | null = null;
      for (const meal of ofDay) {
        const perServing = perServingOf.get(meal.recipeId);
        if (!perServing) continue;
        for (const step of [PORTION_STEP, -PORTION_STEP]) {
          const portions = meal.portions + step;
          if (portions < MIN_PORTIONS || portions > MAX_PORTIONS) continue;
          const remaining = Math.abs(gap - perServing.kcal * step);
          if (remaining < Math.abs(gap) && (!bestMove || remaining < bestMove.remaining)) {
            bestMove = { meal, portions, remaining };
          }
        }
      }
      if (!bestMove) break;
      const perServing = perServingOf.get(bestMove.meal.recipeId);
      if (!perServing) break;
      Object.assign(bestMove.meal, {
        portions: bestMove.portions,
        kcal: round1(perServing.kcal * bestMove.portions),
        proteinG: round1(perServing.proteinG * bestMove.portions),
        carbsG: round1(perServing.carbsG * bestMove.portions),
        fatG: round1(perServing.fatG * bestMove.portions),
      });
    }
  }

  const days = summarizeDays(meals, dayCount);
  if (meals.length > 0) {
    for (const day of days) {
      if (Math.abs(day.kcal - targets.kcal) > targets.kcal * DAY_TOLERANCE) {
        warnings.push({
          kind: "dayOffTarget",
          dayIndex: day.dayIndex,
          kcal: day.kcal,
          target: targets.kcal,
        });
      }
      if (targets.proteinG > 0 && day.proteinG < targets.proteinG * 0.8) {
        warnings.push({
          kind: "lowProtein",
          dayIndex: day.dayIndex,
          proteinG: day.proteinG,
          target: targets.proteinG,
        });
      }
    }
  }

  return { meals, days, warnings, excluded, eligibleCount: eligible.length };
}

export function summarizeDays(
  meals: readonly Pick<PlannedMeal, "dayIndex" | "kcal" | "proteinG" | "carbsG" | "fatG">[],
  dayCount = 7,
) {
  return Array.from({ length: dayCount }, (_, dayIndex) => {
    const ofDay = meals.filter((meal) => meal.dayIndex === dayIndex);
    const sum = (pick: (meal: (typeof ofDay)[number]) => number) =>
      round1(ofDay.reduce((total, meal) => total + pick(meal), 0));
    return {
      dayIndex,
      kcal: Math.round(sum((meal) => meal.kcal)),
      proteinG: Math.round(sum((meal) => meal.proteinG)),
      carbsG: Math.round(sum((meal) => meal.carbsG)),
      fatG: Math.round(sum((meal) => meal.fatG)),
    };
  });
}
