"use client";

import { useTranslations } from "next-intl";
import { FormProvider } from "react-hook-form";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { UnitField } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import type { ActionResult } from "@/lib/action-result";
import { discardSessionAction } from "./actions";
import { stopFor } from "./rest-timer-store";
import { type FinishFormValues, finishSchema, type NoteFormValues, noteSchema } from "./schemas";

/** Fin de séance : ressenti facultatif (1 à 10), séries non validées retirées. */
export function FinishForm({
  sessionId,
  action,
}: {
  sessionId: string;
  action: (values: FinishFormValues) => Promise<ActionResult<string>>;
}) {
  const t = useTranslations("Training.session");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: finishSchema,
    defaultValues: { perceivedEffort: "" },
    action: (values) => {
      // Plus de repos à décompter une fois la séance terminée.
      stopFor(sessionId);
      return action(values);
    },
  });
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
        <UnitField<FinishFormValues>
          name="perceivedEffort"
          label={t("effort")}
          hint={t("effortHint")}
          unit="/ 10"
          mode="numeric"
          className="sm:max-w-xs"
        />
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton
          pending={pending}
          pendingLabel={t("finishing")}
          size="lg"
          className="self-start"
        >
          {t("finish")}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}

export function DiscardSessionButton({ id }: { id: string }) {
  const t = useTranslations("Training.session");
  const tCommon = useTranslations("Common");
  return (
    <ConfirmButton
      label={t("discard")}
      confirmLabel={t("discardConfirm")}
      cancelLabel={tCommon("cancel")}
      pendingLabel={tCommon("deleting")}
      action={() => {
        stopFor(id);
        return discardSessionAction(id);
      }}
    />
  );
}

/** Note libre sur un exercice de la séance (réglage de machine, sensation…). */
export function NoteForm({
  action,
  defaultNote,
  idPrefix,
}: {
  action: (values: NoteFormValues) => Promise<ActionResult<string>>;
  defaultNote: string;
  idPrefix: string;
}) {
  const t = useTranslations("Training.session");
  const tCommon = useTranslations("Common");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError, succeeded } = useActionForm({
    schema: noteSchema,
    defaultValues: { note: defaultNote },
    action,
  });
  const id = `${idPrefix}-note`;
  const error = messages.validation(form.formState.errors.note?.message);
  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-2">
        <label htmlFor={id} className="text-sm font-semibold">
          {t("note")}
        </label>
        <textarea
          id={id}
          rows={2}
          maxLength={500}
          placeholder={t("notePlaceholder")}
          aria-invalid={Boolean(error)}
          className="rounded-control border border-border-strong bg-surface px-3 py-2 text-base focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring"
          {...form.register("note")}
        />
        {error ? <p className="text-xs font-medium text-destructive">{error}</p> : null}
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <div className="flex items-center gap-3">
          <SubmitButton
            pending={pending}
            pendingLabel={tCommon("saving")}
            variant="secondary"
            size="sm"
          >
            {t("saveNote")}
          </SubmitButton>
          {succeeded ? (
            <p role="status" className="text-sm text-muted-foreground">
              {tCommon("saved")}
            </p>
          ) : null}
        </div>
      </form>
    </FormProvider>
  );
}
