"use client";

import { useTranslations } from "next-intl";
import { useFormContext } from "react-hook-form";
import { TextField, UnitField, useFieldError } from "@/components/forms/fields";
import { ChoiceChip, ChoiceGroup } from "@/components/ui/choice";
import { SEX_OPTIONS } from "../options";
import type { OnboardingFormValues } from "../schema";

export function PersonalStep({ today }: { today: string }) {
  const t = useTranslations("Onboarding.personal");
  const tOptions = useTranslations("Options");
  const tCommon = useTranslations("Common");
  const { register } = useFormContext<OnboardingFormValues>();
  const consentError = useFieldError<OnboardingFormValues>("healthConsent");

  return (
    <div className="flex flex-col gap-7">
      <TextField<OnboardingFormValues>
        name="birthDate"
        type="date"
        label={t("birthDate")}
        hint={t("birthDateHint")}
        autoComplete="bday"
        min="1900-01-01"
        max={today}
      />

      <ChoiceGroup legend={t("sex")} hint={t("sexHint")} className="flex flex-wrap gap-2">
        {SEX_OPTIONS.map((option) => (
          <ChoiceChip
            key={option}
            type="radio"
            label={tOptions(`sex.${option}`)}
            value={option}
            {...register("sex")}
          />
        ))}
      </ChoiceGroup>

      <div className="grid gap-5 sm:grid-cols-2">
        <UnitField<OnboardingFormValues>
          name="heightCm"
          label={t("height")}
          unit={tCommon("cm")}
          mode="numeric"
        />
        <UnitField<OnboardingFormValues>
          name="weightKg"
          label={t("weight")}
          hint={t("weightHint")}
          unit={tCommon("kg")}
        />
      </div>

      <UnitField<OnboardingFormValues>
        name="waistCm"
        label={`${t("waist")} (${tCommon("optional")})`}
        hint={t("waistHint")}
        unit={tCommon("cm")}
        className="sm:max-w-[calc(50%-0.625rem)]"
      />

      <div className="rounded-control border border-border bg-surface p-4">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 size-5 shrink-0 accent-(--primary)"
            aria-invalid={Boolean(consentError)}
            aria-describedby="healthConsent-hint"
            {...register("healthConsent")}
          />
          <span>
            <span className="block font-medium">{t("consent")}</span>
            <span id="healthConsent-hint" className="mt-1 block text-sm text-muted-foreground">
              {t("consentHint")}
            </span>
          </span>
        </label>
        {consentError ? (
          <p role="alert" className="mt-3 text-sm font-medium text-destructive">
            {consentError}
          </p>
        ) : null}
      </div>
    </div>
  );
}
