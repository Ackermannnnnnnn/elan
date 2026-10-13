"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { useState } from "react";
import { Controller, FormProvider, useFieldArray, useWatch } from "react-hook-form";
import { TextField, UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { ChoiceChip, ChoiceGroup } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { TagInput } from "@/components/ui/tag-input";
import { MEAL_SLOTS } from "@/domain/meal-planner";
import type { ActionResult } from "@/lib/action-result";
import { FoodPicker } from "./food-picker";
import { type RecipeFormValues, recipeSchema } from "./schemas";

export type KnownFood = { kcal: number; proteinG: number };

type Props = {
  initial: RecipeFormValues;
  /** Valeurs pour 100 g des aliments déjà présents (aperçu des apports). */
  knownFoods: Record<string, KnownFood>;
  action: (values: RecipeFormValues) => Promise<ActionResult<string>>;
  submitLabel: string;
};

const toNumber = (raw: unknown) => Number(String(raw ?? "").replace(",", "."));

export function RecipeForm({ initial, knownFoods, action, submitLabel }: Props) {
  const t = useTranslations("Recipes.form");
  const tOptions = useTranslations("Options");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const [foods, setFoods] = useState<Record<string, KnownFood>>(knownFoods);
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: recipeSchema,
    defaultValues: initial,
    action,
  });
  const { fields, append, remove } = useFieldArray({ control: form.control, name: "ingredients" });
  const ingredientsError = listError(form.formState.errors.ingredients);

  // Aperçu indicatif : le calcul qui fait foi est refait par le serveur à l'enregistrement.
  const [ingredients, servings] = useWatch({
    control: form.control,
    name: ["ingredients", "servings"],
  });
  const portions = toNumber(servings);
  let kcal = 0;
  let protein = 0;
  for (const ingredient of ingredients ?? []) {
    const food = foods[ingredient.foodId];
    const grams = toNumber(ingredient.quantityG);
    if (!food || ingredient.isOptional || !Number.isFinite(grams)) continue;
    kcal += (food.kcal * grams) / 100;
    protein += (food.proteinG * grams) / 100;
  }
  const showPreview = (ingredients ?? []).length > 0 && portions > 0;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-8">
        <div className="grid gap-5 sm:grid-cols-2">
          <TextField<RecipeFormValues>
            name="title"
            label={t("title")}
            placeholder={t("titlePlaceholder")}
            maxLength={160}
            className="sm:col-span-2"
          />
          <TextField<RecipeFormValues>
            name="description"
            label={`${t("description")} (${tCommon("optional")})`}
            maxLength={1000}
            className="sm:col-span-2"
          />
          <UnitField<RecipeFormValues>
            name="servings"
            label={t("servings")}
            hint={t("servingsHint")}
            unit={t("servingsUnit")}
          />
          <div className="grid grid-cols-2 gap-4">
            <UnitField<RecipeFormValues>
              name="prepMinutes"
              label={t("prep")}
              unit={tCommon("minutes")}
              mode="numeric"
            />
            <UnitField<RecipeFormValues>
              name="cookMinutes"
              label={t("cook")}
              unit={tCommon("minutes")}
              mode="numeric"
            />
          </div>
        </div>

        <ChoiceGroup legend={t("slots")} hint={t("slotsHint")} className="flex flex-wrap gap-2">
          {MEAL_SLOTS.map((slot) => (
            <ChoiceChip
              key={slot}
              label={tOptions(`mealCategory.${slot}`)}
              value={slot}
              {...form.register("slots")}
            />
          ))}
        </ChoiceGroup>

        <section aria-labelledby="ingredients-title" className="flex flex-col gap-4">
          <div>
            <h2 id="ingredients-title" className="text-lg font-semibold">
              {t("ingredients")}
            </h2>
            <p className="mt-1 text-sm text-muted-foreground">{t("ingredientsHint")}</p>
          </div>

          {fields.length > 0 ? (
            <ul className="flex flex-col gap-3">
              {fields.map((field, index) => (
                <li
                  key={field.id}
                  className="grid gap-3 rounded-control border border-border p-4 sm:grid-cols-[1fr_8rem_10rem_auto] sm:items-end"
                >
                  <div className="min-w-0 sm:self-center">
                    <p className="font-medium">{field.foodName}</p>
                    <label className="mt-1 inline-flex items-center gap-2 text-sm text-muted-foreground">
                      <input
                        type="checkbox"
                        className="size-4 accent-primary"
                        {...form.register(`ingredients.${index}.isOptional`)}
                      />
                      {t("optionalIngredient")}
                    </label>
                  </div>
                  <UnitField<RecipeFormValues>
                    name={`ingredients.${index}.quantityG`}
                    label={t("quantity")}
                    unit={tCommon("grams")}
                  />
                  <TextField<RecipeFormValues>
                    name={`ingredients.${index}.displayQuantity`}
                    label={t("display")}
                    placeholder={t("displayPlaceholder")}
                    maxLength={60}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => remove(index)}
                    aria-label={tCommon("removeItem", { item: field.foodName })}
                    className="text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 aria-hidden="true" />
                  </Button>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-muted-foreground">{t("noIngredients")}</p>
          )}
          {ingredientsError ? (
            <p className="text-sm font-medium text-destructive">
              {messages.validation(ingredientsError)}
            </p>
          ) : null}

          <FoodPicker
            onPick={(food) => {
              setFoods((current) => ({
                ...current,
                [food.id]: { kcal: food.kcal, proteinG: food.proteinG },
              }));
              append({
                foodId: food.id,
                foodName: food.brand ? `${food.name} (${food.brand})` : food.name,
                quantityG: "100",
                displayQuantity: "",
                isOptional: false,
              });
            }}
          />

          {showPreview ? (
            <p
              className="rounded-control bg-surface-muted px-4 py-3 text-sm tabular-nums"
              role="status"
            >
              {t("preview", {
                kcal: Math.round(kcal / portions),
                protein: Math.round(protein / portions),
              })}
            </p>
          ) : null}
        </section>

        <Field id="steps" label={`${t("steps")} (${tCommon("optional")})`} hint={t("stepsHint")}>
          <textarea
            id="steps"
            rows={6}
            aria-describedby="steps-hint"
            className="min-h-32 rounded-control border border-border-strong bg-surface px-4 py-3 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
            {...form.register("steps")}
          />
        </Field>

        <Field id="tags" label={`${t("tags")} (${tCommon("optional")})`}>
          <Controller
            control={form.control}
            name="tags"
            render={({ field }) => (
              <TagInput
                id="tags"
                value={field.value}
                onChange={field.onChange}
                placeholder={t("tagsPlaceholder")}
                addLabel={tCommon("add")}
                removeLabel={(item) => tCommon("removeItem", { item })}
                maxItems={20}
              />
            )}
          />
        </Field>

        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton
          pending={pending}
          pendingLabel={tCommon("saving")}
          size="lg"
          className="self-start"
        >
          {submitLabel}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}

/** Erreur portée par la liste elle-même (« au moins un ingrédient »), pas par une ligne. */
function listError(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const root = (error as { root?: { message?: string }; message?: string }).root?.message;
  return root ?? (error as { message?: string }).message;
}
