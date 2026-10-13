import "server-only";
import type { IsoDate } from "@/lib/dates";
import type { Row } from "@/types/database";
import { fail, getDb } from "./client";

export type WeightEntry = Pick<Row<"weight_entries">, "id" | "measured_on" | "weight_kg" | "note">;
export type Measurement = Row<"body_measurements">;

// --- Poids ---------------------------------------------------------------------

/** Pesées par ordre chronologique, éventuellement à partir d'une date. */
export async function listWeights(from?: IsoDate): Promise<WeightEntry[]> {
  const { supabase, user } = await getDb();
  let query = supabase
    .from("weight_entries")
    .select("id, measured_on, weight_kg, note")
    .eq("user_id", user.id)
    .order("measured_on", { ascending: true })
    .limit(2000);
  if (from) query = query.gte("measured_on", from);

  const { data, error } = await query;
  if (error) fail("listWeights", error);
  return data;
}

/** Une pesée par jour : enregistrer à nouveau le même jour remplace la valeur. */
export async function saveWeight(input: {
  date: IsoDate;
  weightKg: number;
  note?: string | null;
}): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase.from("weight_entries").upsert(
    {
      user_id: user.id,
      measured_on: input.date,
      weight_kg: input.weightKg,
      note: input.note ?? null,
    },
    { onConflict: "user_id,measured_on" },
  );
  if (error) fail("saveWeight", error, "saveFailed");
}

export async function deleteWeight(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase
    .from("weight_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) fail("deleteWeight", error, "deleteFailed");
}

// --- Mensurations ----------------------------------------------------------------

export type MeasurementValues = {
  waistCm: number | null;
  hipsCm: number | null;
  chestCm: number | null;
  armCm: number | null;
  thighCm: number | null;
};

export async function listMeasurements(limit = 30): Promise<Measurement[]> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("body_measurements")
    .select("*")
    .eq("user_id", user.id)
    .order("measured_on", { ascending: false })
    .limit(limit);
  if (error) fail("listMeasurements", error);
  return data;
}

export async function saveMeasurement(date: IsoDate, values: MeasurementValues): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase.from("body_measurements").upsert(
    {
      user_id: user.id,
      measured_on: date,
      waist_cm: values.waistCm,
      hips_cm: values.hipsCm,
      chest_cm: values.chestCm,
      arm_cm: values.armCm,
      thigh_cm: values.thighCm,
    },
    { onConflict: "user_id,measured_on" },
  );
  if (error) fail("saveMeasurement", error, "saveFailed");
}

export async function deleteMeasurement(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase
    .from("body_measurements")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) fail("deleteMeasurement", error, "deleteFailed");
}

// --- Eau -------------------------------------------------------------------------

export type WaterEntry = Pick<Row<"water_entries">, "id" | "amount_ml" | "consumed_at">;

export async function listWater(date: IsoDate): Promise<WaterEntry[]> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("water_entries")
    .select("id, amount_ml, consumed_at")
    .eq("user_id", user.id)
    .eq("entry_date", date)
    .order("consumed_at", { ascending: true });
  if (error) fail("listWater", error);
  return data;
}

export async function addWater(date: IsoDate, amountMl: number): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase
    .from("water_entries")
    .insert({ user_id: user.id, entry_date: date, amount_ml: amountMl });
  if (error) fail("addWater", error, "saveFailed");
}

export async function deleteWater(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase
    .from("water_entries")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) fail("deleteWater", error, "deleteFailed");
}

// --- Pas -------------------------------------------------------------------------

export async function getSteps(date: IsoDate): Promise<number | null> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("activity_entries")
    .select("steps")
    .eq("user_id", user.id)
    .eq("entry_date", date)
    .eq("kind", "steps")
    .eq("source", "manual")
    .maybeSingle();
  if (error) fail("getSteps", error);
  return data?.steps ?? null;
}

/**
 * Enregistre le total de pas du jour (saisie manuelle).
 * L'unicité « un total par jour et par source » repose sur un index partiel,
 * qu'un upsert ne peut pas cibler : on met à jour, puis on insère si rien n'existait.
 */
export async function saveSteps(date: IsoDate, steps: number): Promise<void> {
  const { supabase, user } = await getDb();
  const { data: updated, error: updateError } = await supabase
    .from("activity_entries")
    .update({ steps })
    .eq("user_id", user.id)
    .eq("entry_date", date)
    .eq("kind", "steps")
    .eq("source", "manual")
    .select("id");
  if (updateError) fail("saveSteps.update", updateError, "saveFailed");
  if (updated.length > 0) return;

  const { error } = await supabase
    .from("activity_entries")
    .insert({ user_id: user.id, entry_date: date, kind: "steps", steps, source: "manual" });
  if (error) fail("saveSteps.insert", error, "saveFailed");
}
