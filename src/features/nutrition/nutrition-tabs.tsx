import { getTranslations } from "next-intl/server";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { ROUTES } from "@/config/routes";

const TABS = [
  { key: "diary", href: ROUTES.nutrition },
  { key: "recipes", href: ROUTES.recipes },
  { key: "plan", href: ROUTES.mealPlan },
  { key: "shopping", href: ROUTES.shopping },
  { key: "foods", href: ROUTES.foods },
] as const;

export type NutritionTab = (typeof TABS)[number]["key"];

/** Navigation entre les rubriques de la nutrition. */
export async function NutritionTabs({ current }: { current: NutritionTab }) {
  const t = await getTranslations("Nutrition.tabs");
  return (
    <SegmentedLinks
      label={t("label")}
      className="-mx-4 mb-6 overflow-x-auto px-4 sm:mx-0 sm:px-0"
      items={TABS.map((tab) => ({
        href: tab.href,
        label: t(tab.key),
        current: tab.key === current,
      }))}
    />
  );
}
