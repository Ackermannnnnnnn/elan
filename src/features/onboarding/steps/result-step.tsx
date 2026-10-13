"use client";

import { useFormatter, useTranslations } from "next-intl";
import { Alert } from "@/components/ui/alert";
import { ACTIVITY_FACTORS, CALORIE_FLOOR, PROTEIN_G_PER_KG } from "@/domain/energy";
import { suggestProgramStructure } from "@/domain/program";
import { addDays } from "@/lib/dates";
import type { PlanPreview } from "../plan";
import type { OnboardingValues } from "../schema";

type ResultStepProps = { preview: PlanPreview; values: OnboardingValues; today: string };

/** Étape 5 : le plan calculé, ses ajustements, et la façon dont il a été obtenu. */
export function ResultStep({ preview, values, today }: ResultStepProps) {
  const t = useTranslations("Onboarding.result");
  const tOptions = useTranslations("Options");
  const format = useFormatter();
  const { plan, input, age } = preview;
  const { calories, macros } = plan;

  const number = (value: number, digits = 0) =>
    format.number(value, { maximumFractionDigits: digits, minimumFractionDigits: digits });
  const signed = (value: number, digits = 0) =>
    (value > 0 ? "+" : value < 0 ? "−" : "") + number(Math.abs(value), digits);

  const projectedDate =
    plan.weeksToTarget && plan.weeksToTarget > 0
      ? format.dateTime(new Date(`${addDays(today, plan.weeksToTarget * 7)}T12:00:00Z`), {
          day: "numeric",
          month: "long",
          year: "numeric",
          timeZone: "UTC",
        })
      : null;

  const floor = CALORIE_FLOOR[input.sex ?? "unspecified"];
  const allergyCount = values.allergies.length + values.otherAllergies.length;
  const structure = suggestProgramStructure(values.sessionsPerWeek);

  const stats = [
    { label: t("maintenance"), value: `${number(plan.maintenanceKcal)} kcal` },
    { label: t("bmr"), value: `${number(plan.bmr.kcal)} kcal` },
    {
      label: t("rate"),
      value:
        calories.expectedWeeklyRateKg === 0
          ? t("rateStable")
          : t("ratePerWeek", { rate: signed(calories.expectedWeeklyRateKg, 2) }),
    },
    ...(plan.weeksToTarget !== null
      ? [
          {
            label: t("duration"),
            value: t("weeks", { count: plan.weeksToTarget }),
            detail: projectedDate ? t("around", { date: projectedDate }) : undefined,
          },
        ]
      : []),
  ];

  const macroRows = [
    { label: t("protein"), grams: macros.proteinG, share: macros.energyShare.protein },
    { label: t("carbs"), grams: macros.carbsG, share: macros.energyShare.carbs },
    { label: t("fat"), grams: macros.fatG, share: macros.energyShare.fat },
  ];

  return (
    <div className="flex flex-col gap-6">
      {/* Le chiffre principal : un seul, dans la police de texte courante. */}
      <section className="rounded-card bg-primary p-6 text-primary-foreground sm:p-8">
        <p className="font-medium opacity-90">{t("targetLabel")}</p>
        <p className="mt-1 flex flex-wrap items-baseline gap-x-3">
          <span className="font-sans text-[3.5rem] leading-none font-bold tracking-tight sm:text-[4.25rem]">
            {number(calories.targetKcal)}
          </span>
          <span className="text-lg font-medium opacity-90">{t("perDay")}</span>
        </p>
      </section>

      <dl className="grid grid-cols-2 gap-px overflow-hidden rounded-card border border-border bg-border">
        {stats.map((stat) => (
          <div key={stat.label} className="bg-surface p-4 sm:p-5">
            <dt className="text-sm text-muted-foreground">{stat.label}</dt>
            <dd className="mt-1 text-lg font-semibold">{stat.value}</dd>
            {"detail" in stat && stat.detail ? (
              <dd className="text-sm text-muted-foreground">{stat.detail}</dd>
            ) : null}
          </div>
        ))}
      </dl>

      {calories.adjustments.map((adjustment) => (
        <Alert key={adjustment} variant="info">
          {t(`adjustments.${adjustment}`, { floor: number(floor) })}
        </Alert>
      ))}
      {plan.assessment.warnings.map((warning) => (
        <Alert key={warning} variant="info">
          {t(`warnings.${warning}`)}
        </Alert>
      ))}

      <section className="rounded-card border border-border bg-surface p-5 sm:p-6">
        <h3 className="text-lg font-semibold">{t("macrosTitle")}</h3>
        <table className="mt-3 w-full text-left">
          <tbody>
            {macroRows.map((row) => (
              <tr key={row.label} className="border-b border-border last:border-b-0">
                <th scope="row" className="py-3 font-medium">
                  {row.label}
                </th>
                <td className="py-3 text-right text-lg font-semibold tabular-nums">
                  {number(row.grams)} g
                </td>
                <td className="hidden py-3 pl-4 text-right text-sm text-muted-foreground tabular-nums sm:table-cell">
                  {t("share", { percent: row.share })}
                </td>
              </tr>
            ))}
            <tr>
              <th scope="row" className="py-3 font-medium">
                {t("fiber")}
              </th>
              <td className="py-3 text-right text-lg font-semibold tabular-nums">
                {number(macros.fiberG)} g
              </td>
              <td className="hidden py-3 pl-4 text-right text-sm text-muted-foreground sm:table-cell">
                {t("fiberNote")}
              </td>
            </tr>
          </tbody>
        </table>
      </section>

      <section className="rounded-card border border-border bg-surface p-5 sm:p-6">
        <h3 className="text-lg font-semibold">{t("strategyTitle")}</h3>
        <ul className="mt-3 flex list-disc flex-col gap-2 pl-5 text-[0.9375rem]">
          <li>
            {t("strategyProtein", {
              grams: number(Math.round(macros.proteinG / values.mealsPerDay / 5) * 5),
              meals: values.mealsPerDay,
            })}
          </li>
          {allergyCount > 0 ? <li>{t("strategyAllergies", { count: allergyCount })}</li> : null}
          <li>{t("strategyTracking")}</li>
        </ul>
        <h3 className="mt-6 text-lg font-semibold">{t("trainingTitle")}</h3>
        <p className="mt-2 text-[0.9375rem]">{tOptions(`programStructure.${structure}`)}</p>
        <p className="mt-1 text-sm text-muted-foreground">{t("trainingDetail")}</p>
      </section>

      <details className="rounded-card border border-border bg-surface p-5 sm:p-6">
        <summary className="cursor-pointer text-lg font-semibold">{t("assumptionsTitle")}</summary>
        <ul className="mt-4 flex list-disc flex-col gap-2 pl-5 text-[0.9375rem] text-muted-foreground">
          <li>
            {t("assumptions.bmr", {
              weight: number(input.weightKg, 1),
              height: number(input.heightCm),
              age,
            })}
          </li>
          {plan.bmr.sexAveraged ? <li>{t("assumptions.sexAveraged")}</li> : null}
          <li>
            {t("assumptions.activity", {
              factor: number(ACTIVITY_FACTORS[input.activityLevel], 3),
              level: tOptions(`activityLevel.${input.activityLevel}.label`),
            })}
          </li>
          {calories.dailyDeltaKcal !== 0 ? (
            <li>{t("assumptions.delta", { delta: signed(calories.dailyDeltaKcal) })}</li>
          ) : null}
          <li>
            {t("assumptions.protein", {
              perKg: number(PROTEIN_G_PER_KG[input.goalType], 1),
              reference: number(macros.referenceWeightKg, 1),
            })}
          </li>
          <li>{t("assumptions.accuracy")}</li>
        </ul>
      </details>

      <p className="text-sm text-muted-foreground">{t("disclaimer")}</p>
    </div>
  );
}
