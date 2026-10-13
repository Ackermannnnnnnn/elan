"use client";

import { useTranslations } from "next-intl";
import { FormProvider, useWatch } from "react-hook-form";
import { TextField, UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { ChoiceChip, ChoiceGroup } from "@/components/ui/choice";
import { ALLERGEN_CODES } from "@/domain/food-classification";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { labelLooksConsistent } from "@/domain/nutrition";
import type { ActionResult } from "@/lib/action-result";
import { foodSchema, type FoodFormValues } from "./schemas";

type Props = {
  initial: FoodFormValues;
  /** Action serveur ; `returnTo` lui est transmis lors d'une création. */
  action: (values: FoodFormValues, returnTo?: string) => Promise<ActionResult<string>>;
  returnTo?: string;
};

export function FoodForm({ initial, action, returnTo }: Props) {
  const t = useTranslations("Nutrition.foods");
  const tOptions = useTranslations("Options");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: foodSchema,
    defaultValues: initial,
    action: (values) => action(values, returnTo),
  });

  const [basis, kcal, proteinG, carbsG, fatG] = useWatch({
    control: form.control,
    name: ["basis", "kcal", "proteinG", "carbsG", "fatG"],
  });
  const per = tOptions(`basis.${basis}`);

  // Avertissement non bloquant : l'erreur classique est de recopier les valeurs « par portion ».
  const numbers = [kcal, proteinG, carbsG, fatG].map((raw) =>
    Number(String(raw).replace(",", ".")),
  );
  const allFilled = [kcal, proteinG, carbsG, fatG].every((raw) => String(raw).trim() !== "");
  const [kcalValue = 0, proteinValue = 0, carbsValue = 0, fatValue = 0] = numbers;
  const inconsistent =
    allFilled &&
    numbers.every(Number.isFinite) &&
    !labelLooksConsistent({
      kcal: kcalValue,
      proteinG: proteinValue,
      carbsG: carbsValue,
      fatG: fatValue,
      fiberG: null,
    });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField<FoodFormValues>
            name="name"
            label={t("name")}
            placeholder={t("namePlaceholder")}
            maxLength={200}
          />
          <TextField<FoodFormValues>
            name="brand"
            label={`${t("brand")} (${tCommon("optional")})`}
            maxLength={120}
          />
          <Field id="basis" label={t("basis")}>
            <Select id="basis" {...form.register("basis")}>
              <option value="100g">{tOptions("basis.100g")}</option>
              <option value="100ml">{tOptions("basis.100ml")}</option>
            </Select>
          </Field>
          <Field id="preparationState" label={t("state")} hint={t("stateHint")}>
            <Select
              id="preparationState"
              aria-describedby="preparationState-hint"
              {...form.register("preparationState")}
            >
              {(["as_sold", "raw", "cooked", "unknown"] as const).map((state) => (
                <option key={state} value={state}>
                  {tOptions(`preparationState.${state}`)}
                </option>
              ))}
            </Select>
          </Field>
        </div>

        <fieldset className="min-w-0">
          <legend className="text-lg font-semibold">
            {t("valuesTitle")} {per}
          </legend>
          <p className="mt-1 text-sm text-muted-foreground">{t("valuesHint")}</p>
          <div className="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-5">
            <UnitField<FoodFormValues> name="kcal" label={t("kcal")} unit={tCommon("kcal")} />
            <UnitField<FoodFormValues> name="proteinG" label={t("protein")} unit="g" />
            <UnitField<FoodFormValues> name="carbsG" label={t("carbs")} unit="g" />
            <UnitField<FoodFormValues> name="fatG" label={t("fat")} unit="g" />
            <UnitField<FoodFormValues> name="fiberG" label={t("fiber")} unit="g" />
          </div>
          {inconsistent ? (
            <Alert variant="info" className="mt-4">
              {t("inconsistent")}
            </Alert>
          ) : null}
        </fieldset>

        <fieldset className="min-w-0">
          <legend className="text-lg font-semibold">
            {t("servingTitle")} ({tCommon("optional")})
          </legend>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <UnitField<FoodFormValues>
              name="servingSizeG"
              label={t("servingSize")}
              unit={basis === "100ml" ? tCommon("ml") : tCommon("grams")}
            />
            <TextField<FoodFormValues>
              name="servingLabel"
              label={t("servingLabel")}
              placeholder={t("servingLabelPlaceholder")}
              maxLength={60}
            />
          </div>
        </fieldset>

        <ChoiceGroup
          legend={t("allergens")}
          hint={t("allergensHint")}
          className="flex flex-wrap gap-2"
        >
          {ALLERGEN_CODES.map((code) => (
            <ChoiceChip
              key={code}
              label={tOptions(`allergen.${code}`)}
              value={code}
              {...form.register("allergens")}
            />
          ))}
        </ChoiceGroup>

        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton
          pending={pending}
          pendingLabel={tCommon("saving")}
          size="lg"
          className="self-start"
        >
          {t("save")}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}
