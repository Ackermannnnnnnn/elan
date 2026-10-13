"use client";

import { useFormatter, useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import { UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Card, CardTitle } from "@/components/ui/card";
import { saveStepsAction } from "./actions";
import { stepsSchema, type StepsFormValues } from "./schemas";

/** Pas du jour, saisis à la main (la synchronisation avec un téléphone viendra plus tard). */
export function StepsCard({ steps, goal }: { steps: number | null; goal: number | null }) {
  const t = useTranslations("Home.steps");
  const tCommon = useTranslations("Common");
  const format = useFormatter();
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError, succeeded } = useActionForm({
    schema: stepsSchema,
    defaultValues: { steps: steps === null ? "" : String(steps) },
    action: saveStepsAction,
  });

  return (
    <Card>
      <div className="flex items-baseline justify-between gap-3">
        <CardTitle>{t("title")}</CardTitle>
        <p className="font-semibold tabular-nums">
          {steps === null ? (
            <span className="font-normal text-muted-foreground">{t("none")}</span>
          ) : (
            <>
              {format.number(steps)}
              {goal ? (
                <span className="font-normal text-muted-foreground">
                  {" "}
                  {t("goal", { target: format.number(goal) })}
                </span>
              ) : null}
            </>
          )}
        </p>
      </div>
      <FormProvider {...form}>
        <form onSubmit={onSubmit} noValidate className="mt-4 flex items-end gap-2">
          <UnitField<StepsFormValues>
            name="steps"
            label={t("label")}
            unit="pas"
            mode="numeric"
            className="flex-1"
          />
          <SubmitButton
            pending={pending}
            pendingLabel={tCommon("saving")}
            variant="secondary"
            size="lg"
          >
            {t("save")}
          </SubmitButton>
        </form>
      </FormProvider>
      {succeeded ? (
        <p role="status" className="mt-2 text-sm font-medium text-success">
          {tCommon("saved")}
        </p>
      ) : null}
      {formError ? (
        <Alert variant="error" className="mt-3">
          {messages.error(formError)}
        </Alert>
      ) : null}
    </Card>
  );
}
