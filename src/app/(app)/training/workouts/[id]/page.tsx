import {
  ArrowDown,
  ArrowLeft,
  ArrowUp,
  Link2,
  Minus,
  Play,
  Plus,
  Repeat,
  Unlink,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionButton } from "@/components/forms/action-button";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { getActiveSession, getWorkout } from "@/data/training";
import {
  deleteWorkoutAction,
  moveWorkoutExerciseAction,
  removeWorkoutExerciseAction,
  setTargetSetsAction,
  setWorkoutRestAction,
  setWorkoutSupersetAction,
  setWorkoutWeekdayAction,
  startSessionAction,
  updatePrescriptionAction,
  updateWorkoutAction,
} from "@/features/training/actions";
import { demoFor } from "@/features/training/demo";
import { MovementDemo } from "@/features/training/movement-demo";
import { PrescriptionForm } from "@/features/training/prescription-form";
import { RestPicker } from "@/features/training/rest-picker";
import { addExercisesUrl, exerciseUrl, replaceUrl, sessionUrl } from "@/features/training/urls";
import { WorkoutForm } from "@/features/training/workout-form";
import { supersetLabels } from "@/domain/session-flow";

const WEEKDAYS = [1, 2, 3, 4, 5, 6, 7] as const;
type Weekday = (typeof WEEKDAYS)[number];

export async function generateMetadata({
  params,
}: PageProps<"/training/workouts/[id]">): Promise<Metadata> {
  const { id } = await params;
  const found = /^[0-9a-f-]{36}$/i.test(id) ? await getWorkout(id) : null;
  const t = await getTranslations("Training");
  return { title: found?.workout.name ?? t("title") };
}

export default async function WorkoutPage({ params }: PageProps<"/training/workouts/[id]">) {
  const { id } = await params;
  const found = /^[0-9a-f-]{36}$/i.test(id) ? await getWorkout(id) : null;
  if (!found) notFound();
  const { workout } = found;
  const [active, t, tOptions, tCommon] = await Promise.all([
    getActiveSession(),
    getTranslations("Training"),
    getTranslations("Options"),
    getTranslations("Common"),
  ]);
  const count = workout.exercises.length;
  const labels = supersetLabels(
    workout.exercises.map((item) => ({ supersetWithNext: item.superset_with_next })),
  );

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
        title={workout.name}
        lead={t("workoutSummary", { count, minutes: workout.estimated_minutes ?? 0 })}
        action={
          active ? (
            <Button asChild>
              <Link href={sessionUrl(active.id)}>{t("resume")}</Link>
            </Button>
          ) : count > 0 ? (
            <ActionButton
              action={startSessionAction.bind(null, workout.id, {})}
              pendingLabel={t("starting")}
              size="lg"
            >
              <Play aria-hidden="true" />
              {t("start")}
            </ActionButton>
          ) : null
        }
      />

      <section aria-labelledby="day-title" className="mb-6">
        <h2 id="day-title" className="mb-2 text-sm font-semibold text-muted-foreground">
          {t("plan.habitTitle")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {WEEKDAYS.map((weekday) => (
            <ActionButton
              key={weekday}
              action={setWorkoutWeekdayAction.bind(null, workout.id, weekday)}
              pendingLabel="…"
              size="sm"
              variant={workout.weekday === weekday ? "primary" : "secondary"}
              aria-pressed={workout.weekday === weekday}
              aria-label={t("plan.setHabit", { day: t(`weekday.${weekday}`) })}
            >
              {t(`weekdayShort.${weekday}`)}
            </ActionButton>
          ))}
          <ActionButton
            action={setWorkoutWeekdayAction.bind(null, workout.id, null)}
            pendingLabel="…"
            size="sm"
            variant={workout.weekday === null ? "primary" : "secondary"}
            aria-pressed={workout.weekday === null}
            aria-label={t("plan.setOnDemand")}
          >
            {t("plan.onDemand")}
          </ActionButton>
        </div>
      </section>

      {count === 0 ? (
        <Card className="mb-4">
          <p className="mb-4 text-muted-foreground">{t("emptyWorkout")}</p>
          <Button asChild>
            <Link href={addExercisesUrl(workout.id)}>
              <Plus aria-hidden="true" />
              {t("addExercise")}
            </Link>
          </Button>
        </Card>
      ) : (
        <ol className="mb-4 flex flex-col gap-4">
          {workout.exercises.map((item, index) => {
            const exercise = item.exercise;
            if (!exercise) return null;
            const reps = exercise.is_timed
              ? t("secondsRange", { min: item.rep_min, max: item.rep_max })
              : t("repsRange", { min: item.rep_min, max: item.rep_max });
            const shared = exercise.owner_id === null;
            return (
              <li key={item.id}>
                <Card>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      {labels[index] ? (
                        <Badge variant="primary" className="mb-1">
                          {t("session.supersetBadge", { label: labels[index] ?? "" })}
                        </Badge>
                      ) : null}
                      <p className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
                        {t("exerciseNumber", { number: index + 1 })} ·{" "}
                        {t(`muscle.${exercise.primary_muscle}`)}
                      </p>
                      <h2 className="text-lg font-semibold">
                        <Link
                          href={exerciseUrl(exercise.id)}
                          className="underline-offset-4 hover:underline"
                        >
                          {exercise.name}
                        </Link>
                      </h2>
                      <p className="mt-1 text-[0.9375rem] tabular-nums">
                        <span className="font-semibold">
                          {t("setsTimes", { sets: item.target_sets, reps })}
                        </span>
                        {item.rest_seconds ? (
                          <span className="text-muted-foreground">
                            {" "}
                            · {t("restSeconds", { seconds: item.rest_seconds })}
                          </span>
                        ) : null}
                      </p>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {shared ? (
                          <Badge>{tOptions(`trainingLevel.${exercise.difficulty}`)}</Badge>
                        ) : (
                          <Badge variant="primary">{t("ownExercise.badge")}</Badge>
                        )}
                        <Badge>
                          {exercise.equipment.length === 0
                            ? t("bodyweight")
                            : exercise.equipment
                                .map((equipment) => tOptions(`equipment.${equipment}` as never))
                                .join(", ")}
                        </Badge>
                        {item.replaced_exercise_id ? (
                          <Badge variant="primary">{t("replaced")}</Badge>
                        ) : null}
                      </div>
                    </div>
                    <div className="flex items-center">
                      <ActionButton
                        action={moveWorkoutExerciseAction.bind(null, item.id, -1)}
                        pendingLabel=""
                        size="icon"
                        variant="ghost"
                        disabled={index === 0}
                        aria-label={t("moveUp", { name: exercise.name })}
                      >
                        <ArrowUp aria-hidden="true" />
                      </ActionButton>
                      <ActionButton
                        action={moveWorkoutExerciseAction.bind(null, item.id, 1)}
                        pendingLabel=""
                        size="icon"
                        variant="ghost"
                        disabled={index === count - 1}
                        aria-label={t("moveDown", { name: exercise.name })}
                      >
                        <ArrowDown aria-hidden="true" />
                      </ActionButton>
                      <ConfirmButton
                        action={removeWorkoutExerciseAction.bind(null, item.id)}
                        label={t("removeExercise", { name: exercise.name })}
                        confirmLabel={tCommon("confirmDelete")}
                        cancelLabel={tCommon("cancel")}
                        pendingLabel={t("removing")}
                        iconOnly
                      />
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-1">
                    <span className="mr-1 text-sm text-muted-foreground">
                      {t("prescription.sets")}
                    </span>
                    <ActionButton
                      action={setTargetSetsAction.bind(null, item.id, item.target_sets - 1)}
                      pendingLabel=""
                      size="icon"
                      variant="ghost"
                      disabled={item.target_sets <= 1}
                      aria-label={t("fewerSets", { name: exercise.name })}
                    >
                      <Minus aria-hidden="true" />
                    </ActionButton>
                    <span className="w-6 text-center font-semibold tabular-nums">
                      {item.target_sets}
                    </span>
                    <ActionButton
                      action={setTargetSetsAction.bind(null, item.id, item.target_sets + 1)}
                      pendingLabel=""
                      size="icon"
                      variant="ghost"
                      disabled={item.target_sets >= 12}
                      aria-label={t("moreSets", { name: exercise.name })}
                    >
                      <Plus aria-hidden="true" />
                    </ActionButton>
                  </div>
                  <div className="mt-2 flex flex-wrap items-start gap-2">
                    <RestPicker
                      seconds={item.rest_seconds}
                      exerciseName={exercise.name}
                      action={setWorkoutRestAction.bind(null, item.id)}
                    />
                    {index < count - 1 ? (
                      <ActionButton
                        action={setWorkoutSupersetAction.bind(
                          null,
                          item.id,
                          !item.superset_with_next,
                        )}
                        pendingLabel="…"
                        size="sm"
                        variant="ghost"
                      >
                        {item.superset_with_next ? (
                          <Unlink aria-hidden="true" />
                        ) : (
                          <Link2 aria-hidden="true" />
                        )}
                        {item.superset_with_next ? t("session.unlink") : t("session.linkShort")}
                      </ActionButton>
                    ) : null}
                  </div>

                  <details className="mt-2">
                    <summary className="cursor-pointer text-sm font-semibold text-primary">
                      {t("prescription.titleShort")}
                    </summary>
                    <div className="mt-3">
                      <PrescriptionForm
                        key={`${item.target_sets}-${item.rep_min}-${item.rep_max}-${item.rest_seconds}`}
                        idPrefix={item.id}
                        timed={exercise.is_timed}
                        action={updatePrescriptionAction.bind(null, item.id)}
                        defaultValues={{
                          sets: String(item.target_sets),
                          repMin: String(item.rep_min),
                          repMax: String(item.rep_max),
                          restSeconds: String(item.rest_seconds ?? 0),
                        }}
                      />
                    </div>
                  </details>

                  {exercise.instructions ? (
                    <details className="mt-2">
                      <summary className="cursor-pointer text-sm font-semibold text-primary">
                        {t("instructions")}
                      </summary>
                      <p className="mt-2 text-[0.9375rem] whitespace-pre-line text-muted-foreground">
                        {exercise.instructions}
                      </p>
                    </details>
                  ) : null}

                  <div className="mt-4 flex flex-col gap-3">
                    <MovementDemo {...demoFor(exercise)} />
                    {shared ? (
                      <div className="flex flex-wrap gap-2">
                        <Button asChild variant="secondary" size="sm">
                          <Link href={replaceUrl(item.id)}>
                            <Repeat aria-hidden="true" />
                            {t("replace")}
                          </Link>
                        </Button>
                        <Button asChild variant="ghost" size="sm">
                          <Link href={replaceUrl(item.id, { easier: true, noMachine: true })}>
                            {t("replaceEasier")}
                          </Link>
                        </Button>
                      </div>
                    ) : null}
                  </div>
                </Card>
              </li>
            );
          })}
        </ol>
      )}

      {count > 0 ? (
        <Button asChild variant="secondary" className="mb-6">
          <Link href={addExercisesUrl(workout.id)}>
            <Plus aria-hidden="true" />
            {t("addExercise")}
          </Link>
        </Button>
      ) : null}

      <Card className="mt-2">
        <CardHeader className="mb-4">
          <CardTitle className="text-base">{t("workoutForm.settings")}</CardTitle>
          <CardDescription>{t("workoutForm.deleteHint")}</CardDescription>
        </CardHeader>
        <WorkoutForm
          key={`${workout.name}-${workout.weekday}`}
          mode="edit"
          action={updateWorkoutAction.bind(null, workout.id)}
          defaultValues={{
            name: workout.name,
            weekday: workout.weekday ? (String(workout.weekday) as `${Weekday}`) : "",
          }}
        />
        <div className="mt-5 border-t border-border pt-4">
          <ConfirmButton
            action={deleteWorkoutAction.bind(null, workout.id)}
            label={t("workoutForm.delete")}
            confirmLabel={t("workoutForm.deleteConfirm")}
            cancelLabel={tCommon("cancel")}
            pendingLabel={t("workoutForm.deleting")}
          />
        </div>
      </Card>
    </>
  );
}
