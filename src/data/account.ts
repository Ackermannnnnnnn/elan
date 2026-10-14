import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { APP_NAME } from "@/config/app";
import type { Database } from "@/types/database";
import { fail, getDb } from "./client";

type TableName = keyof Database["public"]["Tables"];

/** Tables exportées et colonne qui les rattache à l'utilisateur. */
const EXPORTED: readonly {
  table: TableName;
  owner: "id" | "user_id" | "owner_id";
  omit?: string[];
}[] = [
  { table: "profiles", owner: "id" },
  { table: "user_preferences", owner: "user_id" },
  { table: "user_goals", owner: "user_id" },
  { table: "nutrition_targets", owner: "user_id" },
  { table: "weight_entries", owner: "user_id" },
  { table: "body_measurements", owner: "user_id" },
  { table: "progress_photos", owner: "user_id" },
  { table: "activity_entries", owner: "user_id" },
  { table: "water_entries", owner: "user_id" },
  { table: "habits", owner: "user_id" },
  { table: "habit_entries", owner: "user_id" },
  { table: "reminders", owner: "user_id" },
  { table: "user_achievements", owner: "user_id" },
  { table: "weekly_reviews", owner: "user_id" },
  { table: "foods", owner: "owner_id" },
  { table: "meal_categories", owner: "user_id" },
  { table: "food_diary_entries", owner: "user_id" },
  { table: "meals", owner: "user_id" },
  { table: "meal_items", owner: "user_id" },
  { table: "meal_photos", owner: "user_id" },
  { table: "recipes", owner: "user_id" },
  { table: "recipe_ingredients", owner: "user_id" },
  { table: "meal_plans", owner: "user_id" },
  { table: "meal_plan_items", owner: "user_id" },
  { table: "shopping_lists", owner: "user_id" },
  { table: "shopping_list_items", owner: "user_id" },
  { table: "exercise_library", owner: "owner_id" },
  { table: "training_programs", owner: "user_id" },
  { table: "workouts", owner: "user_id" },
  { table: "workout_exercises", owner: "user_id" },
  { table: "workout_sessions", owner: "user_id" },
  { table: "session_exercises", owner: "user_id" },
  { table: "workout_sets", owner: "user_id" },
  { table: "ai_conversations", owner: "user_id" },
  { table: "ai_messages", owner: "user_id" },
  { table: "ai_usage_log", owner: "user_id" },
  // Les clés de chiffrement des notifications ne servent à rien hors de l'appareil.
  { table: "push_subscriptions", owner: "user_id", omit: ["p256dh", "auth"] },
  { table: "push_alarms", owner: "user_id" },
];

const PAGE = 1000;

/**
 * Toutes les données de l'utilisateur, table par table (RGPD, droit d'accès
 * et de portabilité). Lecture paginée : aucune table n'est tronquée.
 */
export async function exportAccountData(): Promise<Record<string, unknown>> {
  const { supabase, user } = await getDb();
  // Lecture générique table par table : les types par table n'apportent rien ici.
  const db = supabase as unknown as SupabaseClient;
  const tables: Record<string, unknown[]> = {};

  for (const { table, owner, omit } of EXPORTED) {
    const rows: Record<string, unknown>[] = [];
    for (let from = 0; ; from += PAGE) {
      const { data, error } = await db
        .from(table)
        .select("*")
        .eq(owner, user.id)
        .order(table === "user_preferences" ? "user_id" : "id", { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) fail(`exportAccountData.${table}`, error, "exportFailed");
      const page = (data ?? []) as Record<string, unknown>[];
      rows.push(
        ...page.map((row) =>
          omit
            ? Object.fromEntries(Object.entries(row).filter(([key]) => !omit.includes(key)))
            : row,
        ),
      );
      if (page.length < PAGE) break;
    }
    tables[table] = rows;
  }

  return {
    application: APP_NAME,
    exportedAt: new Date().toISOString(),
    account: { id: user.id, email: user.email },
    tables,
  };
}

/**
 * Supprime définitivement le compte et toutes ses données, après avoir
 * vérifié le mot de passe (une session restée ouverte ne suffit pas).
 */
export async function deleteAccount(password: string): Promise<"deleted" | "wrongPassword"> {
  const { supabase, user } = await getDb();
  if (!user.email) fail("deleteAccount.email", { code: "no_email" }, "accountDeleteFailed");
  const { error: authError } = await supabase.auth.signInWithPassword({
    email: user.email,
    password,
  });
  if (authError) {
    if (authError.code === "invalid_credentials" || authError.status === 400)
      return "wrongPassword";
    fail("deleteAccount.reauth", authError, "accountDeleteFailed");
  }
  const { error } = await supabase.rpc("delete_my_account");
  if (error) fail("deleteAccount", error, "accountDeleteFailed");
  await supabase.auth.signOut({ scope: "local" });
  return "deleted";
}
