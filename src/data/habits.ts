import "server-only";
import { countByWeek, HABIT_DEFAULT_TARGETS, HABIT_KEYS, type HabitKey } from "@/domain/habits";
import { addDays, type IsoDate } from "@/lib/dates";
import { fail, getDb } from "./client";
import { getOwnPreferences, type Preferences } from "./plan";

/** Profondeur d'historique lue pour les séries (12 semaines). */
export const HABIT_HISTORY_DAYS = 84;

export type HabitSetting = {
  key: HabitKey;
  active: boolean;
  /** Objectif utilisé (réglage de l'habitude, sinon préférences, sinon valeur par défaut). */
  target: number;
  /** Objectif « naturel » quand l'habitude n'a pas de réglage propre. */
  defaultTarget: number;
  /** Indisponible tant que la fonction liée est coupée (suivi de l'eau). */
  available: boolean;
};

export type HabitData = HabitSetting & {
  /** Valeur par jour (habitudes quotidiennes). */
  values: Map<IsoDate, number>;
  /** Séances par semaine (clé = lundi) pour l'habitude hebdomadaire. */
  weeks: Map<IsoDate, number>;
};

function defaultTarget(key: HabitKey, preferences: Preferences | null): number {
  switch (key) {
    case "meals_logged":
      return preferences?.meals_per_day ?? HABIT_DEFAULT_TARGETS.meals_logged;
    case "hydration":
      return preferences?.daily_water_goal_ml || HABIT_DEFAULT_TARGETS.hydration;
    case "walking":
      return preferences?.daily_steps_goal || HABIT_DEFAULT_TARGETS.walking;
    case "workouts":
      return preferences?.sessions_per_week || HABIT_DEFAULT_TARGETS.workouts;
    case "sleep":
      return HABIT_DEFAULT_TARGETS.sleep;
  }
}

/** Le sommeil demande une saisie chaque jour : il n'est suivi que si on l'active. */
const ACTIVE_BY_DEFAULT: Record<HabitKey, boolean> = {
  meals_logged: true,
  hydration: true,
  walking: true,
  workouts: true,
  sleep: false,
};

type HabitRow = { id: string; key: string; target_value: number | null; is_active: boolean };

async function listHabitRows(): Promise<HabitRow[]> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("habits")
    .select("id, key, target_value, is_active")
    .eq("user_id", user.id)
    .neq("key", "custom");
  if (error) fail("listHabitRows", error);
  return data;
}

function toSettings(rows: HabitRow[], preferences: Preferences | null): HabitSetting[] {
  return HABIT_KEYS.map((key) => {
    const row = rows.find((candidate) => candidate.key === key);
    const fallback = defaultTarget(key, preferences);
    const available = key !== "hydration" || preferences?.water_tracking_enabled !== false;
    return {
      key,
      active: available && (row ? row.is_active : ACTIVE_BY_DEFAULT[key]),
      target: row?.target_value ?? fallback,
      defaultTarget: fallback,
      available,
    };
  });
}

export async function getHabitSettings(): Promise<HabitSetting[]> {
  const [rows, preferences] = await Promise.all([listHabitRows(), getOwnPreferences()]);
  return toSettings(rows, preferences);
}

/**
 * Données de toutes les habitudes sur les 12 dernières semaines. Rien n'est
 * saisi deux fois : repas, eau, pas et séances viennent de ce qui est déjà
 * enregistré ailleurs ; seul le sommeil a sa propre saisie.
 */
export async function getHabitsOverview(today: IsoDate): Promise<HabitData[]> {
  const { supabase, user } = await getDb();
  const from = addDays(today, -(HABIT_HISTORY_DAYS - 1));

  const [rows, preferences, diary, water, steps, sessions, sleep] = await Promise.all([
    listHabitRows(),
    getOwnPreferences(),
    supabase
      .from("food_diary_entries")
      .select("entry_date, category_id")
      .eq("user_id", user.id)
      .gte("entry_date", from)
      .lte("entry_date", today)
      .limit(10000),
    supabase
      .from("water_entries")
      .select("entry_date, amount_ml")
      .eq("user_id", user.id)
      .gte("entry_date", from)
      .lte("entry_date", today)
      .limit(10000),
    supabase
      .from("activity_entries")
      .select("entry_date, steps")
      .eq("user_id", user.id)
      .eq("kind", "steps")
      .gte("entry_date", from)
      .lte("entry_date", today)
      .limit(1000),
    supabase
      .from("workout_sessions")
      .select("scheduled_on")
      .eq("user_id", user.id)
      .eq("status", "completed")
      .gte("scheduled_on", addDays(from, -7))
      .lte("scheduled_on", today)
      .limit(1000),
    supabase
      .from("habit_entries")
      .select("habit_id, entry_date, value")
      .eq("user_id", user.id)
      .gte("entry_date", from)
      .lte("entry_date", today)
      .limit(1000),
  ]);
  for (const [name, result] of Object.entries({ diary, water, steps, sessions, sleep })) {
    if (result.error) fail(`getHabitsOverview.${name}`, result.error);
  }

  const meals = new Map<IsoDate, Set<string>>();
  for (const entry of diary.data ?? []) {
    const day = meals.get(entry.entry_date) ?? new Set<string>();
    day.add(entry.category_id);
    meals.set(entry.entry_date, day);
  }
  const sum = (
    items: { date: IsoDate; value: number }[],
    combine = (a: number, b: number) => a + b,
  ) => {
    const map = new Map<IsoDate, number>();
    for (const { date, value } of items) {
      const previous = map.get(date);
      map.set(date, previous === undefined ? value : combine(previous, value));
    }
    return map;
  };
  const sleepHabit = rows.find((row) => row.key === "sleep");

  const values: Record<HabitKey, Map<IsoDate, number>> = {
    meals_logged: new Map([...meals].map(([date, categories]) => [date, categories.size])),
    hydration: sum(
      (water.data ?? []).map((row) => ({ date: row.entry_date, value: row.amount_ml })),
    ),
    // Plusieurs sources possibles (saisie, téléphone) : on retient la plus haute.
    walking: sum(
      (steps.data ?? []).map((row) => ({ date: row.entry_date, value: row.steps ?? 0 })),
      Math.max,
    ),
    sleep: sum(
      (sleep.data ?? [])
        .filter((row) => row.habit_id === sleepHabit?.id && row.value !== null)
        .map((row) => ({ date: row.entry_date, value: row.value as number })),
    ),
    workouts: new Map(),
  };
  const weeks = countByWeek((sessions.data ?? []).map((row) => row.scheduled_on));

  return toSettings(rows, preferences).map((setting) => ({
    ...setting,
    values: values[setting.key],
    weeks: setting.key === "workouts" ? weeks : new Map(),
  }));
}

/** Crée la ligne de réglage d'une habitude si elle n'existe pas encore. */
async function ensureHabit(key: HabitKey, active: boolean): Promise<string> {
  const { supabase, user } = await getDb();
  const { data: existing, error } = await supabase
    .from("habits")
    .select("id")
    .eq("user_id", user.id)
    .eq("key", key)
    .maybeSingle();
  if (error) fail("ensureHabit.select", error);
  if (existing) return existing.id;
  const { data: created, error: insertError } = await supabase
    .from("habits")
    .insert({ user_id: user.id, key, is_active: active })
    .select("id")
    .single();
  if (insertError) fail("ensureHabit.insert", insertError, "saveFailed");
  return created.id;
}

export async function saveHabitSettings(
  settings: readonly { key: HabitKey; active: boolean; target: number }[],
): Promise<void> {
  const { supabase, user } = await getDb();
  const current = await getHabitSettings();
  for (const setting of settings) {
    const base = current.find((item) => item.key === setting.key);
    if (!base) continue;
    const id = await ensureHabit(setting.key, setting.active);
    // Un objectif égal à la valeur « naturelle » n'est pas figé : il suivra les préférences.
    const target = setting.target === base.defaultTarget ? null : setting.target;
    const { error } = await supabase
      .from("habits")
      .update({ is_active: setting.active, target_value: target })
      .eq("id", id)
      .eq("user_id", user.id);
    if (error) fail("saveHabitSettings", error, "saveFailed");
  }
}

/** Heures de sommeil de la nuit qui s'est terminée ce jour-là. `null` efface la saisie. */
export async function saveSleep(date: IsoDate, hours: number | null): Promise<void> {
  const { supabase, user } = await getDb();
  const id = await ensureHabit("sleep", true);
  if (hours === null) {
    const { error } = await supabase
      .from("habit_entries")
      .delete()
      .eq("user_id", user.id)
      .eq("habit_id", id)
      .eq("entry_date", date);
    if (error) fail("saveSleep.delete", error, "deleteFailed");
    return;
  }
  const settings = await getHabitSettings();
  const target = settings.find((item) => item.key === "sleep")?.target ?? 0;
  const { error } = await supabase.from("habit_entries").upsert(
    {
      user_id: user.id,
      habit_id: id,
      entry_date: date,
      value: hours,
      completed: hours >= target,
    },
    { onConflict: "habit_id,entry_date" },
  );
  if (error) fail("saveSleep", error, "saveFailed");
}
