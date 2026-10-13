import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { ROUTES, safeRedirectPath } from "@/config/routes";
import { logAuthError } from "@/features/auth/errors";
import { createClient } from "@/lib/supabase/server";

const OTP_TYPES: readonly EmailOtpType[] = [
  "signup",
  "invite",
  "magiclink",
  "recovery",
  "email_change",
  "email",
];

function isOtpType(value: string | null): value is EmailOtpType {
  return value !== null && (OTP_TYPES as readonly string[]).includes(value);
}

/**
 * Destination des liens envoyés par e-mail (confirmation d'inscription,
 * réinitialisation du mot de passe). Deux formats sont acceptés :
 *   · ?token_hash=…&type=…  — modèle d'e-mail recommandé (fonctionne même si
 *     le lien est ouvert sur un autre appareil) ;
 *   · ?code=…               — modèle d'e-mail Supabase par défaut (PKCE).
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const code = searchParams.get("code");
  const next = safeRedirectPath(searchParams.get("next"));

  const supabase = await createClient();

  if (tokenHash && isOtpType(type)) {
    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });
    if (!error) {
      const destination = type === "recovery" ? ROUTES.resetPassword : next;
      return NextResponse.redirect(new URL(destination, request.url));
    }
    logAuthError("confirm.verifyOtp", error);
  } else if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(new URL(next, request.url));
    logAuthError("confirm.exchangeCode", error);
  }

  const login = new URL(ROUTES.login, request.url);
  login.searchParams.set("error", "linkInvalid");
  return NextResponse.redirect(login);
}
