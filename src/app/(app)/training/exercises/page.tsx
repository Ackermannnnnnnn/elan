import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/config/routes";
import { getTrainingSettings, listExercises } from "@/data/training";
import { ExerciseBrowser, readBrowserSearch } from "@/features/training/exercise-browser";
import { libraryUrl, newExerciseUrl } from "@/features/training/urls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training.libraryPage");
  return { title: t("title") };
}

export default async function LibraryPage({ searchParams }: PageProps<"/training/exercises">) {
  const search = readBrowserSearch(await searchParams);
  const [exercises, settings, t] = await Promise.all([
    listExercises(),
    getTrainingSettings(),
    getTranslations("Training"),
  ]);
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
        title={t("libraryPage.title")}
        lead={t("libraryPage.lead")}
        action={
          <Button asChild variant="secondary">
            <Link href={newExerciseUrl()}>
              <Plus aria-hidden="true" />
              {t("libraryPage.createOwn")}
            </Link>
          </Button>
        }
      />
      <ExerciseBrowser
        exercises={exercises}
        settings={settings}
        search={search}
        path={libraryUrl}
      />
    </>
  );
}
