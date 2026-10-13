"use server";

import { revalidatePath } from "next/cache";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ROUTES, safeRedirectPath } from "@/config/routes";
import { fieldErrorsFromZod, type ActionResult } from "@/lib/action-result";
import { ONBOARDED_COOKIE } from "@/lib/onboarding-cookie";
import { getSiteUrl } from "@/lib/site-url";
import { createClient } from "@/lib/supabase/server";
import { authErrorKey, logAuthError } from "./errors";
import {
  forgotPasswordSchema,
  resetPasswordSchema,
  signInSchema,
  signUpSchema,
  type ForgotPasswordValues,
  type ResetPasswordValues,
  type SignInValues,
  type SignUpValues,
} from "./schemas";

// Une Server Action est un point d'entrée HTTP public : chaque action revalide
// ses entrées avec Zod, quel que soit ce que le formulaire a déjà vérifié.

export async function signIn(
  input: SignInValues,
  next?: string,
): Promise<ActionResult<keyof SignInValues>> {
  const parsed = signInSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) {
    logAuthError("signIn", error);
    return { ok: false, formError: authErrorKey(error) };
  }

  revalidatePath("/", "layout");
  redirect(safeRedirectPath(next));
}

export type SignUpResult =
  ActionResult<keyof SignUpValues> | { ok: true; needsEmailConfirmation: true };

export async function signUp(input: SignUpValues): Promise<SignUpResult> {
  const parsed = signUpSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };

  const { displayName, email, password } = parsed.data;
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      // Repris par le déclencheur SQL qui crée la ligne `profiles`.
      data: { display_name: displayName },
      emailRedirectTo: `${await getSiteUrl()}${ROUTES.authConfirm}`,
    },
  });

  if (error) {
    logAuthError("signUp", error);
    if (error.code === "weak_password") {
      return {
        ok: false,
        fieldErrors: { password: "passwordTooShort" },
        formError: "weakPassword",
      };
    }
    return { ok: false, formError: authErrorKey(error) };
  }

  // Confirmation par e-mail désactivée côté Supabase : la session existe déjà.
  if (data.session) {
    revalidatePath("/", "layout");
    redirect(ROUTES.home);
  }

  // Sinon, même réponse que l'adresse soit nouvelle ou déjà inscrite : on ne
  // révèle pas quels e-mails possèdent un compte.
  return { ok: true, needsEmailConfirmation: true };
}

export async function requestPasswordReset(
  input: ForgotPasswordValues,
): Promise<ActionResult<keyof ForgotPasswordValues>> {
  const parsed = forgotPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };

  const supabase = await createClient();
  const confirmUrl = new URL(`${await getSiteUrl()}${ROUTES.authConfirm}`);
  confirmUrl.searchParams.set("next", ROUTES.resetPassword);

  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: confirmUrl.toString(),
  });

  if (error) {
    logAuthError("requestPasswordReset", error);
    // Seule la limitation de débit est signalée ; le reste ne doit pas
    // permettre de deviner si l'adresse correspond à un compte.
    if (authErrorKey(error) === "tooManyAttempts") {
      return { ok: false, formError: "tooManyAttempts" };
    }
  }
  return { ok: true };
}

export async function updatePassword(
  input: ResetPasswordValues,
): Promise<ActionResult<keyof ResetPasswordValues>> {
  const parsed = resetPasswordSchema.safeParse(input);
  if (!parsed.success) return { ok: false, fieldErrors: fieldErrorsFromZod(parsed.error) };

  const supabase = await createClient();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims?.sub) return { ok: false, formError: "sessionExpired" };

  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) {
    logAuthError("updatePassword", error);
    return { ok: false, formError: authErrorKey(error) };
  }

  revalidatePath("/", "layout");
  redirect(ROUTES.home);
}

export async function signOut(): Promise<void> {
  const supabase = await createClient();
  const { error } = await supabase.auth.signOut();
  if (error) logAuthError("signOut", error);
  // Le prochain compte utilisé sur ce navigateur sera vérifié à nouveau.
  (await cookies()).delete(ONBOARDED_COOKIE);

  revalidatePath("/", "layout");
  redirect(ROUTES.login);
}
