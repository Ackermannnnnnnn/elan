import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { EXERCISE_CATALOG } from "@/domain/exercise-catalog";
import { asUser, createTestDatabase, createUser } from "./harness";

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
