import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { ROUTES } from "@/config/routes";
import { AuthHeading } from "@/features/auth/auth-heading";
import { AuthLink } from "@/features/auth/auth-link";
import { SignupForm } from "@/features/auth/signup-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.signup");
  return { title: t("title") };
}

export default async function SignupPage() {
  const t = await getTranslations("Auth.signup");

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      <SignupForm />
      <p className="mt-8 text-[0.9375rem] text-muted-foreground">
        {t("hasAccount")} <AuthLink href={ROUTES.login}>{t("loginLink")}</AuthLink>
      </p>
    </>
  );
}
