/**
 * Déroulé d'une séance : supersets, repos après une série, valeurs proposées
 * pour la série suivante. Règles : docs/CALCULS.md.
 */

export type FlowItem = {
  name: string;
  /** Repos prévu après une série de cet exercice (secondes), null = pas de repos. */
  restSeconds: number | null;
  /** Enchaîné sans repos avec l'exercice suivant. */
  supersetWithNext: boolean;
};

/**
 * Groupes d'exercices enchaînés : [[0], [1, 2], [3]] signifie que les exercices
 * 1 et 2 forment un superset. Le drapeau du dernier exercice est ignoré.
 */
export function supersetGroups(items: readonly Pick<FlowItem, "supersetWithNext">[]): number[][] {
  const groups: number[][] = [];
  let current: number[] = [];
  items.forEach((item, index) => {
    current.push(index);
    if (!item.supersetWithNext || index === items.length - 1) {
      groups.push(current);
      current = [];
    }
  });
  return groups;
}

/** Étiquette « A1 », « A2 »… pour les exercices en superset, null sinon. */
export function supersetLabels(
  items: readonly Pick<FlowItem, "supersetWithNext">[],
): (string | null)[] {
  const labels: (string | null)[] = items.map(() => null);
  let letter = 0;
  for (const group of supersetGroups(items)) {
    if (group.length < 2) continue;
    const prefix = String.fromCharCode(65 + (letter % 26));
    group.forEach((index, rank) => {
      labels[index] = `${prefix}${rank + 1}`;
    });
    letter += 1;
  }
  return labels;
}

export type AfterSet =
  | { kind: "chain"; next: string }
  | { kind: "rest"; seconds: number; next: string | null }
  | { kind: "none" };

/**
 * Ce qui suit une série de l'exercice `index` :
 *  · dans un superset, sauf pour le dernier exercice du groupe : enchaîner
 *    tout de suite avec l'exercice suivant du groupe ;
 *  · sinon (exercice seul, ou dernier du superset) : le repos prévu, puis on
 *    revient au premier exercice du groupe (superset) ou on reste sur l'exercice.
 *    Le repos d'un superset est le plus long des repos prévus dans le groupe.
 */
export function afterSet(items: readonly FlowItem[], index: number): AfterSet {
  const group = supersetGroups(items).find((candidate) => candidate.includes(index));
  const item = items[index];
  if (!group || !item) return { kind: "none" };
  const rank = group.indexOf(index);
  if (rank < group.length - 1) {
    const next = items[group[rank + 1] as number];
    return { kind: "chain", next: next?.name ?? "" };
  }
  const rests = group.map((member) => items[member]?.restSeconds ?? 0);
  const seconds = Math.max(0, ...rests);
  if (seconds === 0) return { kind: "none" };
  const first = items[group[0] as number];
  return { kind: "rest", seconds, next: group.length > 1 ? (first?.name ?? null) : null };
}

export type SetValues = { weightKg: number | null; reps: number | null };

/**
 * Valeurs proposées pour une série non encore validée : celles de la dernière
 * série validée de l'exercice dans cette séance, sinon l'objectif du jour.
 */
export function proposedValues(
  sets: readonly (SetValues & { setNumber: number; done: boolean })[],
  setNumber: number,
  target: SetValues | null,
): SetValues | null {
  const previous = sets
    .filter((set) => set.done && set.setNumber < setNumber && set.reps !== null)
    .sort((a, b) => b.setNumber - a.setNumber)[0];
  if (previous) return { weightKg: previous.weightKg, reps: previous.reps };
  return target;
}
