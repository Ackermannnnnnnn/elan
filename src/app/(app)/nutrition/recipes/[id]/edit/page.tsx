import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { getRecipe } from "@/data/recipes";
import { recipeUrl } from "@/features/nutrition/urls";
import { updateRecipeAction } from "@/features/recipes/actions";
import { type KnownFood, RecipeForm } from "@/features/recipes/recipe-form";
import { DeleteRecipeButton } from "@/features/recipes/delete-recipe-button";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Recipes");
  return { title: t("editTitle") };
}

const text = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));

export default async function EditRecipePage({
  params,
}: PageProps<"/nutrition/recipes/[id]/edit">) {
  const { id } = await params;
  const recipe = /^[0-9a-f-]{36}$/i.test(id) ? await getRecipe(id) : null;
  if (!recipe) notFound();
  const t = await getTranslations("Recipes");

  // Un ingrédient dont l'aliment a été supprimé ne peut pas être conservé : il est retiré du formulaire.
  const withFood = recipe.ingredients.filter((ingredient) => ingredient.food !== null);
  const knownFoods: Record<string, KnownFood> = {};
  for (const ingredient of withFood) {
    if (ingredient.food) {
      knownFoods[ingredient.food.id] = {
        kcal: ingredient.food.kcal,
        proteinG: ingredient.food.protein_g,
      };
    }
  }

  return (
    <>
      <Link
        href={recipeUrl(recipe.id)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {recipe.title}
      </Link>
      <PageHeader title={t("editTitle")} />
      <div className="flex flex-col gap-5">
        <Card>
          <RecipeForm
            initial={{
              title: recipe.title,
              description: recipe.description ?? "",
              servings: text(recipe.servings),
              prepMinutes: text(recipe.prepMinutes),
              cookMinutes: text(recipe.cookMinutes),
              slots: recipe.slots,
              tags: recipe.tags,
              steps: recipe.steps.join("\n"),
              ingredients: withFood.map((ingredient) => ({
                foodId: ingredient.foodId ?? "",
                foodName: ingredient.name,
                quantityG: text(ingredient.quantityG),
                displayQuantity: ingredient.displayQuantity ?? "",
                isOptional: ingredient.isOptional,
              })),
            }}
            knownFoods={knownFoods}
            action={updateRecipeAction.bind(null, recipe.id)}
            submitLabel={t("form.save")}
          />
        </Card>
        <div>
          <DeleteRecipeButton id={recipe.id} label={t("delete")} />
        </div>
      </div>
    </>
  );
}
