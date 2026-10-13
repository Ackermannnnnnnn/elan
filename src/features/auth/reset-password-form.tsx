"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Field, fieldDescribedBy } from "@/components/ui/field";
import { PasswordInput } from "@/components/ui/password-input";
import { updatePassword } from "./actions";
import { resetPasswordSchema, type ResetPasswordValues } from "./schemas";

export function ResetPasswordForm() {
  const t = useTranslations("Auth");
  const messages = useFormMessages();
  const [formError, setFormError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Un message d'état ne doit pas réapparaître quand on revient sur la page
  // (Next.js conserve les pages quittées) : il est effacé dès qu'elle est masquée.
  useLayoutEffect(() => () => setFormError(null), []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ResetPasswordValues>({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { password: "", confirmPassword: "" },
  });

  const onSubmit = handleSubmit((values) => {
    if (pending) return;
    setFormError(null);
    startTransition(async () => {
      const result = await updatePassword(values);
      if (result.ok) return;
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof ResetPasswordValues, { message });
      }
      setFormError(result.formError ?? null);
    });
  });

  const passwordError = messages.validation(errors.password?.message);
  const confirmError = messages.validation(errors.confirmPassword?.message);
  const passwordHint = t("fields.passwordHint");
  const toggleLabels = {
    showLabel: t("fields.showPassword"),
    hideLabel: t("fields.hidePassword"),
  };

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}

      <Field
        id="password"
        label={t("fields.newPassword")}
        hint={passwordHint}
        error={passwordError}
      >
        <PasswordInput
          id="password"
          autoComplete="new-password"
          aria-invalid={Boolean(passwordError)}
          aria-describedby={fieldDescribedBy("password", {
            hint: passwordHint,
            error: passwordError,
          })}
          {...toggleLabels}
          {...register("password")}
        />
      </Field>

      <Field id="confirmPassword" label={t("fields.confirmPassword")} error={confirmError}>
        <PasswordInput
          id="confirmPassword"
          autoComplete="new-password"
          aria-invalid={Boolean(confirmError)}
          aria-describedby={fieldDescribedBy("confirmPassword", { error: confirmError })}
          {...toggleLabels}
          {...register("confirmPassword")}
        />
      </Field>

      <SubmitButton pending={pending} pendingLabel={t("reset.submitting")} size="lg">
        {t("reset.submit")}
      </SubmitButton>
    </form>
  );
}
