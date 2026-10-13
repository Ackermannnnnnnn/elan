import { createBrowserClient } from "@supabase/ssr";
import { requireSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/** Client Supabase pour les composants client. Soumis à la RLS de l'utilisateur. */
export function createClient() {
  const { url, publishableKey } = requireSupabasePublicEnv();
  return createBrowserClient<Database>(url, publishableKey);
}
