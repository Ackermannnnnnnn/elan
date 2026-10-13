import { ROUTES } from "@/config/routes";

/** Construction des adresses du journal : le jour et le repas voyagent dans l'URL. */
const withParams = (path: string, params: Record<string, string | undefined>) => {
  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) if (value) search.set(key, value);
  const query = search.toString();
  return query ? `${path}?${query}` : path;
};

export const diaryUrl = (date?: string) => withParams(ROUTES.nutrition, { date });

export const addUrl = (params: {
  date: string;
  category: string;
  mode?: "foods" | "recipes" | "quick" | "copy";
  q?: string;
  food?: string;
  recipe?: string;
  from?: string;
}) => withParams(ROUTES.nutritionAdd, params);

export const entryUrl = (id: string) => `${ROUTES.nutrition}/entries/${id}`;
export const foodUrl = (id: string) => `${ROUTES.foods}/${id}`;
export const newFoodUrl = (returnTo?: string) => withParams(ROUTES.foodNew, { return: returnTo });
export const recipeUrl = (id: string) => `${ROUTES.recipes}/${id}`;
export const recipeEditUrl = (id: string) => `${ROUTES.recipes}/${id}/edit`;
export const mealPlanUrl = (week?: string) => withParams(ROUTES.mealPlan, { week });
export const shoppingUrl = (week?: string) => withParams(ROUTES.shopping, { week });
export const foodScanUrl = (returnTo?: string) => withParams(ROUTES.foodScan, { return: returnTo });
