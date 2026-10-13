import {
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  History,
  Play,
  Plus,
  Settings2,
} from "lucide-react";
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
import { getToday } from "@/data/profile";
import { getActiveSession, getWeekSchedule } from "@/data/training";
import { resolveWeekStart, type WeekEntry } from "@/domain/training-schedule";
import { cancelPlannedAction, startSessionAction } from "@/features/training/actions";
import {
  libraryUrl,
  newWorkoutUrl,
  occurrenceUrl,
  planOnDateUrl,
  plannedUrl,
  sessionUrl,
  workoutUrl,
} from "@/features/training/urls";
import { addDays, startOfIsoWeek } from "@/lib/dates";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training");
  return { title: t("title") };
}

const utc = (date: string) => new Date(`${date}T12:00:00Z`);

export default async function TrainingPage({ searchParams }: PageProps<"/training">) {
  const { semaine } = await searchParams;
  const today = await getToday();
  const weekStart = resolveWeekStart(typeof semaine === "string" ? semaine : undefined, today);
  const [week, active, t, tOptions, format] = await Promise.all([
    getWeekSchedule(weekStart, today),
    getActiveSession(),
    getTranslations("Training"),
    getTranslations("Options"),
    getFormatter(),
  ]);
  const currentWeek = startOfIsoWeek(today);
  const dayLabel = (date: string) =>
    format.dateTime(utc(date), { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
  const shortDay = (date: string) =>
    format.dateTime(utc(date), { weekday: "long", day: "numeric", timeZone: "UTC" });
  const weekHref = (monday: string) =>
    monday === currentWeek ? ROUTES.training : `${ROUTES.training}?semaine=${monday}`;
  const workoutById = new Map(week.workouts.map((workout) => [workout.id, workout]));
  const onDemand = week.workouts.filter((workout) => workout.weekday === null);

  const startButton = (entry: WeekEntry, primary: boolean) => {
    if (active || !entry.workoutId) return null;
    const workout = workoutById.get(entry.workoutId);
    if (!workout || workout.exercises.length === 0) return null;
    const from =
      entry.kind === "planned" && entry.sessionId
        ? { plannedId: entry.sessionId }
        : { occurrence: entry.date };
    return (
      <ActionButton
        action={startSessionAction.bind(null, entry.workoutId, from)}
        pendingLabel={t("starting")}
        size="sm"
        variant={primary ? "primary" : "secondary"}
      >
        <Play aria-hidden="true" />
        {entry.past ? t("entry.doNow") : t("start")}
      </ActionButton>
    );
  };

  const organizeLink = (entry: WeekEntry) => {
    const href =
      entry.kind === "recurring" && entry.workoutId
        ? occurrenceUrl(entry.workoutId, entry.date)
        : entry.sessionId
          ? plannedUrl(entry.sessionId)
          : null;
    if (!href) return null;
    return (
      <Button asChild variant="ghost" size="sm">
        <Link
          href={href}
          aria-label={t("entry.organizeLabel", { name: entry.name, date: dayLabel(entry.date) })}
        >
          {t("entry.organize")}
        </Link>
      </Button>
    );
  };

  const renderEntry = (entry: WeekEntry, isToday: boolean) => {
    const workout = entry.workoutId ? workoutById.get(entry.workoutId) : undefined;
    const summary = workout
      ? t("workoutSummary", {
          count: workout.exercises.length,
          minutes: workout.estimated_minutes ?? 0,
        })
      : null;
    const title =
      (entry.kind === "done" || entry.kind === "active") && entry.sessionId ? (
        <Link
          href={sessionUrl(entry.sessionId)}
          className="font-medium underline-offset-4 hover:underline"
        >
          {entry.name}
        </Link>
      ) : workout ? (
        <Link
          href={workoutUrl(workout.id)}
          className="font-medium underline-offset-4 hover:underline"
        >
          {entry.name}
        </Link>
      ) : (
        <span className="font-medium">{entry.name}</span>
      );
    const muted = entry.kind === "skipped" || (entry.kind === "recurring" && entry.past);

    return (
      <li key={entry.key} className="flex flex-wrap items-center justify-between gap-x-3 gap-y-2">
        <span className={cn("min-w-0", muted && "text-muted-foreground")}>
          <span className={cn("block", entry.kind === "skipped" && "line-through")}>{title}</span>
          <span className="flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
            {entry.kind === "done" ? (
              <Badge variant="primary">
                <Check aria-hidden="true" className="size-3.5" />
                {t("entry.done")}
              </Badge>
            ) : null}
            {entry.kind === "active" ? <Badge variant="primary">{t("entry.active")}</Badge> : null}
            {entry.kind === "planned" ? (
              <Badge>
                {entry.movedFrom
                  ? t("entry.moved", { day: shortDay(entry.movedFrom) })
                  : t("entry.added")}
              </Badge>
            ) : null}
            {entry.kind === "skipped" ? <Badge>{t("entry.skipped")}</Badge> : null}
            {entry.kind === "recurring" && entry.past ? <Badge>{t("entry.missed")}</Badge> : null}
            {summary && entry.kind !== "done" && entry.kind !== "skipped" ? (
              <span>{summary}</span>
            ) : null}
          </span>
        </span>
        <span className="flex flex-wrap items-center gap-1">
          {entry.kind === "active" && entry.sessionId ? (
            <Button asChild size="sm">
              <Link href={sessionUrl(entry.sessionId)}>{t("resume")}</Link>
            </Button>
          ) : null}
          {entry.kind === "recurring" || entry.kind === "planned"
            ? startButton(entry, isToday)
            : null}
          {entry.kind === "skipped" && entry.sessionId ? (
            <ActionButton
              action={cancelPlannedAction.bind(null, entry.sessionId)}
              pendingLabel="…"
              size="sm"
              variant="ghost"
            >
              {t("entry.restore")}
            </ActionButton>
          ) : null}
          {entry.kind === "recurring" || entry.kind === "planned" ? organizeLink(entry) : null}
        </span>
      </li>
    );
  };

  return (
    <>
      <PageHeader
        title={t("title")}
        lead={t("lead")}
        action={
          <div className="flex flex-wrap gap-2">
            <Button asChild variant="secondary">
              <Link href={libraryUrl}>
                <BookOpen aria-hidden="true" />
                {t("libraryLink")}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={ROUTES.trainingHistory}>
                <History aria-hidden="true" />
                {t("history.title")}
              </Link>
            </Button>
          </div>
        }
      />

      {active ? (
        <Alert variant="info" className="mb-5">
          <span className="flex flex-wrap items-center justify-between gap-3">
            <span>
              {t(active.status === "paused" ? "activePaused" : "activeRunning", {
                name: active.name,
              })}
            </span>
            <Button asChild size="sm">
              <Link href={sessionUrl(active.id)}>{t("resume")}</Link>
            </Button>
          </span>
        </Alert>
      ) : null}

      {!week.program ? (
        <Card className="mb-5">
          <CardHeader className="mb-4">
            <CardTitle>{t("empty.title")}</CardTitle>
            <CardDescription>{t("empty.lead")}</CardDescription>
          </CardHeader>
          <ul className="mb-5 flex list-disc flex-col gap-1 pl-5 text-[0.9375rem]">
            <li>{t("empty.point1")}</li>
            <li>{t("empty.point2")}</li>
            <li>{t("empty.point3")}</li>
          </ul>
          <div className="flex flex-wrap items-center gap-3">
            <Button asChild size="lg">
              <Link href={ROUTES.trainingSetup}>{t("empty.action")}</Link>
            </Button>
            <span className="text-[0.9375rem] text-muted-foreground">{t("empty.or")}</span>
            <Button asChild variant="secondary" size="lg">
              <Link href={newWorkoutUrl()}>{t("empty.custom")}</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <Card className="mb-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-semibold">{week.program.name}</h2>
              <p className="text-[0.9375rem] text-muted-foreground">
                {t("programSummary", {
                  goal: t(`goal.${week.program.goal}`),
                  level: tOptions(`trainingLevel.${week.program.level}`),
                  sessions: week.program.sessions_per_week,
                  minutes: week.program.minutes_per_session ?? 0,
                })}
              </p>
            </div>
            <Button asChild variant="secondary" size="sm">
              <Link href={ROUTES.trainingSetup}>
                <Settings2 aria-hidden="true" />
                {t("editProgram")}
              </Link>
            </Button>
          </div>
        </Card>
      )}

      {week.program ? (
        <div className="flex flex-col gap-5">
          <section aria-labelledby="week-title">
            <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
              <h2
                id="week-title"
                className="font-sans text-sm font-semibold tracking-normal text-muted-foreground"
              >
                {t("weekNav.range", {
                  from: format.dateTime(utc(weekStart), {
                    day: "numeric",
                    month: "long",
                    timeZone: "UTC",
                  }),
                  to: format.dateTime(utc(addDays(weekStart, 6)), {
                    day: "numeric",
                    month: "long",
                    timeZone: "UTC",
                  }),
                })}
              </h2>
              <nav aria-label={t("week")} className="flex items-center gap-1">
                <Button asChild variant="ghost" size="icon">
                  <Link href={weekHref(addDays(weekStart, -7))} aria-label={t("weekNav.previous")}>
                    <ChevronLeft aria-hidden="true" />
                  </Link>
                </Button>
                {weekStart !== currentWeek ? (
                  <Button asChild variant="ghost" size="sm">
                    <Link href={ROUTES.training}>{t("weekNav.current")}</Link>
                  </Button>
                ) : null}
                <Button asChild variant="ghost" size="icon">
                  <Link href={weekHref(addDays(weekStart, 7))} aria-label={t("weekNav.next")}>
                    <ChevronRight aria-hidden="true" />
                  </Link>
                </Button>
              </nav>
            </div>
            <ol className="overflow-hidden rounded-card border border-border bg-surface">
              {week.days.map((day) => (
                <li
                  key={day.date}
                  className={cn(
                    "flex flex-col gap-2 border-b border-border px-5 py-3 last:border-b-0 sm:flex-row sm:items-start sm:gap-3 sm:px-6",
                    day.isToday && "bg-primary-soft/40",
                  )}
                >
                  <div className="flex items-center justify-between gap-2 sm:w-32 sm:shrink-0 sm:flex-col sm:items-start">
                    <span className="font-semibold first-letter:uppercase">
                      {format.dateTime(utc(day.date), { weekday: "long", timeZone: "UTC" })}{" "}
                      <span className="font-normal text-muted-foreground tabular-nums">
                        {format.dateTime(utc(day.date), {
                          day: "numeric",
                          month: "short",
                          timeZone: "UTC",
                        })}
                      </span>
                      {day.isToday ? (
                        <span className="block text-xs font-medium text-primary">{t("today")}</span>
                      ) : null}
                    </span>
                    <Button asChild variant="ghost" size="sm" className="-ml-2 sm:hidden">
                      <Link
                        href={planOnDateUrl(day.date)}
                        aria-label={t("entry.addOnDay", { date: dayLabel(day.date) })}
                      >
                        <Plus aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                  <div className="flex min-w-0 flex-1 items-start gap-2">
                    {day.entries.length === 0 ? (
                      <span className="flex-1 py-1 text-muted-foreground">{t("restDay")}</span>
                    ) : (
                      <ul className="flex min-w-0 flex-1 flex-col gap-3">
                        {day.entries.map((entry) => renderEntry(entry, day.isToday))}
                      </ul>
                    )}
                    <Button asChild variant="ghost" size="icon" className="hidden sm:inline-flex">
                      <Link
                        href={planOnDateUrl(day.date)}
                        aria-label={t("entry.addOnDay", { date: dayLabel(day.date) })}
                      >
                        <Plus aria-hidden="true" />
                      </Link>
                    </Button>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          {onDemand.length > 0 ? (
            <section aria-labelledby="on-demand-title">
              <h2
                id="on-demand-title"
                className="font-sans text-sm font-semibold tracking-normal text-muted-foreground"
              >
                {t("onDemand.title")}
              </h2>
              <p className="mb-2 text-sm text-muted-foreground">{t("onDemand.lead")}</p>
              <ul className="overflow-hidden rounded-card border border-border bg-surface">
                {onDemand.map((workout) => (
                  <li
                    key={workout.id}
                    className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-3 last:border-b-0 sm:px-6"
                  >
                    <Link
                      href={workoutUrl(workout.id)}
                      className="group min-w-0 underline-offset-4"
                    >
                      <span className="block font-medium group-hover:underline">
                        {workout.name}
                      </span>
                      <span className="block text-sm text-muted-foreground">
                        {t("workoutSummary", {
                          count: workout.exercises.length,
                          minutes: workout.estimated_minutes ?? 0,
                        })}
                      </span>
                    </Link>
                    {active || workout.exercises.length === 0 ? null : (
                      <ActionButton
                        action={startSessionAction.bind(null, workout.id, {})}
                        pendingLabel={t("starting")}
                        size="sm"
                        variant="secondary"
                      >
                        <Play aria-hidden="true" />
                        {t("start")}
                      </ActionButton>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </div>
      ) : null}

      <Card className="mt-5">
        <CardHeader className="mb-3">
          <CardTitle className="text-base">{t("manage.title")}</CardTitle>
          <CardDescription>{t("manage.lead")}</CardDescription>
        </CardHeader>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="secondary">
            <Link href={newWorkoutUrl()}>
              <Plus aria-hidden="true" />
              {t("manage.newWorkout")}
            </Link>
          </Button>
          <Button asChild variant="ghost">
            <Link href={libraryUrl}>
              <BookOpen aria-hidden="true" />
              {t("manage.library")}
            </Link>
          </Button>
        </div>
      </Card>

      <Card className="mt-5 bg-surface-muted">
        <CardHeader className="mb-1">
          <CardTitle className="text-base">{t("aiOff.title")}</CardTitle>
        </CardHeader>
        <p className="text-[0.9375rem] text-muted-foreground">{t("aiOff.body")}</p>
      </Card>
    </>
  );
}
