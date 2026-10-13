import { ChevronRight, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionButton } from "@/components/forms/action-button";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { listRecipes } from "@/data/recipes";
import { MEAL_SLOTS } from "@/domain/meal-planner";
import { NutritionTabs } from "@/features/nutrition/nutrition-tabs";
import { recipeUrl } from "@/features/nutrition/urls";
import { addStarterRecipesAction } from "@/features/recipes/actions";
import { RecipeFacts } from "@/features/recipes/recipe-facts";
import { STARTER_RECIPES } from "@/features/recipes/starter-recipes";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Recipes");
  return { title: t("title") };
}

export default async function RecipesPage() {
  const [recipes, t, tOptions, format] = await Promise.all([
    listRecipes(),
    getTranslations("Recipes"),
    getTranslations("Options"),
    getFormatter(),
  ]);
  const ownedStarters = new Set(
    recipes.flatMap((recipe) => (recipe.starterKey ? [recipe.starterKey] : [])),
  );
  const missingStarters = STARTER_RECIPES.filter((recipe) => !ownedStarters.has(recipe.key)).length;

  return (
    <>
      <PageHeader
        title={t("title")}
        lead={t("lead")}
        action={
          <Button asChild>
            <Link href={ROUTES.recipeNew}>
              <Plus aria-hidden="true" />
              {t("new")}
            </Link>
          </Button>
        }
      />
      <NutritionTabs current="recipes" />

      <div className="flex flex-col gap-5">
        {missingStarters > 0 ? (
          <Card>
            <CardHeader className="mb-4">
              <CardTitle>{t("starters.title")}</CardTitle>
              <CardDescription>{t("starters.lead", { count: missingStarters })}</CardDescription>
            </CardHeader>
            <ActionButton
              action={addStarterRecipesAction}
              pendingLabel={t("starters.adding")}
              variant={recipes.length === 0 ? "primary" : "secondary"}
            >
              {t("starters.add", { count: missingStarters })}
            </ActionButton>
          </Card>
        ) : null}

        {recipes.length === 0 ? (
          <p className="text-muted-foreground">{t("empty")}</p>
        ) : (
          MEAL_SLOTS.map((slot) => {
            const inSlot = recipes.filter((recipe) => recipe.slots.includes(slot));
            if (inSlot.length === 0) return null;
            return (
              <section key={slot} aria-labelledby={`slot-${slot}`}>
                <h2
                  id={`slot-${slot}`}
                  className="mb-2 font-sans text-sm font-semibold tracking-normal text-muted-foreground"
                >
                  {tOptions(`mealCategory.${slot}`)}
                </h2>
                <ul className="overflow-hidden rounded-card border border-border bg-surface">
                  {inSlot.map((recipe) => (
                    <li key={recipe.id} className="border-b border-border last:border-b-0">
                      <Link
                        href={recipeUrl(recipe.id)}
                        className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted sm:px-6"
                      >
                        <span className="flex min-w-0 flex-col gap-1">
                          <span className="truncate font-medium">{recipe.title}</span>
                          <RecipeFacts recipe={recipe} showAllergens={false} />
                        </span>
                        <span className="flex shrink-0 items-center gap-2">
                          <span className="text-right text-sm tabular-nums">
                            <span className="block font-semibold">
                              {t("kcalPerServing", {
                                value: format.number(Math.round(recipe.perServing.kcal)),
                              })}
                            </span>
                            <span className="block text-muted-foreground">
                              {t("proteinPerServing", {
                                value: format.number(Math.round(recipe.perServing.proteinG)),
                              })}
                            </span>
                          </span>
                          <ChevronRight
                            aria-hidden="true"
                            className="size-5 text-muted-foreground"
                          />
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            );
          })
        )}

        {recipes.some((recipe) => recipe.slots.length === 0) ? (
          <section aria-labelledby="slot-none">
            <h2
              id="slot-none"
              className="mb-2 font-sans text-sm font-semibold tracking-normal text-muted-foreground"
            >
              {t("noSlot")}
            </h2>
            <ul className="overflow-hidden rounded-card border border-border bg-surface">
              {recipes
                .filter((recipe) => recipe.slots.length === 0)
                .map((recipe) => (
                  <li key={recipe.id} className="border-b border-border last:border-b-0">
                    <Link
                      href={recipeUrl(recipe.id)}
                      className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted sm:px-6"
                    >
                      <span className="truncate font-medium">{recipe.title}</span>
                      <ChevronRight aria-hidden="true" className="size-5 text-muted-foreground" />
                    </Link>
                  </li>
                ))}
            </ul>
          </section>
        ) : null}

        <p className="text-sm text-muted-foreground">{t("source")}</p>
      </div>
    </>
  );
}
