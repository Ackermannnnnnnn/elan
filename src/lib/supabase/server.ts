import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { connection } from "next/server";
import { requireSupabasePublicEnv } from "@/lib/env";
import type { Database } from "@/types/database";

/**
 * Client Supabase pour les Server Components, Server Actions et Route Handlers.
 * Il agit AU NOM de l'utilisateur connecté (session lue dans les cookies) :
 * toutes les requêtes passent par la Row Level Security.
 */
export async function createClient() {
  // Lire les cookies en premier : c'est ce qui signale à Next.js que ce code
  // dépend de la requête et ne doit pas être exécuté au moment du build.
  const cookieStore = await cookies();
  // La validité d'une session dépend de l'heure courante : ce code doit
  // s'exécuter à chaque requête, jamais dans un rendu anticipé mis en cache.
  await connection();
  const { url, publishableKey } = requireSupabasePublicEnv();

  return createServerClient<Database>(url, publishableKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Un Server Component ne peut pas écrire de cookie. Sans gravité :
          // `proxy.ts` rafraîchit la session avant chaque rendu.
        }
      },
    },
  });
}
