import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ActionButton } from "@/components/forms/action-button";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { DataError } from "@/data/client";
import { listReplacements } from "@/data/training";
import { replaceExerciseAction } from "@/features/training/actions";
import { replaceUrl, workoutUrl } from "@/features/training/urls";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Training.replacePage");
  return { title: t("title") };
}

const flag = (value: string | string[] | undefined) =>
  (Array.isArray(value) ? value[0] : value) === "1";

export default async function ReplacePage({
  params,
  searchParams,
}: PageProps<"/training/replace/[itemId]">) {
  const { itemId } = await params;
  const query = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(itemId)) notFound();
  const filters = {
    easier: flag(query.easier),
    noMachine: flag(query.noMachine),
    bodyweight: flag(query.bodyweight),
  };

  let found;
  try {
    found = await listReplacements(itemId, {
      easier: filters.easier,
      noMachine: filters.noMachine,
      bodyweightOnly: filters.bodyweight,
    });
  } catch (error) {
    if (error instanceof DataError && error.key === "itemNotFound") notFound();
    throw error;
  }
  const { current, item, options } = found;
  const [t, tTraining, tOptions] = await Promise.all([
    getTranslations("Training.replacePage"),
    getTranslations("Training"),
    getTranslations("Options"),
  ]);

  const toggles = [
    { key: "easier", label: t("filters.easier") },
    { key: "noMachine", label: t("filters.noMachine") },
    { key: "bodyweight", label: t("filters.bodyweight") },
  ] as const;

  return (
    <>
      <Link
        href={workoutUrl(item.workout_id)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {tTraining("backToWorkout")}
      </Link>
      <PageHeader
        title={t("heading", { name: current.name })}
        lead={t("lead", { muscle: tTraining(`muscle.${current.primary_muscle}`) })}
      />

      <nav aria-label={t("filtersLabel")} className="mb-5 flex flex-wrap gap-2">
        {toggles.map((toggle) => {
          const on = filters[toggle.key];
          return (
            <Link
              key={toggle.key}
              href={replaceUrl(itemId, { ...filters, [toggle.key]: !on })}
              aria-pressed={on}
              scroll={false}
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
        <Card>
          <p className="font-semibold">{t("none")}</p>
          <p className="mt-1 text-muted-foreground">{t("noneHint")}</p>
        </Card>
      ) : (
        <ul className="flex flex-col gap-4">
          {options.map((exercise) => (
            <li key={exercise.id}>
              <Card>
                <h2 className="text-lg font-semibold">{exercise.name}</h2>
                <div className="mt-2 flex flex-wrap gap-1.5">
                  <Badge>{tOptions(`trainingLevel.${exercise.difficulty}`)}</Badge>
                  <Badge>
                    {exercise.equipment.length === 0
                      ? tTraining("bodyweight")
                      : exercise.equipment
                          .map((equipment) => tOptions(`equipment.${equipment}` as never))
                          .join(", ")}
                  </Badge>
                  {exercise.movement_pattern === current.movement_pattern ? (
                    <Badge variant="primary">{t("sameMovement")}</Badge>
                  ) : null}
                </div>
                {exercise.instructions ? (
                  <p className="mt-3 text-[0.9375rem] text-muted-foreground">
                    {exercise.instructions}
                  </p>
                ) : null}
                <div className="mt-4 flex flex-wrap gap-2">
                  <ActionButton
                    action={replaceExerciseAction.bind(null, item.id, exercise.id, false)}
                    pendingLabel={t("replacing")}
                    size="sm"
                    aria-label={t("chooseLabel", { name: exercise.name })}
                  >
                    {t("choose")}
                  </ActionButton>
                  <ActionButton
                    action={replaceExerciseAction.bind(null, item.id, exercise.id, true)}
                    pendingLabel={t("replacing")}
                    size="sm"
                    variant="ghost"
                  >
                    {t("chooseAndDislike", { name: current.name })}
                  </ActionButton>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      )}

      <Alert variant="info" className="mt-6">
        {t("pain")}
      </Alert>
    </>
  );
}
