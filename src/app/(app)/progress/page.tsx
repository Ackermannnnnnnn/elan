import { CalendarCheck } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Meter } from "@/components/ui/meter";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { Stat, StatGrid } from "@/components/ui/stat";
import { BmiCard } from "@/features/tracking/bmi-card";
import { ROUTES } from "@/config/routes";
import { getActiveGoal, getTargetsOn, listGoalHistory } from "@/data/plan";
import { getOwnProfile, getToday } from "@/data/profile";
import { listMeasurements, listWeights } from "@/data/tracking";
import { shouldRecalculate } from "@/domain/energy";
import {
  analyzeTrend,
  directionForGoal,
  movingAverage,
  weightProgress,
} from "@/domain/weight-trend";
import { RecalculateNotice } from "@/features/targets/recalculate-notice";
import { DeleteEntryButton } from "@/features/tracking/delete-buttons";
import { MeasurementForm } from "@/features/tracking/measurement-form";
import { WeightChart } from "@/features/tracking/weight-chart";
import { WeightForm } from "@/features/tracking/weight-form";
import { addDays } from "@/lib/dates";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Progress");
  return { title: t("title") };
}

const RANGES = { "7": 7, "30": 30, "90": 90, all: null } as const;
type RangeKey = keyof typeof RANGES;
const isRange = (value: unknown): value is RangeKey => typeof value === "string" && value in RANGES;

export default async function ProgressPage({ searchParams }: PageProps<"/progress">) {
  const params = await searchParams;
  const range: RangeKey = isRange(params.range) ? params.range : "30";

  const today = await getToday();
  const [weights, goal, targets, measurements, goals, profile, t, tOptions, format] =
    await Promise.all([
      listWeights(),
      getActiveGoal(),
      getTargetsOn(today),
      listMeasurements(),
      listGoalHistory(),
      getOwnProfile(),
      getTranslations("Progress"),
      getTranslations("Options"),
      getFormatter(),
    ]);

  const kg = (value: number, digits = 1) =>
    format.number(value, { minimumFractionDigits: digits, maximumFractionDigits: digits });
  const signedKg = (value: number, digits = 1) =>
    (value > 0 ? "+" : value < 0 ? "−" : "") + kg(Math.abs(value), digits);
  const day = (date: string, month: "short" | "long" = "long") =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      day: "numeric",
      month,
      year: "numeric",
      timeZone: "UTC",
    });

  const points = weights.map((entry) => ({ date: entry.measured_on, weightKg: entry.weight_kg }));
  const trendPoints = movingAverage(points);
  const latest = trendPoints.at(-1);
  const targetKg = goal?.target_weight_kg ?? null;

  const rangeDays = RANGES[range];
  const rangeStart = rangeDays === null ? null : addDays(today, -(rangeDays - 1));
  const visible = rangeStart
    ? trendPoints.filter((point) => point.date >= rangeStart)
    : trendPoints;

  const progress = latest
    ? weightProgress({
        startKg: goal?.start_weight_kg ?? trendPoints[0]!.weightKg,
        currentKg: latest.weightKg,
        targetKg,
      })
    : null;
  const trend = analyzeTrend(points, today, directionForGoal(goal?.goal_type));

  const calculationWeight = (targets?.inputs as { weight_kg?: unknown } | null)?.weight_kg;
  const suggestRecalculation =
    latest !== undefined &&
    targets?.source === "calculated" &&
    typeof calculationWeight === "number" &&
    shouldRecalculate(calculationWeight, latest.weightKg);

  const history = [...trendPoints].reverse();
  const notesByDate = new Map(weights.map((entry) => [entry.measured_on, entry]));

  return (
    <>
      <PageHeader
        title={t("title")}
        lead={t("lead")}
        action={
          <Button asChild variant="secondary">
            <Link href={ROUTES.habits}>
              <CalendarCheck aria-hidden="true" />
              {t("habitsLink")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-5">
        {latest && progress ? (
          <StatGrid>
            <Stat
              label={t("stats.current")}
              value={`${kg(latest.weightKg)} kg`}
              detail={day(latest.date)}
            />
            <Stat
              label={t("stats.since")}
              value={`${signedKg(progress.changeKg)} kg`}
              detail={t("stats.start", { weight: kg(progress.startKg) })}
            />
            <Stat
              label={t("stats.remaining")}
              value={
                progress.remainingKg === null
                  ? t("stats.noTarget")
                  : progress.percent === 100
                    ? t("stats.reached")
                    : `${kg(progress.remainingKg)} kg`
              }
              detail={
                progress.percent !== null ? (
                  <span className="flex flex-col gap-2">
                    {t("stats.progress", { percent: progress.percent })}
                    <Meter
                      label={t("stats.remaining")}
                      value={progress.percent}
                      max={100}
                      valueText={t("stats.progress", { percent: progress.percent })}
                    />
                  </span>
                ) : undefined
              }
            />
            <Stat
              label={t("stats.trend")}
              value={
                trend.weeklyRateKg === null
                  ? t("stats.notEnough")
                  : t("stats.perWeek", { rate: signedKg(trend.weeklyRateKg, 2) })
              }
            />
          </StatGrid>
        ) : null}
        {latest && profile?.height_cm ? (
          <BmiCard weightKg={latest.weightKg} heightCm={profile.height_cm} />
        ) : null}

        {latest ? (
          <Alert variant="info">
            {t(`trend.${trend.status}`, { count: trend.entriesInWindow })}
          </Alert>
        ) : null}

        {suggestRecalculation && typeof calculationWeight === "number" && latest ? (
          <RecalculateNotice delta={signedKg(latest.weightKg - calculationWeight)} />
        ) : null}

        <Card id="weight">
          <CardHeader>
            <CardTitle>{t("weightForm.title")}</CardTitle>
          </CardHeader>
          <WeightForm today={today} />
        </Card>

        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <CardTitle>{t("chart.title")}</CardTitle>
            {trendPoints.length > 0 ? (
              <SegmentedLinks
                label={t("chart.range")}
                items={(Object.keys(RANGES) as RangeKey[]).map((key) => ({
                  href: key === "30" ? ROUTES.progress : `${ROUTES.progress}?range=${key}`,
                  label: t(`chart.r${key}`),
                  current: key === range,
                }))}
              />
            ) : null}
          </div>

          {trendPoints.length === 0 ? (
            <p className="text-muted-foreground">{t("chart.empty")}</p>
          ) : visible.length === 0 ? (
            <p className="text-muted-foreground">{t("chart.emptyRange")}</p>
          ) : (
            <WeightChart
              points={visible}
              targetKg={targetKg}
              labels={{
                weighIns: t("chart.weighIns"),
                average: t("chart.average"),
                target: targetKg === null ? "" : t("chart.target", { weight: kg(targetKg) }),
                description: `${t("chart.title")}. ${t("chart.kgAxis")}.`,
              }}
            />
          )}
        </Card>

        {history.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("history.title")}</CardTitle>
            </CardHeader>
            <div className="-mx-5 overflow-x-auto sm:-mx-6">
              <table className="w-full min-w-[22rem] text-left text-[0.9375rem]">
                <thead>
                  <tr className="border-b border-border text-sm text-muted-foreground">
                    <th scope="col" className="px-5 py-2 font-medium sm:px-6">
                      {t("history.date")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      {t("history.weight")}
                    </th>
                    <th scope="col" className="px-3 py-2 text-right font-medium">
                      {t("history.average")}
                    </th>
                    <th scope="col" className="px-5 py-2 text-right font-medium sm:px-6">
                      <span className="sr-only">{t("history.actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.slice(0, 60).map((point) => {
                    const entry = notesByDate.get(point.date);
                    return (
                      <tr key={point.date} className="border-b border-border last:border-b-0">
                        <th scope="row" className="px-5 py-2.5 font-normal sm:px-6">
                          {day(point.date, "short")}
                          {entry?.note ? (
                            <span className="block text-sm text-muted-foreground">
                              {entry.note}
                            </span>
                          ) : null}
                        </th>
                        <td className="px-3 py-2.5 text-right font-semibold tabular-nums">
                          {kg(point.weightKg)} kg
                        </td>
                        <td className="px-3 py-2.5 text-right text-muted-foreground tabular-nums">
                          {kg(point.averageKg)} kg
                        </td>
                        <td className="px-5 py-1 text-right sm:px-6">
                          {entry ? (
                            <DeleteEntryButton
                              kind="weight"
                              id={entry.id}
                              label={t("history.delete", { date: day(point.date) })}
                            />
                          ) : null}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        ) : null}

        <Card>
          <CardHeader>
            <CardTitle>{t("measurements.title")}</CardTitle>
            <CardDescription>{t("measurements.lead")}</CardDescription>
          </CardHeader>
          <MeasurementForm today={today} />

          {measurements.length === 0 ? (
            <p className="mt-6 text-muted-foreground">{t("measurements.empty")}</p>
          ) : (
            <div className="-mx-5 mt-6 overflow-x-auto sm:-mx-6">
              <table className="w-full min-w-[34rem] text-left text-[0.9375rem]">
                <thead>
                  <tr className="border-b border-border text-sm text-muted-foreground">
                    <th scope="col" className="px-5 py-2 font-medium sm:px-6">
                      {t("history.date")}
                    </th>
                    {(["waist", "hips", "chest", "arm", "thigh"] as const).map((key) => (
                      <th key={key} scope="col" className="px-3 py-2 text-right font-medium">
                        {t(`measurements.${key}`)}
                      </th>
                    ))}
                    <th scope="col" className="px-5 py-2 sm:px-6">
                      <span className="sr-only">{t("history.actions")}</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {measurements.map((row) => (
                    <tr key={row.id} className="border-b border-border last:border-b-0">
                      <th scope="row" className="px-5 py-2.5 font-normal whitespace-nowrap sm:px-6">
                        {day(row.measured_on, "short")}
                      </th>
                      {[row.waist_cm, row.hips_cm, row.chest_cm, row.arm_cm, row.thigh_cm].map(
                        (value, index) => (
                          <td key={index} className="px-3 py-2.5 text-right tabular-nums">
                            {value === null ? (
                              <span className="text-muted-foreground">—</span>
                            ) : (
                              `${kg(value)} cm`
                            )}
                          </td>
                        ),
                      )}
                      <td className="px-5 py-1 text-right sm:px-6">
                        <DeleteEntryButton
                          kind="measurement"
                          id={row.id}
                          label={t("measurements.delete", { date: day(row.measured_on) })}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        {goals.length > 0 ? (
          <Card>
            <CardHeader>
              <CardTitle>{t("goals.title")}</CardTitle>
            </CardHeader>
            <ul className="flex flex-col">
              {goals.map((entry) => (
                <li
                  key={entry.id}
                  className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 border-b border-border py-3 first:pt-0 last:border-b-0 last:pb-0"
                >
                  <span>
                    <span className="font-semibold">
                      {tOptions(`goalType.${entry.goal_type}.label`)}
                    </span>
                    <span className="block text-sm text-muted-foreground">
                      {t("goals.since", { date: day(entry.started_on) })}
                      {entry.target_weight_kg !== null
                        ? `, ${t("goals.target", { weight: kg(entry.target_weight_kg) })}`
                        : ""}
                    </span>
                  </span>
                  <Badge variant={entry.status === "active" ? "primary" : "neutral"}>
                    {t(`goals.${entry.status}`)}
                  </Badge>
                </li>
              ))}
            </ul>
          </Card>
        ) : null}
      </div>
    </>
  );
}
