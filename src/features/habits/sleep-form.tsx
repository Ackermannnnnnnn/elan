"use client";

import { useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import { TextField, UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { saveSleepAction } from "./actions";
import { sleepSchema, type SleepFormValues } from "./schemas";

/** Heures de sommeil de la nuit passée (laisser vide efface la saisie). */
export function SleepForm({ today, hours }: { today: string; hours: number | null }) {
  const t = useTranslations("Habits.sleep");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError, succeeded } = useActionForm({
    schema: sleepSchema,
    defaultValues: {
      date: today,
      hours: hours === null ? "" : String(hours).replace(".", ","),
    },
    action: saveSleepAction,
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-3">
          <UnitField<SleepFormValues>
            name="hours"
            id="sleep-hours"
            label={t("hours")}
            unit="h"
            mode="decimal"
            placeholder="7,5"
          />
          <TextField<SleepFormValues>
            name="date"
            id="sleep-date"
            label={t("date")}
            type="date"
            max={today}
          />
        </div>
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={pending} pendingLabel={tCommon("saving")} variant="secondary">
            {t("save")}
          </SubmitButton>
          {succeeded ? (
            <p role="status" className="text-sm font-medium text-success">
              {tCommon("saved")}
            </p>
          ) : null}
        </div>
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
      </form>
    </FormProvider>
  );
}
