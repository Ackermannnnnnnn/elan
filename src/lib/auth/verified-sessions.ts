import { createHash } from "node:crypto";

/**
 * Sessions déjà vérifiées, pour quelques secondes. Avec une clé de signature
 * « historique » (HS256), Supabase ne peut pas vérifier le jeton localement :
 * chaque vérification est un appel réseau à Supabase Auth, et un même clic en
 * demandait plusieurs (filtre d'entrée, action, rendu de la page).
 *
 * La clé est l'empreinte EXACTE des cookies de session : un autre jeton, une
 * autre session ou un jeton rafraîchi n'en profitent jamais. Seul un succès
 * est mémorisé, au plus 20 secondes, et jamais dans les 2 dernières minutes
 * de validité du jeton (pour que son rafraîchissement ait lieu normalement).
 */
const TTL_MS = 20_000;
const REFRESH_MARGIN_MS = 120_000;
const MAX_ENTRIES = 1000;

export type VerifiedUser = { id: string; email: string | null };

const verified = new Map<string, { until: number; user: VerifiedUser }>();

export function sessionKeyFrom(cookies: readonly { name: string; value: string }[]): string | null {
  const auth = cookies
    .filter((cookie) => cookie.name.startsWith("sb-") && cookie.name.includes("-auth-token"))
    .sort((a, b) => a.name.localeCompare(b.name))
    .map((cookie) => `${cookie.name}=${cookie.value}`);
  if (auth.length === 0) return null;
  return createHash("sha256").update(auth.join("\n")).digest("hex");
}

export function recallVerified(key: string | null, now = Date.now()): VerifiedUser | null {
  if (!key) return null;
  const known = verified.get(key);
  if (!known) return null;
  if (known.until <= now) {
    verified.delete(key);
    return null;
  }
  return known.user;
}

/** `expiresAt` : expiration du jeton (secondes depuis 1970, champ `exp`). */
export function rememberVerified(
  key: string | null,
  user: VerifiedUser,
  expiresAt: unknown,
  now = Date.now(),
) {
  if (!key || typeof expiresAt !== "number") return;
  const until = Math.min(now + TTL_MS, expiresAt * 1000 - REFRESH_MARGIN_MS);
  if (until <= now) return;
  if (verified.size >= MAX_ENTRIES) {
    for (const [entry, value] of verified) if (value.until <= now) verified.delete(entry);
    if (verified.size >= MAX_ENTRIES) verified.clear();
  }
  verified.set(key, { until, user });
}

export function forgetVerified(key: string | null) {
  if (key) verified.delete(key);
}
