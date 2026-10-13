import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { AuthHeading } from "@/features/auth/auth-heading";
import { ResetPasswordForm } from "@/features/auth/reset-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.reset");
  return { title: t("title") };
}

// Page atteinte depuis le lien reçu par e-mail : /auth/confirm a ouvert une
// session, et `proxy.ts` refuse l'accès sans session.
export default async function ResetPasswordPage() {
  const t = await getTranslations("Auth.reset");

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <ResetPasswordForm />
    </>
  );
}
