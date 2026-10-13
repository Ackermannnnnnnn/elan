"use client";

import { useFormatter, useTranslations } from "next-intl";
import { FormProvider, useWatch } from "react-hook-form";
import { UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { macrosForQuantity } from "@/domain/nutrition";
import type { ActionResult } from "@/lib/action-result";
import { quantitySchema, type QuantityFormValues } from "./schemas";

export type QuantityFood = {
  basis: "100g" | "100ml";
  kcal: number;
  proteinG: number;
  carbsG: number;
  fatG: number;
  fiberG: number | null;
  servingSizeG: number | null;
  servingLabel: string | null;
};

type Props = {
  food: QuantityFood;
  initial: QuantityFormValues;
  submitLabel: string;
  action: (values: QuantityFormValues) => Promise<ActionResult<string>>;
};

/** Saisie d'une quantité, avec l'aperçu des apports calculé en direct par le moteur métier. */
export function QuantityForm({ food, initial, submitLabel, action }: Props) {
  const t = useTranslations("Nutrition.add");
  const tSummary = useTranslations("Nutrition.summary");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: quantitySchema,
    defaultValues: initial,
    action,
  });

  const [unit, quantity] = useWatch({ control: form.control, name: ["unit", "quantity"] });
  const parsed = quantitySchema.safeParse({ unit, quantity });
  const grams = parsed.success
    ? parsed.data.unit === "grams"
      ? parsed.data.quantity
      : parsed.data.quantity * (food.servingSizeG ?? 0)
    : null;
  const preview = grams !== null && grams > 0 ? macrosForQuantity(food, grams) : null;

  const baseUnit = food.basis === "100ml" ? tCommon("ml") : tCommon("grams");
  const number = (value: number) => format.number(value, { maximumFractionDigits: 1 });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <div className="grid gap-4 sm:grid-cols-2">
          <UnitField<QuantityFormValues>
            name="quantity"
            label={t("quantity")}
            unit={unit === "servings" ? "×" : baseUnit}
            autoFocus
          />
          {food.servingSizeG ? (
            <Field id="unit" label={t("unit")}>
              <Select id="unit" {...form.register("unit")}>
                <option value="grams">
                  {food.basis === "100ml" ? t("unitMl") : t("unitGrams")}
                </option>
                <option value="servings">
                  {t("unitServings", {
                    label:
                      food.servingLabel ??
                      t("servingDefault", { grams: number(food.servingSizeG) }),
                  })}
                </option>
              </Select>
            </Field>
          ) : null}
        </div>

        <div aria-live="polite" className="rounded-control bg-surface-muted p-4">
          <p className="text-sm text-muted-foreground">{t("preview")}</p>
          {preview ? (
            <dl className="mt-2 grid grid-cols-4 gap-2 text-center">
              {[
                [tSummary("calories"), `${number(preview.kcal)}`, tCommon("kcal")],
                [tSummary("protein"), number(preview.proteinG), "g"],
                [tSummary("carbs"), number(preview.carbsG), "g"],
                [tSummary("fat"), number(preview.fatG), "g"],
              ].map(([label, value, suffix]) => (
                <div key={label}>
                  <dd className="text-lg font-semibold tabular-nums">
                    {value}
                    <span className="ml-0.5 text-sm font-normal text-muted-foreground">
                      {suffix}
                    </span>
                  </dd>
                  <dt className="text-xs text-muted-foreground">{label}</dt>
                </div>
              ))}
            </dl>
          ) : (
            <p className="mt-2 font-semibold">—</p>
          )}
        </div>

        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton pending={pending} pendingLabel={t("submitting")} size="lg">
          {submitLabel}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
