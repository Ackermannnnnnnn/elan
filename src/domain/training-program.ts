/**
 * Génération d'un programme d'entraînement, SANS IA : des séances types
 * construites à partir de « créneaux » (schéma de mouvement + muscle), remplis
 * avec les exercices compatibles avec le matériel, le niveau et les zones
 * sensibles déclarées. Règles et chiffres : docs/CALCULS.md.
 */
import type { CautionArea, Equipment, Level, Muscle, Pattern } from "./exercise-catalog";

export const STRUCTURES = ["full_body", "upper_lower", "push_pull_legs"] as const;
export type Structure = (typeof STRUCTURES)[number];

export const TRAINING_GOALS = [
  "fat_loss",
  "hypertrophy",
  "strength",
  "endurance",
  "general_fitness",
] as const;
export type TrainingGoal = (typeof TRAINING_GOALS)[number];

export type Focus = "full_body" | "upper" | "lower" | "push" | "pull" | "legs";

/** Exercice tel que le voit le moteur (ligne de `exercise_library`). */
export type LibraryExercise = {
  id: string;
  slug: string | null;
  name: string;
  primary: Muscle;
  pattern: Pattern;
  equipment: readonly Equipment[];
  difficulty: Level;
  compound: boolean;
  timed: boolean;
  caution: readonly CautionArea[];
};

export type TrainingContext = {
  level: Level;
  /** Matériel accessible (déduit du lieu et du matériel déclaré). */
  equipment: readonly Equipment[];
  /** Zones déclarées sensibles : exclusion stricte. */
  limitations: readonly CautionArea[];
  /** Exercices à ne plus proposer (slugs ou identifiants). */
  disliked: readonly string[];
  /** Exercices appréciés (slugs ou identifiants) : préférés à score égal. */
  liked: readonly string[];
};

const LEVEL_RANK: Record<Level, number> = { beginner: 0, intermediate: 1, advanced: 2 };

/** Tout le matériel d'une salle de sport. */
export const GYM_EQUIPMENT: readonly Equipment[] = [
  "dumbbells",
  "barbell",
  "bench",
  "pull_up_bar",
  "resistance_bands",
  "kettlebell",
  "machines",
  "cardio_machine",
  "mat",
];

/** Matériel accessible : la salle donne tout ; ailleurs, ce qui a été déclaré. */
export function availableEquipment(
  location: "gym" | "home" | "both" | "outdoor" | null,
  declared: readonly string[],
): Equipment[] {
  if (location === "gym" || location === "both") return [...GYM_EQUIPMENT];
  return GYM_EQUIPMENT.filter((item) => declared.includes(item));
}

const identifies = (exercise: LibraryExercise, list: readonly string[]) =>
  list.includes(exercise.id) || (exercise.slug !== null && list.includes(exercise.slug));

/** Contraintes STRICTES : matériel, zones sensibles, exercices refusés. */
export function isAllowed(exercise: LibraryExercise, context: TrainingContext): boolean {
  if (!exercise.equipment.every((item) => context.equipment.includes(item))) return false;
  if (exercise.caution.some((area) => context.limitations.includes(area))) return false;
  return !identifies(exercise, context.disliked);
}

/** Le niveau de l'exercice ne dépasse pas celui de la personne. */
export function suitsLevel(exercise: LibraryExercise, level: Level): boolean {
  return LEVEL_RANK[exercise.difficulty] <= LEVEL_RANK[level];
}

// --- Séries, répétitions, repos ------------------------------------------------------

export type Prescription = { sets: number; repMin: number; repMax: number; restSeconds: number };

const PRESCRIPTIONS: Record<TrainingGoal, { compound: Prescription; isolation: Prescription }> = {
  strength: {
    compound: { sets: 4, repMin: 3, repMax: 5, restSeconds: 180 },
    isolation: { sets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
  },
  hypertrophy: {
    compound: { sets: 3, repMin: 6, repMax: 10, restSeconds: 120 },
    isolation: { sets: 3, repMin: 10, repMax: 15, restSeconds: 75 },
  },
  fat_loss: {
    compound: { sets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
    isolation: { sets: 3, repMin: 12, repMax: 15, restSeconds: 60 },
  },
  endurance: {
    compound: { sets: 3, repMin: 12, repMax: 15, restSeconds: 60 },
    isolation: { sets: 2, repMin: 15, repMax: 20, restSeconds: 45 },
  },
  general_fitness: {
    compound: { sets: 3, repMin: 8, repMax: 12, restSeconds: 90 },
    isolation: { sets: 2, repMin: 10, repMax: 15, restSeconds: 60 },
  },
};

/** Exercices chronométrés : durée de tenue en secondes, selon le niveau. */
const TIMED: Record<Level, Prescription> = {
  beginner: { sets: 3, repMin: 20, repMax: 30, restSeconds: 60 },
  intermediate: { sets: 3, repMin: 30, repMax: 45, restSeconds: 60 },
  advanced: { sets: 3, repMin: 45, repMax: 60, restSeconds: 60 },
};

export function prescriptionFor(
  exercise: Pick<LibraryExercise, "compound" | "timed">,
  goal: TrainingGoal,
  level: Level,
): Prescription {
  if (exercise.timed) return { ...TIMED[level] };
  const base = PRESCRIPTIONS[goal][exercise.compound ? "compound" : "isolation"];
  // Un débutant ne dépasse pas 3 séries : la technique d'abord.
  return { ...base, sets: level === "beginner" ? Math.min(base.sets, 3) : base.sets };
}

/** Durée estimée d'un exercice, en secondes (travail + repos + mise en place). */
export function exerciseSeconds(prescription: Prescription, timed: boolean): number {
  const work = timed ? (prescription.repMin + prescription.repMax) / 2 : 40;
  return prescription.sets * (work + prescription.restSeconds) + 60;
}

export const WARMUP_SECONDS = 5 * 60;

// --- Structures -------------------------------------------------------------------

/** Structure conseillée selon le nombre de séances et le niveau. */
export function recommendStructure(sessionsPerWeek: number, level: Level): Structure {
  if (sessionsPerWeek <= 3) return "full_body";
  if (sessionsPerWeek === 4) return "upper_lower";
  return level === "beginner" ? "upper_lower" : "push_pull_legs";
}

/** Structures possibles (on ne fait pas de push/pull/legs en moins de 3 séances). */
export function allowedStructures(sessionsPerWeek: number): Structure[] {
  if (sessionsPerWeek <= 1) return ["full_body"];
  if (sessionsPerWeek === 2) return ["full_body", "upper_lower"];
  return ["full_body", "upper_lower", "push_pull_legs"];
}

/** Jours d'entraînement répartis dans la semaine (1 = lundi). */
export const WEEKDAYS_BY_COUNT: Record<number, number[]> = {
  1: [1],
  2: [1, 4],
  3: [1, 3, 5],
  4: [1, 2, 4, 5],
  5: [1, 2, 3, 5, 6],
  6: [1, 2, 3, 4, 5, 6],
};

type Slot = {
  pattern?: Pattern;
  muscle?: Muscle;
  compound?: boolean;
  /** 1 : indispensable · 2 : important · 3 : retiré en premier si le temps manque. */
  priority: 1 | 2 | 3;
};

const s = (slot: Slot) => slot;

const TEMPLATES: Record<string, { focus: Focus; slots: Slot[] }> = {
  fullA: {
    focus: "full_body",
    slots: [
      s({ pattern: "squat", compound: true, priority: 1 }),
      s({ pattern: "push_horizontal", muscle: "chest", priority: 1 }),
      s({ pattern: "pull_vertical", priority: 1 }),
      s({ pattern: "hinge", priority: 2 }),
      s({ muscle: "shoulders", pattern: "isolation", priority: 3 }),
      s({ pattern: "core", priority: 3 }),
    ],
  },
  fullB: {
    focus: "full_body",
    slots: [
      s({ pattern: "hinge", compound: true, priority: 1 }),
      s({ pattern: "push_vertical", muscle: "shoulders", priority: 1 }),
      s({ pattern: "pull_horizontal", muscle: "back", priority: 1 }),
      s({ pattern: "lunge", priority: 2 }),
      s({ muscle: "triceps", priority: 3 }),
      s({ pattern: "core", priority: 3 }),
    ],
  },
  fullC: {
    focus: "full_body",
    slots: [
      s({ pattern: "squat", compound: true, priority: 1 }),
      s({ pattern: "pull_horizontal", muscle: "back", priority: 1 }),
      s({ pattern: "push_horizontal", muscle: "chest", priority: 1 }),
      s({ muscle: "glutes", priority: 2 }),
      s({ muscle: "biceps", priority: 3 }),
      s({ pattern: "core", priority: 3 }),
    ],
  },
  upper: {
    focus: "upper",
    slots: [
      s({ pattern: "push_horizontal", muscle: "chest", priority: 1 }),
      s({ pattern: "pull_horizontal", muscle: "back", priority: 1 }),
      s({ pattern: "push_vertical", muscle: "shoulders", priority: 1 }),
      s({ pattern: "pull_vertical", priority: 1 }),
      s({ muscle: "shoulders", pattern: "isolation", priority: 2 }),
      s({ muscle: "biceps", priority: 3 }),
      s({ muscle: "triceps", priority: 3 }),
    ],
  },
  lower: {
    focus: "lower",
    slots: [
      s({ pattern: "squat", compound: true, priority: 1 }),
      s({ pattern: "hinge", compound: true, priority: 1 }),
      s({ pattern: "lunge", priority: 2 }),
      s({ muscle: "hamstrings", pattern: "isolation", priority: 2 }),
      s({ muscle: "calves", priority: 3 }),
      s({ pattern: "core", priority: 3 }),
    ],
  },
  push: {
    focus: "push",
    slots: [
      s({ pattern: "push_horizontal", muscle: "chest", compound: true, priority: 1 }),
      s({ pattern: "push_vertical", muscle: "shoulders", priority: 1 }),
      s({ pattern: "push_horizontal", muscle: "chest", priority: 2 }),
      s({ muscle: "shoulders", pattern: "isolation", priority: 2 }),
      s({ muscle: "triceps", priority: 3 }),
      s({ muscle: "chest", pattern: "isolation", priority: 3 }),
    ],
  },
  pull: {
    focus: "pull",
    slots: [
      s({ pattern: "pull_vertical", priority: 1 }),
      s({ pattern: "pull_horizontal", muscle: "back", priority: 1 }),
      s({ pattern: "pull_horizontal", priority: 2 }),
      s({ muscle: "biceps", priority: 2 }),
      s({ muscle: "biceps", priority: 3 }),
      s({ pattern: "core", priority: 3 }),
    ],
  },
  legs: {
    focus: "legs",
    slots: [
      s({ pattern: "squat", compound: true, priority: 1 }),
      s({ pattern: "hinge", compound: true, priority: 1 }),
      s({ pattern: "lunge", priority: 2 }),
      s({ muscle: "quadriceps", pattern: "isolation", priority: 2 }),
      s({ muscle: "hamstrings", pattern: "isolation", priority: 3 }),
      s({ muscle: "calves", priority: 3 }),
    ],
  },
};

const SEQUENCES: Record<Structure, string[]> = {
  full_body: ["fullA", "fullB", "fullC"],
  upper_lower: ["upper", "lower"],
  push_pull_legs: ["push", "pull", "legs"],
};

// --- Génération --------------------------------------------------------------------

export type PlannedExercise = Prescription & { exerciseId: string; slotPriority: 1 | 2 | 3 };
export type PlannedWorkout = {
  index: number;
  focus: Focus;
  weekday: number;
  exercises: PlannedExercise[];
  estimatedMinutes: number;
};
export type GeneratedProgram = {
  structure: Structure;
  workouts: PlannedWorkout[];
  /** Créneaux restés vides faute d'exercice compatible. */
  unfilledSlots: number;
};

const FALLBACK_MUSCLE: Partial<Record<Pattern, Muscle>> = {
  squat: "glutes",
  lunge: "glutes",
  hinge: "hamstrings",
  push_horizontal: "chest",
  push_vertical: "shoulders",
  pull_horizontal: "back",
  pull_vertical: "back",
};

const LOADABLE: readonly Equipment[] = ["dumbbells", "barbell", "machines", "kettlebell"];

function slotMatches(exercise: LibraryExercise, slot: Slot): boolean {
  if (slot.pattern && exercise.pattern !== slot.pattern) return false;
  if (slot.muscle && exercise.primary !== slot.muscle) return false;
  if (slot.compound !== undefined && exercise.compound !== slot.compound) return false;
  return true;
}

function pickExercise(
  slot: Slot,
  library: readonly LibraryExercise[],
  context: TrainingContext,
  inWorkout: Set<string>,
  usage: Map<string, number>,
): LibraryExercise | null {
  // Un créneau « composé » accepte un exercice d'isolation si rien d'autre ne convient.
  // Dernier recours : le même groupe musculaire par un autre mouvement (un
  // squat impossible pour un genou sensible devient un exercice de fessiers).
  const fallback = slot.pattern ? FALLBACK_MUSCLE[slot.pattern] : undefined;
  const relaxations: Slot[] = [
    slot,
    { ...slot, compound: undefined },
    ...(fallback ? [{ muscle: fallback, priority: slot.priority }] : []),
  ];
  for (const candidateSlot of relaxations) {
    const candidates = library.filter(
      (exercise) =>
        slotMatches(exercise, candidateSlot) &&
        isAllowed(exercise, context) &&
        suitsLevel(exercise, context.level) &&
        !inWorkout.has(exercise.id),
    );
    if (candidates.length === 0) continue;
    const scored = candidates.map((exercise) => {
      let score = 0;
      if (identifies(exercise, context.liked)) score += 2;
      if (exercise.difficulty === context.level) score += 0.5;
      if (slot.priority === 1 && exercise.compound) score += 0.5;
      // Les exercices chargeables (haltères, barre, machines) permettent une
      // progression plus fine que l'élastique ou le poids du corps.
      if (exercise.equipment.some((item) => LOADABLE.includes(item))) score += 0.75;
      else if (exercise.equipment.length > 0) score += 0.25;
      // Variété entre les séances, sans sacrifier le choix du meilleur exercice.
      score -= (usage.get(exercise.id) ?? 0) * 0.6;
      return { exercise, score };
    });
    scored.sort(
      (a, b) =>
        b.score - a.score ||
        (a.exercise.slug ?? a.exercise.id).localeCompare(b.exercise.slug ?? b.exercise.id),
    );
    return scored[0]?.exercise ?? null;
  }
  return null;
}

export function generateProgram(input: {
  library: readonly LibraryExercise[];
  context: TrainingContext;
  goal: TrainingGoal;
  structure: Structure;
  sessionsPerWeek: number;
  minutesPerSession: number;
  /** Muscles à privilégier : un exercice supplémentaire dans les séances concernées. */
  priorityMuscles?: readonly Muscle[];
}): GeneratedProgram {
  const sessions = Math.min(6, Math.max(1, Math.round(input.sessionsPerWeek)));
  const structure = allowedStructures(sessions).includes(input.structure)
    ? input.structure
    : recommendStructure(sessions, input.context.level);
  const sequence = SEQUENCES[structure];
  const weekdays = WEEKDAYS_BY_COUNT[sessions] ?? [1];
  const budget = input.minutesPerSession * 60 - WARMUP_SECONDS;
  const usage = new Map<string, number>();
  let unfilledSlots = 0;

  const workouts: PlannedWorkout[] = [];
  for (let index = 0; index < sessions; index += 1) {
    const template = TEMPLATES[sequence[index % sequence.length] as string];
    if (!template) continue;
    const slots = [...template.slots];
    for (const muscle of input.priorityMuscles ?? []) {
      const fits =
        template.focus === "full_body" ||
        (template.focus === "upper" || template.focus === "push" || template.focus === "pull"
          ? ["chest", "back", "shoulders", "biceps", "triceps"].includes(muscle)
          : ["glutes", "quadriceps", "hamstrings", "calves"].includes(muscle));
      if (fits) slots.push({ muscle, priority: 2 });
    }

    const inWorkout = new Set<string>();
    const chosen: PlannedExercise[] = [];
    for (const slot of slots) {
      const exercise = pickExercise(slot, input.library, input.context, inWorkout, usage);
      if (!exercise) {
        unfilledSlots += 1;
        continue;
      }
      inWorkout.add(exercise.id);
      chosen.push({
        exerciseId: exercise.id,
        slotPriority: slot.priority,
        ...prescriptionFor(exercise, input.goal, input.context.level),
      });
    }

    // Trop long pour le temps disponible : on retire d'abord les exercices de
    // priorité 3, puis 2, sans descendre sous trois exercices.
    const timedById = new Map(input.library.map((exercise) => [exercise.id, exercise.timed]));
    const duration = () =>
      chosen.reduce(
        (sum, item) => sum + exerciseSeconds(item, timedById.get(item.exerciseId) ?? false),
        0,
      );
    for (const priority of [3, 2] as const) {
      while (duration() > budget && chosen.length > 3) {
        const at = chosen.map((item) => item.slotPriority).lastIndexOf(priority);
        if (at < 0) break;
        chosen.splice(at, 1);
      }
    }
    // Encore trop long : une série de moins sur chaque exercice (au moins 2).
    while (duration() > budget && chosen.some((item) => item.sets > 2)) {
      for (const item of chosen) if (item.sets > 2) item.sets -= 1;
    }

    for (const item of chosen) usage.set(item.exerciseId, (usage.get(item.exerciseId) ?? 0) + 1);
    workouts.push({
      index,
      focus: template.focus,
      weekday: weekdays[index] ?? index + 1,
      exercises: chosen,
      estimatedMinutes: Math.round((duration() + WARMUP_SECONDS) / 60),
    });
  }
  return { structure, workouts, unfilledSlots };
}

/** Durée estimée d'une séance (échauffement compris), en minutes, bornée à 5–300. */
export function estimateWorkoutMinutes(
  items: readonly (Prescription & { timed: boolean })[],
): number {
  const seconds = items.reduce((sum, item) => sum + exerciseSeconds(item, item.timed), 0);
  return Math.min(300, Math.max(5, Math.round((seconds + WARMUP_SECONDS) / 60)));
}
