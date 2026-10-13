"use client";

import { useTranslations } from "next-intl";
import { useState } from "react";
import { Field } from "@/components/ui/field";
import { Select } from "@/components/ui/select";
import { updateFoodEntryAction, updateQuickEntryAction, updateRecipeEntryAction } from "./actions";
import { PortionsForm } from "./portions-form";
import { QuantityForm, type QuantityFood } from "./quantity-form";
import { QuickEntryForm } from "./quick-entry-form";
import type { PortionsFormValues, QuantityFormValues, QuickEntryFormValues } from "./schemas";

type Common = { entryId: string; categoryId: string; categories: { id: string; label: string }[] };
type Props =
  | (Common & { kind: "food"; food: QuantityFood; initial: QuantityFormValues })
  | (Common & { kind: "quick"; initial: QuickEntryFormValues })
  | (Common & {
      kind: "recipe";
      initial: PortionsFormValues;
      perServing: { kcal: number; proteinG: number };
    });

/** Modification d'une entrée du journal : repas de rattachement + quantité ou apports. */
export function EntryEditor(props: Props) {
  const t = useTranslations("Nutrition.edit");
  const [categoryId, setCategoryId] = useState(props.categoryId);

  return (
    <div className="flex flex-col gap-5">
      <Field id="entry-category" label={t("category")} className="sm:max-w-xs">
        <Select
          id="entry-category"
          value={categoryId}
          onChange={(event) => setCategoryId(event.target.value)}
        >
          {props.categories.map((category) => (
            <option key={category.id} value={category.id}>
              {category.label}
            </option>
          ))}
        </Select>
      </Field>

      {props.kind === "food" ? (
        <QuantityForm
          food={props.food}
          initial={props.initial}
          submitLabel={t("save")}
          action={(values) => updateFoodEntryAction(props.entryId, categoryId, values)}
        />
      ) : props.kind === "recipe" ? (
        <PortionsForm
          initial={props.initial}
          perServing={props.perServing}
          submitLabel={t("save")}
          action={(values) => updateRecipeEntryAction(props.entryId, categoryId, values)}
        />
      ) : (
        <QuickEntryForm
          initial={props.initial}
          submitLabel={t("save")}
          action={(values) => updateQuickEntryAction(props.entryId, categoryId, values)}
        />
      )}
    </div>
  );
}
