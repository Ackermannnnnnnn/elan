import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Alert } from "@/components/ui/alert";
import { Card } from "@/components/ui/card";
import { getDiaryEntry, getFood, listMealCategories } from "@/data/nutrition";
import { getRecipe } from "@/data/recipes";
import { DeleteDiaryEntryButton } from "@/features/nutrition/action-buttons";
import { EntryEditor } from "@/features/nutrition/entry-editor";
import { FoodPer100 } from "@/features/nutrition/food-line";
import { diaryUrl } from "@/features/nutrition/urls";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nutrition.edit");
  return { title: t("title") };
}

const text = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));

export default async function EditEntryPage({ params }: PageProps<"/nutrition/entries/[id]">) {
  const { id } = await params;
  const entry = /^[0-9a-f-]{36}$/i.test(id) ? await getDiaryEntry(id) : null;
  if (!entry) notFound();

  const [categories, food, recipe, t, tOptions] = await Promise.all([
    listMealCategories(),
    entry.food_id ? getFood(entry.food_id) : Promise.resolve(null),
    entry.recipe_id ? getRecipe(entry.recipe_id) : Promise.resolve(null),
    getTranslations("Nutrition"),
    getTranslations("Options"),
  ]);

  const categoryOptions = categories.map((category) => ({
    id: category.id,
    label:
      category.key === "custom" ? (category.label ?? "") : tOptions(`mealCategory.${category.key}`),
  }));
  // Une entrée de saisie rapide n'a ni aliment ni poids : ses apports ont été déclarés tels quels.
  const isQuick = entry.food_id === null && entry.quantity_g === null;

  return (
    <>
      <Link
        href={diaryUrl(entry.entry_date)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("title")}
      </Link>
      <PageHeader title={entry.description} />

      <div className="flex flex-col gap-5">
        <Card>
          {food ? (
            <p className="mb-5 text-sm text-muted-foreground">
              <FoodPer100 food={food} />
            </p>
          ) : null}

          {food ? (
            <EntryEditor
              kind="food"
              entryId={entry.id}
              categoryId={entry.category_id}
              categories={categoryOptions}
              food={{
                basis: food.basis,
                kcal: food.kcal,
                proteinG: food.protein_g,
                carbsG: food.carbs_g,
                fatG: food.fat_g,
                fiberG: food.fiber_g,
                servingSizeG: food.serving_size_g,
                servingLabel: food.serving_label,
              }}
              initial={
                entry.servings !== null && food.serving_size_g
                  ? { unit: "servings", quantity: text(entry.servings) }
                  : { unit: "grams", quantity: text(entry.quantity_g) }
              }
            />
          ) : recipe ? (
            <EntryEditor
              kind="recipe"
              entryId={entry.id}
              categoryId={entry.category_id}
              categories={categoryOptions}
              initial={{ portions: text(entry.servings ?? 1) }}
              perServing={{ kcal: recipe.perServing.kcal, proteinG: recipe.perServing.proteinG }}
            />
          ) : isQuick ? (
            <EntryEditor
              kind="quick"
              entryId={entry.id}
              categoryId={entry.category_id}
              categories={categoryOptions}
              initial={{
                description: entry.description,
                kcal: text(entry.kcal),
                proteinG: text(entry.protein_g),
                carbsG: text(entry.carbs_g),
                fatG: text(entry.fat_g),
              }}
            />
          ) : (
            <Alert variant="info">{t("edit.foodDeleted")}</Alert>
          )}
        </Card>

        <div>
          <DeleteDiaryEntryButton id={entry.id} label={t("edit.delete")} />
        </div>
      </div>
    </>
  );
}
