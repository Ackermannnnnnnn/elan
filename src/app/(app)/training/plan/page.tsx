import { ArrowLeft, Pencil, Play } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionButton } from "@/components/forms/action-button";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getToday } from "@/data/profile";
import { getActiveSession, getPlannedSession, getWorkout } from "@/data/training";
import { isoWeekday, weekDates } from "@/domain/training-schedule";
import {
  cancelPlannedAction,
  moveOccurrenceAction,
  reschedulePlannedAction,
  setWorkoutWeekdayAction,
  skipOccurrenceAction,
  startSessionAction,
} from "@/features/training/actions";
import { DateForm } from "@/features/training/date-form";
import { weekUrl, workoutUrl } from "@/features/training/urls";
import { addDays, isIsoDate, startOfIsoWeek } from "@/lib/dates";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
const UUID = /^[0-9a-f-]{36}$/i;

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training.plan");
  return { title: t("title") };
}

const utc = (date: string) => new Date(`${date}T12:00:00Z`);

/** Ce que l'on organise : une occurrence hebdomadaire, ou une séance planifiée / sautée. */
async function resolveTarget(search: Record<string, string | string[] | undefined>) {
  const { seance, date, planifiee } = search;
  if (typeof planifiee === "string" && UUID.test(planifiee)) {
    const session = await getPlannedSession(planifiee);
    if (!session) return null;
    const found = session.workout_id ? await getWorkout(session.workout_id) : null;
    return { kind: "session" as const, session, workout: found?.workout ?? null };
  }
  if (typeof seance === "string" && UUID.test(seance) && isIsoDate(date)) {
    const found = await getWorkout(seance);
    if (!found || found.workout.weekday !== isoWeekday(date)) return null;
    return { kind: "occurrence" as const, date, workout: found.workout };
  }
  return null;
}

export default async function PlanPage({ searchParams }: PageProps<"/training/plan">) {
  const target = await resolveTarget(await searchParams);
  if (!target) notFound();
  const [today, active, t, tTraining, format] = await Promise.all([
    getToday(),
    getActiveSession(),
    getTranslations("Training.plan"),
    getTranslations("Training"),
    getFormatter(),
  ]);
  const longDate = (date: string) =>
    format.dateTime(utc(date), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const shortDate = (date: string) =>
    format.dateTime(utc(date), { weekday: "short", day: "numeric", timeZone: "UTC" });

  const workout = target.workout;
  const date = target.kind === "occurrence" ? target.date : target.session.scheduled_on;
  const status = target.kind === "occurrence" ? "occurrence" : target.session.status;
  const originalDate = target.kind === "session" ? target.session.original_date : null;
  const name = workout?.name ?? (target.kind === "session" ? target.session.name : "");

  const lead =
    status === "occurrence"
      ? t("scheduledOn", { date: longDate(date) })
      : status === "skipped"
        ? t("skippedOn", { date: longDate(date) })
        : originalDate && originalDate !== date
          ? t("movedFrom", { date: longDate(date), original: longDate(originalDate) })
          : t("plannedOn", { date: longDate(date) });

  // Raccourcis : les autres jours de la même semaine, à partir d'aujourd'hui.
  const quickDates = weekDates(startOfIsoWeek(date)).filter(
    (candidate) => candidate !== date && candidate >= today,
  );
  const moveAction = (to: string) =>
    target.kind === "occurrence" && workout
      ? moveOccurrenceAction.bind(null, workout.id, target.date, { date: to })
      : target.kind === "session"
        ? reschedulePlannedAction.bind(null, target.session.id, { date: to })
        : null;
  const formAction =
    target.kind === "occurrence" && workout
      ? moveOccurrenceAction.bind(null, workout.id, target.date)
      : target.kind === "session"
        ? reschedulePlannedAction.bind(null, target.session.id)
        : null;
  const canMove = status === "occurrence" || status === "planned";
  const canStart = Boolean(
    !active && workout && workout.exercises.length > 0 && status !== "skipped",
  );

  return (
    <>
      <Link
        href={weekUrl(date)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {tTraining("title")}
      </Link>
      <PageHeader title={name} lead={lead} />

      <div className="flex flex-col gap-5">
        {canMove && formAction ? (
          <Card>
            <CardHeader className="mb-4">
              <CardTitle className="text-base">
                {status === "occurrence" ? t("moveTitle") : t("rescheduleTitle")}
              </CardTitle>
              {status === "occurrence" ? <CardDescription>{t("moveLead")}</CardDescription> : null}
            </CardHeader>
            {quickDates.length > 0 ? (
              <div className="mb-4 flex flex-wrap gap-2">
                {quickDates.map((candidate) => {
                  const action = moveAction(candidate);
                  return action ? (
                    <ActionButton
                      key={candidate}
                      action={action}
                      pendingLabel="…"
                      size="sm"
                      variant="secondary"
                      aria-label={t("moveTo", { date: longDate(candidate) })}
                    >
                      <span className="first-letter:uppercase">{shortDate(candidate)}</span>
                    </ActionButton>
                  ) : null;
                })}
              </div>
            ) : null}
            <DateForm
              action={formAction}
              defaultDate={date >= today ? date : today}
              min={today}
              max={addDays(today, 365)}
            />
          </Card>
        ) : null}

        <Card>
          <CardHeader className="mb-4">
            <CardTitle className="text-base">{t("otherActions")}</CardTitle>
          </CardHeader>
          {!workout && target.kind === "session" ? (
            <Alert variant="info" className="mb-4">
              {t("missingWorkout")}
            </Alert>
          ) : null}
          <div className="flex flex-wrap gap-2">
            {canStart && workout ? (
              <ActionButton
                action={startSessionAction.bind(
                  null,
                  workout.id,
                  target.kind === "occurrence"
                    ? { occurrence: target.date }
                    : { plannedId: target.session.id },
                )}
                pendingLabel={tTraining("starting")}
              >
                <Play aria-hidden="true" />
                {t("startNow")}
              </ActionButton>
            ) : null}
            {target.kind === "occurrence" && workout ? (
              <ActionButton
                action={skipOccurrenceAction.bind(null, workout.id, target.date)}
                pendingLabel={t("skipping")}
                variant="secondary"
              >
                {t("skip")}
              </ActionButton>
            ) : null}
            {target.kind === "session" ? (
              <ActionButton
                action={cancelPlannedAction.bind(null, target.session.id)}
                pendingLabel={t("removing")}
                variant="secondary"
              >
                {status === "skipped"
                  ? t("restoreSkipped")
                  : originalDate && originalDate !== date
                    ? t("restore")
                    : t("remove")}
              </ActionButton>
            ) : null}
            {workout ? (
              <Button asChild variant="ghost">
                <Link href={workoutUrl(workout.id)}>
                  <Pencil aria-hidden="true" />
                  {t("edit")}
                </Link>
              </Button>
            ) : null}
          </div>
        </Card>

        {workout ? (
          <Card>
            <CardHeader className="mb-4">
              <CardTitle className="text-base">{t("habitTitle")}</CardTitle>
              <CardDescription>{t("habitLead")}</CardDescription>
            </CardHeader>
            <div className="flex flex-wrap gap-2">
              {WEEKDAYS.map((weekday) => (
                <ActionButton
                  key={weekday}
                  action={setWorkoutWeekdayAction.bind(null, workout.id, weekday, date)}
                  pendingLabel="…"
                  size="sm"
                  variant={workout.weekday === weekday ? "primary" : "secondary"}
                  aria-pressed={workout.weekday === weekday}
                  aria-label={t("setHabit", { day: tTraining(`weekday.${weekday}`) })}
                >
                  {tTraining(`weekdayShort.${weekday}`)}
                </ActionButton>
              ))}
              <ActionButton
                action={setWorkoutWeekdayAction.bind(null, workout.id, null, date)}
                pendingLabel="…"
                size="sm"
                variant={workout.weekday === null ? "primary" : "secondary"}
                aria-pressed={workout.weekday === null}
                aria-label={t("setOnDemand")}
              >
                {t("onDemand")}
              </ActionButton>
            </div>
          </Card>
        ) : null}
      </div>
    </>
  );
}
