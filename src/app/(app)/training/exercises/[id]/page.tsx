import { ArrowLeft, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { getExercise, getExerciseHistory } from "@/data/training";
import { summarizeSets } from "@/domain/progression";
import { deleteOwnExerciseAction } from "@/features/training/actions";
import { demoFor } from "@/features/training/demo";
import { MovementDemo } from "@/features/training/movement-demo";
import { ProgressChart } from "@/features/training/progress-chart";
import { editExerciseUrl, libraryUrl, sessionUrl } from "@/features/training/urls";

export async function generateMetadata({
  params,
}: PageProps<"/training/exercises/[id]">): Promise<Metadata> {
  const { id } = await params;
  const exercise = /^[0-9a-f-]{36}$/i.test(id) ? await getExercise(id) : null;
  const t = await getTranslations("Training");
  return { title: exercise?.name ?? t("title") };
}

export default async function ExercisePage({ params }: PageProps<"/training/exercises/[id]">) {
  const { id } = await params;
  const exercise = /^[0-9a-f-]{36}$/i.test(id) ? await getExercise(id) : null;
  if (!exercise) notFound();
  const [history, t, tTraining, tOptions, tCommon, format] = await Promise.all([
    getExerciseHistory(exercise.id),
    getTranslations("Training.exercise"),
    getTranslations("Training"),
    getTranslations("Options"),
    getTranslations("Common"),
    getFormatter(),
  ]);
  const own = exercise.owner_id !== null;
  const number = (value: number, digits = 1) =>
    format.number(value, { maximumFractionDigits: digits });

  // Chronologique pour le graphique. Avec charge : force estimée ; sinon : meilleure série.
  const chronological = [...history].reverse().map((entry) => ({
    ...entry,
    summary: summarizeSets(entry.sets),
    bestReps: Math.max(0, ...entry.sets.map((set) => set.reps ?? 0)),
  }));
  const weighted = chronological.some((entry) => entry.summary.bestOneRepMax !== null);
  const points = chronological.flatMap((entry) => {
    const value = weighted ? entry.summary.bestOneRepMax : entry.bestReps;
    return value === null || value === 0 ? [] : [{ key: entry.sessionId, date: entry.date, value }];
  });
  const unit = weighted ? "kg" : exercise.is_timed ? "s" : t("repsUnit");

  return (
    <>
      <Link
        href={libraryUrl}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {tTraining("libraryPage.title")}
      </Link>
      <PageHeader title={exercise.name} lead={tTraining(`muscle.${exercise.primary_muscle}`)} />

      <div className="flex flex-col gap-5">
        <Card>
          <div className="mb-3 flex flex-wrap gap-1.5">
            {own ? (
              <Badge variant="primary">{tTraining("ownExercise.badge")}</Badge>
            ) : (
              <Badge>{tOptions(`trainingLevel.${exercise.difficulty}`)}</Badge>
            )}
            <Badge>
              {exercise.equipment.length === 0
                ? tTraining("bodyweight")
                : exercise.equipment
                    .map((equipment) => tOptions(`equipment.${equipment}` as never))
                    .join(", ")}
            </Badge>
          </div>
          {exercise.instructions ? (
            <p className="whitespace-pre-line">{exercise.instructions}</p>
          ) : null}
          {exercise.caution_areas.length > 0 ? (
            <p className="mt-3 text-sm text-muted-foreground">
              {t("caution", {
                areas: exercise.caution_areas
                  .map((area) => tTraining(`area.${area}` as never))
                  .join(", "),
              })}
            </p>
          ) : null}
          <MovementDemo {...demoFor(exercise)} className="mt-4" />
          {own ? (
            <div className="mt-5 flex flex-wrap items-center gap-2 border-t border-border pt-4">
              <Button asChild variant="secondary" size="sm">
                <Link href={editExerciseUrl(exercise.id)}>
                  <Pencil aria-hidden="true" />
                  {tTraining("ownExercise.edit")}
                </Link>
              </Button>
              <ConfirmButton
                action={deleteOwnExerciseAction.bind(null, exercise.id)}
                label={tTraining("ownExercise.delete")}
                confirmLabel={tTraining("ownExercise.deleteConfirm")}
                cancelLabel={tCommon("cancel")}
                pendingLabel={tTraining("ownExercise.deleting")}
              />
            </div>
          ) : null}
        </Card>

        <Card>
          <CardHeader className="mb-4">
            <CardTitle>{t("progress")}</CardTitle>
            <p className="text-sm text-muted-foreground">
              {weighted ? t("progressWeighted") : t("progressReps")}
            </p>
          </CardHeader>
          {points.length >= 2 ? (
            <ProgressChart
              points={points}
              unit={unit}
              labels={{
                series: weighted ? t("seriesWeighted") : t("seriesReps"),
                description: t("chartDescription", { count: points.length }),
              }}
            />
          ) : (
            <p className="text-muted-foreground">{t("notEnough")}</p>
          )}

          {history.length > 0 ? (
            <details className="mt-4" open={points.length < 2}>
              <summary className="cursor-pointer text-sm font-semibold text-primary">
                {t("table")}
              </summary>
              <table className="mt-3 w-full text-left text-sm">
                <thead className="text-muted-foreground">
                  <tr>
                    <th className="py-1.5 font-medium">{t("date")}</th>
                    <th className="py-1.5 font-medium">{t("sets")}</th>
                    {weighted ? (
                      <th className="py-1.5 text-right font-medium">{t("oneRepMax")}</th>
                    ) : null}
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry) => {
                    const summary = summarizeSets(entry.sets);
                    return (
                      <tr key={entry.sessionId} className="border-t border-border">
                        <td className="py-2 pr-3 align-top">
                          <Link
                            href={sessionUrl(entry.sessionId)}
                            className="underline-offset-4 hover:underline"
                          >
                            {format.dateTime(new Date(`${entry.date}T12:00:00Z`), {
                              day: "numeric",
                              month: "short",
                              timeZone: "UTC",
                            })}
                          </Link>
                        </td>
                        <td className="py-2 pr-3 tabular-nums">
                          {entry.sets
                            .map((set) =>
                              set.weightKg
                                ? `${number(set.weightKg)} × ${set.reps ?? 0}`
                                : `${set.reps ?? 0}${exercise.is_timed ? " s" : ""}`,
                            )
                            .join(" · ")}
                        </td>
                        {weighted ? (
                          <td className="py-2 text-right tabular-nums">
                            {summary.bestOneRepMax === null
                              ? "–"
                              : `${number(summary.bestOneRepMax)} kg`}
                          </td>
                        ) : null}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </details>
          ) : null}
        </Card>
      </div>
    </>
  );
}
