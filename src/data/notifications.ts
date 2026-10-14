import "server-only";
import type { Row } from "@/types/database";
import { fail, getDb } from "./client";

// --- Abonnements (un par appareil) ------------------------------------------------------

export type PushSubscriptionInput = { endpoint: string; p256dh: string; auth: string };

/** Enregistre l'abonnement de cet appareil, ou signale qu'il est toujours utilisé. */
export async function savePushSubscription(input: PushSubscriptionInput): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase.from("push_subscriptions").upsert(
    {
      user_id: user.id,
      endpoint: input.endpoint,
      p256dh: input.p256dh,
      auth: input.auth,
      last_seen_at: new Date().toISOString(),
    },
    { onConflict: "user_id,endpoint" },
  );
  if (error) fail("savePushSubscription", error, "saveFailed");
}

export async function deletePushSubscription(endpoint: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase
    .from("push_subscriptions")
    .delete()
    .eq("user_id", user.id)
    .eq("endpoint", endpoint);
  if (error) fail("deletePushSubscription", error, "deleteFailed");
}

export async function getPushSubscription(endpoint: string): Promise<PushSubscriptionInput | null> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("user_id", user.id)
    .eq("endpoint", endpoint)
    .maybeSingle();
  if (error) fail("getPushSubscription", error);
  return data;
}

// --- Alarme de fin de repos ------------------------------------------------------------

/** Programme (ou reprogramme) la notification de fin de repos. */
export async function setRestAlarm(input: {
  seconds: number;
  detail: string | null;
  url: string;
}): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase.from("push_alarms").upsert(
    {
      user_id: user.id,
      kind: "rest",
      fire_at: new Date(Date.now() + input.seconds * 1000).toISOString(),
      detail: input.detail,
      url: input.url,
    },
    { onConflict: "user_id,kind" },
  );
  if (error) fail("setRestAlarm", error, "saveFailed");
}

export async function clearRestAlarm(): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase
    .from("push_alarms")
    .delete()
    .eq("user_id", user.id)
    .eq("kind", "rest");
  if (error) fail("clearRestAlarm", error, "deleteFailed");
}

// --- Rappels ---------------------------------------------------------------------------

export const REMINDER_KINDS = ["weigh_in", "meal_log", "workout", "meal_prep"] as const;
export type ReminderKind = (typeof REMINDER_KINDS)[number];

export type ReminderSetting = {
  kind: ReminderKind;
  enabled: boolean;
  /** « HH:MM » */
  time: string;
  weekdays: number[];
};

/** Réglages proposés tant que l'utilisateur n'a rien choisi (tous désactivés). */
export const REMINDER_DEFAULTS: Record<ReminderKind, Omit<ReminderSetting, "kind">> = {
  weigh_in: { enabled: false, time: "07:30", weekdays: [1, 2, 3, 4, 5, 6, 7] },
  meal_log: { enabled: false, time: "20:30", weekdays: [1, 2, 3, 4, 5, 6, 7] },
  workout: { enabled: false, time: "17:30", weekdays: [1, 3, 5] },
  meal_prep: { enabled: false, time: "10:00", weekdays: [7] },
};

type ReminderRow = Pick<Row<"reminders">, "kind" | "enabled" | "time_local" | "weekdays">;

export async function listReminders(): Promise<ReminderSetting[]> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("reminders")
    .select("kind, enabled, time_local, weekdays")
    .eq("user_id", user.id);
  if (error) fail("listReminders", error);
  return REMINDER_KINDS.map((kind) => {
    const row = (data as ReminderRow[]).find((candidate) => candidate.kind === kind);
    if (!row) return { kind, ...REMINDER_DEFAULTS[kind] };
    return {
      kind,
      enabled: row.enabled,
      time: row.time_local.slice(0, 5),
      weekdays: [...row.weekdays].sort(),
    };
  });
}

export async function saveReminders(settings: readonly ReminderSetting[]): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase.from("reminders").upsert(
    settings.map((setting) => ({
      user_id: user.id,
      kind: setting.kind,
      enabled: setting.enabled,
      time_local: setting.time,
      weekdays: setting.weekdays,
    })),
    { onConflict: "user_id,kind" },
  );
  if (error) fail("saveReminders", error, "saveFailed");
}
