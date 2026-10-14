import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { ROUTES } from "@/config/routes";
import { createClient } from "@/lib/supabase/server";
import {
  forgetVerified,
  recallVerified,
  rememberVerified,
  sessionKeyFrom,
} from "./verified-sessions";

export type SessionUser = { id: string; email: string | null };

async function sessionKey(): Promise<string | null> {
  return sessionKeyFrom((await cookies()).getAll());
}

async function readSessionUser(): Promise<SessionUser | null> {
  const key = await sessionKey();
  if (!key) return null;
  const known = recallVerified(key);
  if (known) return known;

  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  const claims = data?.claims;
  if (error || !claims?.sub) return null;

  const user = {
    id: claims.sub,
    email: typeof claims.email === "string" ? claims.email : null,
  };
  rememberVerified(key, user, claims.exp);
  return user;
}

/** À la déconnexion : oublie immédiatement la session de ce navigateur. */
export async function forgetVerifiedSession(): Promise<void> {
  forgetVerified(await sessionKey());
}

/**
 * Portée d'une action serveur ou d'une route : `cache()` de React ne
 * fonctionne que pendant le rendu des pages. Sans cette portée, chaque accès
 * aux données d'une action revérifiait la session (jusqu'à un appel réseau
 * à Supabase Auth par requête). Voir `runAction`.
 */
const requestScope = new AsyncLocalStorage<{ user?: Promise<SessionUser | null> }>();

export function withRequestScope<T>(run: () => Promise<T>): Promise<T> {
  return requestScope.getStore() ? run() : requestScope.run({}, run);
}

/**
 * Utilisateur connecté, ou `null`. Le jeton est vérifié par `getClaims()`
 * (signature contrôlée), jamais lu tel quel dans le cookie.
 * Vérifié une seule fois par rendu (`cache()`) ou par action (`withRequestScope`).
 */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
  const store = requestScope.getStore();
  if (!store) return readSessionUser();
  store.user ??= readSessionUser();
  return store.user;
});

/** À appeler en tête de toute page ou action privée : redirige si non connecté. */
export async function requireUser(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect(ROUTES.login);
  return user;
}
