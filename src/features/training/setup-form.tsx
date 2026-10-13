"use client";

import { useTranslations } from "next-intl";
import { useEffect } from "react";
import { FormProvider, useWatch } from "react-hook-form";
import { UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { ChoiceCard, ChoiceChip, ChoiceGroup } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { CAUTION_AREAS, EQUIPMENT, LEVELS } from "@/domain/exercise-catalog";
import { allowedStructures, recommendStructure, TRAINING_GOALS } from "@/domain/training-program";
import type { ActionResult } from "@/lib/action-result";
import { PRIORITY_MUSCLES, setupSchema, type SetupFormValues } from "./schemas";

export function SetupForm({
  initial,
  action,
  submitLabel,
}: {
  initial: SetupFormValues;
  action: (values: SetupFormValues) => Promise<ActionResult<string>>;
  submitLabel: string;
}) {
  const t = useTranslations("Training");
  const tOptions = useTranslations("Options");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: setupSchema,
    defaultValues: initial,
    action,
  });
  const [sessionsRaw, level, location, structure] = useWatch({
    control: form.control,
    name: ["sessionsPerWeek", "level", "location", "structure"],
  });
  const sessions = Math.min(6, Math.max(1, Math.round(Number(String(sessionsRaw)) || 1)));
  const allowed = allowedStructures(sessions);
  const recommended = recommendStructure(sessions, level);

  // Structure devenue impossible (ex. 2 séances et push/pull/legs) : la conseillée.
  useEffect(() => {
    if (!allowed.includes(structure)) form.setValue("structure", recommended);
  }, [allowed, structure, recommended, form]);

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <Field id="goal" label={t("setup.goal")}>
            <Select id="goal" {...form.register("goal")}>
              {TRAINING_GOALS.map((goal) => (
                <option key={goal} value={goal}>
                  {t(`goal.${goal}`)}
                </option>
              ))}
            </Select>
          </Field>
          <Field id="level" label={t("setup.level")}>
            <Select id="level" {...form.register("level")}>
              {LEVELS.map((option) => (
                <option key={option} value={option}>
                  {tOptions(`trainingLevel.${option}`)}
                </option>
              ))}
            </Select>
          </Field>
          <UnitField<SetupFormValues>
            name="sessionsPerWeek"
            label={t("setup.sessions")}
            unit={t("setup.perWeek")}
            mode="numeric"
          />
          <UnitField<SetupFormValues>
            name="minutesPerSession"
            label={t("setup.minutes")}
            unit={tCommon("minutes")}
            mode="numeric"
          />
          <Field id="location" label={t("setup.location")}>
            <Select id="location" {...form.register("location")}>
              {(["gym", "home", "both", "outdoor"] as const).map((option) => (
                <option key={option} value={option}>
                  {tOptions(`trainingLocation.${option}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        {location === "gym" || location === "both" ? (
          <p className="text-sm text-muted-foreground">{t("setup.gymEquipment")}</p>
        ) : (
          <ChoiceGroup
            legend={t("setup.equipment")}
            hint={t("setup.equipmentHint")}
            className="flex flex-wrap gap-2"
          >
            {EQUIPMENT.filter((item) => item !== "cardio_machine").map((item) => (
              <ChoiceChip
                key={item}
                label={tOptions(`equipment.${item}`)}
                value={item}
                {...form.register("equipment")}
              />
            ))}
          </ChoiceGroup>
        )}

        <ChoiceGroup
          legend={t("setup.limitations")}
          hint={t("setup.limitationsHint")}
          className="flex flex-wrap gap-2"
        >
          {CAUTION_AREAS.map((area) => (
            <ChoiceChip
              key={area}
              label={t(`area.${area}`)}
              value={area}
              {...form.register("limitations")}
            />
          ))}
        </ChoiceGroup>

        <ChoiceGroup
          legend={`${t("setup.priority")} (${tCommon("optional")})`}
          className="flex flex-wrap gap-2"
        >
          {PRIORITY_MUSCLES.map((muscle) => (
            <ChoiceChip
              key={muscle}
              label={t(`muscle.${muscle}`)}
              value={muscle}
              {...form.register("priorityMuscles")}
            />
          ))}
        </ChoiceGroup>

        <ChoiceGroup legend={t("setup.structure")} className="grid gap-3 sm:grid-cols-3">
          {allowed.map((option) => (
            <ChoiceCard
              key={option}
              type="radio"
              value={option}
              label={`${t(`structure.${option}.name`)}${option === recommended ? ` · ${t("setup.recommended")}` : ""}`}
              description={t(`structure.${option}.description`)}
              {...form.register("structure")}
            />
          ))}
        </ChoiceGroup>

        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton
          pending={pending}
          pendingLabel={t("setup.generating")}
          size="lg"
          className="self-start"
        >
          {submitLabel}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
