"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ROUTES } from "@/config/routes";
import { getActiveGoal, getTargetsOn, saveTargets } from "@/data/plan";
import { getOwnProfile, getToday } from "@/data/profile";
import { CALORIE_FLOOR } from "@/domain/energy";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/run-action";
import { recalculateTargets } from "./recalculate";
import { carbsFromRemainder, manualTargetsSchema, type ManualTargetsFormValues } from "./schemas";

export async function recalculateTargetsAction(): Promise<ActionResult<string>> {
  return runAction(z.undefined(), undefined, async () => {
    await recalculateTargets();
    revalidatePath("/", "layout");
  });
}

/** Revient au calcul automatique depuis la page de réglage manuel. */
export async function resetTargetsAction(): Promise<ActionResult<string>> {
  const result = await recalculateTargetsAction();
  if (!result.ok) return result;
  redirect(ROUTES.profile);
}

export async function saveManualTargetsAction(
  input: ManualTargetsFormValues,
): Promise<ActionResult<string>> {
  const result = await runAction(manualTargetsSchema, input, async (values) => {
    const [profile, today, goal] = await Promise.all([
      getOwnProfile(),
      getToday(),
      getActiveGoal(),
    ]);
    // Même en réglage manuel, l'application n'enregistre pas de cible dangereusement basse.
    if (values.kcal < CALORIE_FLOOR[profile?.sex ?? "unspecified"]) {
      return { ok: false, formError: "targetsTooLow" };
    }
    const previous = await getTargetsOn(today);
    const previousInputs =
      previous?.inputs && typeof previous.inputs === "object" && !Array.isArray(previous.inputs)
        ? previous.inputs
        : {};

    await saveTargets({
      goal_id: goal?.id ?? null,
      effective_from: today,
      source: "manual",
      formula: null,
      bmr_kcal: previous?.bmr_kcal ?? null,
      maintenance_kcal: previous?.maintenance_kcal ?? null,
      target_kcal: values.kcal,
      protein_g: values.proteinG,
      carbs_g: carbsFromRemainder(values),
      fat_g: values.fatG,
      fiber_g: Math.round((values.kcal / 1000) * 14),
      inputs: previousInputs,
    });
    revalidatePath("/", "layout");
  });
  if (!result.ok) return result;
  redirect(ROUTES.profile);
}
