import { Plus } from "lucide-react";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { ROUTES } from "@/config/routes";
import { listDiary, listDiaryTotals } from "@/data/nutrition";
import { getActiveGoal, getOwnPreferences, getTargetsOn } from "@/data/plan";
import { getOwnProfile, getToday } from "@/data/profile";
import { getSteps, listWater, listWeights } from "@/data/tracking";
import { shouldRecalculate } from "@/domain/energy";
import { progressTowards, sumMacros } from "@/domain/nutrition";
import { movingAverage } from "@/domain/weight-trend";
import { IntakeChart } from "@/features/nutrition/intake-chart";
import { RecalculateNotice } from "@/features/targets/recalculate-notice";
import { StepsCard } from "@/features/tracking/steps-card";
import { WaterCard } from "@/features/tracking/water-card";
import { WeightChart } from "@/features/tracking/weight-chart";
import { addDays, eachDay } from "@/lib/dates";

const HISTORY_DAYS = 14;
const WEIGHT_DAYS = 30;

export default async function HomePage() {
  const today = await getToday();
  const historyStart = addDays(today, -(HISTORY_DAYS - 1));

  const [
    profile,
    preferences,
    goal,
    targets,
    entries,
    totalsByDay,
    weights,
    water,
    steps,
    t,
    format,
  ] = await Promise.all([
    getOwnProfile(),
    getOwnPreferences(),
    getActiveGoal(),
    getTargetsOn(today),
    listDiary(today),
    listDiaryTotals(historyStart, today),
    listWeights(addDays(today, -(WEIGHT_DAYS + 6))),
    listWater(today),
    getSteps(today),
    getTranslations("Home"),
    getFormatter(),
  ]);
  const tChart = await getTranslations("Progress.chart");

  const number = (value: number, digits = 0) =>
    format.number(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const longDate = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });

  const consumed = sumMacros(
    entries.map((entry) => ({
      kcal: entry.kcal,
      proteinG: entry.protein_g,
      carbsG: entry.carbs_g,
      fatG: entry.fat_g,
      fiberG: entry.fiber_g,
    })),
  );
  const calories = targets ? progressTowards(consumed.kcal, targets.target_kcal) : null;

  // Courbe de poids : la moyenne est calculée avec 6 jours de recul, puis on n'affiche que 30 jours.
  const trend = movingAverage(
    weights.map((entry) => ({ date: entry.measured_on, weightKg: entry.weight_kg })),
  );
  const weightStart = addDays(today, -(WEIGHT_DAYS - 1));
  const visibleTrend = trend.filter((point) => point.date >= weightStart);
  const latest = trend.at(-1);

  const calculationWeight = (targets?.inputs as { weight_kg?: unknown } | null)?.weight_kg;
  const weightDelta =
    latest && targets?.source === "calculated" && typeof calculationWeight === "number"
      ? latest.weightKg - calculationWeight
      : null;

  const byDay = new Map(totalsByDay.map((day) => [day.date, day]));
  const days = eachDay(historyStart, today);
  const hasHistory = totalsByDay.length > 0;

  return (
    <>
      <PageHeader
        title={
          profile?.display_name
            ? t("greeting", { name: profile.display_name })
            : t("greetingAnonymous")
        }
        lead={longDate(today).replace(/^./, (letter) => letter.toUpperCase())}
      />

      <div className="flex flex-col gap-5">
        {weightDelta !== null &&
        shouldRecalculate(calculationWeight as number, latest!.weightKg) ? (
          <RecalculateNotice
            delta={(weightDelta > 0 ? "+" : "−") + number(Math.abs(weightDelta), 1)}
          />
        ) : null}

        <Card>
          <CardHeader className="mb-4">
            <CardTitle>{t("today.title")}</CardTitle>
          </CardHeader>

          {targets && calories ? (
            <>
              {/* Le chiffre du jour : ce qu'il reste à manger. Un seul chiffre de cette taille par écran. */}
              <p className="flex flex-wrap items-baseline gap-x-3">
                <span className="font-sans text-[3.25rem] leading-none font-bold tracking-tight sm:text-[4rem]">
                  {number(Math.abs(calories.remaining))}
                </span>
                <span className="text-lg text-muted-foreground">
                  {calories.isOver ? t("today.over") : t("today.remaining")}
                </span>
              </p>
              <Meter
                label={t("history.calories")}
                value={consumed.kcal}
                max={targets.target_kcal}
                valueText={t("today.consumedOf", {
                  consumed: number(consumed.kcal),
                  target: number(targets.target_kcal),
                })}
                className="mt-4 h-2.5"
              />
              <p className="mt-2 text-sm text-muted-foreground tabular-nums">
                {t("today.consumedOf", {
                  consumed: number(consumed.kcal),
                  target: number(targets.target_kcal),
                })}
              </p>

              <dl className="mt-6 grid gap-4 sm:grid-cols-3">
                {[
                  {
                    label: t("today.protein"),
                    value: consumed.proteinG,
                    target: targets.protein_g,
                  },
                  { label: t("today.carbs"), value: consumed.carbsG, target: targets.carbs_g },
                  { label: t("today.fat"), value: consumed.fatG, target: targets.fat_g },
                ].map((macro) => {
                  const text = t("today.gramsOf", {
                    value: number(macro.value),
                    target: number(macro.target),
                  });
                  return (
                    <div key={macro.label}>
                      <div className="flex items-baseline justify-between gap-2">
                        <dt className="text-sm font-medium">{macro.label}</dt>
                        <dd className="text-sm text-muted-foreground tabular-nums">{text}</dd>
                      </div>
                      <Meter
                        label={macro.label}
                        value={macro.value}
                        max={macro.target}
                        valueText={text}
                        className="mt-1.5"
                      />
                    </div>
                  );
                })}
              </dl>
            </>
          ) : (
            <p className="text-muted-foreground">{t("today.noTargets")}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-3 border-t border-border pt-5">
            <Button asChild>
              <Link href={ROUTES.nutrition}>
                <Plus aria-hidden="true" />
                {t("today.addMeal")}
              </Link>
            </Button>
            <p className="text-sm text-muted-foreground">
              {t("today.meals", { count: entries.length })}
            </p>
          </div>
        </Card>

        <Card>
          <div className="mb-4 flex flex-wrap items-baseline justify-between gap-3">
            <CardTitle>{t("weight.title")}</CardTitle>
            {latest ? (
              <p>
                <span className="text-lg font-semibold tabular-nums">
                  {number(latest.weightKg, 1)} kg
                </span>{" "}
                <span className="text-sm text-muted-foreground">
                  {t("weight.on", { date: longDate(latest.date) })}
                </span>
              </p>
            ) : null}
          </div>
          {visibleTrend.length > 0 ? (
            <WeightChart
              points={visibleTrend}
              targetKg={goal?.target_weight_kg ?? null}
              height={200}
              labels={{
                weighIns: tChart("weighIns"),
                average: tChart("average"),
                target: goal?.target_weight_kg
                  ? tChart("target", { weight: number(goal.target_weight_kg, 1) })
                  : "",
                description: `${tChart("title")}, ${t("weight.chartTitle")}. ${tChart("kgAxis")}.`,
              }}
            />
          ) : (
            <p className="text-muted-foreground">{t("weight.none")}</p>
          )}
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href={`${ROUTES.progress}#weight`}>{t("weight.log")}</Link>
            </Button>
            <Button asChild variant="ghost">
              <Link href={ROUTES.progress}>{t("weight.details")}</Link>
            </Button>
          </div>
        </Card>

        <div className="grid gap-5 lg:grid-cols-2">
          {preferences?.water_tracking_enabled !== false ? (
            <WaterCard
              totalMl={water.reduce((sum, entry) => sum + entry.amount_ml, 0)}
              goalMl={preferences?.daily_water_goal_ml ?? null}
            />
          ) : null}
          <StepsCard steps={steps} goal={preferences?.daily_steps_goal ?? null} />
        </div>

        <Card>
          <CardHeader>
            <CardTitle>{t("history.title")}</CardTitle>
          </CardHeader>
          {hasHistory ? (
            <>
              <div className="grid gap-8 lg:grid-cols-2">
                <div>
                  <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal">
                    {t("history.calories")}
                  </h3>
                  <IntakeChart
                    points={days.map((date) => ({ date, value: byDay.get(date)?.kcal ?? null }))}
                    target={targets?.target_kcal ?? null}
                    unit="kcal"
                    labels={{
                      series: t("history.calories"),
                      target: targets
                        ? t("history.target", { value: number(targets.target_kcal) })
                        : "",
                      description: `${t("history.calories")}, ${t("history.title")}`,
                    }}
                  />
                </div>
                <div>
                  <h3 className="mb-2 font-sans text-sm font-semibold tracking-normal">
                    {t("history.protein")}
                  </h3>
                  <IntakeChart
                    points={days.map((date) => ({
                      date,
                      value: byDay.get(date)?.proteinG ?? null,
                    }))}
                    target={targets?.protein_g ?? null}
                    unit="g"
                    labels={{
                      series: t("history.protein"),
                      target: targets
                        ? t("history.target", { value: `${number(targets.protein_g)} g` })
                        : "",
                      description: `${t("history.protein")}, ${t("history.title")}`,
                    }}
                  />
                </div>
              </div>

              <details className="mt-5">
                <summary className="cursor-pointer text-sm font-medium text-primary">
                  {t("history.table")}
                </summary>
                <table className="mt-3 w-full text-left text-[0.9375rem]">
                  <thead>
                    <tr className="border-b border-border text-sm text-muted-foreground">
                      <th scope="col" className="py-2 font-medium">
                        {t("history.day")}
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        {t("history.calories")}
                      </th>
                      <th scope="col" className="py-2 text-right font-medium">
                        {t("history.protein")}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {[...days].reverse().map((date) => {
                      const day = byDay.get(date);
                      return (
                        <tr key={date} className="border-b border-border last:border-b-0">
                          <th scope="row" className="py-2 font-normal first-letter:uppercase">
                            {longDate(date)}
                          </th>
                          {day ? (
                            <>
                              <td className="py-2 text-right tabular-nums">
                                {number(day.kcal)} kcal
                              </td>
                              <td className="py-2 text-right tabular-nums">
                                {number(day.proteinG)} g
                              </td>
                            </>
                          ) : (
                            <td colSpan={2} className="py-2 text-right text-muted-foreground">
                              {t("history.noEntry")}
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </details>
            </>
          ) : (
            <p className="text-muted-foreground">{t("history.empty")}</p>
          )}
        </Card>
      </div>
    </>
  );
}
