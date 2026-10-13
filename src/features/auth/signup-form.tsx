"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { MailCheck } from "lucide-react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Field, fieldDescribedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ROUTES } from "@/config/routes";
import { signUp } from "./actions";
import { signUpSchema, type SignUpValues } from "./schemas";

export function SignupForm() {
  const t = useTranslations("Auth");
  const messages = useFormMessages();
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmationSentTo, setConfirmationSentTo] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Un message d'état ne doit pas réapparaître quand on revient sur la page
  // (Next.js conserve les pages quittées) : il est effacé dès qu'elle est masquée.
  useLayoutEffect(() => () => setFormError(null), []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignUpValues>({
    resolver: zodResolver(signUpSchema),
    defaultValues: { displayName: "", email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    if (pending) return;
    setFormError(null);
    startTransition(async () => {
      const result = await signUp(values);
      if (result.ok) {
        if ("needsEmailConfirmation" in result) setConfirmationSentTo(values.email.trim());
        return;
      }
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof SignUpValues, { message });
      }
      setFormError(result.formError ?? null);
    });
  });

  if (confirmationSentTo) {
    return (
      <div role="status" className="flex flex-col gap-4">
        <span className="flex size-12 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <MailCheck aria-hidden="true" className="size-6" />
        </span>
        <h2 className="text-xl font-semibold">{t("signup.checkInboxTitle")}</h2>
        <p className="text-muted-foreground">
          {t("signup.checkInboxBody", { email: confirmationSentTo })}
        </p>
        <p className="text-sm text-muted-foreground">{t("signup.checkInboxSpam")}</p>
        <Button asChild variant="secondary" className="mt-2 self-start">
          <Link href={ROUTES.login} prefetch={false}>
            {t("signup.backToLogin")}
          </Link>
        </Button>
      </div>
    );
  }

  const nameError = messages.validation(errors.displayName?.message);
  const emailError = messages.validation(errors.email?.message);
  const passwordError = messages.validation(errors.password?.message);
  const passwordHint = t("fields.passwordHint");

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}

      <Field id="displayName" label={t("fields.displayName")} error={nameError}>
        <Input
          id="displayName"
          autoComplete="given-name"
          aria-invalid={Boolean(nameError)}
          aria-describedby={fieldDescribedBy("displayName", { error: nameError })}
          {...register("displayName")}
        />
      </Field>

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

      <Field id="password" label={t("fields.password")} hint={passwordHint} error={passwordError}>
        <PasswordInput
          id="password"
          autoComplete="new-password"
          showLabel={t("fields.showPassword")}
          hideLabel={t("fields.hidePassword")}
          aria-invalid={Boolean(passwordError)}
          aria-describedby={fieldDescribedBy("password", {
            hint: passwordHint,
            error: passwordError,
          })}
          {...register("password")}
        />
      </Field>

      <p className="text-sm text-muted-foreground">{t("signup.dataNotice")}</p>

      <SubmitButton pending={pending} pendingLabel={t("signup.submitting")} size="lg">
        {t("signup.submit")}
      </SubmitButton>
    </form>
  );
}
