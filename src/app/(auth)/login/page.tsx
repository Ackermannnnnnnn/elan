import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { Suspense } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { ROUTES } from "@/config/routes";
import { AuthHeading } from "@/features/auth/auth-heading";
import { AuthLink } from "@/features/auth/auth-link";
import { LoginForm } from "@/features/auth/login-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Auth.login");
  return { title: t("title") };
}

export default async function LoginPage() {
  const t = await getTranslations("Auth.login");

  return (
    <>
      <AuthHeading title={t("title")} subtitle={t("subtitle")} />
      {/* Le formulaire lit l'URL (?next=…) : il s'affiche dès que le navigateur la connaît. */}
      <Suspense fallback={<FormSkeleton />}>
        <LoginForm />
      </Suspense>
      <p className="mt-8 text-[0.9375rem] text-muted-foreground">
        {t("noAccount")} <AuthLink href={ROUTES.signup}>{t("signupLink")}</AuthLink>
      </p>
    </>
  );
}

function FormSkeleton() {
  return (
    <div className="flex flex-col gap-5">
      <Skeleton className="h-[4.75rem]" />
      <Skeleton className="h-[4.75rem]" />
      <Skeleton className="h-12" />
    </div>
  );
}
