import type { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { generateMealPlan } from "@/domain/meal-planner";
import { recipeNutrition, recipeTraits } from "@/domain/recipe";
import { STARTER_RECIPES } from "@/features/recipes/starter-recipes";
import { asUser, createTestDatabase, createUser } from "./harness";

type FoodRow = {
  source_ref: string;
  name: string;
  kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number | null;
  allergens: string[];
  diet_class: "plant" | "vegetarian" | "fish" | "meat" | "unknown";
};

let db: PGlite;
let alice: string;
const foods = new Map<string, FoodRow>();

beforeAll(async () => {
  db = await createTestDatabase();
  alice = await createUser(db, "alice@example.test");
  const { rows } = await db.query<FoodRow>(
    "select source_ref, name, kcal::float8 as kcal, protein_g::float8 as protein_g, carbs_g::float8 as carbs_g, fat_g::float8 as fat_g, fiber_g::float8 as fiber_g, allergens, diet_class from foods where source = 'ciqual'",
  );
  for (const row of rows) foods.set(row.source_ref, row);
});

describe("catalogue CIQUAL", () => {
  it("est importé dans le catalogue partagé", async () => {
    expect(foods.size).toBeGreaterThan(3000);
    const { rows } = await db.query<{ n: number }>(
      "select count(*)::int as n from foods where source = 'ciqual' and (owner_id is not null or data_quality <> 'verified')",
    );
    expect(rows[0]?.n).toBe(0);
  });

  it("est lisible par un utilisateur mais pas modifiable", async () => {
    await asUser(db, alice, async (tx) => {
      const { rows } = await tx.query<{ n: number }>(
        "select count(*)::int as n from foods where source = 'ciqual'",
      );
      expect(rows[0]?.n).toBe(foods.size);
      const updated = await tx.query("update foods set kcal = 1 where source = 'ciqual'");
      expect(updated.affectedRows).toBe(0);
      const deleted = await tx.query("delete from foods where source = 'ciqual'");
      expect(deleted.affectedRows).toBe(0);
    });
    await expect(
      asUser(db, alice, (tx) =>
        tx.query(
          "insert into foods (owner_id, source, source_ref, data_quality, name, kcal, protein_g, carbs_g, fat_g) values (null, 'ciqual', 'x1', 'verified', 'Faux', 1, 1, 1, 1)",
        ),
      ),
    ).rejects.toThrow();
  });

  it("classe les recherches : nom commençant par le terme, puis noms courts", async () => {
    const names = await asUser(db, alice, async (tx) =>
      (await tx.query<{ name: string }>("select name from search_foods('riz blanc', 3)")).rows.map(
        (r) => r.name,
      ),
    );
    expect(names[0]).toBe("Riz blanc, cru");
    expect(names.every((name) => name.toLowerCase().startsWith("riz blanc"))).toBe(true);
  });

  it("place les aliments personnels en premier et exige tous les mots", async () => {
    const names = await asUser(db, alice, async (tx) => {
      await tx.query(
        "insert into foods (owner_id, source, data_quality, name, kcal, protein_g, carbs_g, fat_g) values ($1, 'user', 'user', 'Mon riz au lait maison', 120, 3, 20, 3)",
        [alice],
      );
      return (
        await tx.query<{ name: string }>("select name from search_foods('riz lait', 5)")
      ).rows.map((r) => r.name);
    });
    expect(names[0]).toBe("Mon riz au lait maison");
    for (const name of names) expect(name.toLowerCase()).toMatch(/riz/);
  });

  it("autorise une copie privée d'un produit Open Food Facts, une seule fois par code-barres", async () => {
    await expect(
      asUser(db, alice, async (tx) => {
        const insert = () =>
          tx.query(
            "insert into foods (owner_id, source, source_ref, data_quality, name, kcal, protein_g, carbs_g, fat_g) values ($1, 'open_food_facts', '3017620422003', 'community', 'Pâte à tartiner', 539, 6.3, 57.5, 30.9)",
            [alice],
          );
        await insert();
        await insert();
      }),
    ).rejects.toThrow(/duplicate|unique/);
  });

  it("refuse un aliment privé qui se dit issu de CIQUAL", async () => {
    await expect(
      asUser(db, alice, (tx) =>
        tx.query(
          "insert into foods (owner_id, source, source_ref, data_quality, name, kcal, protein_g, carbs_g, fat_g) values ($1, 'ciqual', '9100', 'verified', 'Riz', 350, 7, 77, 1)",
          [alice],
        ),
      ),
    ).rejects.toThrow(/foods_owner_source_check/);
  });
});

describe("recettes de départ", () => {
  const nutritionOf = (recipe: (typeof STARTER_RECIPES)[number]) => {
    const ingredients = recipe.ingredients.map((ingredient) => {
      const food = foods.get(ingredient.ciqual);
      return {
        quantityG: ingredient.grams,
        isOptional: ingredient.optional ?? false,
        food: food
          ? {
              kcal: food.kcal,
              proteinG: food.protein_g,
              carbsG: food.carbs_g,
              fatG: food.fat_g,
              fiberG: food.fiber_g,
              allergens: food.allergens,
              dietClass: food.diet_class,
            }
          : null,
      };
    });
    return { ...recipeNutrition(ingredients, recipe.servings), ...recipeTraits(ingredients) };
  };

  it("ont des clés uniques et des codes CIQUAL existants", () => {
    const keys = STARTER_RECIPES.map((recipe) => recipe.key);
    expect(new Set(keys).size).toBe(keys.length);
    const missing = STARTER_RECIPES.flatMap((recipe) =>
      recipe.ingredients
        .filter((ingredient) => !foods.has(ingredient.ciqual))
        .map((i) => `${recipe.key}:${i.ciqual}`),
    );
    expect(missing).toEqual([]);
  });

  it("ont des portions réalistes pour leur repas", () => {
    for (const recipe of STARTER_RECIPES) {
      const { perServing, isComplete } = nutritionOf(recipe);
      expect(isComplete).toBe(true);
      const isSnackOnly = recipe.slots.every((slot) => slot === "snack");
      const [min, max] = isSnackOnly ? [120, 300] : [300, 800];
      expect(perServing.kcal, recipe.key).toBeGreaterThanOrEqual(min);
      expect(perServing.kcal, recipe.key).toBeLessThanOrEqual(max);
    }
  });

  it("étiquetées « végétalien » : aucun ingrédient animal ni lait / œuf", () => {
    for (const recipe of STARTER_RECIPES.filter((item) => item.tags.includes("végétalien"))) {
      const traits = nutritionOf(recipe);
      expect(traits.dietClass, recipe.key).toBe("plant");
      expect(traits.allergens, recipe.key).not.toContain("milk");
      expect(traits.allergens, recipe.key).not.toContain("eggs");
    }
  });

  it("permettent un plan à ±10 % de la cible pour des profils variés", () => {
    const planner = STARTER_RECIPES.map((recipe) => {
      const nutrition = nutritionOf(recipe);
      return {
        id: recipe.key,
        title: recipe.title,
        slots: recipe.slots,
        perServing: nutrition.perServing,
        isComplete: nutrition.isComplete,
        allergens: nutrition.allergens,
        dietClass: nutrition.dietClass,
        totalMinutes: recipe.prepMinutes + recipe.cookMinutes,
        ingredientNames: recipe.ingredients.map((i) => foods.get(i.ciqual)?.name ?? ""),
      };
    });
    const profiles = [
      { kcal: 2320, proteinG: 160, diet: "omnivore" as const, maxMinutes: 30 },
      { kcal: 1500, proteinG: 110, diet: "omnivore" as const, maxMinutes: null },
      { kcal: 3000, proteinG: 150, diet: "vegetarian" as const, maxMinutes: 45 },
      { kcal: 1860, proteinG: 99, diet: "vegan" as const, maxMinutes: 30 },
    ];
    for (const profile of profiles) {
      for (let seed = 0; seed < 20; seed += 1) {
        const plan = generateMealPlan({
          recipes: planner,
          targets: { kcal: profile.kcal, proteinG: profile.proteinG },
          constraints: {
            allergies: [],
            excludedIngredients: [],
            diet: profile.diet,
            maxMinutes: profile.maxMinutes,
            styles: [],
          },
          seed,
        });
        for (const day of plan.days) {
          expect(
            Math.abs(day.kcal - profile.kcal),
            `${profile.diet} ${profile.kcal}`,
          ).toBeLessThanOrEqual(profile.kcal * 0.1);
        }
      }
    }
  });

  it("calcule le poulet-riz-brocolis comme à la main", () => {
    // Poulet 300 g × 110 = 330 ; riz 150 g × 350 = 525 ; brocoli 300 g × 31,9 = 95,7 ;
    // huile 10 g × 899 = 89,9. Total 1040,6 kcal → 520,3 par portion.
    const recipe = STARTER_RECIPES.find((item) => item.key === "poulet-riz-brocolis");
    if (!recipe) throw new Error("recette manquante");
    expect(nutritionOf(recipe).perServing.kcal).toBeCloseTo(520.3, 1);
  });
});

describe("plans et recettes de départ", () => {
  it("garde des portions au quart près dans un plan", async () => {
    const servings = await asUser(db, alice, async (tx) => {
      const plan = await tx.query<{ id: string }>(
        "insert into meal_plans (week_start) values ('2026-10-12') returning id",
      );
      const planId = plan.rows[0]?.id;
      const item = await tx.query<{ servings: string }>(
        "insert into meal_plan_items (meal_plan_id, day_index, meal_slot, title, servings) values ($1, 0, 'lunch', 'Test', 1.25) returning servings::text",
        [planId],
      );
      return item.rows[0]?.servings;
    });
    expect(servings).toBe("1.25");
  });

  it("n'ajoute pas deux fois la même recette de départ", async () => {
    await expect(
      asUser(db, alice, async (tx) => {
        const insert = () =>
          tx.query(
            "insert into recipes (title, origin, starter_key, meal_slots) values ('Porridge', 'starter', 'porridge-banane', '{breakfast}')",
          );
        await insert();
        await insert();
      }),
    ).rejects.toThrow(/recipes_one_starter_per_user/);
  });

  it("refuse un repas inconnu dans les créneaux d'une recette", async () => {
    await expect(
      asUser(db, alice, (tx) =>
        tx.query("insert into recipes (title, meal_slots) values ('X', '{brunch}')"),
      ),
    ).rejects.toThrow(/check constraint/);
  });
});
