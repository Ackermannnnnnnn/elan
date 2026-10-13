import { describe, expect, it } from "vitest";
import { mapOpenFoodFactsProduct, normalizeBarcode } from "./map";

// Forme d'une réponse de l'API v2 (champs utiles seulement), modelée sur les
// réponses de référence des tests d'intégration d'Open Food Facts.
const found = (product: Record<string, unknown>) => ({
  code: "3017620422003",
  status: 1,
  status_verbose: "product found",
  product,
});

const biscuit = {
  product_name: "Some product",
  product_name_fr: "Biscuits au chocolat",
  brands: "Marque A, Marque B",
  allergens_tags: ["en:apple", "en:eggs", "en:milk", "en:soybeans"],
  traces_tags: ["en:nuts"],
  ingredients_analysis_tags: ["en:palm-oil", "en:non-vegan", "en:vegetarian"],
  categories_tags: ["en:snacks", "en:biscuits"],
  serving_quantity: 10,
  serving_size: "10 g",
  nutriments: {
    "energy-kcal_100g": 140.5,
    energy_100g: 400,
    proteins_100g: 4.5,
    carbohydrates_100g: 10.5,
    fat_100g: 8.5,
    fiber_100g: 2,
    sugars_100g: 12.5,
    "saturated-fat_100g": 5.6,
    salt_100g: 0.0502,
  },
};

describe("normalizeBarcode", () => {
  it("accepte 8 à 14 chiffres, espaces et tirets ignorés", () => {
    expect(normalizeBarcode(" 3017 6204-22003 ")).toBe("3017620422003");
    expect(normalizeBarcode("1234567")).toBeNull();
    expect(normalizeBarcode("abc12345678")).toBeNull();
  });
});

describe("mapOpenFoodFactsProduct", () => {
  it("convertit une fiche complète", () => {
    const result = mapOpenFoodFactsProduct("3017620422003", found(biscuit));
    expect(result).toEqual({
      ok: true,
      food: {
        barcode: "3017620422003",
        name: "Biscuits au chocolat",
        brand: "Marque A",
        kcal: 140.5,
        proteinG: 4.5,
        carbsG: 10.5,
        fatG: 8.5,
        fiberG: 2,
        sugarsG: 12.5,
        saturatedFatG: 5.6,
        saltG: 0.05,
        servingSizeG: 10,
        servingLabel: "10 g",
        // Allergènes déclarés + traces + déduits du nom (« biscuit » → gluten).
        allergens: ["eggs", "gluten", "milk", "nuts", "soy"],
        dietClass: "vegetarian",
        aisle: "grocery",
      },
    });
  });

  it("déduit les kcal des kJ si besoin (1 kcal = 4,184 kJ)", () => {
    const withoutKcal: Record<string, number> = { ...biscuit.nutriments };
    delete withoutKcal["energy-kcal_100g"];
    const result = mapOpenFoodFactsProduct(
      "3017620422003",
      found({ ...biscuit, nutriments: withoutKcal }),
    );
    expect(result.ok && result.food.kcal).toBe(95.6);
  });

  it("refuse une fiche sans les macros principales", () => {
    const withoutFat: Record<string, number> = { ...biscuit.nutriments };
    delete withoutFat.fat_100g;
    expect(mapOpenFoodFactsProduct("1", found({ ...biscuit, nutriments: withoutFat }))).toEqual({
      ok: false,
      reason: "incomplete",
    });
    expect(
      mapOpenFoodFactsProduct("1", found({ ...biscuit, product_name_fr: "", product_name: "" })),
    ).toEqual({
      ok: false,
      reason: "incomplete",
    });
  });

  it("reconnaît un produit inconnu", () => {
    expect(
      mapOpenFoodFactsProduct("12345678", {
        code: "12345678",
        status: 0,
        status_verbose: "product not found",
      }),
    ).toEqual({ ok: false, reason: "notFound" });
  });

  it("classe le régime d'après l'analyse des ingrédients", () => {
    const vegan = mapOpenFoodFactsProduct(
      "1",
      found({
        ...biscuit,
        product_name_fr: "Boisson soja",
        ingredients_analysis_tags: ["en:vegan"],
      }),
    );
    expect(vegan.ok && vegan.food.dietClass).toBe("plant");
    const tuna = mapOpenFoodFactsProduct(
      "1",
      found({
        ...biscuit,
        product_name_fr: "Thon au naturel",
        ingredients_analysis_tags: ["en:non-vegetarian"],
        categories_tags: ["en:fishes"],
      }),
    );
    expect(tuna.ok && tuna.food.dietClass).toBe("fish");
    expect(tuna.ok && tuna.food.aisle).toBe("meat_fish");
  });

  it("ignore des valeurs impossibles", () => {
    const result = mapOpenFoodFactsProduct(
      "1",
      found({ ...biscuit, nutriments: { ...biscuit.nutriments, proteins_100g: 450 } }),
    );
    expect(result).toEqual({ ok: false, reason: "incomplete" });
  });
});
