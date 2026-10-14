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
import { macrosForQuantity, portionChoices } from "@/domain/nutrition";
import { cn } from "@/lib/utils";
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
  packageSizeG?: number | null;
  packageLabel?: string | null;
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
  const amount = (grams: number) => `${number(grams)} ${baseUnit}`;
  const choices = portionChoices({
    basis: food.basis,
    servingSizeG: food.servingSizeG,
    packageSizeG: food.packageSizeG ?? null,
  });
  const choiceLabel = (kind: (typeof choices)[number]["kind"], grams: number) => {
    switch (kind) {
      case "package":
        return t("portion.package", { amount: food.packageLabel ?? amount(grams) });
      case "halfPackage":
        return t("portion.halfPackage", { amount: amount(grams) });
      case "serving":
        return t("portion.serving", { amount: food.servingLabel ?? amount(grams) });
      case "halfServing":
        return t("portion.halfServing", { amount: amount(grams) });
      case "twoServings":
        return t("portion.twoServings", { amount: amount(grams) });
      case "hundred":
        return amount(100);
      default:
        return t(`portion.${kind}`);
    }
  };
  const currentGrams = unit === "grams" && parsed.success ? parsed.data.quantity : null;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <fieldset>
          <legend className="mb-2 text-sm font-semibold">{t("portion.title")}</legend>
          <div className="flex flex-wrap gap-2">
            {choices.map((choice) => {
              const active = currentGrams === choice.grams;
              return (
                <button
                  key={choice.kind}
                  type="button"
                  aria-pressed={active}
                  onClick={() => {
                    form.setValue("unit", "grams");
                    form.setValue("quantity", String(choice.grams).replace(".", ","), {
                      shouldValidate: true,
                    });
                  }}
                  className={cn(
                    "inline-flex min-h-11 items-center rounded-full border px-4 text-[0.9375rem] font-medium transition-colors",
                    active
                      ? "border-primary bg-primary-soft text-primary-soft-foreground"
                      : "border-border-strong bg-surface hover:border-primary/60",
                  )}
                >
                  {choiceLabel(choice.kind, choice.grams)}
                </button>
              );
            })}
          </div>
        </fieldset>
        <div className="grid gap-4 sm:grid-cols-2">
          <UnitField<QuantityFormValues>
            name="quantity"
            label={t("quantity")}
            unit={unit === "servings" ? "×" : baseUnit}
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
