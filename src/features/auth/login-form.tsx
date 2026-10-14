"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { useLayoutEffect, useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { SubmitButton } from "@/components/forms/submit-button";
import { useFormMessages } from "@/components/forms/use-form-messages";
import { Alert } from "@/components/ui/alert";
import { Field, fieldDescribedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { PasswordInput } from "@/components/ui/password-input";
import { ROUTES } from "@/config/routes";
import { signIn } from "./actions";
import { AuthLink } from "./auth-link";
import { signInSchema, type SignInValues } from "./schemas";

export function LoginForm() {
  const t = useTranslations("Auth");
  const messages = useFormMessages();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? undefined;

  // Erreur transmise par une redirection (ex. lien de confirmation expiré) :
  // lue dans l'adresse, masquée dès le premier envoi du formulaire.
  const linkError = searchParams.get("error");
  const accountDeleted = searchParams.get("deleted") === "1";
  const [linkDismissed, setLinkDismissed] = useState(false);
  const [submitError, setFormError] = useState<string | null>(null);
  const formError = submitError ?? (linkDismissed ? null : linkError);
  const [pending, startTransition] = useTransition();

  // Un message d'état ne doit pas réapparaître quand on revient sur la page
  // (Next.js conserve les pages quittées) : il est effacé dès qu'elle est masquée.
  useLayoutEffect(() => () => setFormError(null), []);

  const {
    register,
    handleSubmit,
    setError,
    formState: { errors },
  } = useForm<SignInValues>({
    resolver: zodResolver(signInSchema),
    defaultValues: { email: "", password: "" },
  });

  const onSubmit = handleSubmit((values) => {
    if (pending) return;
    setFormError(null);
    setLinkDismissed(true);
    startTransition(async () => {
      const result = await signIn(values, next);
      if (result.ok) return;
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        setError(field as keyof SignInValues, { message });
      }
      setFormError(result.formError ?? null);
    });
  });

  const emailError = messages.validation(errors.email?.message);
  const passwordError = messages.validation(errors.password?.message);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-5">
      {accountDeleted && !formError ? (
        <Alert variant="success">{t("login.accountDeleted")}</Alert>
      ) : null}
      {formError ? <Alert variant="error">{messages.error(formError)}</Alert> : null}

      <Field id="email" label={t("fields.email")} error={emailError}>
        <Input
          id="email"
          type="email"
          inputMode="email"
          autoComplete="username"
          autoCapitalize="none"
          spellCheck={false}
          aria-invalid={Boolean(emailError)}
          aria-describedby={fieldDescribedBy("email", { error: emailError })}
          {...register("email")}
        />
      </Field>

      <Field
        id="password"
        label={t("fields.password")}
        error={passwordError}
        labelAction={
          <AuthLink href={ROUTES.forgotPassword} className="text-sm font-medium">
            {t("login.forgot")}
          </AuthLink>
        }
      >
        <PasswordInput
          id="password"
          autoComplete="current-password"
          showLabel={t("fields.showPassword")}
          hideLabel={t("fields.hidePassword")}
          aria-invalid={Boolean(passwordError)}
          aria-describedby={fieldDescribedBy("password", { error: passwordError })}
          {...register("password")}
        />
      </Field>

      <SubmitButton
        pending={pending}
        pendingLabel={t("login.submitting")}
        size="lg"
        className="mt-1"
      >
        {t("login.submit")}
      </SubmitButton>
    </form>
  );
}
