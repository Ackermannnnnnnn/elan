"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Field, fieldDescribedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { requestPasswordReset } from "./actions";
import { forgotPasswordSchema, type ForgotPasswordValues } from "./schemas";

export function ForgotPasswordForm() {
  const t = useTranslations("Auth");
  const messages = useFormMessages();
  const [formError, setFormError] = useState<string | null>(null);
  const [sentTo, setSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Un message d'état ne doit pas réapparaître quand on revient sur la page
  // (Next.js conserve les pages quittées) : il est effacé dès qu'elle est masquée.
  useLayoutEffect(() => () => setFormError(null), []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  });

  const onSubmit = handleSubmit((values) => {
    if (pending) return;
    setFormError(null);
    startTransition(async () => {
      const result = await requestPasswordReset(values);
      if (result.ok) {
        setSentTo(values.email.trim());
        return;
      }
      if (result.fieldErrors?.email) setError("email", { message: result.fieldErrors.email });
      setFormError(result.formError ?? null);
    });
  });

  if (sentTo) {
    return (
      <Alert variant="success">
        <p className="font-semibold">{t("forgot.sentTitle")}</p>
        <p className="mt-1 font-normal">{t("forgot.sentBody", { email: sentTo })}</p>
      </Alert>
    );
  }

  const emailError = messages.validation(errors.email?.message);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}

      <Field id="email" label={t("fields.email")} error={emailError}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(emailError)}
          aria-describedby={fieldDescribedBy("email", { error: emailError })}
          {...register("email")}
        />
      </Field>

      <SubmitButton pending={pending} pendingLabel={t("forgot.submitting")} size="lg">
        {t("forgot.submit")}
      </SubmitButton>
    </form>
  );
}
