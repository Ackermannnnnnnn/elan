import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ROUTES } from "@/config/routes";
import { AuthHeading } from "@/features/auth/auth-heading";
import { AuthLink } from "@/features/auth/auth-link";
import { ForgotPasswordForm } from "@/features/auth/forgot-password-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.forgot");
  return { title: t("title") };
}

export default async function ForgotPasswordPage() {
  const t = await getTranslations("Auth.forgot");

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <ForgotPasswordForm />
      <p className="mt-8 text-[0.9375rem]">
        <AuthLink href={ROUTES.login}>{t("backToLogin")}</AuthLink>
      </p>
    </>
  );
}
