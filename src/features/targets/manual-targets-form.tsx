"use client";

import { useFormatter, useTranslations } from "next-intl";
import { useTransition } from "react";
import { FormProvider, useWatch } from "react-hook-form";
import { UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { resetTargetsAction, saveManualTargetsAction } from "./actions";
import { carbsFromRemainder, manualTargetsSchema, type ManualTargetsFormValues } from "./schemas";

type Props = { initial: ManualTargetsFormValues; floorKcal: number; canReset: boolean };

export function ManualTargetsForm({ initial, floorKcal, canReset }: Props) {
  const t = useTranslations("Targets.manual");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: manualTargetsSchema,
    defaultValues: initial,
    action: saveManualTargetsAction,
  });
  const [resetting, startReset] = useTransition();

  // Aperçu en direct des glucides, calculés par la même fonction que sur le serveur.
  const [kcal, proteinG, fatG] = useWatch({
    control: form.control,
    name: ["kcal", "proteinG", "fatG"],
  });
  const parsed = manualTargetsSchema.safeParse({ kcal, proteinG, fatG });
  const carbs = parsed.success ? carbsFromRemainder(parsed.data) : null;

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <UnitField<ManualTargetsFormValues>
          name="kcal"
          label={t("kcal")}
          unit={tCommon("kcal")}
          mode="numeric"
          className="sm:max-w-xs"
        />
        <div className="grid gap-5 sm:grid-cols-3">
          <UnitField<ManualTargetsFormValues>
            name="proteinG"
            label={t("protein")}
            unit="g"
            mode="numeric"
          />
          <UnitField<ManualTargetsFormValues>
            name="fatG"
            label={t("fat")}
            unit="g"
            mode="numeric"
          />
          <div className="flex flex-col gap-2">
            <span className="text-sm font-semibold">{t("carbs")}</span>
            <output
              aria-live="polite"
              className="flex h-12 items-center rounded-control bg-surface-muted px-3.5 font-semibold tabular-nums"
            >
              {carbs === null ? "—" : `${format.number(carbs)} g`}
            </output>
          </div>
        </div>

        {formError === "targetsTooLow" ? (
          <Alert variant="error">{t("tooLow", { floor: format.number(floorKcal) })}</Alert>
        ) : formError ? (
          <Alert variant="error">{messages.error(formError)}</Alert>
        ) : null}

        <div className="flex flex-wrap gap-3">
          <SubmitButton pending={pending} pendingLabel={tCommon("saving")}>
            {t("save")}
          </SubmitButton>
          {canReset ? (
            <Button
              variant="ghost"
              aria-disabled={resetting}
              onClick={() => {
                if (!resetting) startReset(async () => void (await resetTargetsAction()));
              }}
            >
              {resetting ? t("resetting") : t("reset")}
            </Button>
          ) : null}
        </div>
      </form>
    </FormProvider>
  );
}
