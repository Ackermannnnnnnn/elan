"use client";

import { Trash2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { FormProvider, useFormContext } from "react-hook-form";
import { TextField, useFieldError } from "@/components/forms/fields";
import { SubmitButton } from "@/components/forms/submit-button";
import { useActionForm } from "@/components/forms/use-action-form";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Field, fieldDescribedBy } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { deleteAccountAction } from "./actions";
import { DELETE_CONFIRMATION_WORD, deleteAccountSchema, type DeleteAccountValues } from "./schemas";

export function DeleteAccountForm() {
  const t = useTranslations("Account.delete");
  const messages = useFormMessages();
  const { form, onSubmit, pending, formError } = useActionForm({
    schema: deleteAccountSchema,
    defaultValues: { password: "", confirmation: "" },
    action: deleteAccountAction,
  });

  return (
    <FormProvider {...form}>
      <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
        <PasswordField label={t("password")} />
        <TextField<DeleteAccountValues>
          name="confirmation"
          label={t("confirmation", { word: DELETE_CONFIRMATION_WORD })}
          autoComplete="off"
        />
        {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}
        <SubmitButton
          pending={pending}
          pendingLabel={t("deleting")}
          variant="destructive"
          className="self-start"
        >
          <Trash2 aria-hidden="true" />
          {t("submit")}
        </SubmitButton>
      </form>
    </FormProvider>
  );
}

function PasswordField({ label }: { label: string }) {
  const tAuth = useTranslations("Auth");
  const error = useFieldError<DeleteAccountValues>("password");
  const { register } = useFormContext<DeleteAccountValues>();
  return (
    <Field id="delete-password" label={label} error={error}>
      <PasswordInput
        id="delete-password"
        autoComplete="current-password"
        showLabel={tAuth("fields.showPassword")}
        hideLabel={tAuth("fields.hidePassword")}
        aria-invalid={Boolean(error)}
        aria-describedby={fieldDescribedBy("delete-password", { error })}
        {...register("password")}
      />
    </Field>
  );
}
