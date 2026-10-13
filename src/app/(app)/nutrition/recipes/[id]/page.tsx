import { ArrowLeft, Pencil } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Stat, StatGrid } from "@/components/ui/stat";
import { ROUTES } from "@/config/routes";
import { listMealCategories } from "@/data/nutrition";
import { getToday } from "@/data/profile";
import { getRecipe } from "@/data/recipes";
import { recipeEditUrl } from "@/features/nutrition/urls";
import { addRecipeEntryAction } from "@/features/recipes/actions";
import { RecipeEntryForm } from "@/features/recipes/recipe-entry-form";
import { RecipeFacts } from "@/features/recipes/recipe-facts";

export async function generateMetadata({
  params,
}: PageProps<"/nutrition/recipes/[id]">): Promise<Metadata> {
  const { id } = await params;
  const recipe = /^[0-9a-f-]{36}$/i.test(id) ? await getRecipe(id) : null;
  const t = await getTranslations("Recipes");
  return { title: recipe?.title ?? t("title") };
}

export default async function RecipePage({ params }: PageProps<"/nutrition/recipes/[id]">) {
  const { id } = await params;
  const recipe = /^[0-9a-f-]{36}$/i.test(id) ? await getRecipe(id) : null;
  if (!recipe) notFound();

  const [today, categories, t, tOptions, tCommon, format] = await Promise.all([
    getToday(),
    listMealCategories(),
    getTranslations("Recipes"),
    getTranslations("Options"),
    getTranslations("Common"),
    getFormatter(),
  ]);
  const number = (value: number, digits = 0) =>
    format.number(value, { maximumFractionDigits: digits });
  const categoryOptions = categories.map((category) => ({
    id: category.id,
    label:
      category.key === "custom" ? (category.label ?? "") : tOptions(`mealCategory.${category.key}`),
  }));
  const preferred =
    categories.find((category) => recipe.slots.includes(category.key as never)) ?? categories[0];

  return (
    <>
      <Link
        href={ROUTES.recipes}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("title")}
      </Link>
      <PageHeader
        title={recipe.title}
        lead={recipe.description ?? undefined}
        action={
          <Button asChild variant="secondary">
            <Link href={recipeEditUrl(recipe.id)}>
              <Pencil aria-hidden="true" />
              {tCommon("edit")}
            </Link>
          </Button>
        }
      />

      <div className="flex flex-col gap-5">
        <Card>
          <CardHeader className="mb-4">
            <CardTitle>{t("perServingTitle")}</CardTitle>
            <RecipeFacts recipe={recipe} />
          </CardHeader>
          <StatGrid>
            <Stat
              label={t("kcal")}
              value={`${number(recipe.perServing.kcal)} ${tCommon("kcal")}`}
            />
            <Stat label={t("protein")} value={`${number(recipe.perServing.proteinG)} g`} />
            <Stat label={t("carbs")} value={`${number(recipe.perServing.carbsG)} g`} />
            <Stat label={t("fat")} value={`${number(recipe.perServing.fatG)} g`} />
          </StatGrid>
          <p className="mt-4 text-sm text-muted-foreground">
            {t("servingsInfo", { count: recipe.servings })}
            {recipe.slots.length > 0
              ? ` · ${recipe.slots.map((slot) => tOptions(`mealCategory.${slot}`)).join(", ")}`
              : ""}
          </p>
          {!recipe.isComplete ? (
            <p className="mt-2 text-sm text-muted-foreground">{t("incompleteHint")}</p>
          ) : null}
        </Card>

        <Card>
          <CardHeader className="mb-3">
            <CardTitle>{t("ingredientsTitle")}</CardTitle>
          </CardHeader>
          <ul className="flex flex-col">
            {recipe.ingredients.map((ingredient) => (
              <li
                key={ingredient.id}
                className="flex items-baseline justify-between gap-4 border-b border-border py-2.5 last:border-b-0"
              >
                <span className="min-w-0">
                  {ingredient.name}
                  {ingredient.isOptional ? (
                    <span className="text-muted-foreground"> ({t("optional")})</span>
                  ) : null}
                  {ingredient.food === null ? (
                    <span className="block text-sm text-destructive">{t("foodMissing")}</span>
                  ) : null}
                </span>
                <span className="shrink-0 text-right text-sm tabular-nums">
                  {ingredient.displayQuantity ? (
                    <span className="block font-medium">{ingredient.displayQuantity}</span>
                  ) : null}
                  <span className="block text-muted-foreground">
                    {number(ingredient.quantityG, 1)} g
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </Card>

        {recipe.steps.length > 0 ? (
          <Card>
            <CardHeader className="mb-3">
              <CardTitle>{t("stepsTitle")}</CardTitle>
            </CardHeader>
            <ol className="flex list-decimal flex-col gap-2 pl-5 marker:font-semibold marker:text-muted-foreground">
              {recipe.steps.map((step, index) => (
                <li key={index}>{step}</li>
              ))}
            </ol>
          </Card>
        ) : null}

        {preferred ? (
          <Card>
            <CardHeader className="mb-4">
              <CardTitle>{t("log.title")}</CardTitle>
            </CardHeader>
            <RecipeEntryForm
              today={today}
              categories={categoryOptions}
              defaultCategoryId={preferred.id}
              perServing={{ kcal: recipe.perServing.kcal, proteinG: recipe.perServing.proteinG }}
              action={addRecipeEntryAction.bind(null, recipe.id)}
            />
          </Card>
        ) : null}

        {recipe.origin === "starter" ? (
          <p className="text-sm text-muted-foreground">{t("source")}</p>
        ) : null}
      </div>
    </>
  );
}
