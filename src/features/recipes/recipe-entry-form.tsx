"use client";

import { useTranslations } from "next-intl";
import { FormProvider, useWatch } from "react-hook-form";
import { TextField, UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import type { ActionResult } from "@/lib/action-result";
import { type RecipeEntryFormValues, recipeEntrySchema } from "./schemas";

type Props = {
  today: string;
  /** Jour proposé (par défaut : aujourd'hui). */
  defaultDate?: string;
  categories: { id: string; label: string }[];
  defaultCategoryId: string;
  perServing: { kcal: number; proteinG: number };
  action: (values: RecipeEntryFormValues) => Promise<ActionResult<string>>;
};

export function RecipeEntryForm({
  today,
  defaultDate,
  categories,
  defaultCategoryId,
  perServing,
  action,
}: Props) {
  const t = useTranslations("Recipes.log");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: recipeEntrySchema,
    defaultValues: { date: defaultDate ?? today, categoryId: defaultCategoryId, portions: "1" },
    action,
  });
  const portions = Number(
    String(useWatch({ control: form.control, name: "portions" })).replace(",", "."),
  );

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-3">
          <TextField<RecipeEntryFormValues> name="date" type="date" label={t("date")} max={today} />
          <Field id="categoryId" label={t("meal")}>
            <Select id="categoryId" {...form.register("categoryId")}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.label}
                </option>
              ))}
            </Select>
          </Field>
          <UnitField<RecipeEntryFormValues>
            name="portions"
            label={t("portions")}
            unit={t("portionsUnit")}
          />
        </div>
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
          {t("submit")}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
