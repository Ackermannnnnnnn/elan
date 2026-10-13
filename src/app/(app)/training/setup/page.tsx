import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { getActiveProgram, getTrainingSettings } from "@/data/training";
import { recommendStructure } from "@/domain/training-program";
import { createProgramAction } from "@/features/training/actions";
import { PRIORITY_MUSCLES } from "@/features/training/schemas";
import { SetupForm } from "@/features/training/setup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training.setup");
  return { title: t("title") };
}

export default async function TrainingSetupPage() {
  const [settings, view, t] = await Promise.all([
    getTrainingSettings(),
    getActiveProgram(),
    getTranslations("Training"),
  ]);
  const structure =
    view && view.program.structure !== "custom"
      ? view.program.structure
      : recommendStructure(settings.sessionsPerWeek, settings.level);

  return (
    <>
      <Link
        href={ROUTES.training}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("title")}
      </Link>
      <PageHeader title={t("setup.title")} lead={t("setup.lead")} />
      {view ? (
        <Alert variant="info" className="mb-5">
          {t("setup.replaceWarning")}
        </Alert>
      ) : null}
      <Card>
        <SetupForm
          initial={{
            goal: settings.goal,
            level: settings.level,
            sessionsPerWeek: String(settings.sessionsPerWeek),
            minutesPerSession: String(settings.minutesPerSession),
            location: settings.location,
            equipment: settings.equipment.filter((item) => item !== "cardio_machine"),
            limitations: settings.limitations,
            priorityMuscles: settings.priorityMuscles.filter(
              (muscle): muscle is (typeof PRIORITY_MUSCLES)[number] =>
                (PRIORITY_MUSCLES as readonly string[]).includes(muscle),
            ),
            structure,
          }}
          action={createProgramAction}
          submitLabel={view ? t("setup.regenerate") : t("setup.submit")}
        />
      </Card>
      <p className="mt-5 text-sm text-muted-foreground">{t("setup.disclaimer")}</p>
    </>
  );
}
