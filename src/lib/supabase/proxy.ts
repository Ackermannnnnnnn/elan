import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { GUEST_ONLY_PATHS, PUBLIC_PATHS, ROUTES } from "@/config/routes";
import { recallVerified, rememberVerified, sessionKeyFrom } from "@/lib/auth/verified-sessions";
import { getSupabasePublicEnv } from "@/lib/env";
import { ONBOARDED_COOKIE, ONBOARDED_COOKIE_OPTIONS } from "@/lib/onboarding-cookie";
import type { Database } from "@/types/database";

/** Pages accessibles à un utilisateur connecté qui n'a pas terminé l'onboarding. */
const NO_ONBOARDING_CHECK: readonly string[] = [
  ROUTES.onboarding,
  ROUTES.resetPassword,
  ROUTES.authConfirm,
  ...PUBLIC_PATHS,
];

function matches(pathname: string, paths: readonly string[]): boolean {
  return paths.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * Exécuté avant chaque requête de page :
 *   1. rafraîchit la session Supabase et propage les cookies mis à jour ;
 *   2. renvoie les visiteurs non connectés vers la connexion ;
 *   3. évite aux utilisateurs connectés de revoir les pages de connexion.
 *
 * C'est un premier filtre pour l'ergonomie. La protection réelle des données
 * est assurée par la RLS et par `requireUser()` dans chaque page et action.
 */
export async function updateSession(request: NextRequest): Promise<NextResponse> {
  const { pathname } = request.nextUrl;
  const env = getSupabasePublicEnv();

  // Sans configuration, la seule page utile est celle qui explique quoi faire.
  if (!env) {
    if (pathname === ROUTES.setup) return NextResponse.next({ request });
    return NextResponse.redirect(new URL(ROUTES.setup, request.url));
  }
  if (pathname === ROUTES.setup) {
    return NextResponse.redirect(new URL(ROUTES.home, request.url));
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(env.url, env.publishableKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) request.cookies.set(name, value);
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // Session vérifiée il y a quelques secondes avec exactement ces cookies (et
  // loin de son expiration) : inutile de refaire l'appel réseau. Sinon, ne rien
  // exécuter entre la création du client et getClaims() : c'est cet appel qui
  // vérifie le jeton et rafraîchit la session si nécessaire.
  const sessionKey = sessionKeyFrom(request.cookies.getAll());
  let userId = recallVerified(sessionKey)?.id;
  if (!userId) {
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    userId = claims?.sub;
    if (claims?.sub) {
      rememberVerified(
        sessionKey,
        { id: claims.sub, email: typeof claims.email === "string" ? claims.email : null },
        claims.exp,
      );
    }
  }
  const isSignedIn = Boolean(userId);

  const redirectTo = (path: string, params?: Record<string, string>) => {
    const url = new URL(path, request.url);
    for (const [key, value] of Object.entries(params ?? {})) url.searchParams.set(key, value);
    const redirect = NextResponse.redirect(url);
    // Conserve les cookies de session éventuellement rafraîchis.
    for (const cookie of response.cookies.getAll()) redirect.cookies.set(cookie);
    return redirect;
  };

  if (!isSignedIn && !matches(pathname, PUBLIC_PATHS)) {
    const destination = pathname + request.nextUrl.search;
    return redirectTo(
      ROUTES.login,
      destination === ROUTES.home ? undefined : { next: destination },
    );
  }

  if (isSignedIn && matches(pathname, GUEST_ONLY_PATHS)) {
    return redirectTo(ROUTES.home);
  }

  // Tant que l'onboarding n'est pas terminé, l'espace privé mène à l'onboarding.
  // Vérifié en base une seule fois par navigateur, puis mémorisé dans un cookie.
  if (userId && !matches(pathname, NO_ONBOARDING_CHECK) && !request.cookies.has(ONBOARDED_COOKIE)) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("onboarding_completed_at")
      .eq("id", userId)
      .maybeSingle();
    if (!profile?.onboarding_completed_at) return redirectTo(ROUTES.onboarding);
    response.cookies.set(ONBOARDED_COOKIE, "1", ONBOARDED_COOKIE_OPTIONS);
  }

  return response;
}
