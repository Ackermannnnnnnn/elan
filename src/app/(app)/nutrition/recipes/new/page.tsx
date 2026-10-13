import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { createRecipeAction } from "@/features/recipes/actions";
import { RecipeForm } from "@/features/recipes/recipe-form";
import { EMPTY_RECIPE } from "@/features/recipes/schemas";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Recipes");
  return { title: t("newTitle") };
}

export default async function NewRecipePage() {
  const t = await getTranslations("Recipes");
  return (
    <>
      <Link
        href={ROUTES.recipes}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("title")}
      </Link>
      <PageHeader title={t("newTitle")} lead={t("newLead")} />
      <Card>
        <RecipeForm
          initial={EMPTY_RECIPE}
          knownFoods={{}}
          action={createRecipeAction}
          submitLabel={t("form.create")}
        />
      </Card>
    </>
  );
}
