import "server-only";
import { unstable_rethrow } from "next/navigation";
import type { z } from "zod";
import { DataError } from "@/data/client";
import { withRequestScope } from "@/lib/auth/session";
import { fieldErrorsFromZod, type ActionResult } from "@/lib/action-result";

/**
 * Enveloppe commune des Server Actions : valide l'entrée avec Zod, exécute le
 * traitement, et convertit toute erreur en `ActionResult` traduisible.
 * Les redirections Next.js sont laissées remonter.
 */
export async function runAction<TSchema extends z.ZodType>(
  schema: TSchema,
  input: unknown,
  handler: (values: z.output<TSchema>) => Promise<ActionResult<string> | void>,
): Promise<ActionResult<string>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };

  try {
    return (await withRequestScope(() => handler(parsed.data))) ?? { ok: true };
  } catch (error) {
    unstable_rethrow(error);
    if (error instanceof DataError) return { ok: false, formError: error.key };
    console.error("[action] unexpected error", {
      name: error instanceof Error ? error.name : "unknown",
    });
    return { ok: false, formError: "generic" };
  }
}
