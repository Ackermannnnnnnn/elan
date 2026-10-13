import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { createWorkoutAction } from "@/features/training/actions";
import { WEEKDAY_VALUES } from "@/features/training/schemas";
import { WorkoutForm } from "@/features/training/workout-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training.workoutForm");
  return { title: t("createTitle") };
}

export default async function NewWorkoutPage({
  searchParams,
}: PageProps<"/training/workouts/new">) {
  const { jour } = await searchParams;
  const t = await getTranslations("Training");
  const weekday = WEEKDAY_VALUES.find((value) => value !== "" && value === jour) ?? "";
  return (
    <>
      <Link
        href={ROUTES.training}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("title")}
      </Link>
      <PageHeader title={t("workoutForm.createTitle")} lead={t("workoutForm.createLead")} />
      <Card className="max-w-xl">
        <WorkoutForm
          action={createWorkoutAction}
          defaultValues={{ name: "", weekday }}
          mode="create"
        />
      </Card>
    </>
  );
}
