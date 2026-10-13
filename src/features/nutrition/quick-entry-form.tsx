"use client";

import { useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import { TextField, UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { quickEntrySchema, type QuickEntryFormValues } from "./schemas";

type Props = {
  initial?: QuickEntryFormValues;
  submitLabel: string;
  action: (values: QuickEntryFormValues) => Promise<ActionResult<string>>;
};

const EMPTY: QuickEntryFormValues = {
  description: "",
  kcal: "",
  proteinG: "",
  carbsG: "",
  fatG: "",
};

/** Saisie rapide : l'utilisateur déclare lui-même les apports d'un plat. */
export function QuickEntryForm({ initial = EMPTY, submitLabel, action }: Props) {
  const t = useTranslations("Nutrition.quick");
  const tAdd = useTranslations("Nutrition.add");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: quickEntrySchema,
    defaultValues: initial,
    action,
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <TextField<QuickEntryFormValues>
          name="description"
          label={t("description")}
          placeholder={t("descriptionPlaceholder")}
          maxLength={200}
        />
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
          <UnitField<QuickEntryFormValues> name="kcal" label={t("kcal")} unit={tCommon("kcal")} />
          <UnitField<QuickEntryFormValues> name="proteinG" label={t("protein")} unit="g" />
          <UnitField<QuickEntryFormValues> name="carbsG" label={t("carbs")} unit="g" />
          <UnitField<QuickEntryFormValues> name="fatG" label={t("fat")} unit="g" />
        </div>
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton pending={pending} pendingLabel={tAdd("submitting")} size="lg">
          {submitLabel}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
