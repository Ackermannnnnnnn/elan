import { ArrowLeft, CalendarPlus, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionButton } from "@/components/forms/action-button";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { getActiveProgram } from "@/data/training";
import { planWorkoutAction } from "@/features/training/actions";
import { newWorkoutUrl, weekUrl } from "@/features/training/urls";
import { isIsoDate } from "@/lib/dates";
import { isoWeekday } from "@/domain/training-schedule";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training.planNew");
  return { title: t("title") };
}

export default async function PlanNewPage({ searchParams }: PageProps<"/training/plan/new">) {
  const { date } = await searchParams;
  if (!isIsoDate(date)) notFound();
  const [view, t, tTraining, format] = await Promise.all([
    getActiveProgram(),
    getTranslations("Training.planNew"),
    getTranslations("Training"),
    getFormatter(),
  ]);
  const longDate = format.dateTime(new Date(`${date}T12:00:00Z`), {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const workouts = view?.workouts ?? [];

  return (
    <>
      <Link
        href={weekUrl(date)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {tTraining("title")}
      </Link>
      <PageHeader title={t("title")} lead={t("lead", { date: longDate })} />

      {workouts.length === 0 ? (
        <p className="mb-4 text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="mb-5 flex flex-col gap-3">
          {workouts.map((workout) => (
            <li key={workout.id}>
              <Card className="flex flex-wrap items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-medium">{workout.name}</span>
                  <span className="block text-sm text-muted-foreground">
                    {workout.exercises.length === 0
                      ? t("emptyWorkout")
                      : tTraining("workoutSummary", {
                          count: workout.exercises.length,
                          minutes: workout.estimated_minutes ?? 0,
                        })}
                    {workout.weekday
                      ? ` · ${tTraining(`weekday.${workout.weekday as 1 | 2 | 3 | 4 | 5 | 6 | 7}`)}`
                      : ""}
                  </span>
                </span>
                <ActionButton
                  action={planWorkoutAction.bind(null, workout.id, date)}
                  pendingLabel={t("planning")}
                  size="sm"
                  variant="secondary"
                  disabled={workout.exercises.length === 0}
                  aria-label={t("planLabel", { name: workout.name, date: longDate })}
                >
                  <CalendarPlus aria-hidden="true" />
                  {t("plan")}
                </ActionButton>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Button asChild variant="secondary">
        <Link href={newWorkoutUrl(isoWeekday(date))}>
          <Plus aria-hidden="true" />
          {t("create")}
        </Link>
      </Button>
    </>
  );
}
