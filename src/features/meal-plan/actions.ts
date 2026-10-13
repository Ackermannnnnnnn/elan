"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { DataError } from "@/data/client";
import {
  deleteMealPlan,
  generateAndSaveMealPlan,
  logMealPlanItem,
  removeMealPlanItem,
  swapMealPlanItem,
} from "@/data/meal-plans";
import { getToday } from "@/data/profile";
import type { ActionResult } from "@/lib/action-result";
import { isIsoDate, startOfIsoWeek } from "@/lib/dates";
import { runAction } from "@/lib/run-action";

const refresh = () => revalidatePath("/", "layout");

/** Un lundi au format AAAA-MM-JJ. */
const weekStartSchema = z
  .string()
  .refine((value) => isIsoDate(value) && startOfIsoWeek(value) === value, "dateInvalid");

export async function generatePlanAction(weekStart: string): Promise<ActionResult<string>> {
  return runAction(weekStartSchema, weekStart, async (week) => {
    const outcome = await generateAndSaveMealPlan(week);
    if (!outcome.ok) {
      return {
        ok: false,
        formError: outcome.reason === "noTargets" ? "noTargets" : "noEligibleRecipes",
      };
    }
    refresh();
  });
}

export async function deletePlanAction(weekStart: string): Promise<ActionResult<string>> {
  return runAction(weekStartSchema, weekStart, async (week) => {
    await deleteMealPlan(week);
    refresh();
  });
}

export async function swapPlanItemAction(
  itemId: string,
  recipeId: string,
): Promise<ActionResult<string>> {
  return runAction(
    z.object({ itemId: z.uuid(), recipeId: z.uuid() }),
    { itemId, recipeId },
    async (ids) => {
      await swapMealPlanItem(ids.itemId, ids.recipeId);
      refresh();
    },
  );
}

export async function removePlanItemAction(itemId: string): Promise<ActionResult<string>> {
  return runAction(z.uuid(), itemId, async (id) => {
    await removeMealPlanItem(id);
    refresh();
  });
}

export async function logPlanItemAction(itemId: string): Promise<ActionResult<string>> {
  return runAction(z.uuid(), itemId, async (id) => {
    try {
      await logMealPlanItem(id, await getToday());
    } catch (error) {
      if (error instanceof DataError && error.key === "alreadyLogged") return { ok: true };
      throw error;
    }
    refresh();
  });
}
