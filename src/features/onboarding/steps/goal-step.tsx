"use client";

import { useTranslations } from "next-intl";
import { useFormContext, useWatch } from "react-hook-form";
import { UnitField } from "@/components/forms/fields";
import { Alert } from "@/components/ui/alert";
import { ChoiceCard, ChoiceGroup } from "@/components/ui/choice";
import { GOAL_TYPES, PACES, type BlockingIssue } from "@/domain/energy";
import type { OnboardingFormValues } from "../schema";

export function GoalStep({ blocking }: { blocking: BlockingIssue[] }) {
  const t = useTranslations("Onboarding.goal");
  const tOptions = useTranslations("Options");
  const tCommon = useTranslations("Common");
  const { register, control } = useFormContext<OnboardingFormValues>();
  const goalType = useWatch({ control, name: "goalType" });

  const hasPace =
    goalType === "fat_loss" || goalType === "recomposition" || goalType === "muscle_gain";
  const paceKind = goalType === "muscle_gain" ? "gain" : "loss";
  const formatKg = (value: number) => value.toLocaleString("fr-BE", { maximumFractionDigits: 1 });

  return (
    <div className="flex flex-col gap-7">
      <ChoiceGroup legend={t("goalType")} className="grid gap-2.5">
        {GOAL_TYPES.map((option) => (
          <ChoiceCard
            key={option}
            type="radio"
            value={option}
            label={tOptions(`goalType.${option}.label`)}
            description={tOptions(`goalType.${option}.description`)}
            {...register("goalType")}
          />
        ))}
      </ChoiceGroup>

      <UnitField<OnboardingFormValues>
        name="targetWeightKg"
        label={
          hasPace ? t("targetWeight") : `${t("targetWeightOptional")} (${tCommon("optional")})`
        }
        unit={tCommon("kg")}
        className="sm:max-w-[calc(50%-0.625rem)]"
      />

      {blocking.map((issue) => (
        <Alert key={issue.code} variant="error">
          {issue.code === "target_underweight"
            ? t("blocking.target_underweight", { minimum: formatKg(issue.minimumWeightKg) })
            : t(`blocking.${issue.code}`)}
        </Alert>
      ))}

      {hasPace ? (
        <ChoiceGroup legend={t("pace")} hint={t("paceHint")} className="grid gap-2.5">
          {PACES.map((option) => (
            <ChoiceCard
              key={option}
              type="radio"
              value={option}
              label={tOptions(`pace.${option}.label`)}
              description={tOptions(`pace.${option}.${paceKind}`)}
              {...register("pace")}
            />
          ))}
        </ChoiceGroup>
      ) : null}
    </div>
  );
}
