import { existsSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { EXERCISE_CATALOG } from "./exercise-catalog";
import { demoImages, EXERCISE_DEMOS, videoSearchUrl } from "./exercise-demos";
import { filterExercises, normalizeText } from "./exercise-search";
import { estimateWorkoutMinutes } from "./training-program";
import {
  buildWeek,
  isoWeekday,
  resolveWeekStart,
  type ScheduleSession,
  type ScheduleWorkout,
} from "./training-schedule";

// Semaine du lundi 12 au dimanche 18 octobre 2026 ; « aujourd'hui » = mercredi 14.
const MONDAY = "2026-10-12";
const TODAY = "2026-10-14";
const workouts: ScheduleWorkout[] = [
  { id: "A", name: "Haut du corps A", weekday: 1 },
  { id: "B", name: "Bas du corps A", weekday: 3 },
  { id: "C", name: "Haut du corps B", weekday: 5 },
  { id: "X", name: "Mobilité", weekday: null },
];
const session = (overrides: Partial<ScheduleSession> & Pick<ScheduleSession, "id">) =>
  ({
    workoutId: "A",
    name: "Haut du corps A",
    scheduledOn: MONDAY,
    originalDate: null,
    status: "completed",
    ...overrides,
  }) satisfies ScheduleSession;

const week = (sessions: ScheduleSession[], since: string | null = null) =>
  buildWeek({ weekStart: MONDAY, today: TODAY, since, workouts, sessions });
const kinds = (days: ReturnType<typeof week>) =>
  days.map((day) => day.entries.map((entry) => `${entry.kind}:${entry.workoutId}`).join(","));

describe("planning de la semaine", () => {
  it("répète chaque séance type à son jour ; les séances à la demande n'apparaissent pas", () => {
    expect(kinds(week([]))).toEqual(["recurring:A", "", "recurring:B", "", "recurring:C", "", ""]);
    const days = week([]);
    expect(days.map((day) => day.weekday)).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(days[2]?.isToday).toBe(true);
    expect(days[0]?.entries[0]?.past).toBe(true); // lundi passé et non fait : manqué
    expect(days[4]?.entries[0]?.past).toBe(false);
  });

  it("une séance faite le jour prévu remplace l'occurrence", () => {
    expect(kinds(week([session({ id: "s1" })]))[0]).toBe("done:A");
  });

  it("déplacer une occurrence : elle quitte son jour et apparaît à la nouvelle date", () => {
    const moved = session({
      id: "m",
      workoutId: "C",
      name: "Haut du corps B",
      scheduledOn: "2026-10-17",
      originalDate: "2026-10-16",
      status: "planned",
    });
    const days = week([moved]);
    expect(kinds(days)[4]).toBe("");
    expect(kinds(days)[5]).toBe("planned:C");
    expect(days[5]?.entries[0]?.movedFrom).toBe("2026-10-16");
  });

  it("sauter une occurrence la laisse visible comme « sautée », rétablissable", () => {
    const skipped = session({
      id: "k",
      workoutId: "B",
      scheduledOn: TODAY,
      originalDate: TODAY,
      status: "skipped",
    });
    expect(kinds(week([skipped]))[2]).toBe("skipped:B");
  });

  it("une séance manquée faite plus tard ne réapparaît pas au jour prévu", () => {
    const late = session({ id: "l", scheduledOn: "2026-10-13", originalDate: MONDAY });
    expect(kinds(week([late])).slice(0, 2)).toEqual(["", "done:A"]);
  });

  it("une séance supplémentaire s'ajoute sans masquer celles du jour", () => {
    const extra = session({
      id: "e",
      workoutId: "X",
      name: "Mobilité",
      scheduledOn: TODAY,
      status: "planned",
    });
    expect(kinds(week([extra]))[2]).toBe("planned:X,recurring:B");
  });

  it("ordre dans une journée : faite, en cours, planifiée, prévue, sautée", () => {
    const sessions = [
      session({
        id: "1",
        workoutId: "C",
        scheduledOn: TODAY,
        originalDate: "2026-10-16",
        status: "planned",
      }),
      session({
        id: "2",
        workoutId: "A",
        scheduledOn: TODAY,
        originalDate: MONDAY,
        status: "in_progress",
      }),
      session({ id: "3", workoutId: null, scheduledOn: TODAY, status: "completed" }),
    ];
    expect(kinds(week(sessions))[2]).toBe("done:null,active:A,planned:C,recurring:B");
  });

  it("aucune occurrence avant la création du programme", () => {
    expect(kinds(week([], TODAY))).toEqual(["", "", "recurring:B", "", "recurring:C", "", ""]);
  });

  it("semaine demandée : lundi de la date, bornée à ±1 an, sinon semaine courante", () => {
    expect(isoWeekday("2026-10-18")).toBe(7);
    expect(resolveWeekStart(undefined, TODAY)).toBe(MONDAY);
    expect(resolveWeekStart("2026-10-22", TODAY)).toBe("2026-10-19");
    expect(resolveWeekStart("n'importe quoi", TODAY)).toBe(MONDAY);
    expect(resolveWeekStart("2026-02-30", TODAY)).toBe(MONDAY);
    expect(resolveWeekStart("2030-01-01", TODAY)).toBe("2027-10-11");
  });
});

describe("bibliothèque d'exercices", () => {
  const list = EXERCISE_CATALOG.map((exercise) => ({ ...exercise, id: exercise.slug }));

  it("recherche sans accents ni casse, tous les mots requis", () => {
    expect(normalizeText("Écarté à la Poulie")).toBe("ecarte a la poulie");
    const names = filterExercises(list, { query: "developpe halteres" }).map((e) => e.slug);
    expect(names).toEqual([
      "developpe-couche-halteres",
      "developpe-incline-halteres",
      "developpe-epaules-halteres",
    ]);
  });

  it("filtre par muscle principal et par matériel disponible", () => {
    const biceps = filterExercises(list, { muscle: "biceps" }).map((e) => e.slug);
    expect(biceps).toEqual([
      "curl-halteres",
      "curl-barre",
      "curl-marteau",
      "curl-elastique",
      "curl-poulie",
      "curl-incline-halteres",
      "curl-pupitre",
      "curl-concentre",
      "curl-marteau-corde",
    ]);
    const bodyweight = filterExercises(list, { muscle: "chest", equipment: [] }).map((e) => e.slug);
    expect(bodyweight).toEqual(["pompes", "pompes-genoux"]);
  });
});

describe("durée estimée d'une séance", () => {
  it("échauffement 5 min + séries × (40 s ou durée tenue + repos) + 60 s par exercice", () => {
    // 3 × (40 + 90) + 60 = 450 s ; 3 × (25 + 60) + 60 = 315 s ; + 300 s → 1 065 s ≈ 18 min.
    expect(
      estimateWorkoutMinutes([
        { sets: 3, repMin: 8, repMax: 12, restSeconds: 90, timed: false },
        { sets: 3, repMin: 20, repMax: 30, restSeconds: 60, timed: true },
      ]),
    ).toBe(18);
    expect(estimateWorkoutMinutes([])).toBe(5);
  });
});

describe("illustrations des mouvements", () => {
  it("chaque illustration correspond à un exercice du catalogue et ses deux images existent", () => {
    const slugs = new Set(EXERCISE_CATALOG.map((exercise) => exercise.slug));
    for (const slug of Object.keys(EXERCISE_DEMOS)) {
      expect(slugs.has(slug), slug).toBe(true);
      const images = demoImages(slug);
      expect(images).not.toBeNull();
      for (const path of [images?.start, images?.end]) {
        expect(existsSync(join(process.cwd(), "public", path ?? "")), path).toBe(true);
      }
    }
    expect(Object.keys(EXERCISE_DEMOS).length).toBeGreaterThanOrEqual(55);
  });

  it("sans illustration : null ; la vidéo est une simple recherche YouTube", () => {
    expect(demoImages("burpees")).toBeNull();
    expect(demoImages(null)).toBeNull();
    expect(videoSearchUrl("Écarté à la poulie")).toBe(
      "https://www.youtube.com/results?search_query=%C3%89cart%C3%A9+%C3%A0+la+poulie+exercice+technique",
    );
  });
});

describe("recherche par autres noms", () => {
  it("« kickback », « pec deck », « skull crusher », « rdl » trouvent les exercices", async () => {
    const { aliasesFor, EXERCISE_ALIASES } = await import("./exercise-aliases");
    const list = EXERCISE_CATALOG.map((exercise) => ({
      ...exercise,
      aliases: aliasesFor(exercise.slug),
    }));
    const find = (query: string) => filterExercises(list, { query }).map((e) => e.slug);
    expect(find("kickback")).toEqual([
      "kickback-triceps-haltere",
      "kickback-triceps-poulie",
      "kickback-fessier-poulie",
    ]);
    expect(find("pec deck")).toContain("pec-deck");
    expect(find("skull crusher")).toEqual(["barre-au-front"]);
    expect(find("rdl")).toEqual(["souleve-de-terre-roumain", "souleve-de-terre-roumain-halteres"]);
    // Chaque alias désigne un exercice qui existe.
    const slugs = new Set(EXERCISE_CATALOG.map((exercise) => exercise.slug));
    for (const slug of Object.keys(EXERCISE_ALIASES)) expect(slugs.has(slug), slug).toBe(true);
  });
});
