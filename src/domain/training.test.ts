import { describe, expect, it } from "vitest";
import { EXERCISE_CATALOG } from "./exercise-catalog";
import { findReplacements } from "./exercise-replacement";
import { estimatedOneRepMax, suggestNext, summarizeSets } from "./progression";
import {
  allowedStructures,
  availableEquipment,
  exerciseSeconds,
  generateProgram,
  type LibraryExercise,
  prescriptionFor,
  recommendStructure,
  type TrainingContext,
  WARMUP_SECONDS,
} from "./training-program";

const library: LibraryExercise[] = EXERCISE_CATALOG.map((exercise) => ({
  id: exercise.slug,
  slug: exercise.slug,
  name: exercise.name,
  primary: exercise.primary,
  pattern: exercise.pattern,
  equipment: exercise.equipment,
  difficulty: exercise.difficulty,
  compound: exercise.compound,
  timed: exercise.timed ?? false,
  caution: exercise.caution,
}));
const byId = new Map(library.map((exercise) => [exercise.id, exercise]));

const gym: TrainingContext = {
  level: "intermediate",
  equipment: availableEquipment("gym", []),
  limitations: [],
  disliked: [],
  liked: [],
};
const homeBodyweight: TrainingContext = {
  level: "beginner",
  equipment: availableEquipment("home", []),
  limitations: [],
  disliked: [],
  liked: [],
};

describe("catalogue d'exercices", () => {
  it("a des identifiants uniques et des consignes", () => {
    const slugs = EXERCISE_CATALOG.map((exercise) => exercise.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
    for (const exercise of EXERCISE_CATALOG) {
      expect(exercise.instructions.length, exercise.slug).toBeGreaterThan(40);
      expect(exercise.slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    }
  });
});

describe("matériel et structures", () => {
  it("la salle donne tout le matériel, la maison seulement celui déclaré", () => {
    expect(availableEquipment("gym", [])).toContain("machines");
    expect(availableEquipment("home", ["dumbbells", "inconnu"])).toEqual(["dumbbells"]);
  });

  it("conseille une structure selon la fréquence et le niveau", () => {
    expect(recommendStructure(3, "beginner")).toBe("full_body");
    expect(recommendStructure(4, "advanced")).toBe("upper_lower");
    expect(recommendStructure(5, "beginner")).toBe("upper_lower");
    expect(recommendStructure(6, "intermediate")).toBe("push_pull_legs");
    expect(allowedStructures(2)).toEqual(["full_body", "upper_lower"]);
  });

  it("prescrit séries et répétitions selon l'objectif", () => {
    expect(prescriptionFor({ compound: true, timed: false }, "strength", "advanced")).toEqual({
      sets: 4,
      repMin: 3,
      repMax: 5,
      restSeconds: 180,
    });
    // Débutant : 3 séries au plus.
    expect(prescriptionFor({ compound: true, timed: false }, "strength", "beginner").sets).toBe(3);
    expect(prescriptionFor({ compound: false, timed: true }, "hypertrophy", "beginner")).toEqual({
      sets: 3,
      repMin: 20,
      repMax: 30,
      restSeconds: 60,
    });
  });

  it("estime la durée d'un exercice", () => {
    // 3 × (40 s + 90 s) + 60 s = 450 s.
    expect(exerciseSeconds({ sets: 3, repMin: 8, repMax: 12, restSeconds: 90 }, false)).toBe(450);
  });
});

describe("generateProgram", () => {
  it("construit 4 séances haut / bas du corps en salle, réparties dans la semaine", () => {
    const program = generateProgram({
      library,
      context: gym,
      goal: "hypertrophy",
      structure: "upper_lower",
      sessionsPerWeek: 4,
      minutesPerSession: 75,
    });
    expect(program.structure).toBe("upper_lower");
    expect(program.workouts.map((w) => w.focus)).toEqual(["upper", "lower", "upper", "lower"]);
    expect(program.workouts.map((w) => w.weekday)).toEqual([1, 2, 4, 5]);
    for (const workout of program.workouts) {
      expect(workout.exercises.length).toBeGreaterThanOrEqual(4);
      expect(new Set(workout.exercises.map((e) => e.exerciseId)).size).toBe(
        workout.exercises.length,
      );
    }
    // Les deux séances « haut du corps » ne sont pas identiques.
    const [upperA, , upperB] = program.workouts;
    expect(upperA?.exercises.map((e) => e.exerciseId)).not.toEqual(
      upperB?.exercises.map((e) => e.exerciseId),
    );
  });

  it("respecte le temps disponible, avec au moins 3 exercices", () => {
    for (const minutes of [20, 30, 45, 60]) {
      const program = generateProgram({
        library,
        context: gym,
        goal: "strength",
        structure: "full_body",
        sessionsPerWeek: 3,
        minutesPerSession: minutes,
      });
      for (const workout of program.workouts) {
        expect(workout.exercises.length).toBeGreaterThanOrEqual(3);
        if (minutes >= 45) expect(workout.estimatedMinutes).toBeLessThanOrEqual(minutes);
      }
    }
  });

  it("sans matériel : uniquement des exercices au poids du corps", () => {
    const program = generateProgram({
      library,
      context: homeBodyweight,
      goal: "general_fitness",
      structure: "full_body",
      sessionsPerWeek: 3,
      minutesPerSession: 45,
    });
    for (const exercise of program.workouts.flatMap((w) => w.exercises)) {
      expect(byId.get(exercise.exerciseId)?.equipment).toEqual([]);
      expect(byId.get(exercise.exerciseId)?.difficulty).toBe("beginner");
    }
    expect(program.workouts.every((w) => w.exercises.length >= 3)).toBe(true);
  });

  it("n'inclut jamais un exercice risqué pour une zone déclarée sensible", () => {
    const context = { ...gym, limitations: ["knee", "lower_back"] as const };
    const program = generateProgram({
      library,
      context: { ...context, limitations: [...context.limitations] },
      goal: "hypertrophy",
      structure: "upper_lower",
      sessionsPerWeek: 4,
      minutesPerSession: 60,
    });
    for (const exercise of program.workouts.flatMap((w) => w.exercises)) {
      const caution = byId.get(exercise.exerciseId)?.caution ?? [];
      expect(caution).not.toContain("knee");
      expect(caution).not.toContain("lower_back");
    }
  });

  it("écarte les exercices refusés et favorise les exercices appréciés", () => {
    const program = generateProgram({
      library,
      context: { ...gym, disliked: ["squat-barre"], liked: ["presse-cuisses"] },
      goal: "hypertrophy",
      structure: "upper_lower",
      sessionsPerWeek: 2,
      minutesPerSession: 75,
    });
    const ids = program.workouts.flatMap((w) => w.exercises.map((e) => e.exerciseId));
    expect(ids).not.toContain("squat-barre");
    expect(ids).toContain("presse-cuisses");
  });

  it("ramène une structure impossible à la structure conseillée", () => {
    const program = generateProgram({
      library,
      context: gym,
      goal: "hypertrophy",
      structure: "push_pull_legs",
      sessionsPerWeek: 2,
      minutesPerSession: 60,
    });
    expect(program.structure).toBe("full_body");
  });

  it("ajoute un exercice pour un muscle à privilégier", () => {
    const base = generateProgram({
      library,
      context: gym,
      goal: "hypertrophy",
      structure: "full_body",
      sessionsPerWeek: 3,
      minutesPerSession: 120,
    });
    const focused = generateProgram({
      library,
      context: gym,
      goal: "hypertrophy",
      structure: "full_body",
      sessionsPerWeek: 3,
      minutesPerSession: 120,
      priorityMuscles: ["glutes"],
    });
    const count = (program: typeof base) =>
      program.workouts
        .flatMap((w) => w.exercises)
        .filter((e) => byId.get(e.exerciseId)?.primary === "glutes").length;
    expect(count(focused)).toBeGreaterThan(count(base));
  });

  it("estime la durée en incluant l'échauffement", () => {
    const program = generateProgram({
      library,
      context: gym,
      goal: "hypertrophy",
      structure: "full_body",
      sessionsPerWeek: 1,
      minutesPerSession: 120,
    });
    const workout = program.workouts[0];
    const seconds = (workout?.exercises ?? []).reduce(
      (sum, e) => sum + exerciseSeconds(e, byId.get(e.exerciseId)?.timed ?? false),
      WARMUP_SECONDS,
    );
    expect(workout?.estimatedMinutes).toBe(Math.round(seconds / 60));
  });
});

describe("findReplacements", () => {
  const bench = byId.get("developpe-couche-barre") as LibraryExercise;

  it("propose le même muscle, même mouvement en tête, hors séance", () => {
    const found = findReplacements({
      current: bench,
      library,
      context: gym,
      inWorkout: ["developpe-couche-halteres"],
    });
    expect(found.every((e) => e.primary === "chest")).toBe(true);
    expect(found[0]?.pattern).toBe("push_horizontal");
    expect(found.map((e) => e.id)).not.toContain("developpe-couche-halteres");
    expect(found.map((e) => e.id)).not.toContain("developpe-couche-barre");
  });

  it("« plus facile, sans machine » : comme dans le cahier des charges", () => {
    const found = findReplacements({
      current: bench,
      library,
      context: gym,
      inWorkout: [],
      filters: { easier: true, noMachine: true },
    });
    expect(found.length).toBeGreaterThan(0);
    for (const exercise of found) {
      expect(exercise.equipment).not.toContain("machines");
      expect(exercise.difficulty).toBe("beginner");
    }
  });

  it("respecte le matériel et les zones sensibles", () => {
    const found = findReplacements({
      current: bench,
      library,
      context: { ...homeBodyweight, limitations: ["wrist"] },
      inWorkout: [],
    });
    for (const exercise of found) {
      expect(exercise.equipment).toEqual([]);
      expect(exercise.caution).not.toContain("wrist");
    }
  });
});

describe("progression", () => {
  const range = { repMin: 8, repMax: 12, timed: false, lowerBodyCompound: false };

  it("première fois : bas de la fourchette, charge à choisir", () => {
    expect(suggestNext({ ...range, previous: [] })).toEqual({
      weightKg: null,
      reps: 8,
      reason: "first",
    });
  });

  it("toutes les séries au maximum : +2,5 kg (haut du corps), retour à 8", () => {
    const previous = [
      { weightKg: 40, reps: 12 },
      { weightKg: 40, reps: 12 },
      { weightKg: 40, reps: 13 },
    ];
    expect(suggestNext({ ...range, previous })).toEqual({
      weightKg: 42.5,
      reps: 8,
      reason: "increaseWeight",
    });
    expect(suggestNext({ ...range, lowerBodyCompound: true, previous })?.weightKg).toBe(45);
  });

  it("sinon : même charge, une répétition de plus que la moins bonne série", () => {
    const previous = [
      { weightKg: 40, reps: 10 },
      { weightKg: 40, reps: 9 },
    ];
    expect(suggestNext({ ...range, previous })).toEqual({
      weightKg: 40,
      reps: 10,
      reason: "increaseReps",
    });
  });

  it("sous la fourchette : même charge, on vise le minimum", () => {
    expect(suggestNext({ ...range, previous: [{ weightKg: 40, reps: 6 }] })).toEqual({
      weightKg: 40,
      reps: 8,
      reason: "repeat",
    });
  });

  it("poids du corps et chronométré : on ajoute, puis on propose une variante", () => {
    expect(suggestNext({ ...range, previous: [{ weightKg: null, reps: 9 }] }).reps).toBe(10);
    expect(suggestNext({ ...range, previous: [{ weightKg: null, reps: 12 }] }).reason).toBe(
      "harderVariant",
    );
    expect(
      suggestNext({
        repMin: 20,
        repMax: 30,
        timed: true,
        lowerBodyCompound: false,
        previous: [{ weightKg: null, reps: 20 }],
      }).reps,
    ).toBe(25);
  });

  it("Epley : 100 kg × 5 → 116,7 kg ; rien au-delà de 12 répétitions", () => {
    expect(estimatedOneRepMax(100, 5)).toBe(116.7);
    expect(estimatedOneRepMax(100, 1)).toBe(100);
    expect(estimatedOneRepMax(50, 15)).toBeNull();
  });

  it("résume une séance : meilleure série et volume", () => {
    const summary = summarizeSets([
      { weightKg: 60, reps: 8 },
      { weightKg: 62.5, reps: 6 },
      { weightKg: null, reps: null },
    ]);
    // 60 × 8 + 62,5 × 6 = 855 kg ; Epley : 60 × 1,267 = 76 ; 62,5 × 1,2 = 75.
    expect(summary).toEqual({
      bestOneRepMax: 76,
      volumeKg: 855,
      totalReps: 14,
      bestSet: { weightKg: 60, reps: 8 },
    });
  });
});
