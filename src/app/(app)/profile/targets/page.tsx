import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { getTargetsOn } from "@/data/plan";
import { getOwnProfile, getToday } from "@/data/profile";
import { CALORIE_FLOOR } from "@/domain/energy";
import { ManualTargetsForm } from "@/features/targets/manual-targets-form";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Targets.manual");
  return { title: t("title") };
}

export default async function TargetsPage() {
  const today = await getToday();
  const [profile, targets, t, tProfile] = await Promise.all([
    getOwnProfile(),
    getTargetsOn(today),
    getTranslations("Targets.manual"),
    getTranslations("Profile"),
  ]);

  return (
    <>
      <Link
        href={ROUTES.profile}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {tProfile("title")}
      </Link>
      <PageHeader title={t("title")} lead={t("lead")} />
      <Card>
        <ManualTargetsForm
          initial={{
            kcal: targets ? String(targets.target_kcal) : "",
            proteinG: targets ? String(targets.protein_g) : "",
            fatG: targets ? String(targets.fat_g) : "",
          }}
          floorKcal={CALORIE_FLOOR[profile?.sex ?? "unspecified"]}
          canReset={targets?.source === "manual"}
        />
      </Card>
    </>
  );
}
