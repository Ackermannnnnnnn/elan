import { describe, expect, it } from "vitest";
import { addDays } from "@/lib/dates";
import {
  analyzeTrend,
  directionForGoal,
  movingAverage,
  weeklySlope,
  weightProgress,
  type WeightPoint,
} from "./weight-trend";

const TODAY = "2026-10-28";

/** Série de pesées : une tous les `step` jours en remontant depuis TODAY. */
function series(weights: number[], step = 1): WeightPoint[] {
  return weights.map((weightKg, index) => ({
    date: addDays(TODAY, -(weights.length - 1 - index) * step),
    weightKg,
  }));
}

describe("moyenne glissante sur 7 jours", () => {
  it("moyenne les pesées des 7 derniers jours civils", () => {
    const result = movingAverage(series([80, 81, 79, 80, 82, 78, 80, 73]));
    // 7e point : moyenne des 7 premiers = 560 / 7 = 80.
    expect(result[6]?.averageKg).toBe(80);
    // 8e point : la première pesée sort de la fenêtre → (81+79+80+82+78+80+73) / 7 = 79.
    expect(result[7]?.averageKg).toBe(79);
  });

  it("se base sur les jours, pas sur le nombre de mesures", () => {
    const points: WeightPoint[] = [
      { date: "2026-10-01", weightKg: 90 },
      { date: "2026-10-20", weightKg: 80 },
      { date: "2026-10-21", weightKg: 82 },
    ];
    // La pesée du 1er octobre est hors fenêtre pour le 21 : (80 + 82) / 2.
    expect(movingAverage(points)[2]?.averageKg).toBe(81);
  });

  it("trie les pesées par date et ne modifie pas l'entrée", () => {
    const points: WeightPoint[] = [
      { date: "2026-10-03", weightKg: 81 },
      { date: "2026-10-01", weightKg: 80 },
    ];
    expect(movingAverage(points).map((point) => point.date)).toEqual(["2026-10-01", "2026-10-03"]);
    expect(points[0]?.date).toBe("2026-10-03");
  });

  it("lisse une fluctuation isolée", () => {
    const result = movingAverage(series([80, 80, 80, 80, 80, 80, 81.4]));
    expect(result.at(-1)?.averageKg).toBe(80.2);
  });
});

describe("pente hebdomadaire", () => {
  it("−0,1 kg par jour = −0,7 kg par semaine", () => {
    const points = series(Array.from({ length: 15 }, (_, index) => 80 - index * 0.1));
    expect(weeklySlope(points)).toBe(-0.7);
  });

  it("nulle pour un poids constant, indéfinie avec une seule mesure", () => {
    expect(weeklySlope(series([80, 80, 80, 80]))).toBe(0);
    expect(weeklySlope(series([80]))).toBeNull();
    expect(weeklySlope([])).toBeNull();
  });
});

describe("analyse de la tendance", () => {
  it("ne conclut jamais à partir d'une seule mesure", () => {
    expect(analyzeTrend(series([80]), TODAY, "loss").status).toBe("insufficient_data");
  });

  it("ne conclut pas sur moins de trois semaines, même avec beaucoup de pesées", () => {
    const tenDays = series([80, 80, 80, 80, 80, 80, 80, 80, 80, 80]);
    expect(analyzeTrend(tenDays, TODAY, "loss")).toMatchObject({
      status: "insufficient_data",
      weeklyRateKg: null,
      spanDays: 9,
    });
  });

  it("ne conclut pas avec trop peu de pesées, même étalées", () => {
    const sparse = series([80, 80, 80, 80], 7);
    expect(analyzeTrend(sparse, TODAY, "loss").status).toBe("insufficient_data");
  });

  it("détecte une stagnation durable malgré les fluctuations quotidiennes", () => {
    const noise = [0.4, -0.3, 0.2, -0.5, 0.1, 0.3, -0.2, 0.5, -0.4, 0.0, 0.2, -0.1];
    const flat = series(
      noise.map((delta) => 80 + delta),
      2,
    );
    const result = analyzeTrend(flat, TODAY, "loss");
    expect(result.status).toBe("plateau");
    expect(Math.abs(result.weeklyRateKg ?? 1)).toBeLessThan(0.1);
  });

  it("une perte régulière est en bonne voie, pas une stagnation", () => {
    const losing = series(
      Array.from({ length: 12 }, (_, index) => 82 - index * 0.15),
      2,
    );
    const result = analyzeTrend(losing, TODAY, "loss");
    expect(result.status).toBe("on_track");
    expect(result.weeklyRateKg).toBeLessThan(-0.3);
  });

  it("signale une tendance à contresens de l'objectif", () => {
    const gaining = series(
      Array.from({ length: 12 }, (_, index) => 80 + index * 0.15),
      2,
    );
    expect(analyzeTrend(gaining, TODAY, "loss").status).toBe("off_track");
    expect(analyzeTrend(gaining, TODAY, "gain").status).toBe("on_track");
  });

  it("pour un maintien, un poids stable est le résultat attendu", () => {
    const flat = series(
      Array.from({ length: 12 }, () => 70),
      2,
    );
    expect(analyzeTrend(flat, TODAY, "maintain").status).toBe("stable");
  });

  it("ignore les pesées de plus de 28 jours", () => {
    const old = series([90, 90, 90, 90, 90, 90, 90], 1).map((point) => ({
      ...point,
      date: addDays(point.date, -60),
    }));
    expect(analyzeTrend(old, TODAY, "loss").entriesInWindow).toBe(0);
  });
});

describe("progression vers la cible", () => {
  it("perte : 3 kg perdus sur 8", () => {
    expect(weightProgress({ startKg: 80, currentKg: 77, targetKg: 72 })).toEqual({
      startKg: 80,
      currentKg: 77,
      changeKg: -3,
      remainingKg: 5,
      percent: 38,
    });
  });

  it("prise : 2 kg pris sur 5", () => {
    expect(weightProgress({ startKg: 70, currentKg: 72, targetKg: 75 }).percent).toBe(40);
  });

  it("borne la progression entre 0 et 100 %", () => {
    expect(weightProgress({ startKg: 80, currentKg: 82, targetKg: 72 }).percent).toBe(0);
    expect(weightProgress({ startKg: 80, currentKg: 71, targetKg: 72 }).percent).toBe(100);
  });

  it("sans cible : seulement la variation", () => {
    expect(weightProgress({ startKg: 80, currentKg: 78.6, targetKg: null })).toMatchObject({
      changeKg: -1.4,
      remainingKg: null,
      percent: null,
    });
  });
});

describe("sens attendu selon l'objectif", () => {
  it.each([
    ["fat_loss", "loss"],
    ["recomposition", "loss"],
    ["muscle_gain", "gain"],
    ["maintenance", "maintain"],
    ["fitness", "maintain"],
    [null, "maintain"],
  ] as const)("%s → %s", (goal, direction) => {
    expect(directionForGoal(goal)).toBe(direction);
  });
});
