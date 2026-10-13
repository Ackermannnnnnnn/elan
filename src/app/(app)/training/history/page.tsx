import { ArrowLeft, ChevronRight } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { listCompletedSessions, listTrainedExercises, sessionSeconds } from "@/data/training";
import { exerciseUrl, sessionUrl } from "@/features/training/urls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training.history");
  return { title: t("title") };
}

export default async function TrainingHistoryPage() {
  const [sessions, exercises, t, tTraining, format] = await Promise.all([
    listCompletedSessions(50),
    listTrainedExercises(),
    getTranslations("Training.history"),
    getTranslations("Training"),
    getFormatter(),
  ]);
  const day = (date: string) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      weekday: "long",
      day: "numeric",
      month: "long",
      timeZone: "UTC",
    });

  return (
    <>
      <Link
        href={ROUTES.training}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {tTraining("title")}
      </Link>
      <PageHeader title={t("title")} lead={t("lead")} />

      {sessions.length === 0 ? (
        <Card>
          <p className="text-muted-foreground">{t("empty")}</p>
        </Card>
      ) : (
        <div className="flex flex-col gap-6">
          <section aria-labelledby="sessions-title">
            <h2
              id="sessions-title"
              className="mb-2 font-sans text-sm font-semibold tracking-normal text-muted-foreground"
            >
              {t("sessions")}
            </h2>
            <ul className="overflow-hidden rounded-card border border-border bg-surface">
              {sessions.map((session) => (
                <li key={session.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={sessionUrl(session.id)}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted sm:px-6"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{session.name}</span>
                      <span className="block text-sm text-muted-foreground first-letter:uppercase">
                        {day(session.scheduled_on)}
                      </span>
                    </span>
                    <span className="flex shrink-0 items-center gap-3 text-right text-sm tabular-nums">
                      <span>
                        <span className="block font-semibold">
                          {t("minutes", { count: Math.round(sessionSeconds(session) / 60) })}
                        </span>
                        <span className="block text-muted-foreground">
                          {t("sets", { count: session.sets })}
                          {session.volumeKg > 0 ? ` · ${format.number(session.volumeKg)} kg` : ""}
                        </span>
                      </span>
                      <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>

          <section aria-labelledby="exercises-title">
            <h2
              id="exercises-title"
              className="mb-2 font-sans text-sm font-semibold tracking-normal text-muted-foreground"
            >
              {t("exercises")}
            </h2>
            <ul className="overflow-hidden rounded-card border border-border bg-surface">
              {exercises.map(({ exercise, lastDate, sessions: count }) => (
                <li key={exercise.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={exerciseUrl(exercise.id)}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted sm:px-6"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{exercise.name}</span>
                      <span className="block text-sm text-muted-foreground">
                        {t("exerciseLine", { count, date: day(lastDate) })}
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
          </section>
        </div>
      )}
    </>
  );
}
