import { z } from "zod";

// Les messages sont des clés du namespace `Validation` (messages/fr.json).
// Les mêmes schémas valident le formulaire dans le navigateur ET l'action sur
// le serveur : la validation côté client n'est qu'un confort.

const email = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "required")
  .max(254, "emailInvalid")
  .pipe(z.email("emailInvalid"));

// Longueur plutôt que règles de composition (recommandation NIST SP 800-63B).
// 72 = limite de bcrypt, utilisé par Supabase Auth.
export const PASSWORD_MIN_LENGTH = 10;
const newPassword = z
  .string()
  .min(PASSWORD_MIN_LENGTH, "passwordTooShort")
  .max(72, "passwordTooLong");

export const displayName = z.string().trim().min(1, "required").max(60, "displayNameTooLong");

export const signInSchema = z.object({
  email,
  password: z.string().min(1, "required").max(72, "passwordTooLong"),
});

export const signUpSchema = z.object({
  displayName,
  email,
  password: newPassword,
});

export const forgotPasswordSchema = z.object({ email });

export const resetPasswordSchema = z
  .object({
    password: newPassword,
    confirmPassword: z.string().min(1, "required"),
  })
  .refine((values) => values.password === values.confirmPassword, {
    path: ["confirmPassword"],
    message: "passwordMismatch",
  });

export type SignInValues = z.infer<typeof signInSchema>;
export type SignUpValues = z.infer<typeof signUpSchema>;
export type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordValues = z.infer<typeof resetPasswordSchema>;
