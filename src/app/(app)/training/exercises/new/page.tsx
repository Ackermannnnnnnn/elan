import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { getWorkout } from "@/data/training";
import { createOwnExerciseAction } from "@/features/training/actions";
import { OwnExerciseForm } from "@/features/training/own-exercise-form";
import { addExercisesUrl, libraryUrl } from "@/features/training/urls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training.ownExercise");
  return { title: t("createTitle") };
}

export default async function NewExercisePage({
  searchParams,
}: PageProps<"/training/exercises/new">) {
  const { seance } = await searchParams;
  // Création depuis une séance : l'exercice y est ajouté directement.
  const found =
    typeof seance === "string" && /^[0-9a-f-]{36}$/i.test(seance) ? await getWorkout(seance) : null;
  const workoutId = found?.workout.id ?? null;
  const t = await getTranslations("Training");
  return (
    <>
      <Link
        href={workoutId ? addExercisesUrl(workoutId) : libraryUrl}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {found ? found.workout.name : t("libraryPage.title")}
      </Link>
      <PageHeader title={t("ownExercise.createTitle")} lead={t("ownExercise.createLead")} />
      <Card className="max-w-2xl">
        <OwnExerciseForm
          action={createOwnExerciseAction.bind(null, workoutId)}
          defaultValues={{
            name: "",
            primary: "chest",
            equipment: [],
            kind: "reps",
            perHand: false,
            instructions: "",
          }}
          submitLabel={workoutId ? t("ownExercise.createAndAdd") : t("ownExercise.create")}
        />
      </Card>
    </>
  );
}
