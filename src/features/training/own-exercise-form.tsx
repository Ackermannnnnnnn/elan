"use client";

import { useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import { TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { ChoiceChip, ChoiceGroup } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { EQUIPMENT, MUSCLES } from "@/domain/exercise-catalog";
import type { ActionResult } from "@/lib/action-result";
import { type OwnExerciseFormValues, ownExerciseSchema } from "./schemas";

/** Création ou modification d'un exercice personnel. */
export function OwnExerciseForm({
  action,
  defaultValues,
  submitLabel,
}: {
  action: (values: OwnExerciseFormValues) => Promise<ActionResult<string>>;
  defaultValues: OwnExerciseFormValues;
  submitLabel: string;
}) {
  const t = useTranslations("Training");
  const tOptions = useTranslations("Options");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: ownExerciseSchema,
    defaultValues,
    action,
  });
  const primaryError = messages.validation(form.formState.errors.primary?.message);
  const instructionsError = messages.validation(form.formState.errors.instructions?.message);

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <TextField<OwnExerciseFormValues>
          name="name"
          label={t("ownExercise.name")}
          maxLength={120}
        />
        <Field id="primary" label={t("ownExercise.primary")} error={primaryError}>
          <Select id="primary" aria-invalid={Boolean(primaryError)} {...form.register("primary")}>
            {MUSCLES.map((muscle) => (
              <option key={muscle} value={muscle}>
                {t(`muscle.${muscle}`)}
              </option>
            ))}
          </Select>
        </Field>
        <ChoiceGroup
          legend={t("ownExercise.equipment")}
          hint={t("ownExercise.equipmentHint")}
          className="flex flex-wrap gap-2"
        >
          {EQUIPMENT.map((item) => (
            <ChoiceChip
              key={item}
              label={tOptions(`equipment.${item}`)}
              value={item}
              {...form.register("equipment")}
            />
          ))}
        </ChoiceGroup>
        <ChoiceGroup legend={t("ownExercise.kind")} className="flex flex-wrap gap-2">
          <ChoiceChip
            type="radio"
            label={t("ownExercise.reps")}
            value="reps"
            {...form.register("kind")}
          />
          <ChoiceChip
            type="radio"
            label={t("ownExercise.timed")}
            value="timed"
            {...form.register("kind")}
          />
        </ChoiceGroup>
        <Field
          id="instructions"
          label={`${t("ownExercise.instructions")} (${tCommon("optional")})`}
          hint={t("ownExercise.instructionsHint")}
          error={instructionsError}
        >
          <textarea
            id="instructions"
            rows={5}
            maxLength={3000}
            aria-describedby={instructionsError ? "instructions-error" : "instructions-hint"}
            className="min-h-28 rounded-control border border-border-strong bg-surface px-4 py-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            {...form.register("instructions")}
          />
        </Field>
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton pending={pending} pendingLabel={tCommon("saving")} className="self-start">
          {submitLabel}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
