import { AuthError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import messages from "../../../messages/fr.json";
import { authErrorKey } from "./errors";

const error = (code: string, status = 400) =>
  new AuthError("message brut de Supabase", status, code);

describe("authErrorKey", () => {
  it.each([
    ["invalid_credentials", "invalidCredentials"],
    ["email_not_confirmed", "emailNotConfirmed"],
    ["over_email_send_rate_limit", "tooManyAttempts"],
    ["user_already_exists", "signupUnavailable"],
    ["weak_password", "weakPassword"],
    ["same_password", "samePassword"],
    ["otp_expired", "linkInvalid"],
    ["session_not_found", "sessionExpired"],
    ["code_inconnu", "generic"],
  ])("%s → %s", (code, key) => {
    expect(authErrorKey(error(code))).toBe(key);
  });

  it("traite tout statut 429 comme une limitation de débit", () => {
    expect(authErrorKey(error("unexpected_failure", 429))).toBe("tooManyAttempts");
  });

  it("ne renvoie que des clés traduites", () => {
    const codes = [
      "invalid_credentials",
      "email_not_confirmed",
      "over_request_rate_limit",
      "user_already_exists",
      "weak_password",
      "same_password",
      "session_expired",
      "otp_expired",
      "bad_code_verifier",
      "autre",
    ];
    for (const code of codes) {
      expect(Object.keys(messages.Errors)).toContain(authErrorKey(error(code)));
    }
  });
});
