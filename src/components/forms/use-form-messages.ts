"use client";

import { useTranslations } from "next-intl";

/**
 * Traduit les clés d'erreur renvoyées par les schémas Zod (`Validation`) et
 * par les Server Actions (`Errors`). Une clé inconnue retombe sur un message
 * générique plutôt que d'afficher un identifiant technique.
 */
export function useFormMessages() {
  const tValidation = useTranslations("Validation");
  const tErrors = useTranslations("Errors");

  return {
    validation(key: string | undefined): string | undefined {
      if (!key) return undefined;
      return tValidation.has(key as never) ? tValidation(key as never) : tErrors("generic");
    },
    error(key: string | undefined | null): string | undefined {
      if (!key) return undefined;
      return tErrors.has(key as never) ? tErrors(key as never) : tErrors("generic");
    },
  };
}
