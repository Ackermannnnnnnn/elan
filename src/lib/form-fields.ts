import { z } from "zod";
import { isIsoDate } from "@/lib/dates";

/**
 * Briques Zod pour les champs de formulaire.
 * Les champs numériques arrivent sous forme de TEXTE (c'est ce que contient un
 * <input>) et acceptent la virgule décimale française : « 72,5 » vaut 72.5.
 * Les messages sont des clés du namespace `Validation`.
 */

const toNumber = (raw: string) => Number(raw.trim().replace(/\s/g, "").replace(",", "."));

type Range = { min: number; max: number; integer?: boolean };

/** Nombre obligatoire dans un intervalle. */
export function requiredNumber({ min, max, integer = false }: Range) {
  return z
    .string()
    .trim()
    .min(1, "required")
    .transform(toNumber)
    .pipe(
      integer
        ? z
            .number("numberInvalid")
            .int("integerRequired")
            .min(min, "numberTooLow")
            .max(max, "numberTooHigh")
        : z.number("numberInvalid").min(min, "numberTooLow").max(max, "numberTooHigh"),
    );
}

/** Nombre facultatif : un champ vide donne `null`. */
export function optionalNumber(range: Range) {
  return z
    .string()
    .trim()
    .transform((raw, context) => {
      if (raw === "") return null;
      const result = requiredNumber(range).safeParse(raw);
      if (result.success) return result.data;
      for (const issue of result.error.issues) {
        context.addIssue({ code: "custom", message: issue.message });
      }
      return z.NEVER;
    });
}

/** Jour civil AAAA-MM-JJ (valeur d'un <input type="date">). */
export const isoDate = z.string().refine(isIsoDate, "dateInvalid");

/** Liste d'étiquettes libres : nettoyée, dédoublonnée, bornée. */
export function tagList(maxItems: number, maxLength = 40) {
  return z
    .array(z.string())
    .transform((tags) => [
      ...new Set(tags.map((tag) => tag.trim().slice(0, maxLength)).filter((tag) => tag.length > 0)),
    ])
    .pipe(z.array(z.string()).max(maxItems, "tooManyItems"));
}

/** Fuseau horaire IANA valide, sinon celui par défaut. */
export function timeZoneOr(fallback: string) {
  return z
    .string()
    .max(64)
    .transform((value) => {
      try {
        new Intl.DateTimeFormat("fr", { timeZone: value });
        return value;
      } catch {
        return fallback;
      }
    })
    .catch(fallback);
}
