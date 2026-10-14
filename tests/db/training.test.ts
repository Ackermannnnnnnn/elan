import { readFileSync } from "node:fs";
import { join } from "node:path";
import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { EXERCISE_CATALOG } from "@/domain/exercise-catalog";
import { asAnon, asUser, createTestDatabase, createUser } from "./harness";

let db: PGlite;
let alice: string;
let bob: string;

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, "alice@example.test");
  bob = await createUser(db, "bob@example.test");
});

type Row = {
  slug: string;
  name: string;
  primary_muscle: string;
  movement_pattern: string;
  equipment: string[];
  difficulty: string;
  is_compound: boolean;
  is_timed: boolean;
  caution_areas: string[];
};

describe("bibliothèque d'exercices", () => {
  it("correspond exactement au catalogue du code", async () => {
    const { rows } = await db.query<Row>(
      "select slug, name, primary_muscle, movement_pattern, equipment, difficulty, is_compound, is_timed, caution_areas from exercise_library where owner_id is null order by slug",
    );
    const expected = [...EXERCISE_CATALOG]
      .sort((a, b) => (a.slug < b.slug ? -1 : 1))
      .map((exercise) => ({
        slug: exercise.slug,
        name: exercise.name,
        primary_muscle: exercise.primary,
        movement_pattern: exercise.pattern,
        equipment: exercise.equipment,
        difficulty: exercise.difficulty,
        is_compound: exercise.compound,
        is_timed: exercise.timed ?? false,
        caution_areas: exercise.caution,
      }));
    expect(rows).toEqual(expected);
  });

  it("est lisible mais pas modifiable par un utilisateur", async () => {
    const result = await asUser(db, alice, async (tx) => ({
      readable: (await tx.query("select id from exercise_library where owner_id is null")).rows
        .length,
      updated: (await tx.query("update exercise_library set name = 'x' where owner_id is null"))
        .affectedRows,
    }));
    expect(result).toEqual({ readable: EXERCISE_CATALOG.length, updated: 0 });
  });
});

describe("séances", () => {
  const setup = async (userId: string) =>
    asUser(
      db,
      userId,
      async (tx) => {
        const program = await tx.query<{ id: string }>(
          "insert into training_programs (name, structure, goal, sessions_per_week) values ('P', 'full_body', 'strength', 3) returning id",
        );
        const workout = await tx.query<{ id: string }>(
          "insert into workouts (program_id, name, weekday) values ($1, 'A', 1) returning id",
          [program.rows[0]?.id],
        );
        return workout.rows[0]?.id as string;
      },
      { commit: true },
    );

  it("n'autorise qu'une séance en cours (ou en pause) à la fois", async () => {
    const workoutId = await setup(alice);
    await expect(
      asUser(db, alice, async (tx) => {
        const insert = (status: string) =>
          tx.query(
            "insert into workout_sessions (workout_id, name, scheduled_on, status) values ($1, 'A', '2026-10-12', $2)",
            [workoutId, status],
          );
        await insert("in_progress");
        await insert("paused");
      }),
    ).rejects.toThrow(/workout_sessions_one_active/);
  });

  it("permet plusieurs séances terminées et cloisonne les comptes", async () => {
    const workoutId = await setup(bob);
    const count = await asUser(db, bob, async (tx) => {
      for (const day of ["2026-10-05", "2026-10-07"]) {
        await tx.query(
          "insert into workout_sessions (workout_id, name, scheduled_on, status) values ($1, 'A', $2, 'completed')",
          [workoutId, day],
        );
      }
      return (await tx.query("select id from workout_sessions")).rows.length;
    });
    expect(count).toBe(2);
    const seenByAlice = await asUser(
      db,
      alice,
      async (tx) => (await tx.query("select id from workouts where name = 'A'")).rows.length,
    );
    expect(seenByAlice).toBe(1);
  });
});

describe("planning souple", () => {
  let carol: string;
  let workoutId: string;
  beforeAll(async () => {
    carol = await createUser(db, "carol@example.test");
    workoutId = await asUser(
      db,
      carol,
      async (tx) => {
        const program = await tx.query<{ id: string }>(
          "insert into training_programs (name, structure, goal, sessions_per_week, origin) values ('Mes séances', 'custom', 'general_fitness', 1, 'manual') returning id",
        );
        // Séance « à la demande » : pas de jour fixe.
        const onDemand = await tx.query<{ id: string }>(
          "insert into workouts (program_id, name, weekday, focus) values ($1, 'Mobilité', null, 'custom') returning id",
          [program.rows[0]?.id],
        );
        expect(onDemand.rows).toHaveLength(1);
        const workout = await tx.query<{ id: string }>(
          "insert into workouts (program_id, name, weekday, focus) values ($1, 'Dos', 1, 'custom') returning id",
          [program.rows[0]?.id],
        );
        return workout.rows[0]?.id as string;
      },
      { commit: true },
    );
  });

  const insert = (status: string, scheduledOn: string, originalDate: string | null) =>
    asUser(db, carol, (tx) =>
      tx.query(
        "insert into workout_sessions (workout_id, name, scheduled_on, original_date, status) values ($1, 'Dos', $2, $3, $4)",
        [workoutId, scheduledOn, originalDate, status],
      ),
    );

  it("une occurrence n'est déplacée ou sautée qu'une fois", async () => {
    await expect(
      asUser(db, carol, async (tx) => {
        const add = (status: string, on: string) =>
          tx.query(
            "insert into workout_sessions (workout_id, name, scheduled_on, original_date, status) values ($1, 'Dos', $2, '2026-10-12', $3)",
            [workoutId, on, status],
          );
        await add("planned", "2026-10-14");
        await add("skipped", "2026-10-12");
      }),
    ).rejects.toThrow(/workout_sessions_one_override/);
  });

  it("une séance sautée reste à sa date d'origine", async () => {
    await expect(insert("skipped", "2026-10-13", "2026-10-12")).rejects.toThrow(
      /workout_sessions_skipped_in_place/,
    );
    await expect(insert("skipped", "2026-10-12", null)).rejects.toThrow(
      /workout_sessions_skipped_in_place/,
    );
    await expect(insert("skipped", "2026-10-12", "2026-10-12")).resolves.toBeDefined();
  });

  it("refaire une séance déjà faite reste possible (pas de contrainte sur les séances terminées)", async () => {
    await expect(
      asUser(db, carol, async (tx) => {
        for (let index = 0; index < 2; index += 1) {
          await tx.query(
            "insert into workout_sessions (workout_id, name, scheduled_on, original_date, status) values ($1, 'Dos', '2026-10-13', '2026-10-12', 'completed')",
            [workoutId],
          );
        }
      }),
    ).resolves.toBeUndefined();
  });

  it("un exercice personnel reste privé et ne peut pas être supprimé s'il est utilisé", async () => {
    const exerciseId = await asUser(
      db,
      carol,
      async (tx) => {
        const exercise = await tx.query<{ id: string }>(
          "insert into exercise_library (owner_id, name, primary_muscle, movement_pattern, difficulty) values (auth.uid(), 'Tirage serviette', 'back', 'pull_horizontal', 'beginner') returning id",
        );
        const id = exercise.rows[0]?.id as string;
        await tx.query(
          "insert into workout_exercises (workout_id, exercise_id, target_sets, rep_min, rep_max) values ($1, $2, 3, 8, 12)",
          [workoutId, id],
        );
        return id;
      },
      { commit: true },
    );
    const seenByBob = await asUser(
      db,
      bob,
      async (tx) =>
        (await tx.query("select id from exercise_library where id = $1", [exerciseId])).rows.length,
    );
    expect(seenByBob).toBe(0);
    await expect(
      asUser(db, carol, (tx) =>
        tx.query("delete from exercise_library where id = $1", [exerciseId]),
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("plan propre à chaque séance", () => {
  let dana: string;
  beforeAll(async () => {
    dana = await createUser(db, "dana@example.test");
  });

  it("reprend l'ordre et les objectifs de la séance type pour les séances existantes", async () => {
    const { sessionId, squat, curl } = await asUser(
      db,
      dana,
      async (tx) => {
        const ids = await tx.query<{ id: string; slug: string }>(
          "select id, slug from exercise_library where slug in ('squat-barre', 'curl-halteres', 'gainage-planche')",
        );
        const id = (slug: string) => ids.rows.find((row) => row.slug === slug)?.id as string;
        const program = await tx.query<{ id: string }>(
          "insert into training_programs (name, structure, goal, sessions_per_week) values ('P', 'full_body', 'strength', 3) returning id",
        );
        const workout = await tx.query<{ id: string }>(
          "insert into workouts (program_id, name, weekday) values ($1, 'A', 1) returning id",
          [program.rows[0]?.id],
        );
        const workoutId = workout.rows[0]?.id;
        await tx.query(
          "insert into workout_exercises (workout_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds) values ($1, $2, 0, 4, 3, 5, 180), ($1, $3, 1, 3, 10, 15, 60)",
          [workoutId, id("squat-barre"), id("curl-halteres")],
        );
        const session = await tx.query<{ id: string }>(
          "insert into workout_sessions (workout_id, name, scheduled_on, status) values ($1, 'A', '2026-10-12', 'completed') returning id",
          [workoutId],
        );
        const sessionId = session.rows[0]?.id as string;
        // Séries saisies avant la migration : le gainage a été ajouté hors programme.
        await tx.query(
          "insert into workout_sets (session_id, exercise_id, set_number) values ($1, $2, 1), ($1, $3, 1), ($1, $4, 1)",
          [sessionId, id("gainage-planche"), id("curl-halteres"), id("squat-barre")],
        );
        return { sessionId, squat: id("squat-barre"), curl: id("curl-halteres") };
      },
      { commit: true },
    );
    // On rejoue la reprise de la migration, telle qu'écrite dans le fichier.
    const migration = readFileSync(
      join(import.meta.dirname, "../../supabase/migrations/20261013200000_session_plan.sql"),
      "utf8",
    );
    const backfill = migration.slice(migration.indexOf("insert into public.session_exercises"));
    await db.exec(backfill);
    const { rows } = await db.query<{
      exercise_id: string;
      position: number;
      rep_min: number;
      rep_max: number;
      rest_seconds: number | null;
    }>(
      "select exercise_id, position, rep_min, rep_max, rest_seconds from session_exercises where session_id = $1 order by position",
      [sessionId],
    );
    expect(rows.map((row) => row.position)).toEqual([0, 1, 2]);
    expect(rows[0]).toMatchObject({
      exercise_id: squat,
      rep_min: 3,
      rep_max: 5,
      rest_seconds: 180,
    });
    expect(rows[1]).toMatchObject({
      exercise_id: curl,
      rep_min: 10,
      rep_max: 15,
      rest_seconds: 60,
    });
    // Exercice hors programme : en dernier, avec un objectif par défaut.
    expect(rows[2]).toMatchObject({ rep_min: 8, rep_max: 12, rest_seconds: null });
  });

  it("un exercice n'apparaît qu'une fois par séance, et le plan est privé", async () => {
    const sessionId = (
      await db.query<{ id: string }>("select id from workout_sessions where user_id = $1 limit 1", [
        dana,
      ])
    ).rows[0]?.id;
    await expect(
      asUser(db, dana, async (tx) => {
        const row = await tx.query<{ exercise_id: string }>(
          "select exercise_id from session_exercises where session_id = $1 limit 1",
          [sessionId],
        );
        await tx.query(
          "insert into session_exercises (session_id, exercise_id, rep_min, rep_max) values ($1, $2, 8, 12)",
          [sessionId, row.rows[0]?.exercise_id],
        );
      }),
    ).rejects.toThrow(/session_exercises_session_id_exercise_id_key/);
    const seenByBob = await asUser(
      db,
      bob,
      async (tx) => (await tx.query("select id from session_exercises")).rows.length,
    );
    expect(seenByBob).toBe(0);
  });
});

describe("démarrer une séance (fonction start_session)", () => {
  it("crée la séance, son plan et ses séries ; reprend la séance en cours ; cloisonne", async () => {
    const erin = await createUser(db, "erin@example.test");
    const workoutId = await asUser(
      db,
      erin,
      async (tx) => {
        const ids = await tx.query<{ id: string; slug: string }>(
          "select id, slug from exercise_library where slug in ('pompes', 'curl-halteres')",
        );
        const program = await tx.query<{ id: string }>(
          "insert into training_programs (name, structure, goal, sessions_per_week) values ('P', 'custom', 'general_fitness', 1) returning id",
        );
        const workout = await tx.query<{ id: string }>(
          "insert into workouts (program_id, name, weekday) values ($1, 'Haut', 3) returning id",
          [program.rows[0]?.id],
        );
        const id = workout.rows[0]?.id as string;
        await tx.query(
          "insert into workout_exercises (workout_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds, superset_with_next) values ($1, $2, 0, 3, 8, 12, 90, true), ($1, $3, 1, 2, 10, 15, 60, false)",
          [id, ids.rows[0]?.id, ids.rows[1]?.id],
        );
        return id;
      },
      { commit: true },
    );

    const result = await asUser(db, erin, async (tx) => {
      // Mercredi 14 octobre 2026 : l'occurrence du mercredi est rattachée.
      const first = await tx.query<{ id: string }>(
        "select public.start_session($1, '2026-10-14', '2026-10-14') as id",
        [workoutId],
      );
      const again = await tx.query<{ id: string }>(
        "select public.start_session($1, '2026-10-14') as id",
        [workoutId],
      );
      const sessionId = first.rows[0]?.id;
      const session = await tx.query<{ status: string; original_date: string | null }>(
        "select status, original_date::text from workout_sessions where id = $1",
        [sessionId],
      );
      const plan = await tx.query<{
        position: number;
        superset_with_next: boolean;
        rest_seconds: number;
      }>(
        "select position, superset_with_next, rest_seconds from session_exercises where session_id = $1 order by position",
        [sessionId],
      );
      const sets = await tx.query<{ n: number }>(
        "select count(*)::int as n from workout_sets where session_id = $1",
        [sessionId],
      );
      return {
        sameAgain: again.rows[0]?.id === sessionId,
        session: session.rows[0],
        plan: plan.rows,
        sets: sets.rows[0]?.n,
      };
    });
    expect(result.sameAgain).toBe(true);
    expect(result.session).toEqual({ status: "in_progress", original_date: "2026-10-14" });
    expect(result.plan).toEqual([
      { position: 0, superset_with_next: true, rest_seconds: 90 },
      { position: 1, superset_with_next: false, rest_seconds: 60 },
    ]);
    expect(result.sets).toBe(5);

    // Un autre compte ne peut pas démarrer la séance type d'Erin.
    await expect(
      asUser(db, bob, (tx) =>
        tx.query("select public.start_session($1, '2026-10-14')", [workoutId]),
      ),
    ).rejects.toThrow(/itemNotFound/);
    // Un visiteur non connecté non plus.
    await expect(
      asAnon(db, (tx) => tx.query("select public.start_session($1, '2026-10-14')", [workoutId])),
    ).rejects.toThrow(/permission denied/);
  });
});
