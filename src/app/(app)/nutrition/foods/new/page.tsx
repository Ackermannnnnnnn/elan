import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ROUTES, safeRedirectPath } from "@/config/routes";
import { createFoodAction } from "@/features/nutrition/actions";
import { FoodForm } from "@/features/nutrition/food-form";
import { EMPTY_FOOD } from "@/features/nutrition/schemas";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nutrition.foods");
  return { title: t("newTitle") };
}

export default async function NewFoodPage({ searchParams }: PageProps<"/nutrition/foods/new">) {
  const params = await searchParams;
  const requested = Array.isArray(params.return) ? params.return[0] : params.return;
  // On ne revient que vers l'ajout d'un repas ; toute autre destination est ignorée.
  const safe = safeRedirectPath(requested);
  const returnTo = requested && safe.startsWith(ROUTES.nutritionAdd) ? safe : undefined;
  const t = await getTranslations("Nutrition.foods");

  return (
    <>
      <Link
        href={returnTo ?? ROUTES.foods}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("title")}
      </Link>
      <PageHeader title={t("newTitle")} />
      <Card>
        <FoodForm initial={EMPTY_FOOD} action={createFoodAction} returnTo={returnTo} />
      </Card>
    </>
  );
}
