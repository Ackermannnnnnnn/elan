"use client";

import { useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import { TextField, UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { saveMeasurementAction } from "./actions";
import { measurementSchema, type MeasurementFormValues } from "./schemas";

const FIELDS = [
  ["waistCm", "waist"],
  ["hipsCm", "hips"],
  ["chestCm", "chest"],
  ["armCm", "arm"],
  ["thighCm", "thigh"],
] as const;

export function MeasurementForm({ today }: { today: string }) {
  const t = useTranslations("Progress.measurements");
  const tForm = useTranslations("Progress.weightForm");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError, succeeded } = useActionForm({
    schema: measurementSchema,
    defaultValues: { date: today, waistCm: "", hipsCm: "", chestCm: "", armCm: "", thighCm: "" },
    action: saveMeasurementAction,
    resetOnSuccess: true,
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {FIELDS.map(([name, key]) => (
            <UnitField<MeasurementFormValues>
              key={name}
              name={name}
              label={t(key)}
              unit={tCommon("cm")}
            />
          ))}
          <TextField<MeasurementFormValues>
            name="date"
            type="date"
            label={tForm("date")}
            max={today}
          />
        </div>
        {succeeded ? <Alert variant="success">{t("saved")}</Alert> : null}
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton
          pending={pending}
          pendingLabel={tCommon("saving")}
          variant="secondary"
          className="self-start"
        >
          {t("save")}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
