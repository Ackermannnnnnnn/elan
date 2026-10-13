import "server-only";
import { cache } from "react";
import type { IsoDate } from "@/lib/dates";
import type { InsertRow, Row } from "@/types/database";
import { fail, getDb } from "./client";

export type Preferences = Row<"user_preferences">;
export type Goal = Row<"user_goals">;
export type NutritionTargets = Row<"nutrition_targets">;

export const getOwnPreferences = cache(async (): Promise<Preferences | null> => {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("user_preferences")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) fail("getOwnPreferences", error);
  return data;
});

/** Objectif principal en cours (il n'y en a jamais plus d'un). */
export const getActiveGoal = cache(async (): Promise<Goal | null> => {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("user_goals")
    .select("*")
    .eq("user_id", user.id)
    .eq("kind", "primary")
    .eq("status", "active")
    .maybeSingle();
  if (error) fail("getActiveGoal", error);
  return data;
});

export async function listGoalHistory(): Promise<Goal[]> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("user_goals")
    .select("*")
    .eq("user_id", user.id)
    .eq("kind", "primary")
    .order("created_at", { ascending: false })
    .limit(20);
  if (error) fail("listGoalHistory", error);
  return data;
}

/**
 * Cibles nutritionnelles en vigueur à une date : les plus récentes déjà entrées
 * en effet. Pour un jour antérieur aux premières cibles (journal rempli après
 * coup), on retient les premières cibles définies plutôt que de n'en afficher aucune.
 */
export const getTargetsOn = cache(async (date: IsoDate): Promise<NutritionTargets | null> => {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("nutrition_targets")
    .select("*")
    .eq("user_id", user.id)
    .lte("effective_from", date)
    .order("effective_from", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) fail("getTargetsOn", error);
  if (data) return data;

  const { data: earliest, error: earliestError } = await supabase
    .from("nutrition_targets")
    .select("*")
    .eq("user_id", user.id)
    .order("effective_from", { ascending: true })
    .limit(1)
    .maybeSingle();
  if (earliestError) fail("getTargetsOn.earliest", earliestError);
  return earliest;
});

/** Enregistre les cibles en vigueur à partir d'un jour (remplace celles du même jour). */
export async function saveTargets(
  targets: Omit<InsertRow<"nutrition_targets">, "id" | "user_id" | "created_at">,
): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase
    .from("nutrition_targets")
    .upsert({ ...targets, user_id: user.id }, { onConflict: "user_id,effective_from" });
  if (error) fail("saveTargets", error, "saveFailed");
}
