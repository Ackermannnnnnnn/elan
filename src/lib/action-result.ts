import type { z } from "zod";

/**
 * Résultat renvoyé par une Server Action à un formulaire.
 * Les messages sont des CLÉS de traduction (namespaces `Errors` et
 * `Validation`), jamais du texte : l'interface les traduit.
 */
export type ActionResult<TField extends string = string> =
  | { ok: true }
  | {
      ok: false;
      /** Clé du namespace `Errors`. */
      formError?: string;
      /** Clé du namespace `Validation`, par champ. */
      fieldErrors?: Partial<Record<TField, string>>;
    };

/** Convertit une erreur Zod en erreurs par champ (première erreur de chaque champ). */
export function fieldErrorsFromZod<TField extends string>(
  error: z.ZodError,
): Partial<Record<TField, string>> {
  const errors: Partial<Record<TField, string>> = {};
  for (const issue of error.issues) {
    const field = issue.path[0];
    if (typeof field === "string" && !(field in errors)) {
      errors[field as TField] = issue.message;
    }
  }
  return errors;
}
