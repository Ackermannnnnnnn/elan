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
import { updateProfile } from "./actions";
import { profileSchema, type ProfileValues } from "./schemas";

type Status = { kind: "idle" } | { kind: "saved" } | { kind: "error"; key: string };

export function IdentityForm({ displayName }: { displayName: string }) {
  const t = useTranslations("Profile.identity");
  const tAuth = useTranslations("Auth.fields");
  const messages = useFormMessages();
  const [status, setStatus] = useState<Status>({ kind: "idle" });
  const [pending, startTransition] = useTransition();

  // Un message d'état ne doit pas réapparaître quand on revient sur la page
  // (Next.js conserve les pages quittées) : il est effacé dès qu'elle est masquée.
  useLayoutEffect(() => () => setStatus({ kind: "idle" }), []);

  const {
    register,
    handleSubmit,
    setError,
    reset,
    formState: { errors, isDirty },
  } = useForm<ProfileValues>({
    resolver: zodResolver(profileSchema),
    defaultValues: { displayName },
  });

  const onSubmit = handleSubmit((values) => {
    if (pending) return;
    setStatus({ kind: "idle" });
    startTransition(async () => {
      const result = await updateProfile(values);
      if (result.ok) {
        reset({ displayName: values.displayName.trim() });
        setStatus({ kind: "saved" });
        return;
      }
      if (result.fieldErrors?.displayName) {
        setError("displayName", { message: result.fieldErrors.displayName });
      }
      if (result.formError) setStatus({ kind: "error", key: result.formError });
    });
  });

  const nameError = messages.validation(errors.displayName?.message);

  return (
    <form onSubmit={onSubmit} noValidate className="flex flex-col gap-4">
      <Field id="displayName" label={tAuth("displayName")} error={nameError}>
        <Input
          id="displayName"
          autoComplete="given-name"
          // Présent dès le HTML du serveur : le champ n'apparaît jamais vide
          // en attendant que le JavaScript soit chargé.
          defaultValue={displayName}
          aria-invalid={Boolean(nameError)}
          aria-describedby={fieldDescribedBy("displayName", { error: nameError })}
          {...register("displayName", { onChange: () => setStatus({ kind: "idle" }) })}
        />
      </Field>

      {status.kind === "saved" ? <Alert variant="success">{t("saved")}</Alert> : null}
      {status.kind === "error" ? <Alert variant="error">{messages.error(status.key)}</Alert> : null}

      <SubmitButton
        pending={pending}
        pendingLabel={t("saving")}
        className="self-start"
        disabled={!isDirty && !pending}
      >
        {t("save")}
      </SubmitButton>
    </form>
  );
}
