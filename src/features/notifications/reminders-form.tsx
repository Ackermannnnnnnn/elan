"use client";

import { useTranslations } from "next-intl";
import { FormProvider, get } from "react-hook-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { saveRemindersAction } from "./actions";
import { remindersSchema, type RemindersFormValues } from "./schemas";

export type ReminderView = {
  kind: "weigh_in" | "meal_log" | "workout" | "meal_prep";
  enabled: boolean;
  time: string;
  weekdays: number[];
};

const WEEKDAYS = ["1", "2", "3", "4", "5", "6", "7"] as const;

/** Les quatre rappels : activé, heure, jours de la semaine. */
export function RemindersForm({ reminders }: { reminders: ReminderView[] }) {
  const t = useTranslations("Notifications.reminders");
  const tDays = useTranslations("Notifications.weekday");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError, succeeded } = useActionForm({
    schema: remindersSchema,
    defaultValues: Object.fromEntries(
      reminders.map((reminder) => [
        reminder.kind,
        {
          enabled: reminder.enabled,
          time: reminder.time,
          weekdays: reminder.weekdays.map(String) as (typeof WEEKDAYS)[number][],
        },
      ]),
    ) as RemindersFormValues,
    action: saveRemindersAction,
  });
  const values = form.watch();

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <ul className="flex flex-col divide-y divide-border">
          {reminders.map(({ kind }) => {
            const enabled = values[kind]?.enabled ?? false;
            const daysError = messages.validation(
              (get(form.formState.errors, `${kind}.weekdays`) as { message?: string } | undefined)
                ?.message,
            );
            return (
              <li key={kind} className="flex flex-col gap-3 py-4 first:pt-0 last:pb-0">
                <label className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    className="mt-1 size-5 shrink-0 accent-primary"
                    {...form.register(`${kind}.enabled`)}
                  />
                  <span>
                    <span className="block font-semibold">{t(`${kind}.name`)}</span>
                    <span className="block text-sm text-muted-foreground">
                      {t(`${kind}.description`)}
                    </span>
                  </span>
                </label>
                {enabled ? (
                  <div className="ml-8 flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <label htmlFor={`reminder-${kind}-time`} className="text-sm font-medium">
                        {t("time")}
                      </label>
                      <Input
                        id={`reminder-${kind}-time`}
                        type="time"
                        className="w-40"
                        {...form.register(`${kind}.time`)}
                      />
                    </div>
                    <fieldset>
                      <legend className="mb-2 text-sm font-medium">{t("days")}</legend>
                      <div className="flex flex-wrap gap-1">
                        {WEEKDAYS.map((day) => (
                          <label
                            key={day}
                            className={cn(
                              "relative flex size-9 cursor-pointer items-center justify-center rounded-full border border-border-strong text-sm font-semibold transition-colors",
                              "has-checked:border-primary has-checked:bg-primary has-checked:text-primary-foreground",
                              "has-focus-visible:outline-2 has-focus-visible:outline-offset-2 has-focus-visible:outline-ring",
                            )}
                          >
                            <input
                              type="checkbox"
                              value={day}
                              className="sr-only"
                              aria-label={tDays(`long.${day}`)}
                              {...form.register(`${kind}.weekdays`)}
                            />
                            <span aria-hidden="true">{tDays(`short.${day}`)}</span>
                          </label>
                        ))}
                      </div>
                      {daysError ? (
                        <p className="mt-2 text-sm font-medium text-destructive">{daysError}</p>
                      ) : null}
                    </fieldset>
                  </div>
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
