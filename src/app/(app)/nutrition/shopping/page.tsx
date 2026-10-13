import { Check, ChevronLeft, ChevronRight, Trash2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { getFormatter, getTranslations } from "next-intl/server";
import { ActionButton } from "@/components/forms/action-button";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getMealPlan } from "@/data/meal-plans";
import { getOwnPreferences } from "@/data/plan";
import { getToday } from "@/data/profile";
import { getShoppingListForWeek, type ShoppingItem } from "@/data/shopping";
import { AISLE_ORDER, shoppingTotal } from "@/domain/shopping";
import { NutritionTabs } from "@/features/nutrition/nutrition-tabs";
import { mealPlanUrl, shoppingUrl } from "@/features/nutrition/urls";
import {
  addManualItemAction,
  deleteShoppingItemAction,
  generateShoppingListAction,
  setPriceAction,
  toggleCheckedAction,
  toggleOwnedAction,
} from "@/features/shopping/actions";
import { ManualItemForm } from "@/features/shopping/manual-item-form";
import { PriceForm } from "@/features/shopping/price-form";
import { addDays, isIsoDate, startOfIsoWeek } from "@/lib/dates";
import { cn } from "@/lib/utils";

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations("Shopping");
  return { title: t("title") };
}

const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

export default async function ShoppingPage({ searchParams }: PageProps<"/nutrition/shopping">) {
  const params = await searchParams;
  const today = await getToday();
  const requested = one(params.week);
  const week = startOfIsoWeek(isIsoDate(requested) ? requested : today);

  const [plan, current, preferences, t, tCommon, format] = await Promise.all([
    getMealPlan(week),
    getShoppingListForWeek(week),
    getOwnPreferences(),
    getTranslations("Shopping"),
    getTranslations("Common"),
    getFormatter(),
  ]);
  const weekLabel = format.dateTime(new Date(`${week}T12:00:00Z`), {
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
  const euros = (value: number) => format.number(value, { style: "currency", currency: "EUR" });
  const quantity = (grams: number | null) =>
    grams === null
      ? ""
      : grams >= 1000
        ? `${format.number(grams / 1000, { maximumFractionDigits: 2 })} ${tCommon("kg")}`
        : `${format.number(grams)} ${tCommon("grams")}`;

  const navigation = (
    <div className="mb-5 flex items-center justify-between gap-2">
      <Button asChild variant="ghost" size="icon">
        <Link href={shoppingUrl(addDays(week, -7))} aria-label={t("previousWeek")}>
          <ChevronLeft aria-hidden="true" />
        </Link>
      </Button>
      <p className="text-lg font-semibold">{t("weekOf", { date: weekLabel })}</p>
      <Button asChild variant="ghost" size="icon">
        <Link href={shoppingUrl(addDays(week, 7))} aria-label={t("nextWeek")}>
          <ChevronRight aria-hidden="true" />
        </Link>
      </Button>
    </div>
  );

  const header = (
    <>
      <PageHeader title={t("title")} lead={t("lead")} />
      <NutritionTabs current="shopping" />
      {navigation}
    </>
  );

  if (!plan) {
    return (
      <>
        {header}
        <Card>
          <CardHeader className="mb-4">
            <CardTitle>{t("noPlan.title")}</CardTitle>
            <CardDescription>{t("noPlan.lead")}</CardDescription>
          </CardHeader>
          <Button asChild>
            <Link href={mealPlanUrl(week)}>{t("noPlan.action")}</Link>
          </Button>
        </Card>
      </>
    );
  }

  if (!current) {
    return (
      <>
        {header}
        <Card>
          <CardHeader className="mb-4">
            <CardTitle>{t("generate.title")}</CardTitle>
            <CardDescription>{t("generate.lead")}</CardDescription>
          </CardHeader>
          <ActionButton
            action={generateShoppingListAction.bind(null, week)}
            pendingLabel={t("generating")}
            size="lg"
          >
            {t("generate.action")}
          </ActionButton>
        </Card>
      </>
    );
  }

  const { items } = current;
  const totals = shoppingTotal(
    items.map((item) => ({
      estimatedPriceEur: item.estimated_price_eur,
      alreadyOwned: item.already_owned,
    })),
  );
  const budget = preferences?.weekly_food_budget_eur ?? null;
  const remaining = items.filter((item) => !item.is_checked && !item.already_owned).length;
  const groups = [
    ...AISLE_ORDER.map((aisle) => ({
      key: aisle,
      items: items.filter((item) => !item.added_manually && (item.aisle ?? "other") === aisle),
    })),
    { key: "manual" as const, items: items.filter((item) => item.added_manually) },
  ].filter((group) => group.items.length > 0);

  return (
    <>
      {header}

      <Card className="mb-5">
        <dl className="grid gap-4 sm:grid-cols-3">
          <div>
            <dt className="text-sm text-muted-foreground">{t("summary.remaining")}</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {t("summary.items", { count: remaining })}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("summary.known")}</dt>
            <dd className="text-xl font-semibold tabular-nums">{euros(totals.totalEur)}</dd>
            <dd className="text-sm text-muted-foreground">
              {totals.unpriced > 0
                ? t("summary.unpriced", { count: totals.unpriced })
                : t("summary.allPriced")}
            </dd>
          </div>
          <div>
            <dt className="text-sm text-muted-foreground">{t("summary.budget")}</dt>
            <dd className="text-xl font-semibold tabular-nums">
              {budget === null ? t("summary.noBudget") : euros(budget)}
            </dd>
            {budget !== null && totals.priced > 0 ? (
              <dd
                className={cn(
                  "text-sm",
                  totals.totalEur > budget ? "text-destructive" : "text-muted-foreground",
                )}
              >
                {totals.totalEur > budget
                  ? t("summary.over", { value: euros(totals.totalEur - budget) })
                  : t("summary.under", { value: euros(budget - totals.totalEur) })}
              </dd>
            ) : null}
          </div>
        </dl>
        <p className="mt-4 text-sm text-muted-foreground">{t("pricesHint")}</p>
      </Card>

      <div className="flex flex-col gap-5">
        {groups.map((group) => (
          <section
            key={group.key}
            aria-labelledby={`aisle-${group.key}`}
            className="overflow-hidden rounded-card border border-border bg-surface"
          >
            <h2 id={`aisle-${group.key}`} className="px-5 pt-4 pb-2 text-lg font-semibold sm:px-6">
              {t(`aisle.${group.key}`)}
            </h2>
            <ul className="border-t border-border">
              {group.items.map((item) => (
                <ShoppingRow key={item.id} item={item} quantity={quantity(item.quantity_g)} />
              ))}
            </ul>
          </section>
        ))}

        <Card>
          <CardHeader className="mb-4">
            <CardTitle>{t("manual.title")}</CardTitle>
          </CardHeader>
          <ManualItemForm action={addManualItemAction.bind(null, week)} />
        </Card>

        <div className="flex flex-col gap-2">
          <ActionButton
            action={generateShoppingListAction.bind(null, week)}
            pendingLabel={t("generating")}
            variant="secondary"
            formClassName="self-start"
          >
            {t("regenerate")}
          </ActionButton>
          <p className="text-sm text-muted-foreground">{t("regenerateHint")}</p>
        </div>
      </div>
    </>
  );
}

async function ShoppingRow({ item, quantity }: { item: ShoppingItem; quantity: string }) {
  const [t, tCommon] = await Promise.all([getTranslations("Shopping"), getTranslations("Common")]);
  const price =
    item.estimated_price_eur === null ? "" : String(item.estimated_price_eur).replace(".", ",");
  return (
    <li
      className={cn(
        "border-b border-border px-5 py-3 last:border-b-0 sm:px-6",
        item.already_owned && "opacity-70",
      )}
    >
      <div className="flex items-start gap-3">
        <ActionButton
          action={toggleCheckedAction.bind(null, item.id, !item.is_checked)}
          pendingLabel=""
          variant={item.is_checked ? "primary" : "secondary"}
          size="icon"
          aria-label={
            item.is_checked ? t("uncheck", { name: item.name }) : t("check", { name: item.name })
          }
          aria-pressed={item.is_checked}
          className="size-9"
        >
          <Check aria-hidden="true" className={item.is_checked ? undefined : "opacity-0"} />
        </ActionButton>
        <div className="min-w-0 flex-1">
          <p className={cn("font-medium", item.is_checked && "text-muted-foreground line-through")}>
            {item.name}
          </p>
          <p className="text-sm text-muted-foreground tabular-nums">
            {quantity}
            {item.already_owned ? ` · ${t("owned")}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-start gap-2">
            <PriceForm
              id={item.id}
              initial={price}
              label={t("priceLabel", { name: item.name })}
              action={setPriceAction.bind(null, item.id)}
            />
            <ActionButton
              action={toggleOwnedAction.bind(null, item.id, !item.already_owned)}
              pendingLabel={tCommon("saving")}
              variant="ghost"
              size="sm"
            >
              {item.already_owned ? t("notOwned") : t("markOwned")}
            </ActionButton>
            {item.added_manually ? (
              <ActionButton
                action={deleteShoppingItemAction.bind(null, item.id)}
                pendingLabel={tCommon("deleting")}
                variant="ghost"
                size="sm"
                aria-label={tCommon("removeItem", { item: item.name })}
              >
                <Trash2 aria-hidden="true" />
              </ActionButton>
            ) : null}
          </div>
        </div>
      </div>
    </li>
  );
}
