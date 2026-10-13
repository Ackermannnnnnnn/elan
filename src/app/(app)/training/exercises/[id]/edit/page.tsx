import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { getExercise } from "@/data/training";
import type { Equipment, Muscle } from "@/domain/exercise-catalog";
import { updateOwnExerciseAction } from "@/features/training/actions";
import { OwnExerciseForm } from "@/features/training/own-exercise-form";
import { exerciseUrl } from "@/features/training/urls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training.ownExercise");
  return { title: t("editTitle") };
}

export default async function EditExercisePage({
  params,
}: PageProps<"/training/exercises/[id]/edit">) {
  const { id } = await params;
  const exercise = /^[0-9a-f-]{36}$/i.test(id) ? await getExercise(id) : null;
  // Seuls les exercices personnels se modifient.
  if (!exercise || exercise.owner_id === null) notFound();
  const t = await getTranslations("Training");
  return (
    <>
      <Link
        href={exerciseUrl(exercise.id)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {exercise.name}
      </Link>
      <PageHeader title={t("ownExercise.editTitle")} />
      <Card className="max-w-2xl">
        <OwnExerciseForm
          action={updateOwnExerciseAction.bind(null, exercise.id)}
          defaultValues={{
            name: exercise.name,
            primary: exercise.primary_muscle as Muscle,
            equipment: exercise.equipment as Equipment[],
            kind: exercise.is_timed ? "timed" : "reps",
            instructions: exercise.instructions ?? "",
          }}
          submitLabel={t("ownExercise.save")}
        />
      </Card>
    </>
  );
}
