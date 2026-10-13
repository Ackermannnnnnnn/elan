import "server-only";
import { cache } from "react";
import { defaultTimeZone } from "@/i18n/config";
import { todayInTimeZone, type IsoDate } from "@/lib/dates";
import type { Row } from "@/types/database";
import { fail, getDb } from "./client";

const PROFILE_COLUMNS =
  "id, display_name, birth_date, sex, height_cm, activity_level, occupation_type, avg_daily_steps, training_level, timezone, onboarding_completed_at, health_data_consent_at" as const;

export type Profile = Pick<
  Row<"profiles">,
  | "id"
  | "display_name"
  | "birth_date"
  | "sex"
  | "height_cm"
  | "activity_level"
  | "occupation_type"
  | "avg_daily_steps"
  | "training_level"
  | "timezone"
  | "onboarding_completed_at"
  | "health_data_consent_at"
>;

/**
 * Profil de l'utilisateur connecté. L'identifiant vient de la session
 * vérifiée : impossible de demander le profil d'un autre.
 * `cache()` : une seule requête par rendu, même si plusieurs composants l'appellent.
 */
export const getOwnProfile = cache(async (): Promise<Profile | null> => {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("profiles")
    .select(PROFILE_COLUMNS)
    .eq("id", user.id)
    .maybeSingle();

  if (error) fail("getOwnProfile", error, "profileLoadFailed");
  return data;
});

/** « Aujourd'hui » pour l'utilisateur, selon le fuseau enregistré dans son profil. */
export async function getToday(): Promise<IsoDate> {
  const profile = await getOwnProfile();
  return todayInTimeZone(profile?.timezone ?? defaultTimeZone);
}

export async function updateOwnProfile(values: { displayName: string }): Promise<void> {
  const { supabase, user } = await getDb();
  // upsert : couvre aussi un compte créé avant l'installation du déclencheur SQL.
  const { error } = await supabase
    .from("profiles")
    .upsert({ id: user.id, display_name: values.displayName }, { onConflict: "id" });

  if (error) fail("updateOwnProfile", error, "profileSaveFailed");
}
