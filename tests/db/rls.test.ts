import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { asAnon, asUser, createTestDatabase, createUser } from "./harness";

let db: PGlite;
let alice: string;
let bob: string;

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, "alice@example.test", "Alice");
  bob = await createUser(db, "bob@example.test");
});

describe("couverture du schéma", () => {
  it("active la RLS sur toutes les tables publiques", async () => {
    const { rows } = await db.query<{ tablename: string }>(
      "select tablename from pg_tables where schemaname = 'public' and not rowsecurity",
    );
    expect(rows.map((row) => row.tablename)).toEqual([]);
  });

  it("définit au moins une politique par table", async () => {
    const { rows } = await db.query<{ tablename: string }>(`
      select t.tablename
      from pg_tables t
      left join pg_policies p on p.schemaname = t.schemaname and p.tablename = t.tablename
      where t.schemaname = 'public'
      group by t.tablename
      having count(p.policyname) = 0
    `);
    expect(rows.map((row) => row.tablename)).toEqual([]);
  });

  it("ne donne aucun droit au rôle anon", async () => {
    const { rows } = await db.query<{ table_name: string }>(`
      select distinct table_name
      from information_schema.role_table_grants
      where table_schema = 'public' and grantee in ('anon', 'PUBLIC')
    `);
    expect(rows.map((row) => row.table_name)).toEqual([]);
  });

  it("limite chaque politique au rôle authenticated", async () => {
    const { rows } = await db.query<{ policyname: string }>(
      "select policyname from pg_policies where schemaname in ('public', 'storage') and roles <> '{authenticated}'",
    );
    expect(rows.map((row) => row.policyname)).toEqual([]);
  });

  it("rattache chaque table privée à la suppression du compte", async () => {
    // Toute colonne user_id / owner_id doit mener à auth.users par une clé
    // étrangère en cascade, directement ou via la table parente.
    const { rows } = await db.query<{ table_name: string }>(`
      select c.table_name
      from information_schema.columns c
      where c.table_schema = 'public'
        and c.column_name in ('user_id', 'owner_id')
        and not exists (
          select 1
          from pg_constraint k
          join pg_attribute a on a.attrelid = k.conrelid and a.attnum = any (k.conkey)
          where k.conrelid = format('public.%I', c.table_name)::regclass
            and k.contype = 'f'
            and k.confdeltype = 'c'
            and a.attname = c.column_name
        )
    `);
    expect(rows.map((row) => row.table_name)).toEqual([]);
  });
});

describe("création d'un compte", () => {
  it("crée le profil, les préférences et les catégories de repas", async () => {
    const result = await asUser(db, alice, async (tx) => ({
      profile: (await tx.query<{ display_name: string }>("select display_name from profiles")).rows,
      preferences: (await tx.query("select user_id from user_preferences")).rows,
      categories: (
        await tx.query<{ key: string }>("select key from meal_categories order by sort_order")
      ).rows,
    }));

    expect(result.profile).toEqual([{ display_name: "Alice" }]);
    expect(result.preferences).toHaveLength(1);
    expect(result.categories.map((row) => row.key)).toEqual([
      "breakfast",
      "lunch",
      "dinner",
      "snack",
    ]);
  });
});

describe("isolation entre utilisateurs", () => {
  it("un visiteur non connecté ne lit rien", async () => {
    await expect(asAnon(db, (tx) => tx.query("select * from profiles"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("chacun ne voit que son propre profil", async () => {
    const rows = await asUser(
      db,
      bob,
      async (tx) => (await tx.query<{ id: string }>("select id from profiles")).rows,
    );
    expect(rows).toEqual([{ id: bob }]);
  });

  it("empêche de modifier le profil d'un autre", async () => {
    const affected = await asUser(
      db,
      bob,
      async (tx) =>
        (await tx.query("update profiles set display_name = 'Piraté' where id = $1", [alice]))
          .affectedRows,
    );
    expect(affected).toBe(0);
  });

  it("empêche de s'approprier un profil en changeant son identifiant", async () => {
    await expect(
      asUser(db, bob, (tx) => tx.query("update profiles set id = $1 where id = $2", [alice, bob])),
    ).rejects.toThrow();
  });

  it("empêche de supprimer un profil, même le sien", async () => {
    await expect(asUser(db, bob, (tx) => tx.query("delete from profiles"))).rejects.toThrow(
      /permission denied/,
    );
  });

  it("cloisonne les pesées en lecture, modification et suppression", async () => {
    await asUser(
      db,
      alice,
      (tx) =>
        tx.query("insert into weight_entries (measured_on, weight_kg) values ('2026-10-01', 82.4)"),
      { commit: true },
    );

    const seenByBob = await asUser(db, bob, async (tx) => ({
      read: (await tx.query("select * from weight_entries")).rows.length,
      updated: (await tx.query("update weight_entries set weight_kg = 50")).affectedRows,
      deleted: (await tx.query("delete from weight_entries")).affectedRows,
    }));
    expect(seenByBob).toEqual({ read: 0, updated: 0, deleted: 0 });

    const seenByAlice = await asUser(
      db,
      alice,
      async (tx) =>
        (await tx.query<{ weight_kg: string }>("select weight_kg from weight_entries")).rows,
    );
    expect(seenByAlice).toEqual([{ weight_kg: "82.40" }]);
  });

  it("refuse d'écrire une ligne au nom d'un autre utilisateur", async () => {
    await expect(
      asUser(db, bob, (tx) =>
        tx.query(
          "insert into weight_entries (user_id, measured_on, weight_kg) values ($1, '2026-10-02', 70)",
          [alice],
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("refuse de transférer une ligne à un autre utilisateur", async () => {
    await expect(
      asUser(db, alice, (tx) => tx.query("update weight_entries set user_id = $1", [bob])),
    ).rejects.toThrow(/row-level security/);
  });

  it("un utilisateur peut créer un aliment personnel, sans droit particulier sur les extensions", async () => {
    // Premier accès au déclencheur de recherche dans cette base : aucun plan
    // d'exécution n'est en cache, les droits de l'appelant sont donc réellement vérifiés.
    const rows = await asUser(
      db,
      bob,
      async (tx) =>
        (
          await tx.query<{ search_text: string }>(
            `insert into foods (owner_id, source, data_quality, name, brand, kcal, protein_g, carbs_g, fat_g)
             values ($1, 'user', 'user', 'Crème brûlée', 'Maison', 300, 4, 20, 22) returning search_text`,
            [bob],
          )
        ).rows,
    );
    expect(rows).toEqual([{ search_text: "creme brulee maison" }]);
  });

  it("empêche d'ajouter un ingrédient à la recette d'un autre", async () => {
    const recipeId = await asUser(
      db,
      alice,
      async (tx) =>
        (
          await tx.query<{ id: string }>(
            "insert into recipes (title) values ('Poulet riz') returning id",
          )
        ).rows[0]!.id,
      { commit: true },
    );

    // Bob tente de rattacher sa ligne à la recette d'Alice : la clé composite
    // (recipe_id, user_id) n'existe pas, l'insertion est rejetée.
    await expect(
      asUser(db, bob, (tx) =>
        tx.query(
          "insert into recipe_ingredients (recipe_id, name, quantity_g) values ($1, 'Riz', 100)",
          [recipeId],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });

  it("empêche d'écrire dans le journal avec la catégorie d'un autre", async () => {
    const aliceCategory = (
      await db.query<{ id: string }>(
        "select id from meal_categories where user_id = $1 and key = 'lunch'",
        [alice],
      )
    ).rows[0]!.id;

    await expect(
      asUser(db, bob, (tx) =>
        tx.query(
          `insert into food_diary_entries
             (entry_date, category_id, description, quantity_g, kcal, protein_g, carbs_g, fat_g)
           values ('2026-10-01', $1, 'Riz', 100, 130, 2.7, 28, 0.3)`,
          [aliceCategory],
        ),
      ),
    ).rejects.toThrow(/foreign key/);
  });
});

describe("catalogues partagés (aliments, exercices)", () => {
  beforeAll(async () => {
    await db.exec(`
      insert into foods (source, source_ref, data_quality, name, kcal, protein_g, carbs_g, fat_g)
      values ('ciqual', 'test-0001', 'verified', 'Pâtes de test, cuites', 126, 4.4, 25, 0.6);
      insert into exercise_library (slug, name, primary_muscle, movement_pattern, difficulty)
      values ('pompes-test', 'Pompes de test', 'chest', 'push_horizontal', 'beginner');
    `);
  });

  it("le catalogue partagé est lisible mais non modifiable", async () => {
    const result = await asUser(db, bob, async (tx) => ({
      readable: (await tx.query("select id from foods where source_ref = 'test-0001'")).rows.length,
      updated: (await tx.query("update foods set kcal = 1 where owner_id is null")).affectedRows,
      deleted: (await tx.query("delete from exercise_library where owner_id is null")).affectedRows,
    }));
    expect(result).toEqual({ readable: 1, updated: 0, deleted: 0 });
  });

  it("un utilisateur ne peut pas injecter d'entrée dans le catalogue partagé", async () => {
    await expect(
      asUser(db, bob, (tx) =>
        tx.query(
          `insert into foods (owner_id, source, source_ref, data_quality, name, kcal, protein_g, carbs_g, fat_g)
           values (null, 'ciqual', '1', 'verified', 'Faux aliment', 0, 0, 0, 0)`,
        ),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("les aliments personnels restent privés", async () => {
    await asUser(
      db,
      alice,
      (tx) =>
        tx.query(
          `insert into foods (owner_id, source, data_quality, name, kcal, protein_g, carbs_g, fat_g)
           values ($1, 'user', 'user', 'Granola maison', 450, 10, 60, 18)`,
          [alice],
        ),
      { commit: true },
    );
    const visibleToBob = await asUser(
      db,
      bob,
      async (tx) => (await tx.query("select id from foods where source = 'user'")).rows.length,
    );
    expect(visibleToBob).toBe(0);
  });

  it("la recherche ignore les accents et la casse", async () => {
    const rows = await asUser(
      db,
      bob,
      async (tx) =>
        (
          await tx.query<{ name: string }>(
            "select name from foods where search_text like '%pates de test%'",
          )
        ).rows,
    );
    expect(rows).toEqual([{ name: "Pâtes de test, cuites" }]);
  });
});

describe("journal d'usage de l'IA", () => {
  it("ne peut être ni modifié ni effacé par l'utilisateur", async () => {
    await asUser(
      db,
      alice,
      (tx) =>
        tx.query(
          "insert into ai_usage_log (feature, provider, model, status) values ('meal_photo', 'anthropic', 'test', 'success')",
        ),
      { commit: true },
    );
    await expect(asUser(db, alice, (tx) => tx.query("delete from ai_usage_log"))).rejects.toThrow(
      /permission denied/,
    );
    await expect(
      asUser(db, alice, (tx) => tx.query("update ai_usage_log set input_tokens = 0")),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("stockage des photos", () => {
  it("n'autorise que le dossier de l'utilisateur connecté", async () => {
    await asUser(
      db,
      alice,
      (tx) =>
        tx.query("insert into storage.objects (bucket_id, name) values ('meal-photos', $1)", [
          `${alice}/repas.jpg`,
        ]),
      { commit: true },
    );

    const visibleToBob = await asUser(
      db,
      bob,
      async (tx) => (await tx.query("select id from storage.objects")).rows.length,
    );
    expect(visibleToBob).toBe(0);

    await expect(
      asUser(db, bob, (tx) =>
        tx.query("insert into storage.objects (bucket_id, name) values ('meal-photos', $1)", [
          `${alice}/intrus.jpg`,
        ]),
      ),
    ).rejects.toThrow(/row-level security/);
  });

  it("garde les buckets privés", async () => {
    const { rows } = await db.query<{ id: string }>("select id from storage.buckets where public");
    expect(rows).toEqual([]);
  });
});

describe("contraintes de validation", () => {
  it("rejette un poids incohérent", async () => {
    await expect(
      asUser(db, bob, (tx) =>
        tx.query("insert into weight_entries (measured_on, weight_kg) values ('2026-10-03', 900)"),
      ),
    ).rejects.toThrow(/check constraint/);
  });

  it("n'accepte qu'un seul objectif principal actif", async () => {
    await expect(
      asUser(db, bob, async (tx) => {
        await tx.query("insert into user_goals (goal_type) values ('fat_loss')");
        await tx.query("insert into user_goals (goal_type) values ('muscle_gain')");
      }),
    ).rejects.toThrow(/unique constraint/);
  });

  it("refuse un prix de course sans source", async () => {
    await expect(
      asUser(db, bob, async (tx) => {
        const list = await tx.query<{ id: string }>(
          "insert into shopping_lists (title) values ('Semaine 41') returning id",
        );
        await tx.query(
          "insert into shopping_list_items (shopping_list_id, name, estimated_price_eur) values ($1, 'Riz', 1.99)",
          [list.rows[0]!.id],
        );
      }),
    ).rejects.toThrow(/check constraint/);
  });
});

describe("suppression du compte", () => {
  it("efface toutes les données de l'utilisateur en cascade", async () => {
    const carol = await createUser(db, "carol@example.test");
    await asUser(
      db,
      carol,
      async (tx) => {
        const category = await tx.query<{ id: string }>(
          "select id from meal_categories where key = 'dinner'",
        );
        await tx.query(
          `insert into food_diary_entries
             (entry_date, category_id, description, quantity_g, kcal, protein_g, carbs_g, fat_g)
           values ('2026-10-01', $1, 'Soupe', 300, 120, 4, 18, 3)`,
          [category.rows[0]!.id],
        );
        const habit = await tx.query<{ id: string }>(
          "insert into habits (key) values ('sleep') returning id",
        );
        await tx.query(
          "insert into habit_entries (habit_id, entry_date, completed) values ($1, '2026-10-01', true)",
          [habit.rows[0]!.id],
        );
        const conversation = await tx.query<{ id: string }>(
          "insert into ai_conversations (kind) values ('nutrition_coach') returning id",
        );
        await tx.query(
          "insert into ai_messages (conversation_id, role, content) values ($1, 'user', 'Bonjour')",
          [conversation.rows[0]!.id],
        );
      },
      { commit: true },
    );

    await db.query("delete from auth.users where id = $1", [carol]);

    const { rows } = await db.query<{ remaining: number }>(
      `select (
         (select count(*) from profiles where id = $1)
         + (select count(*) from user_preferences where user_id = $1)
         + (select count(*) from meal_categories where user_id = $1)
         + (select count(*) from food_diary_entries where user_id = $1)
         + (select count(*) from habits where user_id = $1)
         + (select count(*) from habit_entries where user_id = $1)
         + (select count(*) from ai_conversations where user_id = $1)
         + (select count(*) from ai_messages where user_id = $1)
       )::int as remaining`,
      [carol],
    );
    expect(rows[0]?.remaining).toBe(0);
  });
});
