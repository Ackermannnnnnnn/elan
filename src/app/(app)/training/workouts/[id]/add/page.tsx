import { ArrowLeft, Check, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { getTrainingSettings, getWorkout, listExercises } from "@/data/training";
import { ExerciseBrowser, readBrowserSearch } from "@/features/training/exercise-browser";
import { addExercisesUrl, newExerciseUrl, workoutUrl } from "@/features/training/urls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training.addPage");
  return { title: t("title") };
}

export default async function AddExercisesPage({
  params,
  searchParams,
}: PageProps<"/training/workouts/[id]/add">) {
  const { id } = await params;
  const found = /^[0-9a-f-]{36}$/i.test(id) ? await getWorkout(id) : null;
  if (!found) notFound();
  const { workout } = found;
  const search = readBrowserSearch(await searchParams);
  const [exercises, settings, t] = await Promise.all([
    listExercises(),
    getTrainingSettings(),
    getTranslations("Training"),
  ]);
  const existing = workout.exercises.map((item) => item.exercise_id);

  return (
    <>
      <Link
        href={workoutUrl(workout.id)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {workout.name}
      </Link>
      <PageHeader
        title={t("addPage.title")}
        lead={t("addPage.lead", { name: workout.name })}
        action={
          <Button asChild>
            <Link href={workoutUrl(workout.id)}>
              <Check aria-hidden="true" />
              {t("addPage.done")}
            </Link>
          </Button>
        }
      />
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <p className="font-semibold">{t("addPage.count", { count: existing.length })}</p>
        <Button asChild variant="ghost" size="sm">
          <Link href={newExerciseUrl(workout.id)}>
            <Plus aria-hidden="true" />
            {t("addPage.createOwn")}
          </Link>
        </Button>
      </div>
      <ExerciseBrowser
        exercises={exercises}
        settings={settings}
        search={search}
        path={addExercisesUrl(workout.id)}
        addTo={{ kind: "workout", targetId: workout.id, existing }}
      />
    </>
  );
}
