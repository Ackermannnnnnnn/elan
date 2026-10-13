import { describe, expect, it } from "vitest";
import { recipeNutrition, recipeTraits, type RecipeIngredient } from "./recipe";

const chicken: RecipeIngredient["food"] = {
  kcal: 100,
  proteinG: 20,
  carbsG: 0,
  fatG: 2,
  fiberG: 0,
  allergens: [],
  dietClass: "meat",
};
const rice: RecipeIngredient["food"] = {
  kcal: 350,
  proteinG: 7,
  carbsG: 77,
  fatG: 0.6,
  fiberG: 1.4,
  allergens: [],
  dietClass: "plant",
};
const cheese: RecipeIngredient["food"] = {
  kcal: 400,
  proteinG: 25,
  carbsG: 0,
  fatG: 33,
  fiberG: null,
  allergens: ["milk"],
  dietClass: "vegetarian",
};

describe("recipeNutrition", () => {
  it("additionne les ingrédients puis divise par le nombre de portions", () => {
    // Poulet 150 g : 150 kcal, P 30, F 3, fibres 0.
    // Riz 80 g : 280 kcal, P 5,6, G 61,6, F 0,48 → 0,5, fibres 1,12 → 1,1.
    // Fromage optionnel : ignoré.
    const result = recipeNutrition(
      [
        { quantityG: 150, isOptional: false, food: chicken },
        { quantityG: 80, isOptional: false, food: rice },
        { quantityG: 30, isOptional: true, food: cheese },
      ],
      2,
    );
    expect(result.total).toEqual({
      kcal: 430,
      proteinG: 35.6,
      carbsG: 61.6,
      fatG: 3.5,
      fiberG: 1.1,
    });
    expect(result.perServing).toEqual({
      kcal: 215,
      proteinG: 17.8,
      carbsG: 30.8,
      fatG: 1.8,
      fiberG: 0.6,
    });
    expect(result.isComplete).toBe(true);
  });

  it("signale un calcul incomplet si un ingrédient n'a pas d'aliment", () => {
    const result = recipeNutrition(
      [
        { quantityG: 150, isOptional: false, food: chicken },
        { quantityG: 10, isOptional: false, food: null },
      ],
      1,
    );
    expect(result.isComplete).toBe(false);
    expect(result.perServing.kcal).toBe(150);
  });

  it("rend les fibres inconnues si un ingrédient n'en indique pas", () => {
    const result = recipeNutrition([{ quantityG: 100, isOptional: false, food: cheese }], 1);
    expect(result.perServing.fiberG).toBeNull();
  });

  it("n'est pas complète sans ingrédient", () => {
    expect(recipeNutrition([], 1).isComplete).toBe(false);
  });
});

describe("recipeTraits", () => {
  it("réunit les allergènes, optionnels compris, et garde le régime le plus restrictif", () => {
    const traits = recipeTraits([
      { quantityG: 80, isOptional: false, food: rice },
      { quantityG: 30, isOptional: true, food: cheese },
    ]);
    expect(traits).toEqual({ allergens: ["milk"], dietClass: "vegetarian" });
    expect(recipeTraits([{ quantityG: 150, isOptional: false, food: chicken }]).dietClass).toBe(
      "meat",
    );
  });

  it("devient inconnue avec un ingrédient non identifié, sauf viande ou poisson", () => {
    expect(
      recipeTraits([
        { quantityG: 80, isOptional: false, food: rice },
        { quantityG: 10, isOptional: false, food: null },
      ]).dietClass,
    ).toBe("unknown");
    expect(
      recipeTraits([
        { quantityG: 150, isOptional: false, food: chicken },
        { quantityG: 10, isOptional: false, food: null },
      ]).dietClass,
    ).toBe("meat");
  });
});
