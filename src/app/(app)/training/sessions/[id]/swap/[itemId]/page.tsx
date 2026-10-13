import { ArrowLeft, Search } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionButton } from "@/components/forms/action-button";
import { PageHeader } from "@/components/layout/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { DataError } from "@/data/client";
import { getTrainingSettings, listExercises, listSessionAlternatives } from "@/data/training";
import { swapSessionExerciseAction } from "@/features/training/actions";
import { demoFor } from "@/features/training/demo";
import { ExerciseBrowser, readBrowserSearch } from "@/features/training/exercise-browser";
import { MovementDemo } from "@/features/training/movement-demo";
import { sessionUrl } from "@/features/training/urls";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training.swapPage");
  return { title: t("title") };
}

const flag = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) === "1";

/**
 * Changer un exercice pendant la séance (machine prise, douleur, matériel
 * absent) : alternatives du moteur d'abord, toute la bibliothèque ensuite.
 */
export default async function SwapPage({
  params,
  searchParams,
}: PageProps<"/training/sessions/[id]/swap/[itemId]">) {
  const { id, itemId } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(itemId) || !/^[0-9a-f-]{36}$/i.test(id)) notFound();
  const filters = { noMachine: flag(query.noMachine), bodyweight: flag(query.bodyweight) };
  const inProgram = flag(query.programme);
  const library = flag(query.bibliotheque);

  let found;
  try {
    found = await listSessionAlternatives(itemId, {
      noMachine: filters.noMachine,
      bodyweightOnly: filters.bodyweight,
    });
  } catch (error) {
    if (error instanceof DataError && error.key === "itemNotFound") notFound();
    // Séance terminée entre-temps : retour à son bilan.
    if (error instanceof DataError && error.key === "sessionNotOpen") redirect(sessionUrl(id));
    throw error;
  }
  const { current, sessionId, workoutId, options } = found;
  const [t, tTraining, tOptions, all, settings] = await Promise.all([
    getTranslations("Training.swapPage"),
    getTranslations("Training"),
    getTranslations("Options"),
    library ? listExercises() : Promise.resolve([]),
    library ? getTrainingSettings() : Promise.resolve(null),
  ]);

  const base = `${sessionUrl(sessionId)}/swap/${itemId}`;
  const href = (changes: Record<string, boolean>) => {
    const next = {
      noMachine: filters.noMachine,
      bodyweight: filters.bodyweight,
      programme: inProgram,
      bibliotheque: library,
      ...changes,
    };
    const search = new URLSearchParams();
    for (const [key, on] of Object.entries(next)) if (on) search.set(key, "1");
    const text = search.toString();
    return `${base}${text ? `?${text}` : ""}`;
  };
  const toggles = [
    { key: "noMachine", label: t("noMachine") },
    { key: "bodyweight", label: t("bodyweight") },
  ] as const;

  return (
    <>
      <Link
        href={sessionUrl(sessionId)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("back")}
      </Link>
      <PageHeader
        title={t("heading", { name: current.name })}
        lead={t("lead", { muscle: tTraining(`muscle.${current.primary_muscle}`) })}
      />

      {workoutId ? (
        <SegmentedLinks
          label={t("scopeLabel")}
          className="mb-2"
          fill
          items={[
            { href: href({ programme: false }), label: t("thisSession"), current: !inProgram },
            { href: href({ programme: true }), label: t("inProgram"), current: inProgram },
          ]}
        />
      ) : null}
      {workoutId ? (
        <p className="mb-5 text-sm text-muted-foreground">
          {inProgram ? t("inProgramHint") : t("thisSessionHint")}
        </p>
      ) : null}

      <nav aria-label={t("filtersLabel")} className="mb-4 flex flex-wrap gap-2">
        {toggles.map((toggle) => {
          const on = filters[toggle.key];
          return (
            <Link
              key={toggle.key}
              href={href({ [toggle.key]: !on })}
              scroll={false}
              aria-pressed={on}
              className={cn(
                "inline-flex min-h-11 items-center rounded-full border px-4 text-[0.9375rem] font-medium transition-colors",
                on
                  ? "border-primary bg-primary-soft text-primary-soft-foreground"
                  : "border-border-strong bg-surface hover:border-primary/60",
              )}
            >
              {toggle.label}
            </Link>
          );
        })}
      </nav>

      {options.length === 0 ? (
        <p className="mb-4 text-muted-foreground">{t("none")}</p>
      ) : (
        <ul className="mb-6 flex flex-col gap-3">
          {options.map((exercise) => (
            <li key={exercise.id}>
              <Card className="flex flex-col gap-3">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="text-base font-semibold">{exercise.name}</h2>
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Badge>{tTraining(`muscle.${exercise.primary_muscle}`)}</Badge>
                      <Badge>
                        {exercise.equipment.length === 0
                          ? tTraining("bodyweight")
                          : exercise.equipment
                              .map((item) => tOptions(`equipment.${item}` as never))
                              .join(", ")}
                      </Badge>
                      <Badge>{tOptions(`trainingLevel.${exercise.difficulty}`)}</Badge>
                    </div>
                  </div>
                  <ActionButton
                    action={swapSessionExerciseAction.bind(null, itemId, exercise.id, inProgram)}
                    pendingLabel={t("choosing")}
                    size="sm"
                    aria-label={tTraining("browser.pickLabel", { name: exercise.name })}
                  >
                    {tTraining("browser.pick")}
                  </ActionButton>
                </div>
                <MovementDemo {...demoFor(exercise)} />
              </Card>
            </li>
          ))}
        </ul>
      )}

      {library && settings ? (
        <section aria-labelledby="library-title">
          <h2 id="library-title" className="mb-3 text-lg font-semibold">
            {t("libraryTitle")}
          </h2>
          <ExerciseBrowser
            exercises={all}
            settings={settings}
            search={readBrowserSearch(query)}
            path={base}
            keep={{ bibliotheque: "1", ...(inProgram ? { programme: "1" } : {}) }}
            addTo={{ kind: "swap", targetId: itemId, existing: [current.id], inProgram }}
          />
        </section>
      ) : (
        <Button asChild variant="secondary">
          <Link href={href({ bibliotheque: true })}>
            <Search aria-hidden="true" />
            {t("searchLibrary")}
          </Link>
        </Button>
      )}
    </>
  );
}
