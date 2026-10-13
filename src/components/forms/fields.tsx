"use client";

import type { ComponentProps, ReactNode } from "react";
import { get, useFormContext, type FieldValues, type Path } from "react-hook-form";
import { Field, fieldDescribedBy } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { UnitInput } from "@/components/ui/unit-input";
import { useFormMessages } from "./use-form-messages";

/** Message d'erreur traduit d'un champ du formulaire courant. */
export function useFieldError<T extends FieldValues>(name: Path<T>): string | undefined {
  const {
    formState: { errors },
  } = useFormContext<T>();
  const messages = useFormMessages();
  const message = (get(errors, name) as { message?: string } | undefined)?.message;
  return messages.validation(message);
}

type BaseProps<T extends FieldValues> = {
  name: Path<T>;
  /** Identifiant HTML (par défaut : le nom) — à préciser si le formulaire est répété. */
  id?: string;
  label: string;
  hint?: string;
  labelAction?: ReactNode;
  className?: string;
};

/** Champ numérique avec unité, relié au formulaire (libellé, aide, erreur, ARIA). */
export function UnitField<T extends FieldValues>({
  name,
  id,
  label,
  hint,
  unit,
  mode,
  className,
  labelAction,
  ...inputProps
}: BaseProps<T> & { unit: string; mode?: "decimal" | "numeric" } & Pick<
    ComponentProps<"input">,
    "placeholder" | "autoFocus"
  >) {
  const { register } = useFormContext<T>();
  const error = useFieldError<T>(name);
  const fieldId = id ?? name;
  return (
    <Field
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      className={className}
      labelAction={labelAction}
    >
      <UnitInput
        id={fieldId}
        unit={unit}
        mode={mode}
        aria-invalid={Boolean(error)}
        aria-describedby={fieldDescribedBy(fieldId, { hint, error })}
        {...inputProps}
        {...register(name)}
      />
    </Field>
  );
}

/** Champ texte ou date relié au formulaire. */
export function TextField<T extends FieldValues>({
  name,
  id,
  label,
  hint,
  className,
  labelAction,
  ...inputProps
}: BaseProps<T> &
  Pick<
    ComponentProps<"input">,
    "type" | "placeholder" | "autoComplete" | "max" | "min" | "maxLength"
  >) {
  const { register } = useFormContext<T>();
  const error = useFieldError<T>(name);
  const fieldId = id ?? name;
  return (
    <Field
      id={fieldId}
      label={label}
      hint={hint}
      error={error}
      className={className}
      labelAction={labelAction}
    >
      <Input
        id={fieldId}
        aria-invalid={Boolean(error)}
        aria-describedby={fieldDescribedBy(fieldId, { hint, error })}
        {...inputProps}
        {...register(name)}
      />
    </Field>
  );
}
