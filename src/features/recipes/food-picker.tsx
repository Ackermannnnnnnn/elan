"use client";

import { Plus, Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { useEffect, useId, useState, useTransition } from "react";
import { Input } from "@/components/ui/input";
import { type FoodOption, searchFoodOptionsAction } from "./actions";

/**
 * Recherche d'un aliment (catalogue CIQUAL + aliments personnels) pour
 * l'ajouter comme ingrédient. La recherche part après une courte pause de frappe.
 */
export function FoodPicker({ onPick }: { onPick: (food: FoodOption) => void }) {
  const t = useTranslations("Recipes.form");
  const id = useId();
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<FoodOption[]>([]);
  const [searched, setSearched] = useState("");
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const query = term.trim();
    if (query.length < 2) return;
    const timer = setTimeout(() => {
      startTransition(async () => {
        const found = await searchFoodOptionsAction(query);
        setResults(found);
        setSearched(query);
      });
    }, 250);
    return () => clearTimeout(timer);
  }, [term]);

  const visible = term.trim().length >= 2 ? results : [];

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-sm font-semibold">
        {t("addIngredient")}
      </label>
      <div className="relative">
        <Search
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 left-3.5 size-5 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          id={id}
          type="search"
          value={term}
          onChange={(event) => setTerm(event.target.value)}
          onKeyDown={(event) => {
            // Entrée ne doit pas envoyer tout le formulaire de recette.
            if (event.key === "Enter") event.preventDefault();
          }}
          placeholder={t("searchPlaceholder")}
          autoComplete="off"
          className="pl-11"
        />
      </div>
      <p aria-live="polite" className="text-sm text-muted-foreground">
        {pending
          ? t("searching")
          : searched && term.trim() === searched
            ? t("results", { count: visible.length })
            : ""}
      </p>
      {visible.length > 0 ? (
        <ul className="overflow-hidden rounded-control border border-border">
          {visible.map((food) => (
            <li key={food.id} className="border-b border-border last:border-b-0">
              <button
                type="button"
                aria-label={t("pick", {
                  name: food.brand ? `${food.name} (${food.brand})` : food.name,
                })}
                aria-describedby={`${id}-${food.id}`}
                onClick={() => {
                  onPick(food);
                  setTerm("");
                  setResults([]);
                  setSearched("");
                }}
                className="flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors hover:bg-surface-muted"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium">
                    {food.name}
                    {food.brand ? (
                      <span className="font-normal text-muted-foreground"> ({food.brand})</span>
                    ) : null}
                  </span>
                  <span id={`${id}-${food.id}`} className="block text-sm text-muted-foreground">
                    {t("per100", {
                      kcal: Math.round(food.kcal),
                      protein: Math.round(food.proteinG * 10) / 10,
                    })}
                    {" · "}
                    {t(`source.${food.source}`)}
                  </span>
                </span>
                <Plus aria-hidden="true" className="size-5 shrink-0 text-primary" />
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
