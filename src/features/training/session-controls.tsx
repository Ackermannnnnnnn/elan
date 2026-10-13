"use client";

import { useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { discardSessionAction } from "./actions";
import { type FinishFormValues, finishSchema } from "./schemas";

/** Fin de séance : ressenti facultatif (1 à 10), séries non validées retirées. */
export function FinishForm({
  action,
}: {
  action: (values: FinishFormValues) => Promise<ActionResult<string>>;
}) {
  const t = useTranslations("Training.session");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: finishSchema,
    defaultValues: { perceivedEffort: "" },
    action,
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <UnitField<FinishFormValues>
          name="perceivedEffort"
          label={t("effort")}
          hint={t("effortHint")}
          unit="/ 10"
          mode="numeric"
          className="sm:max-w-xs"
        />
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton
          pending={pending}
          pendingLabel={t("finishing")}
          size="lg"
          className="self-start"
        >
          {t("finish")}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}

export function DiscardSessionButton({ id }: { id: string }) {
  const t = useTranslations("Training.session");
  const tCommon = useTranslations("Common");
  return (
    <ConfirmButton
      label={t("discard")}
      confirmLabel={t("discardConfirm")}
      cancelLabel={tCommon("cancel")}
      pendingLabel={tCommon("deleting")}
      action={() => discardSessionAction(id)}
    />
  );
}
