"use client";

import { useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import { UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { HABIT_KEYS, type HabitKey } from "@/domain/habits";
import { saveHabitSettingsAction } from "./actions";
import { habitSettingsSchema, type HabitSettingsFormValues } from "./schemas";

export type HabitSettingView = {
  key: HabitKey;
  active: boolean;
  target: number;
  available: boolean;
};

/** Choix des habitudes suivies et de leur objectif. */
export function HabitSettingsForm({ settings }: { settings: HabitSettingView[] }) {
  const t = useTranslations("Habits");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const byKey = new Map(settings.map((setting) => [setting.key, setting]));
  const { form, onSubmit, pending, formError, succeeded } = useActionForm({
    schema: habitSettingsSchema,
    defaultValues: Object.fromEntries(
      HABIT_KEYS.map((key) => {
        const setting = byKey.get(key);
        return [
          key,
          {
            active: setting?.active ?? false,
            target: String(setting?.target ?? "").replace(".", ","),
          },
        ];
      }),
    ) as HabitSettingsFormValues,
    action: saveHabitSettingsAction,
  });
  const values = form.watch();

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <ul className="flex flex-col divide-y divide-border">
          {HABIT_KEYS.map((key) => {
            const available = byKey.get(key)?.available ?? true;
            return (
              <li key={key} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-5 shrink-0 accent-primary"
                    disabled={!available}
                    {...form.register(`${key}.active`)}
                  />
                  <span>
                    <span className="block font-semibold">{t(`name.${key}`)}</span>
                    <span className="block text-sm text-muted-foreground">
                      {available ? t(`describe.${key}`) : t("settings.waterOff")}
                    </span>
                  </span>
                </label>
                {available && values[key]?.active ? (
                  <UnitField<HabitSettingsFormValues>
                    name={`${key}.target`}
                    id={`habit-target-${key}`}
                    label={t("settings.target")}
                    unit={t(`unit.${key}`)}
                    mode={key === "sleep" ? "decimal" : "numeric"}
                    className="ml-8 max-w-60"
                  />
                ) : null}
              </li>
            );
          })}
        </ul>
        <div className="flex flex-wrap items-center gap-3">
          <SubmitButton pending={pending} pendingLabel={tCommon("saving")}>
            {tCommon("save")}
          </SubmitButton>
          {succeeded ? (
            <p role="status" className="text-sm font-medium text-success">
              {tCommon("saved")}
            </p>
          ) : null}
        </div>
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
      </form>
    </FormProvider>
  );
}
