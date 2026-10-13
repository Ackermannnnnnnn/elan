"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect, unstable_rethrow } from "next/navigation";
import { ROUTES } from "@/config/routes";
import { DataError } from "@/data/client";
import { saveOnboarding } from "@/data/onboarding";
import { fieldErrorsFromZod, type ActionResult } from "@/lib/action-result";
import { todayInTimeZone } from "@/lib/dates";
import { ONBOARDED_COOKIE, ONBOARDED_COOKIE_OPTIONS } from "@/lib/onboarding-cookie";
import { planFromOnboarding } from "./plan";
import { onboardingSchema, type OnboardingFormValues } from "./schema";

/**
 * Valide les réponses, RECALCULE le plan côté serveur (le résultat affiché
 * dans le navigateur n'est jamais repris tel quel) et enregistre le tout.
 */
export async function completeOnboarding(
  input: OnboardingFormValues,
  mode: "create" | "edit",
): Promise<ActionResult<keyof OnboardingFormValues>> {
  const parsed = onboardingSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };

  const values = parsed.data;
  const today = todayInTimeZone(values.timeZone);
  const { plan, age } = planFromOnboarding(values, today);

  // Les garde-fous s'appliquent ici aussi : le navigateur ne fait pas autorité.
  if (plan.assessment.blocking.length > 0) return { ok: false, formError: "goalNotAllowed" };

  try {
    await saveOnboarding({ values, plan, age, today });
  } catch (error) {
    unstable_rethrow(error);
    return { ok: false, formError: error instanceof DataError ? error.key : "saveFailed" };
  }

  (await cookies()).set(ONBOARDED_COOKIE, "1", ONBOARDED_COOKIE_OPTIONS);
  revalidatePath("/", "layout");
  redirect(mode === "edit" ? ROUTES.profile : ROUTES.home);
}
