import type { AuthError } from "@supabase/supabase-js";

/**
 * Traduit une erreur Supabase Auth en clé du namespace `Errors`.
 * On ne renvoie jamais le message brut de Supabase à l'utilisateur.
 */
export function authErrorKey(error: AuthError): string {
  // Aucune réponse HTTP : Supabase est injoignable (URL erronée, réseau coupé,
  // projet en pause). À distinguer d'un refus, qui porte toujours un statut.
  if (error.name === "AuthRetryableFetchError" || !error.status) return "serviceUnreachable";
  if (error.status === 429) return "tooManyAttempts";

  switch (error.code) {
    case "invalid_credentials":
      return "invalidCredentials";
    case "email_not_confirmed":
      return "emailNotConfirmed";
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return "tooManyAttempts";
    case "user_already_exists":
    case "email_exists":
    case "signup_disabled":
    case "email_address_invalid":
    case "email_address_not_authorized":
      return "signupUnavailable";
    case "weak_password":
      return "weakPassword";
    case "same_password":
      return "samePassword";
    case "session_not_found":
    case "session_expired":
    case "refresh_token_not_found":
      return "sessionExpired";
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
      return "linkInvalid";
    default:
      return "generic";
  }
}

/** Journalise une erreur d'authentification sans donnée personnelle. */
export function logAuthError(context: string, error: AuthError): void {
  console.error(`[auth] ${context}`, {
    name: error.name,
    code: error.code ?? null,
    status: error.status ?? null,
  });
}
