import { describe, expect, it } from "vitest";
import { aggregateShopping, roundUpQuantity, shoppingTotal, type ShoppingRecipe } from "./shopping";

describe("roundUpQuantity", () => {
  it("arrondit au gramme sous 20 g, puis par 5 g", () => {
    expect(roundUpQuantity(12.2)).toBe(13);
    expect(roundUpQuantity(137.4)).toBe(140);
    expect(roundUpQuantity(140)).toBe(140);
    expect(roundUpQuantity(0)).toBe(0);
  });
});

describe("aggregateShopping", () => {
  const recipes = new Map<string, ShoppingRecipe>([
    [
      "bowl",
      {
        servings: 2,
        ingredients: [
          {
            foodId: "rice",
            name: "Riz blanc, cru",
            quantityG: 160,
            isOptional: false,
            aisle: "grocery",
          },
          {
            foodId: "chicken",
            name: "Poulet, filet",
            quantityG: 300,
            isOptional: false,
            aisle: "meat_fish",
          },
          { foodId: "herbs", name: "Coriandre", quantityG: 5, isOptional: true, aisle: "produce" },
        ],
      },
    ],
    [
      "salad",
      {
        servings: 1,
        ingredients: [
          {
            foodId: "rice",
            name: "Riz blanc, cru",
            quantityG: 60,
            isOptional: false,
            aisle: "grocery",
          },
          {
            foodId: "tomato",
            name: "Tomate, crue",
            quantityG: 150,
            isOptional: false,
            aisle: "produce",
          },
        ],
      },
    ],
  ]);

  it("additionne au prorata des portions et range par rayon", () => {
    // Bol : 1,5 + 0,5 portion = 2 portions = la recette entière (160 g de riz, 300 g de poulet).
    // Salade : 1,5 portion → 90 g de riz, 225 g de tomate. Riz total : 250 g.
    const needs = aggregateShopping(
      [
        { recipeId: "bowl", portions: 1.5 },
        { recipeId: "bowl", portions: 0.5 },
        { recipeId: "salad", portions: 1.5 },
        { recipeId: null, portions: 1 },
      ],
      recipes,
    );
    expect(needs).toEqual([
      { foodId: "tomato", name: "Tomate, crue", quantityG: 225, aisle: "produce" },
      { foodId: "chicken", name: "Poulet, filet", quantityG: 300, aisle: "meat_fish" },
      { foodId: "rice", name: "Riz blanc, cru", quantityG: 250, aisle: "grocery" },
    ]);
  });
});

describe("shoppingTotal", () => {
  it("n'additionne que les prix saisis et ignore ce qu'on a déjà", () => {
    expect(
      shoppingTotal([
        { estimatedPriceEur: 2.5, alreadyOwned: false },
        { estimatedPriceEur: 1.25, alreadyOwned: false },
        { estimatedPriceEur: null, alreadyOwned: false },
        { estimatedPriceEur: 9, alreadyOwned: true },
      ]),
    ).toEqual({ totalEur: 3.75, priced: 2, unpriced: 1 });
  });
});
