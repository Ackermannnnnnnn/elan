"use client";

import { useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import { TextField, UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { saveWeightAction } from "./actions";
import { weightSchema, type WeightFormValues } from "./schemas";

export function WeightForm({ today }: { today: string }) {
  const t = useTranslations("Progress.weightForm");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError, succeeded } = useActionForm({
    schema: weightSchema,
    defaultValues: { date: today, weightKg: "", note: "" },
    action: saveWeightAction,
    resetOnSuccess: true,
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <UnitField<WeightFormValues> name="weightKg" label={t("weight")} unit={tCommon("kg")} />
          <TextField<WeightFormValues> name="date" type="date" label={t("date")} max={today} />
        </div>
        <TextField<WeightFormValues>
          name="note"
          label={`${t("note")} (${tCommon("optional")})`}
          placeholder={t("notePlaceholder")}
          maxLength={300}
        />
        <p className="text-sm text-muted-foreground">{t("hint")}</p>
        {succeeded ? <Alert variant="success">{t("saved")}</Alert> : null}
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton pending={pending} pendingLabel={tCommon("saving")} className="self-start">
          {t("save")}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
