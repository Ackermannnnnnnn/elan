"use client";

import { useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import { UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { type PrescriptionFormValues, prescriptionSchema } from "./schemas";

/** Séries, répétitions (ou secondes pour un exercice chronométré) et repos. */
export function PrescriptionForm({
  action,
  defaultValues,
  timed,
  idPrefix,
}: {
  action: (values: PrescriptionFormValues) => Promise<ActionResult<string>>;
  defaultValues: PrescriptionFormValues;
  timed: boolean;
  /** Identifiants uniques : plusieurs formulaires sur la même page. */
  idPrefix: string;
}) {
  const t = useTranslations("Training.prescription");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError, succeeded } = useActionForm({
    schema: prescriptionSchema,
    defaultValues,
    action,
  });
  const unit = timed ? t("unitSeconds") : t("unitReps");
  return (
    <FormProvider {...form}>
      <form
        onSubmit={onSubmit}
        noValidate
        className="flex flex-col gap-4"
        id={`${idPrefix}-prescription`}
      >
        <fieldset className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <legend className="sr-only">{t("title")}</legend>
          <UnitField<PrescriptionFormValues>
            name="sets"
            id={`${idPrefix}-sets`}
            label={t("sets")}
            unit={t("unitSets")}
            mode="numeric"
          />
          <UnitField<PrescriptionFormValues>
            name="repMin"
            id={`${idPrefix}-repMin`}
            label={timed ? t("secondsMin") : t("repMin")}
            unit={unit}
            mode="numeric"
          />
          <UnitField<PrescriptionFormValues>
            name="repMax"
            id={`${idPrefix}-repMax`}
            label={timed ? t("secondsMax") : t("repMax")}
            unit={unit}
            mode="numeric"
          />
          <UnitField<PrescriptionFormValues>
            name="restSeconds"
            id={`${idPrefix}-restSeconds`}
            label={t("rest")}
            unit={t("unitSeconds")}
            mode="numeric"
          />
        </fieldset>
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton
            pending={pending}
            pendingLabel={tCommon("saving")}
            variant="secondary"
            size="sm"
          >
            {t("save")}
          </SubmitButton>
          {succeeded ? (
            <p role="status" className="text-sm text-muted-foreground">
              {t("saved")}
            </p>
          ) : null}
        </div>
      </form>
    </FormProvider>
  );
}
