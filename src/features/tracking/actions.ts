"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { getToday } from "@/data/profile";
import {
  addWater,
  deleteMeasurement,
  deleteWater,
  deleteWeight,
  listWater,
  saveMeasurement,
  saveSteps,
  saveWeight,
} from "@/data/tracking";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/run-action";
import {
  idSchema,
  measurementSchema,
  stepsSchema,
  waterAmountSchema,
  weightSchema,
  type MeasurementFormValues,
  type StepsFormValues,
  type WeightFormValues,
} from "./schemas";

// Les données de suivi alimentent l'accueil, la page Progrès et la navigation.
const refresh = () => revalidatePath("/", "layout");

export async function saveWeightAction(input: WeightFormValues): Promise<ActionResult<string>> {
  return runAction(weightSchema, input, async (values) => {
    if (values.date > (await getToday()))
      return { ok: false, fieldErrors: { date: "dateInFuture" } };
    await saveWeight({ date: values.date, weightKg: values.weightKg, note: values.note || null });
    refresh();
  });
}

export async function deleteWeightAction(id: string): Promise<ActionResult<string>> {
  return runAction(idSchema, id, async (weightId) => {
    await deleteWeight(weightId);
    refresh();
  });
}

export async function saveMeasurementAction(
  input: MeasurementFormValues,
): Promise<ActionResult<string>> {
  return runAction(measurementSchema, input, async ({ date, ...values }) => {
    if (date > (await getToday())) return { ok: false, fieldErrors: { date: "dateInFuture" } };
    await saveMeasurement(date, values);
    refresh();
  });
}

export async function deleteMeasurementAction(id: string): Promise<ActionResult<string>> {
  return runAction(idSchema, id, async (measurementId) => {
    await deleteMeasurement(measurementId);
    refresh();
  });
}

export async function addWaterAction(amountMl: number): Promise<ActionResult<string>> {
  return runAction(waterAmountSchema, amountMl, async (amount) => {
    await addWater(await getToday(), amount);
    refresh();
  });
}

/** Annule le dernier ajout d'eau du jour. */
export async function undoWaterAction(): Promise<ActionResult<string>> {
  return runAction(z.undefined(), undefined, async () => {
    const entries = await listWater(await getToday());
    const last = entries.at(-1);
    if (last) await deleteWater(last.id);
    refresh();
  });
}

export async function saveStepsAction(input: StepsFormValues): Promise<ActionResult<string>> {
  return runAction(stepsSchema, input, async ({ steps }) => {
    await saveSteps(await getToday(), steps);
    refresh();
  });
}
