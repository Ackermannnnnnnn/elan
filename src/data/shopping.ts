import "server-only";
import type { Aisle } from "@/domain/food-classification";
import { aggregateShopping, type ShoppingRecipe } from "@/domain/shopping";
import type { IsoDate } from "@/lib/dates";
import type { Row } from "@/types/database";
import { DataError, fail, getDb } from "./client";
import { getMealPlan } from "./meal-plans";
import { listRecipes } from "./recipes";

export type ShoppingList = Pick<
  Row<"shopping_lists">,
  "id" | "title" | "meal_plan_id" | "created_at"
>;
export type ShoppingItem = Pick<
  Row<"shopping_list_items">,
  | "id"
  | "food_id"
  | "name"
  | "quantity_g"
  | "aisle"
  | "estimated_price_eur"
  | "price_source"
  | "is_checked"
  | "already_owned"
  | "added_manually"
  | "position"
>;

const ITEM_COLUMNS =
  "id, food_id, name, quantity_g, aisle, estimated_price_eur, price_source, is_checked, already_owned, added_manually, position" as const;

export async function getShoppingListForWeek(
  weekStart: IsoDate,
): Promise<{ list: ShoppingList; items: ShoppingItem[] } | null> {
  const plan = await getMealPlan(weekStart);
  if (!plan) return null;
  const { supabase, user } = await getDb();
  const { data: list, error } = await supabase
    .from("shopping_lists")
    .select("id, title, meal_plan_id, created_at")
    .eq("user_id", user.id)
    .eq("meal_plan_id", plan.plan.id)
    .maybeSingle();
  if (error) fail("getShoppingListForWeek", error);
  if (!list) return null;

  const { data: items, error: itemsError } = await supabase
    .from("shopping_list_items")
    .select(ITEM_COLUMNS)
    .eq("user_id", user.id)
    .eq("shopping_list_id", list.id)
    .order("position", { ascending: true });
  if (itemsError) fail("getShoppingListForWeek.items", itemsError);
  return { list, items };
}

/**
 * (Re)crée la liste de courses à partir du plan de la semaine. Les articles
 * ajoutés à la main sont conservés ; les prix déjà saisis pour un même aliment
 * sont repris.
 */
export async function generateShoppingList(weekStart: IsoDate, title: string): Promise<void> {
  const { supabase, user } = await getDb();
  const planned = await getMealPlan(weekStart);
  if (!planned) throw new DataError("noMealPlan");

  const recipes = await listRecipes();
  const byId = new Map<string, ShoppingRecipe>(
    recipes.map((recipe) => [
      recipe.id,
      {
        servings: recipe.servings,
        ingredients: recipe.ingredients.map((ingredient) => ({
          foodId: ingredient.foodId,
          name: ingredient.food?.name ?? ingredient.name,
          quantityG: ingredient.quantityG,
          isOptional: ingredient.isOptional,
          aisle: (ingredient.food?.aisle ?? "other") as Aisle,
        })),
      },
    ]),
  );
  const needs = aggregateShopping(
    planned.items.map((item) => ({ recipeId: item.recipe_id, portions: item.servings })),
    byId,
  );

  const existing = await getShoppingListForWeek(weekStart);
  let listId = existing?.list.id;
  const keptPrices = new Map<string, number>();
  let manualCount = 0;
  if (existing) {
    for (const item of existing.items) {
      if (item.food_id && item.estimated_price_eur !== null && item.price_source === "user") {
        keptPrices.set(item.food_id, item.estimated_price_eur);
      }
      if (item.added_manually) manualCount += 1;
    }
    const { error } = await supabase
      .from("shopping_list_items")
      .delete()
      .eq("user_id", user.id)
      .eq("shopping_list_id", existing.list.id)
      .eq("added_manually", false);
    if (error) fail("generateShoppingList.clear", error, "saveFailed");
  } else {
    const { data, error } = await supabase
      .from("shopping_lists")
      .insert({ user_id: user.id, meal_plan_id: planned.plan.id, title: title.slice(0, 120) })
      .select("id")
      .single();
    if (error) fail("generateShoppingList.list", error, "saveFailed");
    listId = data.id;
  }
  if (!listId || needs.length === 0) return;

  const { error } = await supabase.from("shopping_list_items").insert(
    needs.map((need, index) => {
      const price = need.foodId ? keptPrices.get(need.foodId) : undefined;
      return {
        user_id: user.id,
        shopping_list_id: listId,
        food_id: need.foodId,
        name: need.name.slice(0, 200),
        quantity_g: need.quantityG,
        aisle: need.aisle,
        estimated_price_eur: price ?? null,
        price_source: price === undefined ? null : ("user" as const),
        position: manualCount + index,
      };
    }),
  );
  if (error) fail("generateShoppingList.items", error, "saveFailed");
}

async function updateItem(
  id: string,
  values: Partial<
    Pick<ShoppingItem, "is_checked" | "already_owned" | "estimated_price_eur" | "price_source">
  >,
): Promise<void> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("shopping_list_items")
    .update(values)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("id");
  if (error) fail("updateShoppingItem", error, "saveFailed");
  if (data.length === 0) throw new DataError("itemNotFound");
}

export const setItemChecked = (id: string, checked: boolean) =>
  updateItem(id, { is_checked: checked });
export const setItemOwned = (id: string, owned: boolean) =>
  updateItem(id, { already_owned: owned });
/** Prix saisi par l'utilisateur ; `null` l'efface (aucun prix n'est jamais estimé). */
export const setItemPrice = (id: string, priceEur: number | null) =>
  updateItem(id, {
    estimated_price_eur: priceEur,
    price_source: priceEur === null ? null : "user",
  });

export async function addManualItem(
  weekStart: IsoDate,
  input: { name: string; quantityG: number | null },
): Promise<void> {
  const { supabase, user } = await getDb();
  const current = await getShoppingListForWeek(weekStart);
  if (!current) throw new DataError("noMealPlan");
  const { error } = await supabase.from("shopping_list_items").insert({
    user_id: user.id,
    shopping_list_id: current.list.id,
    name: input.name,
    quantity_g: input.quantityG,
    aisle: "other",
    added_manually: true,
    position: -1,
  });
  if (error) fail("addManualItem", error, "saveFailed");
}

export async function deleteShoppingItem(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { error } = await supabase
    .from("shopping_list_items")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) fail("deleteShoppingItem", error, "deleteFailed");
}
