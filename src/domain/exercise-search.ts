/**
 * Recherche dans la bibliothèque d'exercices : texte (sans accents ni casse),
 * muscle principal et matériel disponible.
 */
import type { Equipment, Muscle } from "./exercise-catalog";

export const normalizeText = (value: string) =>
  value
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();

export type SearchableExercise = {
  name: string;
  primary: Muscle;
  equipment: readonly Equipment[];
};

export type ExerciseFilters = {
  query?: string;
  muscle?: Muscle | null;
  /** Matériel accessible : l'exercice ne doit rien demander d'autre. null = pas de filtre. */
  equipment?: readonly Equipment[] | null;
};

/** Filtre en conservant l'ordre ; tous les mots de la recherche doivent apparaître. */
export function filterExercises<T extends SearchableExercise>(
  exercises: readonly T[],
  filters: ExerciseFilters,
): T[] {
  const words = normalizeText(filters.query ?? "")
    .split(" ")
    .filter(Boolean);
  return exercises.filter((exercise) => {
    if (filters.muscle && exercise.primary !== filters.muscle) return false;
    const available = filters.equipment;
    if (available && !exercise.equipment.every((item) => available.includes(item))) return false;
    if (words.length === 0) return true;
    const name = normalizeText(exercise.name);
    return words.every((word) => name.includes(word));
  });
}
