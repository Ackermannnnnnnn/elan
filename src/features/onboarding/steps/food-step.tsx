"use client";

import { useTranslations } from "next-intl";
import { Controller, useFormContext, type Path } from "react-hook-form";
import { UnitField } from "@/components/forms/fields";
import { ChoiceChip, ChoiceGroup } from "@/components/ui/choice";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { TagInput } from "@/components/ui/tag-input";
import {
  COOKING_SKILLS,
  DIET_TYPES,
  EU_ALLERGENS,
  KITCHEN_EQUIPMENT,
  MEAL_STYLES,
} from "../options";
import type { OnboardingFormValues } from "../schema";

type TagFieldName = Extract<
  Path<OnboardingFormValues>,
  "otherAllergies" | "intolerances" | "excludedIngredients" | "likedFoods" | "dislikedFoods"
>;

export function FoodStep() {
  const t = useTranslations("Onboarding.food");
  const tOptions = useTranslations("Options");
  const tCommon = useTranslations("Common");
  const { register, control } = useFormContext<OnboardingFormValues>();

  const tagField = (name: TagFieldName, label: string, hint?: string, maxItems = 40) => (
    <Field id={name} label={`${label} (${tCommon("optional")})`} hint={hint}>
      <Controller
        control={control}
        name={name}
        render={({ field }) => (
          <TagInput
            id={name}
            value={field.value}
            onChange={field.onChange}
            placeholder={t("tagPlaceholder")}
            addLabel={tCommon("add")}
            removeLabel={(item) => tCommon("removeItem", { item })}
            maxItems={maxItems}
          />
        )}
      />
    </Field>
  );

  return (
    <div className="flex flex-col gap-7">
      <Field id="dietType" label={t("dietType")} className="sm:max-w-[calc(50%-0.625rem)]">
        <Select id="dietType" {...register("dietType")}>
          {DIET_TYPES.map((option) => (
            <option key={option} value={option}>
              {tOptions(`dietType.${option}`)}
            </option>
          ))}
        </Select>
      </Field>

      <ChoiceGroup
        legend={t("allergies")}
        hint={t("allergiesHint")}
        className="flex flex-wrap gap-2"
      >
        {EU_ALLERGENS.map((option) => (
          <ChoiceChip
            key={option}
            label={tOptions(`allergen.${option}`)}
            value={option}
            {...register("allergies")}
          />
        ))}
      </ChoiceGroup>

      {tagField("otherAllergies", t("otherAllergies"), undefined, 20)}
      {tagField("intolerances", t("intolerances"))}
      {tagField("excludedIngredients", t("excluded"), t("excludedHint"), 60)}
      {tagField("likedFoods", t("liked"), undefined, 100)}
      {tagField("dislikedFoods", t("disliked"), undefined, 100)}

      <div className="grid gap-5 sm:grid-cols-2">
        <UnitField<OnboardingFormValues>
          name="mealsPerDay"
          label={t("meals")}
          unit="/ jour"
          mode="numeric"
        />
        <UnitField<OnboardingFormValues>
          name="snacksPerDay"
          label={t("snacks")}
          unit="/ jour"
          mode="numeric"
        />
        <UnitField<OnboardingFormValues>
          name="weeklyFoodBudgetEur"
          label={`${t("budget")} (${tCommon("optional")})`}
          unit="€"
        />
        <UnitField<OnboardingFormValues>
          name="cookingTimeMinutes"
          label={t("cookingTime")}
          unit={tCommon("minutes")}
          mode="numeric"
        />
      </div>

      <Field id="cookingSkill" label={t("cookingSkill")} className="sm:max-w-[calc(50%-0.625rem)]">
        <Select id="cookingSkill" {...register("cookingSkill")}>
          {COOKING_SKILLS.map((option) => (
            <option key={option} value={option}>
              {tOptions(`cookingSkill.${option}`)}
            </option>
          ))}
        </Select>
      </Field>

      <label className="flex cursor-pointer items-center gap-3 font-medium">
        <input
          type="checkbox"
          className="size-5 shrink-0 accent-(--primary)"
          {...register("mealPrep")}
        />
        {t("mealPrep")}
      </label>

      <ChoiceGroup
        legend={`${t("mealStyle")} (${tCommon("optional")})`}
        className="flex flex-wrap gap-2"
      >
        {MEAL_STYLES.map((option) => (
          <ChoiceChip
            key={option}
            label={tOptions(`mealStyle.${option}`)}
            value={option}
            {...register("mealStyle")}
          />
        ))}
      </ChoiceGroup>

      <ChoiceGroup legend={t("kitchen")} className="flex flex-wrap gap-2">
        {KITCHEN_EQUIPMENT.map((option) => (
          <ChoiceChip
            key={option}
            label={tOptions(`kitchenEquipment.${option}`)}
            value={option}
            {...register("kitchenEquipment")}
          />
        ))}
      </ChoiceGroup>
    </div>
  );
}
