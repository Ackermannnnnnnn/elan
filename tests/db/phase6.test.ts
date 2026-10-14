import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDatabase, createUser } from "./harness";

let db: PGlite;
let alice: string;
let bob: string;

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, "alice@example.test");
  bob = await createUser(db, "bob@example.test");
});

const subscribe = (userId: string, endpoint: string) =>
  asUser(
    db,
    userId,
    (tx) =>
      tx.query("insert into push_subscriptions (endpoint, p256dh, auth) values ($1, $2, $3)", [
        endpoint,
        "p256dh-key-abcdefghij",
        "auth-secret",
      ]),
    { commit: true },
  );

type Message = { endpoint: string; kind: string; detail: string | null; url: string | null };

describe("abonnements et alarmes", () => {
  it("restent privés", async () => {
    await subscribe(alice, "https://push.example.test/alice");
    const seen = await asUser(db, bob, async (tx) => ({
      subscriptions: (await tx.query("select id from push_subscriptions")).rows.length,
    }));
    expect(seen).toEqual({ subscriptions: 0 });
  });

  it("n'accepte qu'une alarme de repos par utilisateur", async () => {
    await expect(
      asUser(db, alice, async (tx) => {
        await tx.query("insert into push_alarms (kind, fire_at) values ('rest', now())");
        await tx.query("insert into push_alarms (kind, fire_at) values ('rest', now())");
      }),
    ).rejects.toThrow(/duplicate key/);
  });

  it("envoie une fin de repos une seule fois, et jamais en retard de plus de 2 minutes", async () => {
    await asUser(
      db,
      alice,
      (tx) =>
        tx.query(
          "insert into push_alarms (kind, fire_at, detail, url) values ('rest', '2026-10-14 10:00:00+00', 'Squat', '/training/sessions/x')",
        ),
      { commit: true },
    );

    const early = await db.query<{ m: Message[] }>(
      "select private.due_rest_alarms('2026-10-14 09:59:58+00') as m",
    );
    expect(early.rows[0]?.m).toEqual([]);

    const due = await db.query<{ m: Message[] }>(
      "select private.due_rest_alarms('2026-10-14 10:00:03+00') as m",
    );
    expect(due.rows[0]?.m).toEqual([
      expect.objectContaining({
        endpoint: "https://push.example.test/alice",
        kind: "rest",
        detail: "Squat",
        url: "/training/sessions/x",
      }),
    ]);
    const again = await db.query<{ m: Message[] }>(
      "select private.due_rest_alarms('2026-10-14 10:00:08+00') as m",
    );
    expect(again.rows[0]?.m).toEqual([]);

    await asUser(
      db,
      alice,
      (tx) =>
        tx.query(
          "insert into push_alarms (kind, fire_at) values ('rest', '2026-10-14 10:00:00+00')",
        ),
      { commit: true },
    );
    const stale = await db.query<{ m: Message[] }>(
      "select private.due_rest_alarms('2026-10-14 10:05:00+00') as m",
    );
    expect(stale.rows[0]?.m).toEqual([]);
    const left = await db.query("select id from push_alarms");
    expect(left.rows).toEqual([]);
  });
});

describe("rappels", () => {
  beforeAll(async () => {
    // Bruxelles en octobre = UTC+2 : 08:00 locales = 06:00 UTC. Le 14/10/2026 est un mercredi.
    await asUser(
      db,
      alice,
      (tx) =>
        tx.query(
          "insert into reminders (kind, enabled, time_local, weekdays) values ('weigh_in', true, '08:00', '{3}'), ('meal_prep', true, '08:00', '{1}')",
        ),
      { commit: true },
    );
  });

  const due = async (at: string) =>
    (await db.query<{ m: Message[] }>("select private.due_reminders($1) as m", [at])).rows[0]?.m;

  it("respecte l'heure locale, les jours choisis, et n'envoie qu'une fois par jour", async () => {
    expect(await due("2026-10-14 05:59:00+00")).toEqual([]);
    expect(await due("2026-10-14 06:20:00+00")).toEqual([]); // hors de la fenêtre de 15 min
    expect(await due("2026-10-14 06:01:00+00")).toEqual([
      expect.objectContaining({ kind: "weigh_in", endpoint: "https://push.example.test/alice" }),
    ]);
    expect(await due("2026-10-14 06:02:00+00")).toEqual([]);
  });

  it("ne rappelle pas une pesée déjà faite", async () => {
    await asUser(
      db,
      alice,
      (tx) =>
        tx.query("insert into weight_entries (measured_on, weight_kg) values ('2026-10-21', 80)"),
      { commit: true },
    );
    expect(await due("2026-10-21 06:01:00+00")).toEqual([]);
    const { rows } = await db.query<{ last_sent_on: string }>(
      "select last_sent_on::text from reminders where kind = 'weigh_in'",
    );
    expect(rows[0]?.last_sent_on).toBe("2026-10-21");
  });

  it("ignore les rappels désactivés et les utilisateurs sans abonnement", async () => {
    await asUser(
      db,
      bob,
      (tx) =>
        tx.query(
          "insert into reminders (kind, enabled, time_local) values ('workout', true, '08:00'), ('meal_log', false, '08:00')",
        ),
      { commit: true },
    );
    expect(await due("2026-10-15 06:01:00+00")).toEqual([]);
  });
});

describe("suppression du compte", () => {
  it("est refusée sans session", async () => {
    await expect(asAnon(db, (tx) => tx.query("select delete_my_account()"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("efface toutes les données de l'utilisateur, et seulement les siennes", async () => {
    const seed = (userId: string) =>
      asUser(
        db,
        userId,
        async (tx) => {
          const exercise = await tx.query<{ id: string }>(
            "insert into exercise_library (owner_id, name, primary_muscle, movement_pattern, difficulty) values (auth.uid(), 'Tirage serviette', 'back', 'pull_horizontal', 'beginner') returning id",
          );
          const program = await tx.query<{ id: string }>(
            "insert into training_programs (name, structure, goal, sessions_per_week) values ('P', 'full_body', 'strength', 3) returning id",
          );
          const workout = await tx.query<{ id: string }>(
            "insert into workouts (program_id, name, weekday) values ($1, 'A', 1) returning id",
            [program.rows[0]?.id],
          );
          await tx.query(
            "insert into workout_exercises (workout_id, exercise_id, target_sets, rep_min, rep_max) values ($1, $2, 3, 8, 12)",
            [workout.rows[0]?.id, exercise.rows[0]?.id],
          );
          const session = await tx.query<{ id: string }>(
            "insert into workout_sessions (workout_id, name, scheduled_on, status) values ($1, 'A', '2026-10-12', 'completed') returning id",
            [workout.rows[0]?.id],
          );
          await tx.query(
            "insert into workout_sets (session_id, exercise_id, set_number) values ($1, $2, 1)",
            [session.rows[0]?.id, exercise.rows[0]?.id],
          );
          await tx.query(
            "insert into weight_entries (measured_on, weight_kg) values ('2026-10-01', 81)",
          );
        },
        { commit: true },
      );
    await seed(alice);
    await seed(bob);

    await asUser(db, alice, (tx) => tx.query("select delete_my_account()"), { commit: true });

    const count = async (userId: string) => {
      const { rows } = await db.query<{ n: number }>(
        `select (select count(*) from auth.users where id = $1)
              + (select count(*) from profiles where id = $1)
              + (select count(*) from weight_entries where user_id = $1)
              + (select count(*) from exercise_library where owner_id = $1)
              + (select count(*) from workout_sets where user_id = $1)
              + (select count(*) from push_subscriptions where user_id = $1)
              + (select count(*) from reminders where user_id = $1) as n`,
        [userId],
      );
      return Number(rows[0]?.n);
    };
    expect(await count(alice)).toBe(0);
    expect(await count(bob)).toBeGreaterThan(5);
  });
});
