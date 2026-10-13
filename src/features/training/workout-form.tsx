"use client";

import { useTranslations } from "next-intl";
import { FormProvider, useFormContext } from "react-hook-form";
import { TextField, useFieldError } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { ActionResult } from "@/lib/action-result";
import { WEEKDAY_VALUES, type WorkoutFormValues, workoutSchema } from "./schemas";

type Weekday = Exclude<(typeof WEEKDAY_VALUES)[number], "">;

function WeekdaySelect() {
  const t = useTranslations("Training");
  const { register } = useFormContext<WorkoutFormValues>();
  const error = useFieldError<WorkoutFormValues>("weekday");
  return (
    <Field id="weekday" label={t("workoutForm.weekday")} error={error}>
      <Select id="weekday" aria-invalid={Boolean(error)} {...register("weekday")}>
        {WEEKDAY_VALUES.map((value) => (
          <option key={value} value={value}>
            {value === "" ? t("workoutForm.onDemand") : t(`weekday.${value as Weekday}`)}
          </option>
        ))}
      </Select>
    </Field>
  );
}

/** Nom et jour habituel d'une séance (création ou modification). */
export function WorkoutForm({
  action,
  defaultValues,
  mode,
}: {
  action: (values: WorkoutFormValues) => Promise<ActionResult<string>>;
  defaultValues: WorkoutFormValues;
  mode: "create" | "edit";
}) {
  const t = useTranslations("Training.workoutForm");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError, succeeded } = useActionForm({
    schema: workoutSchema,
    defaultValues,
    action,
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <TextField<WorkoutFormValues>
          name="name"
          label={t("name")}
          placeholder={t("namePlaceholder")}
          maxLength={120}
        />
        <WeekdaySelect />
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton
            pending={pending}
            pendingLabel={mode === "create" ? t("creating") : t("save")}
            variant={mode === "create" ? "primary" : "secondary"}
          >
            {mode === "create" ? t("create") : t("save")}
          </SubmitButton>
          {succeeded && mode === "edit" ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("saved")}
            </p>
          ) : null}
        </div>
      </form>
    </FormProvider>
  );
}
