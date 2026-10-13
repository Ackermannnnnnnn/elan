import "server-only";
import { headers } from "next/headers";

/**
 * Origine publique de l'application (sans barre finale), utilisée pour
 * construire les liens envoyés par e-mail. Supabase n'accepte de toute façon
 * que les URL de redirection déclarées dans son tableau de bord.
 */
export async function getSiteUrl(): Promise<string> {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/+$/, "");

  const requestHeaders = await headers();
  const origin = requestHeaders.get("origin");
  if (origin) return origin;

  const host = requestHeaders.get("x-forwarded-host") ?? requestHeaders.get("host");
  const protocol = requestHeaders.get("x-forwarded-proto") ?? "https";
  return `${protocol}://${host ?? "localhost:3000"}`;
}
