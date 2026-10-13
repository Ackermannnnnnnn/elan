/**
 * Remplacement d'un exercice, SANS IA : on cherche dans la bibliothèque les
 * exercices qui travaillent le même muscle, compatibles avec le matériel, le
 * niveau et les zones sensibles, et absents de la séance. Les mieux classés
 * reprennent le même schéma de mouvement (même rôle dans la séance).
 */
import {
  isAllowed,
  type LibraryExercise,
  suitsLevel,
  type TrainingContext,
} from "./training-program";

export type ReplacementFilters = {
  /** Strictement plus facile que l'exercice actuel (ou poids du corps si déjà débutant). */
  easier?: boolean;
  /** Sans machine de salle. */
  noMachine?: boolean;
  /** Sans aucun matériel. */
  bodyweightOnly?: boolean;
};

const RANK = { beginner: 0, intermediate: 1, advanced: 2 } as const;

export function findReplacements(input: {
  current: LibraryExercise;
  library: readonly LibraryExercise[];
  context: TrainingContext;
  /** Exercices déjà présents dans la séance. */
  inWorkout: readonly string[];
  filters?: ReplacementFilters;
  limit?: number;
}): LibraryExercise[] {
  const { current, context, filters = {} } = input;
  const candidates = input.library.filter((exercise) => {
    if (exercise.id === current.id || input.inWorkout.includes(exercise.id)) return false;
    if (exercise.primary !== current.primary) return false;
    if (!isAllowed(exercise, context) || !suitsLevel(exercise, context.level)) return false;
    if (filters.bodyweightOnly && exercise.equipment.length > 0) return false;
    if (
      filters.noMachine &&
      exercise.equipment.some((item) => item === "machines" || item === "cardio_machine")
    ) {
      return false;
    }
    if (filters.easier) {
      const harder = RANK[exercise.difficulty] > RANK[current.difficulty];
      const notEasier =
        RANK[exercise.difficulty] === RANK[current.difficulty] &&
        !(
          current.difficulty === "beginner" && exercise.equipment.length < current.equipment.length
        );
      if (harder || notEasier) return false;
    }
    return true;
  });

  const scored = candidates.map((exercise) => {
    let score = 0;
    if (exercise.pattern === current.pattern) score += 3;
    if (exercise.compound === current.compound) score += 1;
    if (exercise.timed === current.timed) score += 0.5;
    if (exercise.difficulty === current.difficulty) score += 0.5;
    if (
      context.liked.includes(exercise.id) ||
      (exercise.slug && context.liked.includes(exercise.slug))
    ) {
      score += 1;
    }
    return { exercise, score };
  });
  scored.sort((a, b) => b.score - a.score || a.exercise.name.localeCompare(b.exercise.name, "fr"));
  return scored.slice(0, input.limit ?? 8).map((item) => item.exercise);
}
