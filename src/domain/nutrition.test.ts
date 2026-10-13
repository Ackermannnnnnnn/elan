import { describe, expect, it } from "vitest";
import {
  gramsFromServings,
  labelLooksConsistent,
  macrosForQuantity,
  progressTowards,
  sumMacros,
  type FoodPer100,
} from "./nutrition";

// Valeurs fictives pour les tests, exprimées pour 100 g.
const rice: FoodPer100 = { kcal: 130, proteinG: 2.7, carbsG: 28, fatG: 0.3, fiberG: 0.4 };
const chicken: FoodPer100 = { kcal: 165, proteinG: 31, carbsG: 0, fatG: 3.6, fiberG: 0 };
const noFiberInfo: FoodPer100 = { kcal: 52, proteinG: 0.3, carbsG: 14, fatG: 0.2, fiberG: null };

describe("apports pour une quantité", () => {
  it("200 g de riz = 2 × les valeurs pour 100 g", () => {
    expect(macrosForQuantity(rice, 200)).toEqual({
      kcal: 260,
      proteinG: 5.4,
      carbsG: 56,
      fatG: 0.6,
      fiberG: 0.8,
    });
  });

  it("150 g de poulet", () => {
    expect(macrosForQuantity(chicken, 150)).toEqual({
      kcal: 247.5,
      proteinG: 46.5,
      carbsG: 0,
      fatG: 5.4,
      fiberG: 0,
    });
  });

  it("conserve l'absence d'information sur les fibres", () => {
    expect(macrosForQuantity(noFiberInfo, 120).fiberG).toBeNull();
  });

  it("arrondit au dixième", () => {
    expect(macrosForQuantity(rice, 33).kcal).toBe(42.9);
  });
});

describe("portions", () => {
  it("convertit des portions en grammes", () => {
    expect(gramsFromServings(1.5, 30)).toBe(45);
  });

  it("renvoie null si l'aliment n'a pas de portion définie", () => {
    expect(gramsFromServings(2, null)).toBeNull();
    expect(gramsFromServings(2, 0)).toBeNull();
  });
});

describe("total d'un repas", () => {
  it("additionne les apports", () => {
    const total = sumMacros([macrosForQuantity(rice, 200), macrosForQuantity(chicken, 150)]);
    expect(total).toEqual({
      kcal: 507.5,
      proteinG: 51.9,
      carbsG: 56,
      fatG: 6,
      fiberG: 0.8,
      fiberIsPartial: false,
    });
  });

  it("signale un total de fibres incomplet", () => {
    const total = sumMacros([macrosForQuantity(rice, 100), macrosForQuantity(noFiberInfo, 100)]);
    expect(total.fiberG).toBe(0.4);
    expect(total.fiberIsPartial).toBe(true);
  });

  it("vaut zéro pour une journée vide", () => {
    expect(sumMacros([])).toMatchObject({ kcal: 0, proteinG: 0, carbsG: 0, fatG: 0 });
  });

  it("n'accumule pas d'erreurs d'arrondi flottant", () => {
    const tenth = { kcal: 0.1, proteinG: 0.1, carbsG: 0.1, fatG: 0.1, fiberG: 0.1 };
    expect(sumMacros([tenth, tenth, tenth]).kcal).toBe(0.3);
  });
});

describe("progression vers une cible", () => {
  it("calcule le reste et le pourcentage", () => {
    expect(progressTowards(1450, 2320)).toEqual({
      consumed: 1450,
      target: 2320,
      remaining: 870,
      percent: 63,
      isOver: false,
    });
  });

  it("signale un dépassement sans dépasser 100 % à l'affichage", () => {
    expect(progressTowards(2500, 2320)).toMatchObject({
      remaining: -180,
      percent: 100,
      isOver: true,
    });
  });

  it("supporte une cible nulle", () => {
    expect(progressTowards(100, 0).percent).toBe(0);
  });
});

describe("cohérence d'une étiquette", () => {
  it("accepte une étiquette cohérente", () => {
    expect(labelLooksConsistent(rice)).toBe(true);
    expect(labelLooksConsistent(chicken)).toBe(true);
  });

  it("repère une énergie incompatible avec les macros", () => {
    expect(
      labelLooksConsistent({ kcal: 50, proteinG: 20, carbsG: 60, fatG: 10, fiberG: null }),
    ).toBe(false);
  });

  it("tolère les aliments quasi sans calories", () => {
    expect(
      labelLooksConsistent({ kcal: 2, proteinG: 0.1, carbsG: 0.3, fatG: 0, fiberG: null }),
    ).toBe(true);
  });
});
