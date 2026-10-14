import { ArrowLeft, ChevronRight, ScanBarcode, Search } from "lucide-react";
import type { Metadata } from "next";
import Form from "next/form";
import Link from "next/link";
import { redirect } from "next/navigation";
import { getFormatter, getTranslations } from "next-intl/server";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { SegmentedLinks } from "@/components/ui/segmented-links";
import { ROUTES } from "@/config/routes";
import { getFood, listDiary, listMealCategories, searchFoods } from "@/data/nutrition";
import { getToday } from "@/data/profile";
import { CopyMealButton } from "@/features/nutrition/action-buttons";
import { addFoodEntryAction, addQuickEntryAction } from "@/features/nutrition/actions";
import { FoodPer100 } from "@/features/nutrition/food-line";
import { QuantityForm } from "@/features/nutrition/quantity-form";
import { QuickEntryForm } from "@/features/nutrition/quick-entry-form";
import { addUrl, diaryUrl, foodScanUrl, newFoodUrl } from "@/features/nutrition/urls";
import { listRecipes } from "@/data/recipes";
import { addRecipeEntryAction } from "@/features/recipes/actions";
import { RecipeEntryForm } from "@/features/recipes/recipe-entry-form";
import { addDays, isIsoDate } from "@/lib/dates";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Nutrition.add.tabs");
  return { title: t("foods") };
}

const MODES = ["foods", "recipes", "quick", "copy"] as const;
type Mode = (typeof MODES)[number];
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function AddEntryPage({ searchParams }: PageProps<"/nutrition/add">) {
  const params = await searchParams;
  const today = await getToday();
  const categories = await listMealCategories();

  const date = one(params.date);
  const category = categories.find((item) => item.id === one(params.category));
  // Sans jour ou sans repas valides, il n'y a rien à ajouter : retour au journal.
  if (!isIsoDate(date) || date > today || !category) redirect(ROUTES.nutrition);

  const mode: Mode = MODES.find((item) => item === one(params.mode)) ?? "foods";
  const query = (one(params.q) ?? "").slice(0, 60);
  const slot = { date, categoryId: category.id };

  const [t, tOptions, format] = await Promise.all([
    getTranslations("Nutrition"),
    getTranslations("Options"),
    getFormatter(),
  ]);
  const categoryName =
    category.key === "custom" ? (category.label ?? "") : tOptions(`mealCategory.${category.key}`);
  const base = { date, category: category.id };

  const selectedId = one(params.food);
  const selected = mode === "foods" && selectedId ? await getFood(selectedId) : null;

  return (
    <>
      <Link
        href={diaryUrl(date)}
        className="mb-4 inline-flex items-center gap-1.5 text-sm font-medium text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft aria-hidden="true" className="size-4" />
        {t("title")}
      </Link>
      <PageHeader title={t("add.title", { category: categoryName })} />

      <SegmentedLinks
        label={t("add.title", { category: categoryName })}
        className="mb-5 overflow-x-auto"
        items={MODES.map((item) => ({
          href: addUrl({ ...base, mode: item === "foods" ? undefined : item }),
          label: t(`add.tabs.${item}`),
          current: item === mode,
        }))}
      />

      {mode === "foods" && selected ? (
        <Card>
          <h2 className="text-lg font-semibold">
            {selected.name}
            {selected.brand ? (
              <span className="font-normal text-muted-foreground"> ({selected.brand})</span>
            ) : null}
          </h2>
          <p className="mt-1 mb-5 text-sm text-muted-foreground">
            <FoodPer100 food={selected} />
          </p>
          <QuantityForm
            food={{
              basis: selected.basis,
              kcal: selected.kcal,
              proteinG: selected.protein_g,
              carbsG: selected.carbs_g,
              fatG: selected.fat_g,
              fiberG: selected.fiber_g,
              servingSizeG: selected.serving_size_g,
              servingLabel: selected.serving_label,
              packageSizeG: selected.package_size_g,
              packageLabel: selected.package_label,
            }}
            initial={{
              unit: "grams",
              // La portion indiquée, sinon un petit emballage entier (canette), sinon 100.
              quantity: String(
                selected.serving_size_g ??
                  (selected.package_size_g && selected.package_size_g <= 500
                    ? selected.package_size_g
                    : 100),
              ).replace(".", ","),
            }}
            submitLabel={t("add.submit")}
            action={addFoodEntryAction.bind(null, slot, selected.id)}
          />
          <Link
            href={addUrl({ ...base, q: query || undefined })}
            className="mt-5 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
          >
            {t("add.changeFood")}
          </Link>
        </Card>
      ) : null}

      {mode === "foods" && !selected ? <FoodPicker slot={slot} query={query} /> : null}

      {mode === "recipes" ? (
        <RecipePanel
          slot={slot}
          today={today}
          categoryKey={category.key}
          selectedId={one(params.recipe)}
        />
      ) : null}

      {mode === "quick" ? (
        <Card>
          <p className="mb-5 text-muted-foreground">{t("quick.lead")}</p>
          <QuickEntryForm
            submitLabel={t("quick.submit")}
            action={addQuickEntryAction.bind(null, slot)}
          />
        </Card>
      ) : null}

      {mode === "copy" ? (
        <CopyPanel
          slot={slot}
          today={today}
          from={isIsoDate(one(params.from)) ? (one(params.from) as string) : addDays(date, -1)}
          dayLabel={(value) =>
            format.dateTime(new Date(`${value}T12:00:00Z`), {
              weekday: "long",
              day: "numeric",
              month: "long",
              timeZone: "UTC",
            })
          }
        />
      ) : null}
    </>
  );
}

async function FoodPicker({
  slot,
  query,
}: {
  slot: { date: string; categoryId: string };
  query: string;
}) {
  const t = await getTranslations("Nutrition.add");
  const foods = await searchFoods(query);
  const base = { date: slot.date, category: slot.categoryId };
  const createHref = newFoodUrl(addUrl({ ...base, q: query || undefined }));
  const scanHref = foodScanUrl(addUrl(base));
  const tSources = await getTranslations("Recipes.form.source");

  return (
    <div className="flex flex-col gap-5">
      <Form action={ROUTES.nutritionAdd} className="flex gap-2">
        <input type="hidden" name="date" value={slot.date} />
        <input type="hidden" name="category" value={slot.categoryId} />
        <label htmlFor="food-search" className="sr-only">
          {t("searchLabel")}
        </label>
        <div className="relative flex-1">
          <Search
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
          />
          <Input
            id="food-search"
            type="search"
            name="q"
            defaultValue={query}
            placeholder={t("searchPlaceholder")}
            autoComplete="off"
            enterKeyHint="search"
            className="pl-11"
          />
        </div>
        <Button type="submit" variant="secondary" size="lg">
          {t("searchSubmit")}
        </Button>
      </Form>

      {foods.length === 0 && !query ? (
        <Card>
          <p className="font-semibold">{t("noFoods")}</p>
          <p className="mt-1 text-muted-foreground">{t("noFoodsHint")}</p>
          <div className="mt-5 flex flex-wrap gap-3">
            <Button asChild>
              <Link href={scanHref}>
                <ScanBarcode aria-hidden="true" />
                {t("scan")}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={createHref}>{t("createFood")}</Link>
            </Button>
          </div>
        </Card>
      ) : (
        <section>
          <h2 className="mb-2 font-sans text-sm font-semibold tracking-normal text-muted-foreground">
            {query ? t("results", { count: foods.length }) : t("recent")}
          </h2>
          {foods.length > 0 ? (
            <ul className="overflow-hidden rounded-card border border-border bg-surface">
              {foods.map((food) => (
                <li key={food.id} className="border-b border-border last:border-b-0">
                  <Link
                    href={addUrl({ ...base, q: query || undefined, food: food.id })}
                    aria-label={t("choose", { name: food.name })}
                    className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium">
                        {food.name}
                        {food.brand ? (
                          <span className="font-normal text-muted-foreground"> ({food.brand})</span>
                        ) : null}
                      </span>
                      <span className="block truncate text-sm text-muted-foreground">
                        {tSources(food.source)} · <FoodPer100 food={food} />
                      </span>
                    </span>
                    <ChevronRight
                      aria-hidden="true"
                      className="size-5 shrink-0 text-muted-foreground"
                    />
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Button asChild variant="secondary">
              <Link href={scanHref}>
                <ScanBarcode aria-hidden="true" />
                {t("scan")}
              </Link>
            </Button>
            <Button asChild variant="secondary">
              <Link href={createHref}>{t("createFood")}</Link>
            </Button>
          </div>
        </section>
      )}
    </div>
  );
}

async function CopyPanel({
  slot,
  today,
  from,
  dayLabel,
}: {
  slot: { date: string; categoryId: string };
  today: string;
  from: string;
  dayLabel: (date: string) => string;
}) {
  const t = await getTranslations("Nutrition");
  const format = await getFormatter();
  const source = (await listDiary(from)).filter((entry) => entry.category_id === slot.categoryId);

  return (
    <Card>
      <p className="mb-5 text-muted-foreground">{t("copy.lead")}</p>
      <Form action={ROUTES.nutritionAdd} className="flex flex-wrap items-end gap-3">
        <input type="hidden" name="date" value={slot.date} />
        <input type="hidden" name="category" value={slot.categoryId} />
        <input type="hidden" name="mode" value="copy" />
        <div className="flex flex-col gap-2">
          <label htmlFor="copy-from" className="text-sm font-semibold">
            {t("copy.from")}
          </label>
          <Input
            id="copy-from"
            type="date"
            name="from"
            defaultValue={from}
            max={today}
            className="w-auto"
          />
        </div>
        <Button type="submit" variant="secondary" size="lg">
          {t("copy.show")}
        </Button>
      </Form>

      <h2 className="mt-6 mb-2 font-sans text-sm font-semibold tracking-normal text-muted-foreground first-letter:uppercase">
        {dayLabel(from)}
      </h2>
      {source.length === 0 ? (
        <p className="text-muted-foreground">{t("copy.nothing")}</p>
      ) : (
        <>
          <ul className="mb-5 flex flex-col">
            {source.map((entry) => (
              <li
                key={entry.id}
                className="flex items-center justify-between gap-4 border-b border-border py-2.5 last:border-b-0"
              >
                <span className="truncate">{entry.description}</span>
                <span className="shrink-0 font-semibold tabular-nums">
                  {format.number(Math.round(entry.kcal))} kcal
                </span>
              </li>
            ))}
          </ul>
          <CopyMealButton
            slot={slot}
            fromDate={from}
            label={t("copy.submit", { count: source.length })}
            pendingLabel={t("copy.submitting")}
          />
        </>
      )}
    </Card>
  );
}

async function RecipePanel({
  slot,
  today,
  categoryKey,
  selectedId,
}: {
  slot: { date: string; categoryId: string };
  today: string;
  categoryKey: string;
  selectedId: string | undefined;
}) {
  const [recipes, categories, t, tOptions, format] = await Promise.all([
    listRecipes(),
    listMealCategories(),
    getTranslations("Nutrition.add"),
    getTranslations("Options"),
    getFormatter(),
  ]);
  const base = { date: slot.date, category: slot.categoryId, mode: "recipes" as const };
  const selected = recipes.find((recipe) => recipe.id === selectedId);

  if (selected) {
    return (
      <Card>
        <h2 className="text-lg font-semibold">{selected.title}</h2>
        <p className="mt-1 mb-5 text-sm text-muted-foreground">
          {t("recipePerServing", {
            kcal: format.number(Math.round(selected.perServing.kcal)),
            protein: format.number(Math.round(selected.perServing.proteinG)),
          })}
        </p>
        <RecipeEntryForm
          today={today}
          defaultDate={slot.date}
          categories={categories.map((category) => ({
            id: category.id,
            label:
              category.key === "custom"
                ? (category.label ?? "")
                : tOptions(`mealCategory.${category.key}`),
          }))}
          defaultCategoryId={slot.categoryId}
          perServing={{ kcal: selected.perServing.kcal, proteinG: selected.perServing.proteinG }}
          action={addRecipeEntryAction.bind(null, selected.id)}
        />
        <Link
          href={addUrl(base)}
          className="mt-5 inline-block text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          {t("changeRecipe")}
        </Link>
      </Card>
    );
  }

  if (recipes.length === 0) {
    return (
      <Card>
        <p className="font-semibold">{t("noRecipes")}</p>
        <Button asChild className="mt-5">
          <Link href={ROUTES.recipes}>{t("goRecipes")}</Link>
        </Button>
      </Card>
    );
  }

  // Les recettes prévues pour ce repas d'abord.
  const sorted = [...recipes].sort(
    (a, b) =>
      Number(b.slots.includes(categoryKey as never)) -
      Number(a.slots.includes(categoryKey as never)),
  );
  return (
    <ul className="overflow-hidden rounded-card border border-border bg-surface">
      {sorted.map((recipe) => (
        <li key={recipe.id} className="border-b border-border last:border-b-0">
          <Link
            href={addUrl({ ...base, recipe: recipe.id })}
            aria-label={t("chooseRecipe", { name: recipe.title })}
            className="flex items-center justify-between gap-3 px-5 py-3 transition-colors hover:bg-surface-muted"
          >
            <span className="min-w-0">
              <span className="block truncate font-medium">{recipe.title}</span>
              <span className="block truncate text-sm text-muted-foreground">
                {t("recipePerServing", {
                  kcal: format.number(Math.round(recipe.perServing.kcal)),
                  protein: format.number(Math.round(recipe.perServing.proteinG)),
                })}
              </span>
            </span>
            <ChevronRight aria-hidden="true" className="size-5 shrink-0 text-muted-foreground" />
          </Link>
        </li>
      ))}
    </ul>
  );
}
