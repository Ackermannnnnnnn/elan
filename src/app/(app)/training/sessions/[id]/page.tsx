import { ArrowLeft, Minus, Pause, Play, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionButton } from "@/components/forms/action-button";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, StatGrid } from "@/components/ui/stat";
import { ROUTES } from "@/config/routes";
import { getSession, sessionSeconds } from "@/data/training";
import { type LoggedSet, summarizeSets } from "@/domain/progression";
import {
  addSetAction,
  finishSessionAction,
  logSetAction,
  pauseSessionAction,
  removeLastSetAction,
  resumeSessionAction,
} from "@/features/training/actions";
import { DiscardSessionButton, FinishForm } from "@/features/training/session-controls";
import { ElapsedTime, RestTimerProvider, SetRow } from "@/features/training/session-ui";
import { demoFor } from "@/features/training/demo";
import { MovementDemo } from "@/features/training/movement-demo";
import { exerciseUrl } from "@/features/training/urls";

export async function generateMetadata({
  params,
}: PageProps<"/training/sessions/[id]">): Promise<Metadata> {
  const { id } = await params;
  const view = /^[0-9a-f-]{36}$/i.test(id) ? await getSession(id) : null;
  const t = await getTranslations("Training");
  return { title: view?.session.name ?? t("title") };
}

const decimal = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));

export default async function SessionPage({ params }: PageProps<"/training/sessions/[id]">) {
  const { id } = await params;
  const view = /^[0-9a-f-]{36}$/i.test(id) ? await getSession(id) : null;
  if (!view) notFound();
  const { session, exercises } = view;
  const [t, tSession, format] = await Promise.all([
    getTranslations("Training"),
    getTranslations("Training.session"),
    getFormatter(),
  ]);
  const number = (value: number, digits = 1) =>
    format.number(value, { maximumFractionDigits: digits });
  const done = session.status === "completed";
  const paused = session.status === "paused";

  const describe = (sets: readonly LoggedSet[], timed: boolean) =>
    sets
      .filter((set) => set.reps !== null)
      .map((set) =>
        timed
          ? tSession("setTimed", { seconds: set.reps ?? 0 })
          : set.weightKg
            ? tSession("setWeighted", { weight: number(set.weightKg), reps: set.reps ?? 0 })
            : tSession("setBodyweight", { reps: set.reps ?? 0 }),
      )
      .join(" · ");

  if (done) {
    const all = exercises.flatMap((item) =>
      item.sets.map((set) => ({ weightKg: set.weight_kg, reps: set.reps })),
    );
    const totals = summarizeSets(all);
    return (
      <>
        <Link
          href={ROUTES.trainingHistory}
          className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft aria-hidden="true" className="size-4" />
          {t("history.title")}
        </Link>
        <PageHeader
          title={session.name}
          lead={format.dateTime(new Date(`${session.scheduled_on}T12:00:00Z`), {
            weekday: "long",
            day: "numeric",
            month: "long",
            timeZone: "UTC",
          })}
        />
        <StatGrid className="mb-5">
          <Stat
            label={tSession("duration")}
            value={t("history.minutes", { count: Math.round(sessionSeconds(session) / 60) })}
          />
          <Stat label={tSession("setsDone")} value={String(all.length)} />
          <Stat label={tSession("volume")} value={`${number(totals.volumeKg, 0)} kg`} />
          <Stat
            label={tSession("effortShort")}
            value={session.perceived_effort ? `${session.perceived_effort} / 10` : "–"}
          />
        </StatGrid>
        <div className="flex flex-col gap-4">
          {exercises.map((item) => {
            const now = summarizeSets(
              item.sets.map((set) => ({ weightKg: set.weight_kg, reps: set.reps })),
            );
            const before = summarizeSets(item.previous);
            const delta =
              now.bestOneRepMax !== null && before.bestOneRepMax !== null
                ? Math.round((now.bestOneRepMax - before.bestOneRepMax) * 10) / 10
                : null;
            return (
              <Card key={item.exercise.id}>
                <h2 className="text-lg font-semibold">
                  <Link
                    href={exerciseUrl(item.exercise.id)}
                    className="underline-offset-4 hover:underline"
                  >
                    {item.exercise.name}
                  </Link>
                </h2>
                <p className="mt-1 tabular-nums">
                  {describe(
                    item.sets.map((set) => ({ weightKg: set.weight_kg, reps: set.reps })),
                    item.exercise.is_timed,
                  ) || tSession("noSet")}
                </p>
                {item.previous.length > 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    {tSession("previous", {
                      sets: describe(item.previous, item.exercise.is_timed),
                    })}
                  </p>
                ) : null}
                {delta !== null ? (
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    {delta > 0
                      ? tSession("better", { value: number(delta) })
                      : delta < 0
                        ? tSession("worse", { value: number(-delta) })
                        : tSession("same")}
                  </p>
                ) : null}
              </Card>
            );
          })}
        </div>
      </>
    );
  }

  return (
    <>
      <Link
        href={ROUTES.training}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("title")}
      </Link>
      <PageHeader
        title={session.name}
        lead={tSession(paused ? "pausedLead" : "runningLead")}
        action={
          <div className="flex items-center gap-3">
            <span className="text-2xl font-semibold" aria-label={tSession("elapsed")}>
              {session.started_at ? (
                <ElapsedTime
                  startedAt={session.started_at}
                  pausedSeconds={session.paused_seconds}
                  pausedAt={paused ? session.paused_at : null}
                />
              ) : null}
            </span>
            {paused ? (
              <ActionButton action={resumeSessionAction.bind(null, session.id)} pendingLabel="…">
                <Play aria-hidden="true" />
                {tSession("resume")}
              </ActionButton>
            ) : (
              <ActionButton
                action={pauseSessionAction.bind(null, session.id)}
                pendingLabel="…"
                variant="secondary"
              >
                <Pause aria-hidden="true" />
                {tSession("pause")}
              </ActionButton>
            )}
          </div>
        }
      />
      {paused ? (
        <Alert variant="info" className="mb-5">
          {tSession("pausedNotice")}
        </Alert>
      ) : null}

      <RestTimerProvider>
        <div className="flex flex-col gap-4">
          {exercises.map((item) => {
            const { exercise, target, suggestion } = item;
            const timed = exercise.is_timed;
            const placeholder = {
              weightKg: suggestion?.weightKg ? decimal(suggestion.weightKg) : "",
              reps: suggestion ? String(suggestion.reps) : "",
            };
            const remaining = item.sets.filter((set) => !set.completed_at).length;
            return (
              <Card key={exercise.id}>
                <CardHeader className="mb-3">
                  <CardTitle>
                    <Link
                      href={exerciseUrl(exercise.id)}
                      className="underline-offset-4 hover:underline"
                    >
                      {exercise.name}
                    </Link>
                  </CardTitle>
                  {target ? (
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {t("setsTimes", {
                        sets: item.sets.length,
                        reps: timed
                          ? t("secondsRange", { min: target.rep_min, max: target.rep_max })
                          : t("repsRange", { min: target.rep_min, max: target.rep_max }),
                      })}
                      {target.rest_seconds
                        ? ` · ${t("restSeconds", { seconds: target.rest_seconds })}`
                        : ""}
                    </p>
                  ) : null}
                  {item.previous.length > 0 ? (
                    <p className="text-sm text-muted-foreground tabular-nums">
                      {tSession("previous", { sets: describe(item.previous, timed) })}
                    </p>
                  ) : null}
                  {suggestion ? (
                    <p className="text-sm font-medium tabular-nums">
                      {suggestion.reason === "first"
                        ? tSession("suggestFirst")
                        : suggestion.reason === "harderVariant"
                          ? tSession("suggestHarder")
                          : suggestion.weightKg
                            ? tSession(
                                suggestion.reason === "increaseWeight"
                                  ? "suggestWeightUp"
                                  : "suggestWeighted",
                                { weight: number(suggestion.weightKg), reps: suggestion.reps },
                              )
                            : tSession(timed ? "suggestSeconds" : "suggestReps", {
                                reps: suggestion.reps,
                              })}
                    </p>
                  ) : null}
                  <MovementDemo {...demoFor(exercise)} className="mt-2" />
                </CardHeader>

                <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-2 px-2 text-xs font-semibold text-muted-foreground">
                  <span>{tSession("set")}</span>
                  <span>{tSession("weight")}</span>
                  <span>{timed ? tSession("seconds") : tSession("reps")}</span>
                  <span className="w-11" />
                </div>
                <div className="flex flex-col">
                  {item.sets.map((set) => (
                    <SetRow
                      key={set.id}
                      setId={set.id}
                      setNumber={set.set_number}
                      timed={timed}
                      done={Boolean(set.completed_at)}
                      initial={{
                        weightKg: decimal(set.weight_kg),
                        reps: set.reps === null ? "" : String(set.reps),
                      }}
                      placeholder={placeholder}
                      restSeconds={target?.rest_seconds ?? null}
                      disabled={paused}
                      action={logSetAction.bind(null, set.id)}
                    />
                  ))}
                </div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <ActionButton
                    action={addSetAction.bind(null, session.id, exercise.id)}
                    pendingLabel="…"
                    variant="ghost"
                    size="sm"
                    disabled={paused}
                  >
                    <Plus aria-hidden="true" />
                    {tSession("addSet")}
                  </ActionButton>
                  {remaining > 0 ? (
                    <ActionButton
                      action={removeLastSetAction.bind(null, session.id, exercise.id)}
                      pendingLabel="…"
                      variant="ghost"
                      size="sm"
                      disabled={paused}
                    >
                      <Minus aria-hidden="true" />
                      {tSession("removeSet")}
                    </ActionButton>
                  ) : null}
                </div>
              </Card>
            );
          })}
        </div>
      </RestTimerProvider>

      <Card className="mt-6">
        <CardHeader className="mb-4">
          <CardTitle>{tSession("finishTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{tSession("finishHint")}</p>
        </CardHeader>
        <FinishForm action={finishSessionAction.bind(null, session.id)} />
      </Card>
      <div className="mt-5">
        <DiscardSessionButton id={session.id} />
      </div>
    </>
  );
}
