import {
  ArrowLeftRight,
  ArrowLeft,
  ChevronDown,
  Clock,
  Link2,
  Minus,
  Pause,
  Play,
  Plus,
  StickyNote,
  Unlink,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionButton } from "@/components/forms/action-button";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, StatGrid } from "@/components/ui/stat";
import { ROUTES } from "@/config/routes";
import { getSession, sessionSeconds } from "@/data/training";
import { type LoggedSet, liftedLoad, summarizeSets } from "@/domain/progression";
import { type PlanItem, proposedValues, supersetLabels } from "@/domain/session-flow";
import { RestAlertHint } from "@/features/notifications/rest-alert-hint";
import {
  addSetAction,
  finishSessionAction,
  logSetAction,
  moveSessionExerciseAction,
  pauseSessionAction,
  removeLastSetAction,
  removeSessionExerciseAction,
  resumeSessionAction,
  setSessionNoteAction,
  setSessionRestAction,
  setSessionSupersetAction,
} from "@/features/training/actions";
import { DiscardSessionButton, FinishForm, NoteForm } from "@/features/training/session-controls";
import { ElapsedTime, KeepScreenOn, SessionPlanSync, SetRow } from "@/features/training/session-ui";
import { MoveButtons, ReorderableSessionList } from "@/features/training/session-reorder";
import { demoFor } from "@/features/training/demo";
import { MovementDemo } from "@/features/training/movement-demo";
import { RestPicker } from "@/features/training/rest-picker";
import { addToSessionUrl, exerciseUrl, swapUrl } from "@/features/training/urls";
import { cn } from "@/lib/utils";

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
  const count = exercises.length;
  // Plan actuel de la séance (ordre, séries faites) : le minuteur en déduit
  // la prochaine série, sans jamais proposer un exercice déjà terminé.
  const plan: PlanItem[] = exercises.map((entry, index) => ({
    id: entry.item.id,
    name: entry.exercise.name,
    supersetWithNext: entry.item.superset_with_next && index < count - 1,
    restSeconds: entry.target.rest_seconds,
    sets: entry.sets.map((set) => ({ setNumber: set.set_number, done: Boolean(set.completed_at) })),
  }));
  const labels = supersetLabels(plan);

  // « kg / bras » pour les exercices aux haltères (un dans chaque main).
  const kg = (perHand: boolean) => (perHand ? tSession("kgPerHand") : "kg");
  const describe = (sets: readonly LoggedSet[], timed: boolean, perHand: boolean) =>
    sets
      .filter((set) => set.reps !== null)
      .map((set) =>
        timed
          ? tSession("setTimed", { seconds: set.reps ?? 0 })
          : set.weightKg
            ? tSession("setWeighted", {
                weight: number(set.weightKg),
                unit: kg(perHand),
                reps: set.reps ?? 0,
              })
            : tSession("setBodyweight", { reps: set.reps ?? 0 }),
      )
      .join(" · ");

  if (done) {
    // Volume : charge réellement soulevée (deux haltères = deux fois la charge saisie).
    const all = exercises.flatMap((item) =>
      item.sets.map((set) => ({
        weightKg: liftedLoad(set.weight_kg, item.exercise.load_basis),
        reps: set.reps,
      })),
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
              <Card key={item.item.id}>
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
                    item.exercise.load_basis === "per_hand",
                  ) || tSession("noSet")}
                </p>
                {item.previous.length > 0 ? (
                  <p className="mt-1 text-sm text-muted-foreground tabular-nums">
                    {tSession("previous", {
                      sets: describe(
                        item.previous,
                        item.exercise.is_timed,
                        item.exercise.load_basis === "per_hand",
                      ),
                    })}
                  </p>
                ) : null}
                {delta !== null ? (
                  <p className="mt-1 text-sm font-medium tabular-nums">
                    {delta > 0
                      ? tSession("better", {
                          value: number(delta),
                          unit: kg(item.exercise.load_basis === "per_hand"),
                        })
                      : delta < 0
                        ? tSession("worse", {
                            value: number(-delta),
                            unit: kg(item.exercise.load_basis === "per_hand"),
                          })
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

      <KeepScreenOn active={!paused} />
      <SessionPlanSync sessionId={session.id} plan={plan} />
      <RestAlertHint />
      <div>
        {exercises.length === 0 ? (
          <Card className="mb-4">
            <p className="text-muted-foreground">{tSession("emptySession")}</p>
          </Card>
        ) : null}
        <ReorderableSessionList
          items={exercises.map((entry, index) => {
            const { item, exercise, target, suggestion } = entry;
            const timed = exercise.is_timed;
            const perHand = exercise.load_basis === "per_hand";
            const label = labels[index];
            const linkedToNext = Boolean(label) && item.superset_with_next && index < count - 1;
            const remaining = entry.sets.filter((set) => !set.completed_at).length;
            const doneCount = entry.sets.length - remaining;
            const complete = entry.sets.length > 0 && remaining === 0;
            const target_ = suggestion
              ? { weightKg: suggestion.weightKg ?? null, reps: suggestion.reps }
              : null;
            const nextExercise = exercises[index + 1]?.exercise.name ?? null;
            const goal = suggestion
              ? suggestion.reason === "first"
                ? tSession("suggestFirst")
                : suggestion.reason === "harderVariant"
                  ? tSession("suggestHarder")
                  : suggestion.weightKg
                    ? tSession("goalWeighted", {
                        weight: number(suggestion.weightKg),
                        unit: kg(perHand),
                        reps: suggestion.reps,
                      })
                    : tSession(timed ? "goalSeconds" : "goalReps", { reps: suggestion.reps })
              : null;
            return {
              id: item.id,
              className: cn(linkedToNext ? "mb-0" : "mb-3"),
              node: (
                <>
                  <Card
                    className={cn("relative p-0 sm:p-0", label && "border-l-4 border-l-primary")}
                  >
                    {/* Monter / descendre : toujours visibles, hors du résumé repliable. */}
                    <div className="absolute top-2.5 right-11 z-10 sm:right-12">
                      <MoveButtons itemId={item.id} name={exercise.name} />
                    </div>
                    <details open={!complete} className="group">
                      <summary className="flex cursor-pointer list-none items-start gap-3 py-4 pr-4 pl-4 sm:px-5 sm:pl-5 [&::-webkit-details-marker]:hidden">
                        <span className="min-w-0 flex-1">
                          <span className="flex flex-wrap items-center gap-2 pr-20">
                            {label ? (
                              <Badge variant="primary">
                                {tSession("supersetBadge", { label })}
                              </Badge>
                            ) : null}
                            {complete ? (
                              <Badge variant="primary">
                                {tSession("exerciseDone", { count: doneCount })}
                              </Badge>
                            ) : (
                              <span className="text-xs font-semibold text-muted-foreground tabular-nums">
                                {tSession("progress", {
                                  done: doneCount,
                                  total: entry.sets.length,
                                })}
                              </span>
                            )}
                          </span>
                          <span className="mt-0.5 block text-lg leading-snug font-semibold">
                            {exercise.name}
                          </span>
                          <span className="block text-sm text-muted-foreground tabular-nums">
                            {timed
                              ? t("secondsRange", { min: target.rep_min, max: target.rep_max })
                              : t("repsRange", { min: target.rep_min, max: target.rep_max })}
                            {entry.replaced
                              ? ` · ${tSession("replacing", { name: entry.replaced.name })}`
                              : ""}
                          </span>
                        </span>
                        <ChevronDown
                          aria-hidden="true"
                          className="mt-1 size-5 shrink-0 text-muted-foreground transition-transform group-open:rotate-180"
                        />
                      </summary>

                      <div className="px-4 pb-4 sm:px-5">
                        {entry.previous.length > 0 || goal ? (
                          <p className="mb-2 text-sm tabular-nums">
                            {entry.previous.length > 0 ? (
                              <span className="text-muted-foreground">
                                {tSession("previous", {
                                  sets: describe(entry.previous, timed, perHand),
                                })}
                              </span>
                            ) : null}
                            {entry.previous.length > 0 && goal ? <br /> : null}
                            {goal ? <span className="font-medium">{goal}</span> : null}
                          </p>
                        ) : null}
                        {entry.lastNote && entry.lastNote !== item.note ? (
                          <p className="mb-2 flex items-start gap-1.5 rounded-control bg-warning-soft px-3 py-2 text-sm">
                            <StickyNote aria-hidden="true" className="mt-0.5 size-4 shrink-0" />
                            <span>{tSession("lastNote", { note: entry.lastNote })}</span>
                          </p>
                        ) : null}

                        <div className="mb-2 flex flex-wrap items-start gap-2">
                          <RestPicker
                            seconds={target.rest_seconds}
                            exerciseName={exercise.name}
                            action={setSessionRestAction.bind(null, item.id)}
                            overrideKey={item.id}
                          />
                          <Button asChild variant="secondary" size="sm">
                            <Link
                              href={swapUrl(session.id, item.id)}
                              aria-label={tSession("swapLabel", { name: exercise.name })}
                            >
                              <ArrowLeftRight aria-hidden="true" />
                              {tSession("swap")}
                            </Link>
                          </Button>
                        </div>

                        {entry.sets.length > 0 ? (
                          <div className="grid grid-cols-[2rem_1fr_1fr_auto] gap-2 px-2 text-xs font-semibold text-muted-foreground">
                            <span>{tSession("set")}</span>
                            <span>{perHand ? tSession("weightPerHand") : tSession("weight")}</span>
                            <span>{timed ? tSession("seconds") : tSession("reps")}</span>
                            <span className="w-11" />
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground">{tSession("stopped")}</p>
                        )}
                        <div className="flex flex-col">
                          {entry.sets.map((set) => {
                            const values = proposedValues(
                              entry.sets.map((other) => ({
                                setNumber: other.set_number,
                                done: Boolean(other.completed_at),
                                weightKg: other.weight_kg,
                                reps: other.reps,
                              })),
                              set.set_number,
                              target_,
                            );
                            return (
                              <SetRow
                                key={set.id}
                                setId={set.id}
                                setNumber={set.set_number}
                                timed={timed}
                                perHand={perHand}
                                done={Boolean(set.completed_at)}
                                initial={{
                                  weightKg: decimal(set.weight_kg),
                                  reps: set.reps === null ? "" : String(set.reps),
                                }}
                                proposed={{
                                  weightKg: values?.weightKg ? decimal(values.weightKg) : "",
                                  reps: values?.reps ? String(values.reps) : "",
                                }}
                                sessionId={session.id}
                                itemId={item.id}
                                disabled={paused}
                                action={logSetAction.bind(null, set.id)}
                              />
                            );
                          })}
                        </div>

                        <div className="mt-2 flex flex-wrap items-center gap-1">
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

                        <MovementDemo {...demoFor(exercise)} className="mt-2" />

                        <details className="mt-3 border-t border-border pt-3">
                          <summary className="cursor-pointer text-sm font-semibold text-primary">
                            {tSession("moreOptions")}
                            {item.note ? (
                              <span className="ml-2 font-normal text-muted-foreground">
                                · {tSession("hasNote")}
                              </span>
                            ) : null}
                          </summary>
                          <div className="mt-3 flex flex-col gap-4">
                            <div className="flex flex-wrap gap-2">
                              {index < count - 1 && remaining > 0 ? (
                                <ActionButton
                                  action={moveSessionExerciseAction.bind(null, item.id, "last")}
                                  pendingLabel="…"
                                  variant="secondary"
                                  size="sm"
                                >
                                  <Clock aria-hidden="true" />
                                  {tSession("later")}
                                </ActionButton>
                              ) : null}
                              {index < count - 1 ? (
                                <ActionButton
                                  action={setSessionSupersetAction.bind(
                                    null,
                                    item.id,
                                    !item.superset_with_next,
                                  )}
                                  pendingLabel="…"
                                  variant="ghost"
                                  size="sm"
                                  aria-label={
                                    item.superset_with_next
                                      ? tSession("unlink")
                                      : tSession("link", { name: nextExercise ?? "" })
                                  }
                                >
                                  {item.superset_with_next ? (
                                    <Unlink aria-hidden="true" />
                                  ) : (
                                    <Link2 aria-hidden="true" />
                                  )}
                                  {item.superset_with_next
                                    ? tSession("unlink")
                                    : tSession("linkShort")}
                                </ActionButton>
                              ) : null}
                              {remaining > 0 || doneCount === 0 ? (
                                <ActionButton
                                  action={removeSessionExerciseAction.bind(null, item.id)}
                                  pendingLabel="…"
                                  variant="ghost"
                                  size="sm"
                                >
                                  {doneCount > 0
                                    ? tSession("stopExercise")
                                    : tSession("skipExercise")}
                                </ActionButton>
                              ) : null}
                              <Button asChild variant="ghost" size="sm">
                                <Link href={exerciseUrl(exercise.id)}>{tSession("history")}</Link>
                              </Button>
                            </div>
                            <NoteForm
                              key={item.note ?? ""}
                              idPrefix={item.id}
                              defaultNote={item.note ?? ""}
                              action={setSessionNoteAction.bind(null, item.id)}
                            />
                          </div>
                        </details>
                      </div>
                    </details>
                  </Card>
                  {linkedToNext ? (
                    <p
                      aria-hidden="true"
                      className="flex items-center gap-2 py-1.5 pl-5 text-xs font-semibold text-primary"
                    >
                      <Link2 className="size-3.5" />
                      {tSession("chained")}
                    </p>
                  ) : null}
                </>
              ),
            };
          })}
        />
        <Button asChild variant="secondary" className="self-start">
          <Link href={addToSessionUrl(session.id)}>
            <Plus aria-hidden="true" />
            {tSession("addExercise")}
          </Link>
        </Button>
      </div>

      <Card id="finish" className="mt-6 scroll-mt-4">
        <CardHeader className="mb-4">
          <CardTitle>{tSession("finishTitle")}</CardTitle>
          <p className="text-sm text-muted-foreground">{tSession("finishHint")}</p>
        </CardHeader>
        <FinishForm sessionId={session.id} action={finishSessionAction.bind(null, session.id)} />
      </Card>
      <div className="mt-5">
        <DiscardSessionButton id={session.id} />
      </div>
    </>
  );
}
