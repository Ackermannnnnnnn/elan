"use client";

import { useTranslations } from "next-intl";
import { FormProvider, useWatch } from "react-hook-form";
import { UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { type PortionsFormValues, portionsSchema } from "./schemas";

/** Nombre de portions d'une recette du journal, avec l'aperçu des apports. */
export function PortionsForm({
  initial,
  perServing,
  submitLabel,
  action,
}: {
  initial: PortionsFormValues;
  perServing: { kcal: number; proteinG: number };
  submitLabel: string;
  action: (values: PortionsFormValues) => Promise<ActionResult<string>>;
}) {
  const t = useTranslations("Recipes.log");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: portionsSchema,
    defaultValues: initial,
    action,
  });
  const portions = Number(
    String(useWatch({ control: form.control, name: "portions" })).replace(",", "."),
  );
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <UnitField<PortionsFormValues>
          name="portions"
          label={t("portions")}
          unit={t("portionsUnit")}
          className="sm:max-w-xs"
        />
        {Number.isFinite(portions) && portions > 0 ? (
          <p className="text-sm text-muted-foreground tabular-nums" role="status">
            {t("preview", {
              kcal: Math.round(perServing.kcal * portions),
              protein: Math.round(perServing.proteinG * portions),
            })}
          </p>
        ) : null}
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton pending={pending} pendingLabel={tCommon("saving")} className="self-start">
          {submitLabel}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
