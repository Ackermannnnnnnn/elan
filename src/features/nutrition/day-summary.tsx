import { getFormatter, getTranslations } from "next-intl/server";
import { Meter } from "@/components/ui/meter";
import type { NutritionTargets } from "@/data/plan";
import { progressTowards, type Macros } from "@/domain/nutrition";

type Totals = Macros & { fiberIsPartial: boolean };

/** Bilan d'une journée : calories et macros consommées face aux objectifs. */
export async function DaySummary({
  totals,
  targets,
}: {
  totals: Totals;
  targets: NutritionTargets | null;
}) {
  const t = await getTranslations("Nutrition.summary");
  const format = await getFormatter();
  const number = (value: number) => format.number(Math.round(value));

  if (!targets) {
    return (
      <div>
        <p className="text-2xl font-semibold tabular-nums">{number(totals.kcal)} kcal</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("noTargets")}</p>
      </div>
    );
  }

  const calories = progressTowards(totals.kcal, targets.target_kcal);
  const macros = [
    { label: t("protein"), value: totals.proteinG, target: targets.protein_g },
    { label: t("carbs"), value: totals.carbsG, target: targets.carbs_g },
    { label: t("fat"), value: totals.fatG, target: targets.fat_g },
  ];
  const caloriesText = t("kcalOf", {
    value: number(totals.kcal),
    target: number(targets.target_kcal),
  });

  return (
    <div className="flex flex-col gap-5">
      <div>
        <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
          <p className="text-lg font-semibold">
            {calories.isOver
              ? t("over", { value: number(-calories.remaining) })
              : t("remaining", { value: number(calories.remaining) })}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">{caloriesText}</p>
        </div>
        <Meter
          label={t("calories")}
          value={totals.kcal}
          max={targets.target_kcal}
          valueText={caloriesText}
          className="mt-2.5 h-2.5"
        />
      </div>

      <dl className="grid gap-4 sm:grid-cols-3">
        {macros.map((macro) => {
          const text = t("gramsOf", { value: number(macro.value), target: number(macro.target) });
          return (
            <div key={macro.label}>
              <div className="flex items-baseline justify-between gap-2">
                <dt className="text-sm font-medium">{macro.label}</dt>
                <dd className="text-sm text-muted-foreground tabular-nums">{text}</dd>
              </div>
              <Meter
                label={macro.label}
                value={macro.value}
                max={macro.target}
                valueText={text}
                className="mt-1.5"
              />
            </div>
          );
        })}
      </dl>

      {targets.fiber_g ? (
        <p className="text-sm text-muted-foreground">
          {t("fiber")}
          {" : "}
          {totals.fiberIsPartial
            ? t("fiberPartial", { value: number(totals.fiberG ?? 0) })
            : t("gramsOf", { value: number(totals.fiberG ?? 0), target: number(targets.fiber_g) })}
        </p>
      ) : null}
    </div>
  );
}
