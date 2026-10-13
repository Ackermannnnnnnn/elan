"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ROUTES, safeRedirectPath } from "@/config/routes";
import { findOwnBarcodeFood, saveOpenFoodFactsFood } from "@/data/nutrition";
import type { ActionResult } from "@/lib/action-result";
import { lookupOpenFoodFacts } from "@/lib/open-food-facts/client";
import { runAction } from "@/lib/run-action";
import { foodUrl } from "@/features/nutrition/urls";
import { barcodeSchema, type BarcodeFormValues } from "./schemas";

const ERRORS = {
  notFound: "offNotFound",
  incomplete: "offIncomplete",
  unavailable: "offUnavailable",
} as const;

/**
 * Cherche un produit par code-barres : d'abord parmi les produits déjà
 * scannés par l'utilisateur, sinon sur Open Food Facts (copie personnelle).
 */
export async function importBarcodeAction(
  returnTo: string | null,
  input: BarcodeFormValues,
): Promise<ActionResult<string>> {
  let foodId = "";
  const result = await runAction(barcodeSchema, input, async ({ barcode }) => {
    const existing = await findOwnBarcodeFood(barcode);
    if (existing) {
      foodId = existing;
      return;
    }
    const lookup = await lookupOpenFoodFacts(barcode);
    if (!lookup.ok) return { ok: false, formError: ERRORS[lookup.reason] };
    foodId = await saveOpenFoodFactsFood(lookup.food);
    revalidatePath("/", "layout");
  });
  if (!result.ok) return result;

  // Scanné depuis l'ajout d'un repas : on y revient avec le produit sélectionné.
  const back = safeRedirectPath(returnTo ?? undefined);
  if (returnTo && back.startsWith(ROUTES.nutritionAdd)) {
    const url = new URL(back, "http://local");
    url.searchParams.set("food", foodId);
    url.searchParams.delete("q");
    url.searchParams.delete("mode");
    redirect(url.pathname + url.search);
  }
  redirect(foodUrl(foodId));
}
