import { getTranslations } from "next-intl/server";
import { Logo } from "@/components/brand/logo";
import { SignOutButton } from "@/features/auth/sign-out-button";

/** Mise en page dépouillée : pendant l'onboarding, rien ne détourne du parcours. */
export default async function OnboardingLayout({ children }: LayoutProps<"/onboarding">) {
  const t = await getTranslations("Auth");

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-2xl flex-col px-5 pt-6 pb-16 sm:px-8 sm:pt-10">
      <header className="mb-10 flex items-center justify-between gap-4">
        <Logo />
        <SignOutButton label={t("signOut")} pendingLabel={t("signingOut")} variant="ghost" />
      </header>
      <main className="flex-1">{children}</main>
    </div>
  );
}
