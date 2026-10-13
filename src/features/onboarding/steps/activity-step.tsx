"use client";

import { useTranslations } from "next-intl";
import { useEffect, useRef } from "react";
import { Controller, useFormContext, useWatch } from "react-hook-form";
import { UnitField } from "@/components/forms/fields";
import { Badge } from "@/components/ui/badge";
import { ChoiceCard, ChoiceChip, ChoiceGroup } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import { ACTIVITY_LEVELS, suggestActivityLevel } from "@/domain/energy";
import {
  OCCUPATION_TYPES,
  TRAINING_EQUIPMENT,
  TRAINING_LEVELS,
  TRAINING_LOCATIONS,
} from "../options";
import type { OnboardingFormValues } from "../schema";

const toInt = (raw: string) => {
  const value = Number.parseInt(raw, 10);
  return Number.isFinite(value) ? value : null;
};

export function ActivityStep({ keepActivityLevel }: { keepActivityLevel: boolean }) {
  const t = useTranslations("Onboarding.activity");
  const tOptions = useTranslations("Options");
  const tCommon = useTranslations("Common");
  const { register, control, setValue } = useFormContext<OnboardingFormValues>();

  const [occupation, steps, sessions, minutes] = useWatch({
    control,
    name: ["occupation", "avgDailySteps", "sessionsPerWeek", "sessionMinutes"],
  });

  const suggestion = suggestActivityLevel({
    occupation,
    dailySteps: toInt(steps),
    sessionsPerWeek: toInt(sessions) ?? 0,
    sessionMinutes: toInt(minutes) ?? 0,
  });

  // Le niveau suit la suggestion tant que l'utilisateur ne l'a pas choisi lui-même.
  const chosenManually = useRef(keepActivityLevel);
  useEffect(() => {
    if (!chosenManually.current) setValue("activityLevel", suggestion);
  }, [suggestion, setValue]);

  const activityLevel = register("activityLevel");

  return (
    <div className="flex flex-col gap-7">
      <Field id="occupation" label={t("occupation")}>
        <Select id="occupation" {...register("occupation")}>
          {OCCUPATION_TYPES.map((option) => (
            <option key={option} value={option}>
              {tOptions(`occupation.${option}`)}
            </option>
          ))}
        </Select>
      </Field>

      <UnitField<OnboardingFormValues>
        name="avgDailySteps"
        label={`${t("steps")} (${tCommon("optional")})`}
        hint={t("stepsHint")}
        unit="pas"
        mode="numeric"
        className="sm:max-w-[calc(50%-0.625rem)]"
      />

      <div className="grid gap-5 sm:grid-cols-2">
        <UnitField<OnboardingFormValues>
          name="sessionsPerWeek"
          label={t("sessions")}
          unit="/ sem."
          mode="numeric"
        />
        <UnitField<OnboardingFormValues>
          name="sessionMinutes"
          label={t("sessionMinutes")}
          unit={tCommon("minutes")}
          mode="numeric"
        />
      </div>

      <div className="grid gap-5 sm:grid-cols-2">
        <Field id="trainingLevel" label={t("trainingLevel")}>
          <Select id="trainingLevel" {...register("trainingLevel")}>
            {TRAINING_LEVELS.map((option) => (
              <option key={option} value={option}>
                {tOptions(`trainingLevel.${option}`)}
              </option>
            ))}
          </Select>
        </Field>
        <Field id="trainingLocation" label={t("trainingLocation")}>
          <Select id="trainingLocation" {...register("trainingLocation")}>
            {TRAINING_LOCATIONS.map((option) => (
              <option key={option} value={option}>
                {tOptions(`trainingLocation.${option}`)}
              </option>
            ))}
          </Select>
        </Field>
      </div>

      <ChoiceGroup
        legend={`${t("equipment")} (${tCommon("optional")})`}
        className="flex flex-wrap gap-2"
      >
        {TRAINING_EQUIPMENT.map((option) => (
          <ChoiceChip
            key={option}
            label={tOptions(`equipment.${option}`)}
            value={option}
            {...register("equipment")}
          />
        ))}
      </ChoiceGroup>

      <Field id="sports" label={`${t("sports")} (${tCommon("optional")})`}>
        <Controller
          control={control}
          name="sports"
          render={({ field }) => (
            <TagInput
              id="sports"
              value={field.value}
              onChange={field.onChange}
              placeholder={t("sportsPlaceholder")}
              addLabel={tCommon("add")}
              removeLabel={(item) => tCommon("removeItem", { item })}
              maxItems={30}
            />
          )}
        />
      </Field>

      <ChoiceGroup
        legend={t("activityLevel")}
        hint={t("activityLevelHint")}
        className="grid gap-2.5"
      >
        {ACTIVITY_LEVELS.map((option) => (
          <div key={option} className="relative">
            <ChoiceCard
              type="radio"
              value={option}
              label={tOptions(`activityLevel.${option}.label`)}
              description={tOptions(`activityLevel.${option}.description`)}
              {...activityLevel}
              onChange={(event) => {
                chosenManually.current = true;
                void activityLevel.onChange(event);
              }}
            />
            {option === suggestion ? (
              <Badge variant="primary" className="pointer-events-none absolute top-3.5 right-12">
                {t("suggested")}
              </Badge>
            ) : null}
          </div>
        ))}
      </ChoiceGroup>
    </div>
  );
}
