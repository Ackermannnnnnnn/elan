import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ROUTES, safeRedirectPath } from "@/config/routes";
import { importBarcodeAction } from "@/features/foods/actions";
import { BarcodeForm } from "@/features/foods/barcode-form";
import { newFoodUrl } from "@/features/nutrition/urls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Foods.scan");
  return { title: t("title") };
}

export default async function ScanPage({ searchParams }: PageProps<"/nutrition/foods/scan">) {
  const params = await searchParams;
  const requested = Array.isArray(params.return) ? params.return[0] : params.return;
  // On ne revient que vers l'ajout d'un repas ; toute autre destination est ignorée.
  const safe = safeRedirectPath(requested);
  const returnTo = requested && safe.startsWith(ROUTES.nutritionAdd) ? safe : undefined;
  const t = await getTranslations("Foods.scan");

  return (
    <>
      <Link
        href={returnTo ?? ROUTES.foods}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("back")}
      </Link>
      <PageHeader title={t("title")} lead={t("lead")} />
      <Card>
        <BarcodeForm
          action={importBarcodeAction.bind(null, returnTo ?? null)}
          newFoodHref={newFoodUrl(returnTo)}
        />
      </Card>
    </>
  );
}
