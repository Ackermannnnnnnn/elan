import { ArrowLeft, Check } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { DataError } from "@/data/client";
import { getOpenSessionView, getTrainingSettings, listExercises } from "@/data/training";
import { ExerciseBrowser, readBrowserSearch } from "@/features/training/exercise-browser";
import { addToSessionUrl, sessionUrl } from "@/features/training/urls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training.addToSession");
  return { title: t("title") };
}

export default async function AddToSessionPage({
  params,
  searchParams,
}: PageProps<"/training/sessions/[id]/add">) {
  const { id } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(id)) notFound();
  let view;
  try {
    view = await getOpenSessionView(id);
  } catch (error) {
    if (error instanceof DataError && error.key === "itemNotFound") notFound();
    if (error instanceof DataError && error.key === "sessionNotOpen") redirect(sessionUrl(id));
    throw error;
  }
  const search = readBrowserSearch(await searchParams);
  const [exercises, settings, t] = await Promise.all([
    listExercises(),
    getTrainingSettings(),
    getTranslations("Training.addToSession"),
  ]);
  return (
    <>
      <Link
        href={sessionUrl(id)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {view.session.name}
      </Link>
      <PageHeader
        title={t("title")}
        lead={t("lead")}
        action={
          <Button asChild>
            <Link href={sessionUrl(id)}>
              <Check aria-hidden="true" />
              {t("back")}
            </Link>
          </Button>
        }
      />
      <ExerciseBrowser
        exercises={exercises}
        settings={settings}
        search={search}
        path={addToSessionUrl(id)}
        addTo={{
          kind: "session",
          targetId: id,
          existing: view.items.map((item) => item.exercise_id),
        }}
      />
    </>
  );
}
