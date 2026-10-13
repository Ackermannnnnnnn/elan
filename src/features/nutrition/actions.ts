"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { ROUTES, safeRedirectPath } from "@/config/routes";
import {
  addFoodEntry,
  addQuickEntry,
  copyMeal,
  createFood,
  deleteDiaryEntry,
  deleteFood,
  getDiaryEntry,
  updateFood,
  updateFoodEntry,
  updateQuickEntry,
  type Quantity,
} from "@/data/nutrition";
import { getToday } from "@/data/profile";
import { updateRecipeEntry } from "@/data/recipes";
import type { ActionResult } from "@/lib/action-result";
import { isoDate } from "@/lib/form-fields";
import { runAction } from "@/lib/run-action";
import {
  foodSchema,
  portionsSchema,
  quantitySchema,
  quickEntrySchema,
  slotSchema,
  type FoodFormValues,
  type PortionsFormValues,
  type QuantityFormValues,
  type QuickEntryFormValues,
  type Slot,
} from "./schemas";
import { diaryUrl } from "./urls";

const refresh = () => revalidatePath("/", "layout");

const toQuantity = (values: { unit: "grams" | "servings"; quantity: number }): Quantity =>
  values.unit === "grams" ? { grams: values.quantity } : { servings: values.quantity };

/** Le journal ne s'écrit pas dans le futur. */
async function checkSlot(slot: Slot): Promise<ActionResult<string> | null> {
  const parsed = slotSchema.safeParse(slot);
  if (!parsed.success) return { ok: false, formError: "generic" };
  if (parsed.data.date > (await getToday())) return { ok: false, formError: "generic" };
  return null;
}

// --- Aliments ----------------------------------------------------------------------

export async function createFoodAction(
  input: FoodFormValues,
  returnTo?: string,
): Promise<ActionResult<string>> {
  let foodId = "";
  const result = await runAction(foodSchema, input, async (values) => {
    foodId = await createFood(values);
    refresh();
  });
  if (!result.ok) return result;

  // Créé depuis l'ajout d'un repas : on y revient, l'aliment déjà sélectionné.
  const back = safeRedirectPath(returnTo);
  if (returnTo && back.startsWith(ROUTES.nutritionAdd)) {
    const url = new URL(back, "http://local");
    url.searchParams.set("food", foodId);
    url.searchParams.delete("q");
    redirect(url.pathname + url.search);
  }
  redirect(ROUTES.foods);
}

export async function updateFoodAction(
  id: string,
  input: FoodFormValues,
): Promise<ActionResult<string>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, formError: "itemNotFound" };
  const result = await runAction(foodSchema, input, async (values) => {
    await updateFood(id, values);
    refresh();
  });
  if (!result.ok) return result;
  redirect(ROUTES.foods);
}

export async function deleteFoodAction(id: string): Promise<ActionResult<string>> {
  const result = await runAction(z.uuid(), id, async (foodId) => {
    await deleteFood(foodId);
    refresh();
  });
  if (!result.ok) return result;
  redirect(ROUTES.foods);
}

// --- Journal -------------------------------------------------------------------------

export async function addFoodEntryAction(
  slot: Slot,
  foodId: string,
  input: QuantityFormValues,
): Promise<ActionResult<string>> {
  const invalid = await checkSlot(slot);
  if (invalid) return invalid;
  if (!z.uuid().safeParse(foodId).success) return { ok: false, formError: "itemNotFound" };

  const result = await runAction(quantitySchema, input, async (values) => {
    await addFoodEntry({ ...slot, foodId, quantity: toQuantity(values) });
    refresh();
  });
  if (!result.ok) return result;
  redirect(diaryUrl(slot.date));
}

export async function addQuickEntryAction(
  slot: Slot,
  input: QuickEntryFormValues,
): Promise<ActionResult<string>> {
  const invalid = await checkSlot(slot);
  if (invalid) return invalid;

  const result = await runAction(quickEntrySchema, input, async (entry) => {
    await addQuickEntry({ ...slot, entry });
    refresh();
  });
  if (!result.ok) return result;
  redirect(diaryUrl(slot.date));
}

export async function updateFoodEntryAction(
  id: string,
  categoryId: string,
  input: QuantityFormValues,
): Promise<ActionResult<string>> {
  const ids = z.object({ id: z.uuid(), categoryId: z.uuid() }).safeParse({ id, categoryId });
  if (!ids.success) return { ok: false, formError: "itemNotFound" };
  const entry = await getDiaryEntry(id);
  if (!entry) return { ok: false, formError: "itemNotFound" };

  const result = await runAction(quantitySchema, input, async (values) => {
    await updateFoodEntry({ id, categoryId, quantity: toQuantity(values) });
    refresh();
  });
  if (!result.ok) return result;
  redirect(diaryUrl(entry.entry_date));
}

export async function updateQuickEntryAction(
  id: string,
  categoryId: string,
  input: QuickEntryFormValues,
): Promise<ActionResult<string>> {
  const ids = z.object({ id: z.uuid(), categoryId: z.uuid() }).safeParse({ id, categoryId });
  if (!ids.success) return { ok: false, formError: "itemNotFound" };
  const existing = await getDiaryEntry(id);
  if (!existing) return { ok: false, formError: "itemNotFound" };

  const result = await runAction(quickEntrySchema, input, async (entry) => {
    await updateQuickEntry({ id, categoryId, entry });
    refresh();
  });
  if (!result.ok) return result;
  redirect(diaryUrl(existing.entry_date));
}

export async function deleteDiaryEntryAction(id: string): Promise<ActionResult<string>> {
  if (!z.uuid().safeParse(id).success) return { ok: false, formError: "itemNotFound" };
  const entry = await getDiaryEntry(id);
  if (!entry) redirect(ROUTES.nutrition);

  const result = await runAction(z.uuid(), id, async (entryId) => {
    await deleteDiaryEntry(entryId);
    refresh();
  });
  if (!result.ok) return result;
  redirect(diaryUrl(entry.entry_date));
}

export async function copyMealAction(slot: Slot, fromDate: string): Promise<ActionResult<string>> {
  const invalid = await checkSlot(slot);
  if (invalid) return invalid;

  let copied = 0;
  const result = await runAction(isoDate, fromDate, async (from) => {
    copied = await copyMeal({ fromDate: from, toDate: slot.date, categoryId: slot.categoryId });
    refresh();
  });
  if (!result.ok) return result;
  if (copied === 0) return { ok: false, formError: "nothingToCopy" };
  redirect(diaryUrl(slot.date));
}

export async function updateRecipeEntryAction(
  id: string,
  categoryId: string,
  input: PortionsFormValues,
): Promise<ActionResult<string>> {
  const ids = z.object({ id: z.uuid(), categoryId: z.uuid() }).safeParse({ id, categoryId });
  if (!ids.success) return { ok: false, formError: "itemNotFound" };
  const entry = await getDiaryEntry(id);
  if (!entry) return { ok: false, formError: "itemNotFound" };

  const result = await runAction(portionsSchema, input, async (values) => {
    await updateRecipeEntry({ id, categoryId, portions: values.portions });
    refresh();
  });
  if (!result.ok) return result;
  redirect(diaryUrl(entry.entry_date));
}
