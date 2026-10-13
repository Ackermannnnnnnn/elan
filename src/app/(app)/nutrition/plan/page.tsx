import { Check, ChevronLeft, ChevronRight, RefreshCw, ShoppingCart, X } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionButton } from "@/components/forms/action-button";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { getMealPlan, getPlannerContext, toPlannerRecipe } from "@/data/meal-plans";
import { getTargetsOn } from "@/data/plan";
import { getToday } from "@/data/profile";
import { DAY_TOLERANCE, exclusionReason, MEAL_SLOTS, summarizeDays } from "@/domain/meal-planner";
import {
  generatePlanAction,
  logPlanItemAction,
  removePlanItemAction,
  swapPlanItemAction,
} from "@/features/meal-plan/actions";
import { DeletePlanButton } from "@/features/meal-plan/delete-plan-button";
import { NutritionTabs } from "@/features/nutrition/nutrition-tabs";
import { mealPlanUrl, recipeUrl, shoppingUrl } from "@/features/nutrition/urls";
import { addDays, isIsoDate, startOfIsoWeek } from "@/lib/dates";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("MealPlan");
  return { title: t("title") };
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function MealPlanPage({ searchParams }: PageProps<"/nutrition/plan">) {
  const params = await searchParams;
  const today = await getToday();
  const requested = one(params.week);
  const week = startOfIsoWeek(isIsoDate(requested) ? requested : today);

  const [planned, context, targets, t, tOptions, tCommon, format] = await Promise.all([
    getMealPlan(week),
    getPlannerContext(),
    getTargetsOn(week),
    getTranslations("MealPlan"),
    getTranslations("Options"),
    getTranslations("Common"),
    getFormatter(),
  ]);
  const number = (value: number) => format.number(Math.round(value));
  const dayLabel = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });
  const weekLabel = format.dateTime(new Date(`${week}T12:00:00Z`), {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });

  const plannerRecipes = context.recipes.map(toPlannerRecipe);
  const eligible = plannerRecipes.filter(
    (recipe) => exclusionReason(recipe, context.constraints) === null,
  );
  const excludedCount = plannerRecipes.length - eligible.length;

  const navigation = (
    <div className="mb-5 flex items-center justify-between gap-2">
      <Button asChild variant="ghost" size="icon">
        <Link href={mealPlanUrl(addDays(week, -7))} aria-label={t("previousWeek")}>
          <ChevronLeft aria-hidden="true" />
        </Link>
      </Button>
      <p className="text-lg font-semibold">{t("weekOf", { date: weekLabel })}</p>
      <Button asChild variant="ghost" size="icon">
        <Link href={mealPlanUrl(addDays(week, 7))} aria-label={t("nextWeek")}>
          <ChevronRight aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );

  if (!planned) {
    return (
      <>
        <PageHeader title={t("title")} lead={t("lead")} />
        <NutritionTabs current="plan" />
        {navigation}
        <Card>
          <CardHeader className="mb-4">
            <CardTitle>{t("empty.title")}</CardTitle>
            <CardDescription>{t("empty.lead")}</CardDescription>
          </CardHeader>
          <ul className="mb-5 flex list-disc flex-col gap-1 pl-5 text-[0.9375rem]">
            <li>
              {targets
                ? t("empty.targets", {
                    kcal: number(targets.target_kcal),
                    protein: number(targets.protein_g),
                  })
                : t("empty.noTargets")}
            </li>
            <li>{t("empty.recipes", { count: eligible.length })}</li>
            {excludedCount > 0 ? <li>{t("empty.excluded", { count: excludedCount })}</li> : null}
          </ul>
          {eligible.length === 0 ? (
            <Button asChild>
              <Link href={ROUTES.recipes}>{t("empty.goRecipes")}</Link>
            </Button>
          ) : (
            <ActionButton
              action={generatePlanAction.bind(null, week)}
              pendingLabel={t("generating")}
              size="lg"
            >
              {t("generate")}
            </ActionButton>
          )}
        </Card>
        <p className="mt-5 text-sm text-muted-foreground">{t("noAi")}</p>
      </>
    );
  }

  const { plan, items } = planned;
  const targetKcal = plan.target_kcal ?? targets?.target_kcal ?? 0;
  const targetProtein = plan.target_protein_g ?? targets?.protein_g ?? 0;
  const days = summarizeDays(
    items.map((item) => ({
      dayIndex: item.day_index,
      kcal: item.kcal ?? 0,
      proteinG: item.protein_g ?? 0,
      carbsG: item.carbs_g ?? 0,
      fatG: item.fat_g ?? 0,
    })),
  );
  const missingSlots = MEAL_SLOTS.filter((slot) => !items.some((item) => item.meal_slot === slot));

  return (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <NutritionTabs current="plan" />
      {navigation}

      <div className="mb-5 flex flex-wrap gap-3">
        <Button asChild>
          <Link href={shoppingUrl(week)}>
            <ShoppingCart aria-hidden="true" />
            {t("shopping")}
          </Link>
        </Button>
        <ActionButton
          action={generatePlanAction.bind(null, week)}
          pendingLabel={t("generating")}
          variant="secondary"
        >
          <RefreshCw aria-hidden="true" />
          {t("regenerate")}
        </ActionButton>
      </div>

      {targetKcal > 0 ? (
        <p className="mb-5 text-[0.9375rem] text-muted-foreground">
          {t("targets", { kcal: number(targetKcal), protein: number(targetProtein) })}
        </p>
      ) : null}

      {missingSlots.length > 0 ? (
        <Alert variant="info" className="mb-5">
          {t("missingSlots", {
            slots: missingSlots.map((slot) => tOptions(`mealCategory.${slot}`)).join(", "),
          })}
        </Alert>
      ) : null}

      <div className="flex flex-col gap-5">
        {days.map((day) => {
          const date = addDays(week, day.dayIndex);
          const dayItems = items.filter((item) => item.day_index === day.dayIndex);
          const offTarget =
            targetKcal > 0 && Math.abs(day.kcal - targetKcal) > targetKcal * DAY_TOLERANCE;
          const lowProtein = targetProtein > 0 && day.proteinG < targetProtein * 0.8;
          return (
            <section
              key={day.dayIndex}
              aria-labelledby={`day-${day.dayIndex}`}
              className="overflow-hidden rounded-card border border-border bg-surface"
            >
              <header className="flex flex-wrap items-baseline justify-between gap-2 px-5 pt-4 pb-3 sm:px-6">
                <h2
                  id={`day-${day.dayIndex}`}
                  className="text-lg font-semibold first-letter:uppercase"
                >
                  {dayLabel(date)}
                </h2>
                <p className="text-sm tabular-nums">
                  <span className="font-semibold">{t("dayKcal", { value: number(day.kcal) })}</span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {t("dayProtein", { value: number(day.proteinG) })}
                  </span>
                </p>
              </header>
              {offTarget || lowProtein ? (
                <p className="px-5 pb-2 text-sm text-muted-foreground sm:px-6">
                  {[
                    offTarget ? t("offTarget", { target: number(targetKcal) }) : null,
                    lowProtein ? t("lowProtein") : null,
                  ]
                    .filter(Boolean)
                    .join(" ")}
                </p>
              ) : null}
              {dayItems.length === 0 ? (
                <p className="px-5 pb-4 text-muted-foreground sm:px-6">{t("dayEmpty")}</p>
              ) : (
                <ul className="border-t border-border">
                  {dayItems.map((item) => {
                    const alternatives = eligible.filter(
                      (recipe) =>
                        recipe.slots.includes(item.meal_slot) && recipe.id !== item.recipe_id,
                    );
                    return (
                      <li
                        key={item.id}
                        className="border-b border-border px-5 py-3 last:border-b-0 sm:px-6"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                              {tOptions(`mealCategory.${item.meal_slot}`)}
                            </p>
                            {item.recipe_id ? (
                              <Link
                                href={recipeUrl(item.recipe_id)}
                                className="font-medium underline-offset-4 hover:underline"
                              >
                                {item.title}
                              </Link>
                            ) : (
                              <p className="font-medium">{item.title}</p>
                            )}
                            <p className="text-sm text-muted-foreground tabular-nums">
                              {t("portions", { count: item.servings })} ·{" "}
                              {t("itemMacros", {
                                kcal: number(item.kcal ?? 0),
                                protein: number(item.protein_g ?? 0),
                              })}
                            </p>
                          </div>
                          <ActionButton
                            action={removePlanItemAction.bind(null, item.id)}
                            pendingLabel={tCommon("deleting")}
                            variant="ghost"
                            size="icon"
                            aria-label={t("remove", { name: item.title })}
                            className="text-muted-foreground hover:text-destructive"
                          >
                            <X aria-hidden="true" />
                          </ActionButton>
                        </div>
                        <div className="mt-2 flex flex-wrap items-start gap-2">
                          {item.logged_at ? (
                            <Badge variant="success">
                              <Check aria-hidden="true" className="size-3" />
                              {t("logged")}
                            </Badge>
                          ) : date <= today ? (
                            <ActionButton
                              action={logPlanItemAction.bind(null, item.id)}
                              pendingLabel={tCommon("saving")}
                              variant="secondary"
                              size="sm"
                            >
                              {t("log")}
                            </ActionButton>
                          ) : null}
                          {alternatives.length > 0 ? (
                            <details className="group">
                              <summary className="inline-flex h-9 cursor-pointer list-none items-center rounded-control px-3.5 text-sm font-semibold hover:bg-surface-muted">
                                {t("swap")}
                              </summary>
                              <ul className="mt-2 flex flex-col gap-1">
                                {alternatives.map((recipe) => (
                                  <li key={recipe.id}>
                                    <ActionButton
                                      action={swapPlanItemAction.bind(null, item.id, recipe.id)}
                                      pendingLabel={tCommon("saving")}
                                      variant="ghost"
                                      size="sm"
                                      className="h-auto min-h-9 justify-start py-1.5 text-left whitespace-normal"
                                    >
                                      {t("swapTo", {
                                        name: recipe.title,
                                        kcal: number(recipe.perServing.kcal),
                                      })}
                                    </ActionButton>
                                  </li>
                                ))}
                              </ul>
                            </details>
                          ) : null}
                        </div>
                      </li>
                    );
                  })}
                </ul>
              )}
            </section>
          );
        })}
      </div>

      <div className="mt-8 flex flex-col gap-3">
        <p className="text-sm text-muted-foreground">{t("noAi")}</p>
        <div>
          <DeletePlanButton week={week} label={t("delete")} />
        </div>
      </div>
    </>
  );
}
