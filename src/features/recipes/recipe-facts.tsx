import { Clock } from "lucide-react";
import { getTranslations } from "next-intl/server";
import { Badge } from "@/components/ui/badge";
import type { Recipe } from "@/data/recipes";

/** Régime, durée et allergènes d'une recette, en badges. */
export async function RecipeFacts({
  recipe,
  showAllergens = true,
}: {
  recipe: Recipe;
  showAllergens?: boolean;
}) {
  const [t, tOptions] = await Promise.all([getTranslations("Recipes"), getTranslations("Options")]);
  return (
    <span className="flex flex-wrap items-center gap-1.5">
      <Badge variant={recipe.dietClass === "plant" ? "success" : "neutral"}>
        {t(`diet.${recipe.dietClass}`)}
      </Badge>
      {recipe.totalMinutes !== null ? (
        <Badge>
          <Clock aria-hidden="true" className="size-3" />
          {t("minutes", { count: recipe.totalMinutes })}
        </Badge>
      ) : null}
      {!recipe.isComplete ? <Badge>{t("incomplete")}</Badge> : null}
      {showAllergens && recipe.allergens.length > 0 ? (
        <span className="text-xs text-muted-foreground">
          {t("allergens", {
            list: recipe.allergens
              .map((code) =>
                tOptions.has(`allergen.${code}` as never)
                  ? tOptions(`allergen.${code}` as never)
                  : code,
              )
              .join(", "),
          })}
        </span>
      ) : null}
    </span>
  );
}
