import "server-only";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ROUTES } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";

export type SessionUser = { id: string; email: string | null };

/**
 * Utilisateur connecté, ou `null`. Le jeton est vérifié par `getClaims()`
 * (signature contrôlée), jamais lu tel quel dans le cookie.
 * `cache()` évite de refaire la vérification plusieurs fois par requête.
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  return {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
});

/** À appeler en tête de toute page ou action privée : redirige si non connecté. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(ROUTES.login);
  return user;
}
