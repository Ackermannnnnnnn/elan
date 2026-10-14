/**
 * Progression des charges (double progression) et comparaison des
 * performances. Règles : docs/CALCULS.md.
 */

export type LoggedSet = { weightKg: number | null; reps: number | null };

export type Suggestion = {
  weightKg: number | null;
  reps: number;
  /** Pourquoi cette proposition, pour l'afficher. */
  reason: "first" | "increaseWeight" | "increaseReps" | "repeat" | "harderVariant";
};

/** Pas d'augmentation : plus grand pour les gros mouvements du bas du corps. */
export function weightIncrement(lowerBodyCompound: boolean): number {
  return lowerBodyCompound ? 5 : 2.5;
}

/**
 * Double progression : on reste à la même charge en ajoutant des répétitions
 * jusqu'au haut de la fourchette sur TOUTES les séries, puis on augmente la
 * charge et on repart du bas de la fourchette. Sans charge (poids du corps ou
 * exercice chronométré), on ajoute des répétitions (ou 5 secondes), puis on
 * propose une variante plus difficile.
 */
export function suggestNext(input: {
  previous: readonly LoggedSet[];
  repMin: number;
  repMax: number;
  timed: boolean;
  lowerBodyCompound: boolean;
}): Suggestion {
  const sets = input.previous.filter((set) => set.reps !== null);
  if (sets.length === 0) return { weightKg: null, reps: input.repMin, reason: "first" };

  const reps = sets.map((set) => set.reps as number);
  const weights = sets.map((set) => set.weightKg ?? 0);
  const weight = Math.max(...weights);
  const worst = Math.min(...reps);
  const allAtTop = reps.every((value) => value >= input.repMax);

  if (input.timed) {
    if (allAtTop) return { weightKg: null, reps: input.repMax, reason: "harderVariant" };
    return { weightKg: null, reps: Math.min(input.repMax, worst + 5), reason: "increaseReps" };
  }
  if (weight <= 0) {
    if (allAtTop) return { weightKg: null, reps: input.repMax, reason: "harderVariant" };
    return { weightKg: null, reps: Math.min(input.repMax, worst + 1), reason: "increaseReps" };
  }
  if (allAtTop) {
    return {
      weightKg: weight + weightIncrement(input.lowerBodyCompound),
      reps: input.repMin,
      reason: "increaseWeight",
    };
  }
  if (worst < input.repMin) return { weightKg: weight, reps: input.repMin, reason: "repeat" };
  return { weightKg: weight, reps: Math.min(input.repMax, worst + 1), reason: "increaseReps" };
}

/**
 * Force maximale estimée (formule d'Epley) : charge × (1 + répétitions / 30).
 * Peu fiable au-delà de 12 répétitions : `null` dans ce cas.
 */
export function estimatedOneRepMax(weightKg: number, reps: number): number | null {
  if (weightKg <= 0 || reps <= 0 || reps > 12) return null;
  if (reps === 1) return weightKg;
  return Math.round(weightKg * (1 + reps / 30) * 10) / 10;
}

/** Résumé d'une séance pour un exercice : meilleure série, volume total. */
export function summarizeSets(sets: readonly LoggedSet[]): {
  bestOneRepMax: number | null;
  volumeKg: number;
  totalReps: number;
  bestSet: LoggedSet | null;
} {
  let bestOneRepMax: number | null = null;
  let bestSet: LoggedSet | null = null;
  let volumeKg = 0;
  let totalReps = 0;
  for (const set of sets) {
    if (set.reps === null) continue;
    totalReps += set.reps;
    if (set.weightKg !== null) volumeKg += set.weightKg * set.reps;
    const estimate = set.weightKg === null ? null : estimatedOneRepMax(set.weightKg, set.reps);
    if (estimate !== null && (bestOneRepMax === null || estimate > bestOneRepMax)) {
      bestOneRepMax = estimate;
      bestSet = set;
    }
    if (bestSet === null && (set.weightKg ?? 0) === 0) bestSet = set;
  }
  return { bestOneRepMax, volumeKg: Math.round(volumeKg * 10) / 10, totalReps, bestSet };
}

/**
 * Charge réellement soulevée pour le volume : un exercice « par bras » (un
 * haltère dans chaque main) compte deux fois la charge saisie. La charge
 * saisie, les objectifs et la force estimée restent, eux, « par bras ».
 */
export function liftedLoad(weightKg: number | null, loadBasis: string): number | null {
  if (weightKg === null) return null;
  return loadBasis === "per_hand" ? weightKg * 2 : weightKg;
}
