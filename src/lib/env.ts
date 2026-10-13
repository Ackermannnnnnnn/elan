/**
 * Variables d'environnement PUBLIQUES (préfixe NEXT_PUBLIC_, visibles dans le
 * navigateur). Les secrets vivent dans `env.server.ts` et ne sont jamais
 * importés côté client.
 *
 * Next.js n'injecte ces valeurs que si elles sont écrites en toutes lettres :
 * pas d'accès dynamique du type process.env[nom].
 */
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabasePublishableKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

export type SupabasePublicEnv = { url: string; publishableKey: string };

function isHttpUrl(value: string | undefined): value is string {
  if (!value) return false;
  try {
    const { protocol } = new URL(value);
    return protocol === "https:" || protocol === "http:";
  } catch {
    return false;
  }
}

export type EnvStatus = "ok" | "missing" | "placeholder" | "invalid";

/** Les valeurs de `.env.example` recopiées telles quelles ne sont pas une configuration. */
function urlStatus(value: string | undefined): EnvStatus {
  if (!value) return "missing";
  if (!isHttpUrl(value)) return "invalid";
  if (new URL(value).hostname.startsWith("votre-projet.")) return "placeholder";
  return "ok";
}

function keyStatus(value: string | undefined): EnvStatus {
  if (!value) return "missing";
  if (/x{8,}/i.test(value)) return "placeholder";
  return "ok";
}

/** État de chaque variable, pour expliquer précisément ce qui manque. */
export function getSupabaseEnvStatus(): { url: EnvStatus; publishableKey: EnvStatus } {
  return { url: urlStatus(supabaseUrl), publishableKey: keyStatus(supabasePublishableKey) };
}

/** Renvoie la configuration Supabase, ou `null` si elle est absente, invalide ou d'exemple. */
export function getSupabasePublicEnv(): SupabasePublicEnv | null {
  const status = getSupabaseEnvStatus();
  if (status.url !== "ok" || status.publishableKey !== "ok") return null;
  return { url: supabaseUrl as string, publishableKey: supabasePublishableKey as string };
}

export function isSupabaseConfigured(): boolean {
  return getSupabasePublicEnv() !== null;
}

/** Variante stricte pour le code qui ne s'exécute qu'une fois Supabase configuré. */
export function requireSupabasePublicEnv(): SupabasePublicEnv {
  const env = getSupabasePublicEnv();
  if (!env) {
    throw new Error(
      "Supabase n'est pas configuré : renseigner NEXT_PUBLIC_SUPABASE_URL et " +
        "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY dans .env.local (voir .env.example).",
    );
  }
  return env;
}
