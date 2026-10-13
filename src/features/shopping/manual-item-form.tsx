"use client";

import { useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import { TextField, UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { type ManualItemFormValues, manualItemSchema } from "./schemas";

export function ManualItemForm({
  action,
}: {
  action: (values: ManualItemFormValues) => Promise<ActionResult<string>>;
}) {
  const t = useTranslations("Shopping.manual");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: manualItemSchema,
    defaultValues: { name: "", quantityG: "" },
    action,
    resetOnSuccess: true,
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-[1fr_10rem]">
          <TextField<ManualItemFormValues>
            name="name"
            label={t("name")}
            placeholder={t("namePlaceholder")}
            maxLength={200}
          />
          <UnitField<ManualItemFormValues>
            name="quantityG"
            label={`${t("quantity")} (${tCommon("optional")})`}
            unit={tCommon("grams")}
          />
        </div>
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton
          pending={pending}
          pendingLabel={tCommon("saving")}
          variant="secondary"
          className="self-start"
        >
          {t("submit")}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
