"use client";

import { useTranslations } from "next-intl";
import { useFieldError } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { UnitInput } from "@/components/ui/unit-input";
import type { ActionResult } from "@/lib/action-result";
import { FormProvider } from "react-hook-form";
import { type PriceFormValues, priceSchema } from "./schemas";

/** Prix payé ou relevé par l'utilisateur. Champ vide : aucun prix (rien n'est estimé). */
export function PriceForm({
  id,
  initial,
  label,
  action,
}: {
  id: string;
  initial: string;
  label: string;
  action: (values: PriceFormValues) => Promise<ActionResult<string>>;
}) {
  const t = useTranslations("Shopping");
  const tCommon = useTranslations("Common");
  const { form, onSubmit, pending } = useActionForm({
    schema: priceSchema,
    defaultValues: { price: initial },
    action,
  });
  const inputId = `price-${id}`;
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <label htmlFor={inputId} className="sr-only">
            {label}
          </label>
          <UnitInput
            id={inputId}
            unit="€"
            placeholder={t("pricePlaceholder")}
            className="w-28"
            {...form.register("price")}
          />
          <SubmitButton
            pending={pending}
            pendingLabel={tCommon("saving")}
            variant="secondary"
            size="sm"
          >
            {t("savePrice")}
          </SubmitButton>
        </div>
        <PriceError />
      </form>
    </FormProvider>
  );
}

function PriceError() {
  const error = useFieldError<PriceFormValues>("price");
  return error ? <p className="text-sm font-medium text-destructive">{error}</p> : null;
}
