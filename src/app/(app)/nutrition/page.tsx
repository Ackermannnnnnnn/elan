import { ChevronLeft, ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { listDiary, listMealCategories } from "@/data/nutrition";
import { getOwnPreferences, getTargetsOn } from "@/data/plan";
import { getToday } from "@/data/profile";
import { listWater } from "@/data/tracking";
import { sumMacros } from "@/domain/nutrition";
import { DaySummary } from "@/features/nutrition/day-summary";
import { NutritionTabs } from "@/features/nutrition/nutrition-tabs";
import { addUrl, diaryUrl, entryUrl } from "@/features/nutrition/urls";
import { WaterCard } from "@/features/tracking/water-card";
import { addDays, isIsoDate } from "@/lib/dates";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nutrition");
  return { title: t("title") };
}

export default async function NutritionPage({ searchParams }: PageProps<"/nutrition">) {
  const params = await searchParams;
  const today = await getToday();
  // Un jour invalide ou futur ramène à aujourd'hui.
  const date = isIsoDate(params.date) && params.date <= today ? params.date : today;
  const isToday = date === today;

  const [entries, categories, targets, preferences, water, t, tOptions, tCommon, format] =
    await Promise.all([
      listDiary(date),
      listMealCategories(),
      getTargetsOn(date),
      getOwnPreferences(),
      isToday ? listWater(date) : Promise.resolve([]),
      getTranslations("Nutrition"),
      getTranslations("Options"),
      getTranslations("Common"),
      getFormatter(),
    ]);

  const number = (value: number, digits = 0) =>
    format.number(value, { maximumFractionDigits: digits });
  const toMacros = (entry: (typeof entries)[number]) => ({
    kcal: entry.kcal,
    proteinG: entry.protein_g,
    carbsG: entry.carbs_g,
    fatG: entry.fat_g,
    fiberG: entry.fiber_g,
  });
  const totals = sumMacros(entries.map(toMacros));

  const dateLabel = isToday
    ? tCommon("today")
    : date === addDays(today, -1)
      ? tCommon("yesterday")
      : format.dateTime(new Date(`${date}T12:00:00Z`), {
          weekday: "long",
          day: "numeric",
          month: "long",
          timeZone: "UTC",
        });

  const categoryName = (category: (typeof categories)[number]) =>
    category.key === "custom" ? (category.label ?? "") : tOptions(`mealCategory.${category.key}`);

  return (
    <>
      <PageHeader title={t("title")} />
      <NutritionTabs current="diary" />

      <div className="mb-5 flex items-center justify-between gap-2">
        <Button asChild variant="ghost" size="icon">
          <Link href={diaryUrl(addDays(date, -1))} aria-label={t("previousDay")}>
            <ChevronLeft aria-hidden="true" />
          </Link>
        </Button>
        <div className="text-center">
          <p className="text-lg font-semibold first-letter:uppercase">{dateLabel}</p>
          {isToday ? null : (
            <Link
              href={diaryUrl()}
              className="text-sm font-medium text-primary underline-offset-4 hover:underline"
            >
              {t("backToToday")}
            </Link>
          )}
        </div>
        {isToday ? (
          <span className="size-11" />
        ) : (
          <Button asChild variant="ghost" size="icon">
            <Link href={diaryUrl(addDays(date, 1))} aria-label={t("nextDay")}>
              <ChevronRight aria-hidden="true" />
            </Link>
          </Button>
        )}
      </div>

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader>
            <CardTitle>{t("summary.title")}</CardTitle>
          </CardHeader>
          <DaySummary totals={totals} targets={targets} />
        </Card>

        {categories.map((category) => {
          const items = entries.filter((entry) => entry.category_id === category.id);
          const subtotal = sumMacros(items.map(toMacros));
          const name = categoryName(category);
          return (
            <section
              key={category.id}
              className="overflow-hidden rounded-card border border-border bg-surface"
            >
              <header className="flex items-center justify-between gap-3 px-5 pt-4 pb-3 sm:px-6">
                <div>
                  <h2 className="text-lg font-semibold">{name}</h2>
                  {items.length > 0 ? (
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {t("category.subtotal", { value: number(subtotal.kcal) })}
                    </p>
                  ) : null}
                </div>
                <Button asChild variant="secondary" size="sm">
                  <Link
                    href={addUrl({ date, category: category.id })}
                    aria-label={t("category.addTo", { category: name })}
                  >
                    <Plus aria-hidden="true" />
                    {t("category.add")}
                  </Link>
                </Button>
              </header>

              {items.length === 0 ? (
                <p className="px-5 pb-4 text-[0.9375rem] text-muted-foreground sm:px-6">
                  {t("category.empty")}
                </p>
              ) : (
                <ul className="border-t border-border">
                  {items.map((entry) => (
                    <li key={entry.id} className="border-b border-border last:border-b-0">
                      <Link
                        href={entryUrl(entry.id)}
                        aria-label={t("entry.editLabel", { name: entry.description })}
                        className="flex items-center justify-between gap-4 px-5 py-3 transition-colors hover:bg-surface-muted sm:px-6"
                      >
                        <span className="min-w-0">
                          <span className="flex items-center gap-2">
                            <span className="truncate font-medium">{entry.description}</span>
                            {entry.is_estimate ? <Badge>{t("entry.estimate")}</Badge> : null}
                          </span>
                          <span className="block text-sm text-muted-foreground tabular-nums">
                            {entry.recipe_id !== null && entry.servings !== null
                              ? t("entry.servings", { count: entry.servings })
                              : entry.servings !== null && entry.quantity_g === null
                                ? t("entry.quick")
                                : entry.servings !== null
                                  ? t("entry.servings", { count: entry.servings })
                                  : t("entry.grams", { value: number(entry.quantity_g ?? 0, 1) })}
                            {", "}
                            {t("entry.macros", {
                              protein: number(entry.protein_g),
                              carbs: number(entry.carbs_g),
                              fat: number(entry.fat_g),
                            })}
                          </span>
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums">
                          {number(entry.kcal)} kcal
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          );
        })}

        {isToday && preferences?.water_tracking_enabled !== false ? (
          <WaterCard
            totalMl={water.reduce((sum, entry) => sum + entry.amount_ml, 0)}
            goalMl={preferences?.daily_water_goal_ml ?? null}
          />
        ) : null}

        <Card className="bg-surface-muted">
          <CardHeader className="mb-1">
            <CardTitle className="text-base">{t("aiOff.title")}</CardTitle>
          </CardHeader>
          <p className="text-[0.9375rem] text-muted-foreground">{t("aiOff.body")}</p>
        </Card>
      </div>
    </>
  );
}
