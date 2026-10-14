import type { PGlite, Transaction } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asUser, createTestDatabase, createUser } from "./harness";

let db: PGlite;
let alice: string;
let bob: string;
const ex: Record<string, string> = {};

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, "alice@example.test");
  bob = await createUser(db, "bob@example.test");
  const { rows } = await db.query<{ slug: string; id: string }>(
    "select slug, id from exercise_library where owner_id is null",
  );
  for (const row of rows) ex[row.slug] = row.id;
});

const SLUGS = ["developpe-couche-halteres", "curl-marteau", "crunch", "elevations-laterales"];

/** Séance en cours : 4 exercices de 3 séries ; renvoie les identifiants. */
async function seed(tx: Transaction, status = "in_progress") {
  const program = await tx.query<{ id: string }>(
    "insert into training_programs (name, structure, goal, sessions_per_week, is_active) values ('P', 'full_body', 'strength', 3, false) returning id",
  );
  const workout = await tx.query<{ id: string }>(
    "insert into workouts (program_id, name, weekday) values ($1, 'A', 1) returning id",
    [program.rows[0]?.id],
  );
  const workoutId = workout.rows[0]?.id as string;
  for (const [position, slug] of SLUGS.entries()) {
    await tx.query(
      "insert into workout_exercises (workout_id, exercise_id, position, target_sets, rep_min, rep_max) values ($1, $2, $3, 3, 8, 12)",
      [workoutId, ex[slug], position],
    );
  }
  const session = await tx.query<{ id: string }>(
    "insert into workout_sessions (workout_id, name, scheduled_on, status) values ($1, 'A', '2026-10-15', $2) returning id",
    [workoutId, status],
  );
  const sessionId = session.rows[0]?.id as string;
  const items: string[] = [];
  for (const [position, slug] of SLUGS.entries()) {
    const item = await tx.query<{ id: string }>(
      "insert into session_exercises (session_id, exercise_id, position, rep_min, rep_max, rest_seconds) values ($1, $2, $3, 8, 12, 90) returning id",
      [sessionId, ex[slug], position],
    );
    items.push(item.rows[0]?.id as string);
    await tx.query(
      "insert into workout_sets (session_id, exercise_id, set_number) select $1, $2, n from generate_series(1, 3) n",
      [sessionId, ex[slug]],
    );
  }
  return { sessionId, workoutId, items };
}

const order = async (tx: Transaction, sessionId: string) =>
  (
    await tx.query<{ slug: string; position: number; superset_with_next: boolean }>(
      "select l.slug, s.position, s.superset_with_next from session_exercises s join exercise_library l on l.id = s.exercise_id where s.session_id = $1 order by s.position",
      [sessionId],
    )
  ).rows;

describe("move_session_exercise", () => {
  it("monte et descend sans dépasser les bornes, sans toucher aux séries", async () => {
    await asUser(db, alice, async (tx) => {
      const { sessionId, items } = await seed(tx);
      await tx.query(
        "update workout_sets set weight_kg = 20, reps = 10, completed_at = now() where session_id = $1 and set_number = 1",
        [sessionId],
      );
      const sets = async () =>
        (
          await tx.query(
            "select exercise_id, set_number, weight_kg, reps, completed_at is not null as done from workout_sets where session_id = $1 order by exercise_id, set_number",
            [sessionId],
          )
        ).rows;
      const before = await sets();

      await tx.query("select move_session_exercise($1, 'up')", [items[0]]);
      expect((await order(tx, sessionId)).map((row) => row.slug)).toEqual(SLUGS);
      await tx.query("select move_session_exercise($1, 'down')", [items[3]]);
      expect((await order(tx, sessionId)).map((row) => row.slug)).toEqual(SLUGS);

      await tx.query("select move_session_exercise($1, 'up')", [items[2]]);
      expect((await order(tx, sessionId)).map((row) => row.slug)).toEqual([
        "developpe-couche-halteres",
        "crunch",
        "curl-marteau",
        "elevations-laterales",
      ]);
      await tx.query("select move_session_exercise($1, 'down')", [items[0]]);
      await tx.query("select move_session_exercise($1, 'last')", [items[2]]);
      const final = await order(tx, sessionId);
      expect(final.map((row) => row.slug)).toEqual([
        "developpe-couche-halteres",
        "curl-marteau",
        "elevations-laterales",
        "crunch",
      ]);
      expect(final.map((row) => row.position)).toEqual([0, 1, 2, 3]);
      expect(await sets()).toEqual(before);
    });
  });

  it("sort l'exercice déplacé de son superset", async () => {
    await asUser(db, alice, async (tx) => {
      const { sessionId, items } = await seed(tx);
      await tx.query("update session_exercises set superset_with_next = true where id = any($1)", [
        [items[0], items[2]],
      ]);
      // 2 et 3 enchaînés ; on monte 3 : plus aucun superset autour de lui.
      await tx.query("select move_session_exercise($1, 'up')", [items[3]]);
      const rows = await order(tx, sessionId);
      expect(rows.map((row) => [row.slug, row.superset_with_next])).toEqual([
        ["developpe-couche-halteres", true],
        ["curl-marteau", false],
        ["elevations-laterales", false],
        ["crunch", false],
      ]);
    });
  });

  it("refuse l'exercice d'un autre ou d'une séance terminée", async () => {
    const { items } = await asUser(db, alice, (tx) => seed(tx, "completed"), { commit: true });
    await expect(
      asUser(db, alice, (tx) => tx.query("select move_session_exercise($1, 'up')", [items[1]])),
    ).rejects.toThrow(/sessionNotOpen/);
    await expect(
      asUser(db, bob, (tx) => tx.query("select move_session_exercise($1, 'up')", [items[1]])),
    ).rejects.toThrow(/itemNotFound/);
  });
});

describe("swap_session_exercise", () => {
  it("remplace sur place quand rien n'est fait", async () => {
    await asUser(db, alice, async (tx) => {
      const { sessionId, items } = await seed(tx);
      await tx.query("select swap_session_exercise($1, $2)", [items[1], ex["curl-halteres"]]);
      const rows = await order(tx, sessionId);
      expect(rows.map((row) => row.slug)).toEqual([
        "developpe-couche-halteres",
        "curl-halteres",
        "crunch",
        "elevations-laterales",
      ]);
      const { rows: sets } = await tx.query<{ n: number }>(
        "select count(*)::int as n from workout_sets where session_id = $1 and exercise_id = $2 and completed_at is null",
        [sessionId, ex["curl-halteres"]],
      );
      expect(sets[0]?.n).toBe(3);
      const { rows: old } = await tx.query<{ n: number }>(
        "select count(*)::int as n from workout_sets where session_id = $1 and exercise_id = $2",
        [sessionId, ex["curl-marteau"]],
      );
      expect(old[0]?.n).toBe(0);
      const { rows: trace } = await tx.query<{ replaced: string }>(
        "select replaced_exercise_id as replaced from session_exercises where id = $1",
        [items[1]],
      );
      expect(trace[0]?.replaced).toBe(ex["curl-marteau"]);
    });
  });

  it("garde les séries faites et insère le nouvel exercice juste après", async () => {
    await asUser(db, alice, async (tx) => {
      const { sessionId, items } = await seed(tx);
      await tx.query("update session_exercises set superset_with_next = true where id = $1", [
        items[1],
      ]);
      await tx.query(
        "update workout_sets set weight_kg = 14, reps = 10, completed_at = now() where session_id = $1 and exercise_id = $2 and set_number = 1",
        [sessionId, ex["curl-marteau"]],
      );
      await tx.query("select swap_session_exercise($1, $2)", [items[1], ex["curl-halteres"]]);
      const rows = await order(tx, sessionId);
      expect(rows.map((row) => [row.slug, row.position, row.superset_with_next])).toEqual([
        ["developpe-couche-halteres", 0, false],
        ["curl-marteau", 1, false],
        ["curl-halteres", 2, true],
        ["crunch", 3, false],
        ["elevations-laterales", 4, false],
      ]);
      const { rows: sets } = await tx.query<{ slug: string; n: number; done: number }>(
        "select l.slug, count(*)::int as n, count(w.completed_at)::int as done from workout_sets w join exercise_library l on l.id = w.exercise_id where w.session_id = $1 and l.slug in ('curl-marteau', 'curl-halteres') group by l.slug order by l.slug",
        [sessionId],
      );
      expect(sets).toEqual([
        { slug: "curl-halteres", n: 2, done: 0 },
        { slug: "curl-marteau", n: 1, done: 1 },
      ]);
    });
  });

  it("demande l'objectif du nouvel exercice quand on passe aux secondes", async () => {
    await expect(
      asUser(db, alice, async (tx) => {
        const { items } = await seed(tx);
        await tx.query("select swap_session_exercise($1, $2)", [items[2], ex["gainage-planche"]]);
      }),
    ).rejects.toThrow(/needsPrescription/);
    await asUser(db, alice, async (tx) => {
      const { sessionId, items } = await seed(tx);
      await tx.query(
        "select swap_session_exercise($1, $2, false, 20::smallint, 40::smallint, 45::smallint)",
        [items[2], ex["gainage-planche"]],
      );
      const { rows } = await tx.query(
        "select rep_min, rep_max, rest_seconds from session_exercises where session_id = $1 and exercise_id = $2",
        [sessionId, ex["gainage-planche"]],
      );
      expect(rows).toEqual([{ rep_min: 20, rep_max: 40, rest_seconds: 45 }]);
    });
  });

  it("refuse un exercice déjà dans la séance", async () => {
    await expect(
      asUser(db, alice, async (tx) => {
        const { items } = await seed(tx);
        await tx.query("select swap_session_exercise($1, $2)", [items[0], ex["crunch"]]);
      }),
    ).rejects.toThrow(/exerciseAlreadyInSession/);
  });

  it("remplace aussi dans la séance type si demandé", async () => {
    await asUser(db, alice, async (tx) => {
      const { workoutId, items } = await seed(tx);
      await tx.query("select swap_session_exercise($1, $2, true)", [items[1], ex["curl-halteres"]]);
      const { rows } = await tx.query<{ slug: string }>(
        "select l.slug from workout_exercises w join exercise_library l on l.id = w.exercise_id where w.workout_id = $1 order by w.position",
        [workoutId],
      );
      expect(rows.map((row) => row.slug)).toEqual([
        "developpe-couche-halteres",
        "curl-halteres",
        "crunch",
        "elevations-laterales",
      ]);
    });
  });

  it("refuse l'exercice d'un autre utilisateur", async () => {
    const { items } = await asUser(db, alice, (tx) => seed(tx), { commit: true });
    await expect(
      asUser(db, bob, (tx) =>
        tx.query("select swap_session_exercise($1, $2)", [items[1], ex["curl-halteres"]]),
      ),
    ).rejects.toThrow(/itemNotFound/);
  });
});
