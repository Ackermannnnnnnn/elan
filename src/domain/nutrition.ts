/**
 * Calcul des apports d'un aliment, d'un repas et d'une journée.
 * Les valeurs d'un aliment sont exprimées pour 100 g (ou 100 ml) ; tout le
 * reste s'en déduit par proportion. Aucune valeur n'est estimée ici.
 */

export type Macros = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
};

export type FoodPer100 = {
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
};

const round1 = (value: number) => Math.round(value * 10) / 10;

/** Apports pour une quantité donnée, en grammes (ou millilitres). */
export function macrosForQuantity(food: FoodPer100, quantity: number): Macros {
  const ratio = quantity / 100;
  return {
    kcal: round1(food.kcal * ratio),
    proteinG: round1(food.proteinG * ratio),
    carbsG: round1(food.carbsG * ratio),
    fatG: round1(food.fatG * ratio),
    fiberG: food.fiberG === null ? null : round1(food.fiberG * ratio),
  };
}

/** Convertit un nombre de portions en grammes. `null` si l'aliment n'a pas de portion définie. */
export function gramsFromServings(servings: number, servingSizeG: number | null): number | null {
  if (servingSizeG === null || servingSizeG <= 0) return null;
  return round1(servings * servingSizeG);
}

export const EMPTY_MACROS: Macros = { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 };

/**
 * Additionne des apports. Les fibres inconnues (`null`) comptent pour zéro
 * dans le total ; `fiberIsPartial` signale alors que ce total est un minimum.
 */
export function sumMacros(items: Macros[]): Macros & { fiberIsPartial: boolean } {
  let fiberIsPartial = false;
  type Totals = { kcal: number; proteinG: number; carbsG: number; fatG: number; fiberG: number };
  const total = items.reduce<Totals>(
    (sum, item) => {
      if (item.fiberG === null) fiberIsPartial = true;
      return {
        kcal: sum.kcal + item.kcal,
        proteinG: sum.proteinG + item.proteinG,
        carbsG: sum.carbsG + item.carbsG,
        fatG: sum.fatG + item.fatG,
        fiberG: sum.fiberG + (item.fiberG ?? 0),
      };
    },
    { kcal: 0, proteinG: 0, carbsG: 0, fatG: 0, fiberG: 0 },
  );
  return {
    kcal: round1(total.kcal),
    proteinG: round1(total.proteinG),
    carbsG: round1(total.carbsG),
    fatG: round1(total.fatG),
    fiberG: round1(total.fiberG),
    fiberIsPartial,
  };
}

export type TargetProgress = {
  consumed: number;
  target: number;
  /** Positif : il reste de la marge. Négatif : la cible est dépassée. */
  remaining: number;
  /** Part de la cible atteinte, de 0 à 100 (plafonnée pour l'affichage). */
  percent: number;
  isOver: boolean;
};

export function progressTowards(consumed: number, target: number): TargetProgress {
  const remaining = Math.round(target - consumed);
  const percent =
    target > 0 ? Math.min(100, Math.max(0, Math.round((consumed / target) * 100))) : 0;
  return { consumed: Math.round(consumed), target, remaining, percent, isOver: consumed > target };
}

/**
 * Contrôle de cohérence d'une étiquette saisie à la main : l'énergie déclarée
 * doit être proche de celle recalculée depuis les macros (4/4/9 kcal par g).
 * Tolérance large (fibres, polyols, alcool et arrondis créent des écarts réels).
 */
export function labelLooksConsistent(food: FoodPer100): boolean {
  const computed = food.proteinG * 4 + food.carbsG * 4 + food.fatG * 9;
  if (food.kcal < 20 && computed < 20) return true;
  return Math.abs(computed - food.kcal) <= Math.max(25, food.kcal * 0.25);
}

// --- Portions proposées --------------------------------------------------------------

export type PortionKind =
  | "package"
  | "halfPackage"
  | "serving"
  | "halfServing"
  | "twoServings"
  | "glass"
  | "can"
  | "bottle"
  | "hundred";

export type PortionChoice = { kind: PortionKind; grams: number };

/**
 * Portions proposées en un geste pour un aliment : l'emballage entier et sa
 * moitié, la portion indiquée (et sa moitié, le double), des contenants
 * courants pour une boisson sans emballage connu, et toujours 100 g (ou ml).
 * Quantités en grammes (ou millilitres), arrondies au dixième, sans doublon.
 */
export function portionChoices(food: {
  basis: "100g" | "100ml";
  servingSizeG: number | null;
  packageSizeG: number | null;
}): PortionChoice[] {
  const choices: PortionChoice[] = [];
  const add = (kind: PortionKind, grams: number | null) => {
    if (grams === null || !(grams > 0) || grams > 10000) return;
    const value = round1(grams);
    if (choices.some((choice) => choice.grams === value)) return;
    choices.push({ kind, grams: value });
  };
  const { servingSizeG: serving, packageSizeG: pack } = food;
  if (pack) {
    add("package", pack);
    add("halfPackage", pack / 2);
  }
  if (serving) {
    add("serving", serving);
    // La moitié ou le double n'ont de sens que si la portion est plus petite que l'emballage.
    if (!pack || serving < pack) {
      add("halfServing", serving / 2);
      if (!pack || serving * 2 <= pack) add("twoServings", serving * 2);
    }
  }
  if (food.basis === "100ml" && !pack) {
    add("glass", 200);
    add("can", 330);
    add("bottle", 500);
  }
  add("hundred", 100);
  return choices;
}
