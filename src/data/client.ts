import "server-only";
import { requireUser, type SessionUser } from "@/lib/auth/session";
import { createClient } from "@/lib/supabase/server";

/**
 * Erreur de la couche de données. `key` est une clé du namespace `Errors` :
 * l'interface l'affiche traduite, le détail technique reste dans les journaux.
 */
export class DataError extends Error {
  constructor(
    readonly key: string,
    options?: { cause?: unknown },
  ) {
    super(key, options);
    this.name = "DataError";
  }
}

/**
 * Point d'entrée unique vers la base : vérifie la session PUIS renvoie le
 * client Supabase. Toute lecture ou écriture passe par ici, donc par la RLS,
 * et l'identité vient toujours de la session, jamais d'un paramètre.
 */
export async function getDb(): Promise<{
  supabase: Awaited<ReturnType<typeof createClient>>;
  user: SessionUser;
}> {
  const user = await requireUser();
  const supabase = await createClient();
  return { supabase, user };
}

/** Journalise sans donnée personnelle, puis lève une erreur traduisible. */
export function fail(
  context: string,
  error: { code?: string; message?: string },
  key = "generic",
): never {
  console.error(`[data] ${context}`, { code: error.code ?? null });
  throw new DataError(key, { cause: error });
}
