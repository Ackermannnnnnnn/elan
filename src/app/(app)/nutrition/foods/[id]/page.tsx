import { ArrowLeft } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Card } from "@/components/ui/card";
import { ROUTES } from "@/config/routes";
import { getFood } from "@/data/nutrition";
import { ALLERGEN_CODES, type AllergenCode } from "@/domain/food-classification";
import { DeleteFoodButton } from "@/features/nutrition/action-buttons";
import { updateFoodAction } from "@/features/nutrition/actions";
import { FoodForm } from "@/features/nutrition/food-form";
import { requireUser } from "@/lib/auth/session";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nutrition.foods");
  return { title: t("editTitle") };
}

const text = (value: number | null) => (value === null ? "" : String(value).replace(".", ","));

export default async function EditFoodPage({ params }: PageProps<"/nutrition/foods/[id]">) {
  const { id } = await params;
  const [user, food] = await Promise.all([
    requireUser(),
    /^[0-9a-f-]{36}$/i.test(id) ? getFood(id) : Promise.resolve(null),
  ]);
  // Seuls ses propres aliments sont modifiables ; le catalogue partagé ne l'est pas.
  if (!food || food.owner_id !== user.id) notFound();
  const t = await getTranslations("Nutrition.foods");

  return (
    <>
      <Link
        href={ROUTES.foods}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("title")}
      </Link>
      <PageHeader title={t("editTitle")} />
      <div className="flex flex-col gap-5">
        <Card>
          <FoodForm
            initial={{
              name: food.name,
              brand: food.brand ?? "",
              basis: food.basis,
              preparationState: food.preparation_state,
              kcal: text(food.kcal),
              proteinG: text(food.protein_g),
              carbsG: text(food.carbs_g),
              fatG: text(food.fat_g),
              fiberG: text(food.fiber_g),
              servingSizeG: text(food.serving_size_g),
              servingLabel: food.serving_label ?? "",
              allergens: food.allergens.filter((code): code is AllergenCode =>
                (ALLERGEN_CODES as readonly string[]).includes(code),
              ),
            }}
            action={updateFoodAction.bind(null, food.id)}
          />
        </Card>
        <div>
          <DeleteFoodButton id={food.id} label={t("delete")} />
          <p className="mt-2 text-sm text-muted-foreground">{t("deleteHint")}</p>
        </div>
      </div>
    </>
  );
}
