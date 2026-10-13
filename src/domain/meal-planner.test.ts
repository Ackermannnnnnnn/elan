import { describe, expect, it } from "vitest";
import {
  exclusionReason,
  generateMealPlan,
  type PlannerConstraints,
  type PlannerRecipe,
  portionsFor,
  seededRandom,
} from "./meal-planner";

const recipe = (overrides: Partial<PlannerRecipe> & Pick<PlannerRecipe, "id">): PlannerRecipe => ({
  title: overrides.id,
  slots: ["lunch"],
  perServing: { kcal: 500, proteinG: 35, carbsG: 50, fatG: 15 },
  isComplete: true,
  allergens: [],
  dietClass: "plant",
  totalMinutes: 20,
  ingredientNames: [],
  ...overrides,
});

const none: PlannerConstraints = {
  allergies: [],
  excludedIngredients: [],
  diet: "omnivore",
  maxMinutes: null,
  styles: [],
};

describe("portionsFor", () => {
  it("arrondit au quart de portion et borne entre 0,5 et 2,5", () => {
    // 717,5 / 400 = 1,79 → 1,75.
    expect(portionsFor(717.5, 400)).toBe(1.75);
    expect(portionsFor(100, 400)).toBe(0.5);
    expect(portionsFor(2000, 400)).toBe(2.5);
  });
});

describe("seededRandom", () => {
  it("est reproductible", () => {
    const a = seededRandom(42);
    const b = seededRandom(42);
    expect([a(), a(), a()]).toEqual([b(), b(), b()]);
  });
});

describe("exclusionReason", () => {
  it("applique allergies, exclusions, régime, complétude et temps", () => {
    expect(
      exclusionReason(recipe({ id: "a", allergens: ["milk"] }), { ...none, allergies: ["milk"] }),
    ).toBe("allergy");
    // Allergie saisie librement : cherchée dans les noms d'ingrédients.
    expect(
      exclusionReason(recipe({ id: "b", ingredientNames: ["Kiwi, chair, cru"] }), {
        ...none,
        allergies: ["kiwi"],
      }),
    ).toBe("allergy");
    expect(
      exclusionReason(recipe({ id: "c", ingredientNames: ["Porc, échine, crue"] }), {
        ...none,
        excludedIngredients: ["porc"],
      }),
    ).toBe("excluded");
    expect(
      exclusionReason(recipe({ id: "d", dietClass: "meat" }), { ...none, diet: "vegetarian" }),
    ).toBe("diet");
    expect(exclusionReason(recipe({ id: "e", isComplete: false }), none)).toBe("incomplete");
    expect(
      exclusionReason(recipe({ id: "f", totalMinutes: 45 }), { ...none, maxMinutes: 30 }),
    ).toBe("time");
    expect(exclusionReason(recipe({ id: "g", slots: [] }), none)).toBe("noSlot");
    expect(exclusionReason(recipe({ id: "h" }), none)).toBeNull();
  });

  it("ne confond pas un mot avec un autre qui le contient", () => {
    expect(
      exclusionReason(recipe({ id: "a", ingredientNames: ["Pomme de terre, crue"] }), {
        ...none,
        excludedIngredients: ["terre cuite"],
      }),
    ).toBeNull();
  });
});

describe("generateMealPlan", () => {
  const recipes: PlannerRecipe[] = [
    recipe({
      id: "porridge",
      slots: ["breakfast"],
      perServing: { kcal: 400, proteinG: 20, carbsG: 60, fatG: 8 },
    }),
    recipe({
      id: "eggs",
      slots: ["breakfast"],
      perServing: { kcal: 350, proteinG: 25, carbsG: 30, fatG: 14 },
    }),
    recipe({
      id: "bowl",
      slots: ["lunch", "dinner"],
      perServing: { kcal: 600, proteinG: 45, carbsG: 60, fatG: 18 },
    }),
    recipe({
      id: "salmon",
      slots: ["lunch", "dinner"],
      perServing: { kcal: 550, proteinG: 40, carbsG: 45, fatG: 20 },
    }),
    recipe({
      id: "chili",
      slots: ["lunch", "dinner"],
      perServing: { kcal: 500, proteinG: 30, carbsG: 65, fatG: 10 },
    }),
    recipe({
      id: "yogurt",
      slots: ["snack"],
      perServing: { kcal: 180, proteinG: 15, carbsG: 20, fatG: 4 },
    }),
    recipe({
      id: "peanut",
      slots: ["snack"],
      allergens: ["peanuts"],
      perServing: { kcal: 250, proteinG: 8, carbsG: 20, fatG: 15 },
    }),
  ];
  const targets = { kcal: 2000, proteinG: 140 };

  it("remplit 7 jours × 4 repas en approchant la cible", () => {
    const plan = generateMealPlan({ recipes, targets, constraints: none, seed: 1 });
    expect(plan.meals).toHaveLength(28);
    for (const day of plan.days) {
      expect(Math.abs(day.kcal - 2000)).toBeLessThanOrEqual(200);
    }
    expect(plan.warnings.filter((w) => w.kind === "dayOffTarget")).toEqual([]);
  });

  it("équilibre chaque journée à ±10 % de la cible, quelle que soit la graine", () => {
    for (let seed = 0; seed < 50; seed += 1) {
      const plan = generateMealPlan({ recipes, targets, constraints: none, seed });
      for (const day of plan.days) expect(Math.abs(day.kcal - 2000)).toBeLessThanOrEqual(200);
    }
  });

  it("calcule les apports de chaque repas à partir des portions", () => {
    const plan = generateMealPlan({ recipes, targets, constraints: none, seed: 1 });
    for (const meal of plan.meals) {
      const source = recipes.find((item) => item.id === meal.recipeId);
      expect(meal.kcal).toBeCloseTo((source?.perServing.kcal ?? 0) * meal.portions, 5);
      expect(meal.portions % 0.25).toBe(0);
    }
  });

  it("ne propose jamais une recette contenant un allergène déclaré", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const plan = generateMealPlan({
        recipes,
        targets,
        constraints: { ...none, allergies: ["peanuts"] },
        seed,
      });
      expect(plan.meals.some((meal) => meal.recipeId === "peanut")).toBe(false);
      expect(plan.excluded.allergy).toBe(1);
    }
  });

  it("est déterministe pour une même graine", () => {
    const a = generateMealPlan({ recipes, targets, constraints: none, seed: 7 });
    const b = generateMealPlan({ recipes, targets, constraints: none, seed: 7 });
    expect(a).toEqual(b);
  });

  it("varie le déjeuner d'un jour à l'autre en mode « varié »", () => {
    const plan = generateMealPlan({
      recipes,
      targets,
      constraints: { ...none, styles: ["varied"] },
      seed: 3,
    });
    const lunches = plan.meals.filter((meal) => meal.slot === "lunch").map((meal) => meal.recipeId);
    for (let day = 1; day < lunches.length; day += 1)
      expect(lunches[day]).not.toBe(lunches[day - 1]);
  });

  it("ne sert pas le même plat au déjeuner et au dîner du même jour", () => {
    for (let seed = 0; seed < 20; seed += 1) {
      const plan = generateMealPlan({ recipes, targets, constraints: none, seed });
      for (let day = 0; day < 7; day += 1) {
        const lunch = plan.meals.find((meal) => meal.dayIndex === day && meal.slot === "lunch");
        const dinner = plan.meals.find((meal) => meal.dayIndex === day && meal.slot === "dinner");
        expect(lunch?.recipeId).not.toBe(dinner?.recipeId);
      }
    }
  });

  it("répartit la part d'un repas sans recette sur les autres", () => {
    // Seulement des déjeuners/dîners : 2000 × 0,35 / 0,65 ≈ 1077 kcal au déjeuner.
    const plan = generateMealPlan({
      recipes: recipes.filter((item) => item.slots.includes("lunch")),
      targets,
      constraints: none,
      seed: 1,
    });
    expect(plan.warnings).toEqual(
      expect.arrayContaining([
        { kind: "slotWithoutRecipe", slot: "breakfast" },
        { kind: "slotWithoutRecipe", slot: "snack" },
      ]),
    );
    expect(plan.meals).toHaveLength(14);
    for (const day of plan.days) expect(Math.abs(day.kcal - 2000)).toBeLessThanOrEqual(200);
  });

  it("ne produit aucun repas si aucune recette n'est compatible", () => {
    const plan = generateMealPlan({
      recipes,
      targets,
      constraints: { ...none, diet: "vegan" },
      seed: 1,
    });
    // Toutes les recettes de test sont « plant » : on vérifie l'inverse avec une contrainte de temps.
    expect(plan.meals.length).toBeGreaterThan(0);
    const blocked = generateMealPlan({
      recipes,
      targets,
      constraints: { ...none, maxMinutes: 5 },
      seed: 1,
    });
    expect(blocked.meals).toEqual([]);
    expect(blocked.excluded.time).toBe(recipes.length);
    expect(blocked.warnings).toHaveLength(4);
  });

  it("signale un manque de protéines", () => {
    const plan = generateMealPlan({
      recipes,
      targets: { kcal: 2000, proteinG: 250 },
      constraints: none,
      seed: 1,
    });
    expect(plan.warnings.some((warning) => warning.kind === "lowProtein")).toBe(true);
  });
});
