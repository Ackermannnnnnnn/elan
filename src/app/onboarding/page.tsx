import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { ROUTES } from "@/config/routes";
import { getOwnProfile, getToday } from "@/data/profile";
import { loadOnboardingValues } from "@/features/onboarding/initial-values";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Onboarding");
  return { title: t("meta") };
}

export default async function OnboardingPage() {
  // `getOwnProfile` vérifie la session ; un visiteur non connecté est redirigé.
  const profile = await getOwnProfile();
  if (profile?.onboarding_completed_at) redirect(ROUTES.home);

  const [initialValues, today] = await Promise.all([loadOnboardingValues(), getToday()]);
  return <OnboardingWizard mode="create" initialValues={initialValues} today={today} />;
}
