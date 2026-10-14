"use server";

import { revalidatePath } from "next/cache";
import { saveHabitSettings, saveSleep } from "@/data/habits";
import { getToday } from "@/data/profile";
import { HABIT_KEYS } from "@/domain/habits";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/run-action";
import {
  habitSettingsSchema,
  sleepSchema,
  type HabitSettingsFormValues,
  type SleepFormValues,
} from "./schemas";

const refresh = () => revalidatePath("/", "layout");

export async function saveHabitSettingsAction(
  input: HabitSettingsFormValues,
): Promise<ActionResult<string>> {
  return runAction(habitSettingsSchema, input, async (values) => {
    await saveHabitSettings(HABIT_KEYS.map((key) => ({ key, ...values[key] })));
    refresh();
  });
}

export async function saveSleepAction(input: SleepFormValues): Promise<ActionResult<string>> {
  return runAction(sleepSchema, input, async ({ date, hours }) => {
    if (date > (await getToday())) return { ok: false, fieldErrors: { date: "dateInFuture" } };
    await saveSleep(date, hours);
    refresh();
  });
}
