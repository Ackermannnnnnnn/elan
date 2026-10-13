"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import {
  addManualItem,
  deleteShoppingItem,
  generateShoppingList,
  setItemChecked,
  setItemOwned,
  setItemPrice,
} from "@/data/shopping";
import type { ActionResult } from "@/lib/action-result";
import { isIsoDate, startOfIsoWeek } from "@/lib/dates";
import { runAction } from "@/lib/run-action";
import {
  manualItemSchema,
  type ManualItemFormValues,
  priceSchema,
  type PriceFormValues,
} from "./schemas";

const refresh = () => revalidatePath("/", "layout");
const weekStartSchema = z
  .string()
  .refine((value) => isIsoDate(value) && startOfIsoWeek(value) === value, "dateInvalid");

export async function generateShoppingListAction(weekStart: string): Promise<ActionResult<string>> {
  const t = await getTranslations("Shopping");
  return runAction(weekStartSchema, weekStart, async (week) => {
    await generateShoppingList(week, t("listTitle", { date: week }));
    refresh();
  });
}

export async function toggleCheckedAction(
  id: string,
  checked: boolean,
): Promise<ActionResult<string>> {
  return runAction(z.uuid(), id, async (itemId) => {
    await setItemChecked(itemId, checked);
    refresh();
  });
}

export async function toggleOwnedAction(id: string, owned: boolean): Promise<ActionResult<string>> {
  return runAction(z.uuid(), id, async (itemId) => {
    await setItemOwned(itemId, owned);
    refresh();
  });
}

export async function setPriceAction(
  id: string,
  input: PriceFormValues,
): Promise<ActionResult<string>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, formError: "itemNotFound" };
  return runAction(priceSchema, input, async ({ price }) => {
    await setItemPrice(id, price === null ? null : Math.round(price * 100) / 100);
    refresh();
  });
}

export async function addManualItemAction(
  weekStart: string,
  input: ManualItemFormValues,
): Promise<ActionResult<string>> {
  if (!weekStartSchema.safeParse(weekStart).success) return { ok: false, formError: "generic" };
  return runAction(manualItemSchema, input, async (values) => {
    await addManualItem(weekStart, values);
    refresh();
  });
}

export async function deleteShoppingItemAction(id: string): Promise<ActionResult<string>> {
  return runAction(z.uuid(), id, async (itemId) => {
    await deleteShoppingItem(itemId);
    refresh();
  });
}
