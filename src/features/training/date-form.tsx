"use client";

import { useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import { TextField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { type DateFormValues, dateSchema } from "./schemas";

/** Choix d'une date quelconque (sélecteur natif du téléphone). */
export function DateForm({
  action,
  defaultDate,
  min,
  max,
}: {
  action: (values: DateFormValues) => Promise<ActionResult<string>>;
  defaultDate: string;
  min: string;
  max: string;
}) {
  const t = useTranslations("Training.plan");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: dateSchema,
    defaultValues: { date: defaultDate },
    action,
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-3">
        <div className="flex flex-wrap items-end gap-3">
          <TextField<DateFormValues>
            name="date"
            type="date"
            label={t("otherDate")}
            min={min}
            max={max}
            className="w-48"
          />
          <SubmitButton pending={pending} pendingLabel={t("moving")} variant="secondary">
            {t("move")}
          </SubmitButton>
        </div>
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
      </form>
    </FormProvider>
  );
}
