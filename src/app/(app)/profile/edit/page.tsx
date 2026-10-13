import type { Metadata } from "next";
import { getTranslations } from "next-intl/server";
import { getToday } from "@/data/profile";
import { loadOnboardingValues } from "@/features/onboarding/initial-values";
import { OnboardingWizard } from "@/features/onboarding/onboarding-wizard";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Onboarding");
  return { title: t("editMeta") };
}

/** Modifier son profil = refaire le parcours, pré-rempli ; les cibles sont recalculées. */
export default async function EditProfilePage() {
  const [initialValues, today] = await Promise.all([loadOnboardingValues(), getToday()]);
  return (
    <div className="mx-auto max-w-2xl">
      <OnboardingWizard mode="edit" initialValues={initialValues} today={today} />
    </div>
  );
}
