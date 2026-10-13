"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useLayoutEffect, useState, useTransition } from "react";
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type Resolver,
} from "react-hook-form";
import type { z } from "zod";
import type { ActionResult } from "@/lib/action-result";

type Options<TSchema extends z.ZodType<FieldValues, FieldValues>> = {
  schema: TSchema;
  defaultValues: DefaultValues<z.input<TSchema>>;
  /** Action serveur : elle reçoit les valeurs BRUTES et les revalide elle-même. */
  action: (values: z.input<TSchema>) => Promise<ActionResult<string>>;
  onSuccess?: (values: z.output<TSchema>) => void;
  /** Vide le formulaire après un envoi réussi (formulaires d'ajout). */
  resetOnSuccess?: boolean;
};

/**
 * Câblage commun des formulaires : validation Zod dans le navigateur, envoi à
 * une action serveur, report des erreurs par champ et de l'erreur globale.
 */
export function useActionForm<TSchema extends z.ZodType<FieldValues, FieldValues>>({
  schema,
  defaultValues,
  action,
  onSuccess,
  resetOnSuccess = false,
}: Options<TSchema>) {
  type Input = z.input<TSchema>;
  type Output = z.output<TSchema>;

  const form = useForm<Input, unknown, Output>({
    // Le lien entre un schéma générique et ses types d'entrée/sortie dépasse ce
    // que l'inférence de zodResolver sait exprimer : conversion explicite, une seule fois ici.
    resolver: zodResolver(schema) as unknown as Resolver<Input, unknown, Output>,
    defaultValues,
  });
  const [formError, setFormError] = useState<string | null>(null);
  const [succeeded, setSucceeded] = useState(false);
  const [pending, startTransition] = useTransition();

  // Next.js conserve les pages quittées (masquées) pour les restaurer telles
  // quelles. Un brouillon de saisie doit survivre, pas un « Enregistré. » ou
  // une erreur d'il y a dix minutes : on les efface quand la page est masquée.
  useLayoutEffect(
    () => () => {
      setSucceeded(false);
      setFormError(null);
    },
    [],
  );

  const onSubmit = form.handleSubmit((parsed) => {
    if (pending) return;
    setFormError(null);
    setSucceeded(false);
    const raw = form.getValues();
    startTransition(async () => {
      const result = await action(raw);
      if (result.ok) {
        if (resetOnSuccess) form.reset(defaultValues);
        else form.reset(raw);
        setSucceeded(true);
        onSuccess?.(parsed);
        return;
      }
      for (const [field, message] of Object.entries(result.fieldErrors ?? {})) {
        if (message) form.setError(field as Path<Input>, { message });
      }
      setFormError(result.formError ?? null);
    });
  });

  return {
    form,
    onSubmit,
    pending,
    /** Clé du namespace `Errors`, ou `null`. */
    formError,
    succeeded,
    clearStatus: () => {
      setSucceeded(false);
      setFormError(null);
    },
  };
}
