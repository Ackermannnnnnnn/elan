import { ChevronRight, Plus, ScanBarcode } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { searchFoods } from "@/data/nutrition";
import { requireUser } from "@/lib/auth/session";
import { FoodPer100 } from "@/features/nutrition/food-line";
import { NutritionTabs } from "@/features/nutrition/nutrition-tabs";
import { foodUrl } from "@/features/nutrition/urls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nutrition.foods");
  return { title: t("title") };
}

export default async function FoodsPage() {
  const [user, foods, t, tSources] = await Promise.all([
    requireUser(),
    searchFoods("", 200),
    getTranslations("Nutrition.foods"),
    getTranslations("Recipes.form.source"),
  ]);
  // La recherche renvoie aussi le catalogue partagé : cette page ne liste que les aliments personnels.
  const own = foods
    .filter((food) => food.owner_id === user.id)
    .sort((a, b) => a.name.localeCompare(b.name, "fr"));

  return (
    <>
      <PageHeader
        title={t("title")}
        lead={t("lead")}
        action={
          <div className="flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href={ROUTES.foodScan}>
                <ScanBarcode aria-hidden="true" />
                {t("scan")}
              </Link>
            </Button>
            <Button asChild>
              <Link href={ROUTES.foodNew}>
                <Plus aria-hidden="true" />
                {t("new")}
              </Link>
            </Button>
          </div>
        }
      />
      <NutritionTabs current="foods" />

      {own.length === 0 ? (
        <p className="text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="overflow-hidden rounded-card border border-border bg-surface">
          {own.map((food) => (
            <li key={food.id} className="border-b border-border last:border-b-0">
              <Link
                href={foodUrl(food.id)}
                className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted sm:px-6"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {food.name}
                    {food.brand ? (
                      <span className="font-normal text-muted-foreground"> ({food.brand})</span>
                    ) : null}
                  </span>
                  <span className="block truncate text-sm text-muted-foreground">
                    {tSources(food.source)} · <FoodPer100 food={food} />
                  </span>
                </span>
                <ChevronRight
                  aria-hidden="true"
                  className="size-5 shrink-0 text-muted-foreground"
                />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
