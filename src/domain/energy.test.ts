import { describe, expect, it } from "vitest";
import {
  assessGoal,
  basalMetabolicRate,
  bmi,
  buildNutritionPlan,
  calorieTarget,
  energyFromMacros,
  macroTargets,
  maintenanceCalories,
  referenceWeight,
  shouldRecalculate,
  suggestActivityLevel,
  suggestedWaterMl,
  weeksToTarget,
  weightAtBmi,
} from "./energy";

// Toutes les valeurs attendues ci-dessous ont été calculées à la main à partir
// des formules citées en tête de energy.ts.

describe("métabolisme de base (Mifflin-St Jeor)", () => {
  it("homme : 10 × 80 + 6,25 × 180 − 5 × 30 + 5 = 1780", () => {
    expect(basalMetabolicRate({ weightKg: 80, heightCm: 180, age: 30, sex: "male" })).toEqual({
      kcal: 1780,
      formula: "mifflin_st_jeor",
      sexAveraged: false,
    });
  });

  it("femme : 10 × 65 + 6,25 × 165 − 5 × 30 − 161 = 1370,25 → 1370", () => {
    expect(basalMetabolicRate({ weightKg: 65, heightCm: 165, age: 30, sex: "female" }).kcal).toBe(
      1370,
    );
  });

  it("sexe non précisé : constante moyenne (−78) et estimation signalée comme moins précise", () => {
    const result = basalMetabolicRate({ weightKg: 80, heightCm: 180, age: 30, sex: null });
    expect(result.kcal).toBe(1697);
    expect(result.sexAveraged).toBe(true);
  });

  it("baisse de 5 kcal par année d'âge", () => {
    const at30 = basalMetabolicRate({ weightKg: 70, heightCm: 170, age: 30, sex: "female" }).kcal;
    const at40 = basalMetabolicRate({ weightKg: 70, heightCm: 170, age: 40, sex: "female" }).kcal;
    expect(at30 - at40).toBe(50);
  });
});

describe("maintien", () => {
  it.each([
    ["sedentary", 2136],
    ["light", 2448],
    ["moderate", 2759],
    ["active", 3071],
    ["very_active", 3382],
  ] as const)("1780 kcal × coefficient %s = %i", (level, expected) => {
    expect(maintenanceCalories(1780, level)).toBe(expected);
  });
});

describe("suggestion du niveau d'activité", () => {
  it("bureau, peu de pas, pas de sport → sédentaire", () => {
    expect(
      suggestActivityLevel({
        occupation: "sedentary",
        dailySteps: 3000,
        sessionsPerWeek: 0,
        sessionMinutes: 0,
      }),
    ).toBe("sedentary");
  });

  it("bureau, 8 000 pas, 4 séances d'une heure → modéré", () => {
    expect(
      suggestActivityLevel({
        occupation: "sedentary",
        dailySteps: 8000,
        sessionsPerWeek: 4,
        sessionMinutes: 60,
      }),
    ).toBe("moderate");
  });

  it("travail physique, 12 000 pas, 5 séances d'une heure → très actif", () => {
    expect(
      suggestActivityLevel({
        occupation: "physical",
        dailySteps: 12000,
        sessionsPerWeek: 5,
        sessionMinutes: 60,
      }),
    ).toBe("very_active");
  });

  it("pas inconnus : comptés comme faibles, sans faire échouer le calcul", () => {
    expect(
      suggestActivityLevel({
        occupation: "standing",
        dailySteps: null,
        sessionsPerWeek: 2,
        sessionMinutes: 45,
      }),
    ).toBe("light");
  });
});

describe("objectif calorique", () => {
  const base = { weightKg: 80, maintenanceKcal: 2759, sex: "male" as const };

  it("perte modérée : 0,5 % de 80 kg = 0,4 kg/sem → 440 kcal de déficit", () => {
    expect(calorieTarget({ ...base, goalType: "fat_loss", pace: "moderate" })).toEqual({
      targetKcal: 2320,
      dailyDeltaKcal: -439,
      requestedWeeklyRateKg: -0.4,
      expectedWeeklyRateKg: -0.4,
      adjustments: [],
    });
  });

  it("maintien et remise en forme : aucune modification", () => {
    for (const goalType of ["maintenance", "fitness"] as const) {
      const result = calorieTarget({ ...base, goalType, pace: "fast" });
      expect(result.targetKcal).toBe(2760);
      expect(result.expectedWeeklyRateKg).toBe(0);
      expect(result.adjustments).toEqual([]);
    }
  });

  it("prise de masse modérée : 0,25 % de 80 kg = 0,2 kg/sem → +220 kcal", () => {
    const result = calorieTarget({ ...base, goalType: "muscle_gain", pace: "moderate" });
    expect(result.targetKcal).toBe(2980);
    expect(result.requestedWeeklyRateKg).toBe(0.2);
    expect(result.adjustments).toEqual([]);
  });

  it("recomposition : 10 % sous le maintien", () => {
    expect(calorieTarget({ ...base, goalType: "recomposition", pace: "moderate" }).targetKcal).toBe(
      2480,
    );
  });

  it("plafonne le déficit à 25 % du maintien et recalcule le rythme réel", () => {
    // Femme 65 kg, maintien 1644. Rapide : 0,4875 kg/sem → 536 kcal > 411 (25 %).
    const result = calorieTarget({
      goalType: "fat_loss",
      pace: "fast",
      weightKg: 65,
      maintenanceKcal: 1644,
      sex: "female",
    });
    expect(result.targetKcal).toBe(1230);
    expect(result.adjustments).toEqual(["deficit_capped"]);
    expect(result.requestedWeeklyRateKg).toBe(-0.49);
    expect(result.expectedWeeklyRateKg).toBe(-0.38);
  });

  it("applique le plancher de 1200 kcal (femme) plutôt qu'un déficit dangereux", () => {
    // Maintien 1270, perte modérée → 995 kcal demandés.
    const result = calorieTarget({
      goalType: "fat_loss",
      pace: "moderate",
      weightKg: 50,
      maintenanceKcal: 1270,
      sex: "female",
    });
    expect(result.targetKcal).toBe(1200);
    expect(result.adjustments).toEqual(["floor_applied"]);
    expect(result.expectedWeeklyRateKg).toBe(-0.06);
  });

  it("plancher de 1500 kcal pour un homme ou un sexe non précisé", () => {
    for (const sex of ["male", null] as const) {
      const result = calorieTarget({
        goalType: "fat_loss",
        pace: "fast",
        weightKg: 60,
        maintenanceKcal: 1800,
        sex,
      });
      expect(result.targetKcal).toBe(1500);
      expect(result.adjustments).toContain("floor_applied");
    }
  });

  it("ne propose jamais une cible au-dessus du maintien pour une perte de poids", () => {
    // Maintien déjà sous le plancher : on reste au maintien, sans déficit.
    const result = calorieTarget({
      goalType: "fat_loss",
      pace: "gentle",
      weightKg: 42,
      maintenanceKcal: 1150,
      sex: "female",
    });
    expect(result.targetKcal).toBe(1150);
    expect(result.expectedWeeklyRateKg).toBe(0);
  });

  it("plafonne le surplus à 500 kcal", () => {
    const result = calorieTarget({
      goalType: "muscle_gain",
      pace: "fast",
      weightKg: 130,
      maintenanceKcal: 3800,
      sex: "male",
    });
    expect(result.targetKcal).toBe(4300);
    expect(result.adjustments).toEqual(["surplus_capped"]);
  });

  it("aucun rythme proposé ne dépasse 1 % du poids par semaine", () => {
    for (const weightKg of [50, 80, 120, 180]) {
      const maintenanceKcal = maintenanceCalories(
        basalMetabolicRate({ weightKg, heightCm: 175, age: 35, sex: "male" }).kcal,
        "very_active",
      );
      const result = calorieTarget({
        goalType: "fat_loss",
        pace: "fast",
        weightKg,
        maintenanceKcal,
        sex: "male",
      });
      expect(Math.abs(result.expectedWeeklyRateKg)).toBeLessThanOrEqual(weightKg * 0.01);
    }
  });
});

describe("macronutriments", () => {
  it("perte de poids, 80 kg, 2320 kcal : 160 g de protéines, 64 g de lipides, 276 g de glucides", () => {
    const result = macroTargets({
      targetKcal: 2320,
      goalType: "fat_loss",
      weightKg: 80,
      heightCm: 180,
    });
    expect(result).toEqual({
      proteinG: 160,
      carbsG: 276,
      fatG: 64,
      fiberG: 32,
      energyShare: { protein: 28, carbs: 48, fat: 25 },
      referenceWeightKg: 80,
    });
  });

  it("l'énergie des macros retombe sur la cible calorique (à l'arrondi près)", () => {
    for (const targetKcal of [1200, 1500, 1850, 2320, 2980, 3600]) {
      for (const goalType of ["fat_loss", "maintenance", "muscle_gain"] as const) {
        const macros = macroTargets({ targetKcal, goalType, weightKg: 75, heightCm: 172 });
        expect(Math.abs(energyFromMacros(macros) - targetKcal)).toBeLessThanOrEqual(9);
      }
    }
  });

  it("au-delà d'un IMC de 30, utilise un poids ajusté", () => {
    // 120 kg, 175 cm : poids à IMC 25 = 76,56 kg ; ajusté = 76,56 + 0,4 × 43,44 = 93,94 kg.
    expect(referenceWeight(120, 175)).toBeCloseTo(93.94, 2);
    const result = macroTargets({
      targetKcal: 2400,
      goalType: "fat_loss",
      weightKg: 120,
      heightCm: 175,
    });
    expect(result.proteinG).toBe(188);
    expect(result.referenceWeightKg).toBe(93.9);
  });

  it("plafonne les protéines à 35 % de l'énergie", () => {
    // 2 g/kg × 80 kg = 160 g, mais 35 % de 1500 kcal = 131 g.
    expect(
      macroTargets({ targetKcal: 1500, goalType: "fat_loss", weightKg: 80, heightCm: 180 })
        .proteinG,
    ).toBe(131);
  });

  it("garantit un minimum de lipides de 0,6 g/kg", () => {
    // 25 % de 1500 kcal = 42 g ; 0,6 × 80 = 48 g.
    expect(
      macroTargets({ targetKcal: 1500, goalType: "fat_loss", weightKg: 80, heightCm: 180 }).fatG,
    ).toBe(48);
  });

  it("ne renvoie jamais de glucides négatifs", () => {
    const result = macroTargets({
      targetKcal: 1200,
      goalType: "fat_loss",
      weightKg: 110,
      heightCm: 190,
    });
    expect(result.carbsG).toBeGreaterThanOrEqual(0);
  });
});

describe("durée estimée", () => {
  it("8 kg à perdre à 0,4 kg/sem → 20 semaines", () => {
    expect(weeksToTarget({ weightKg: 80, targetWeightKg: 72, expectedWeeklyRateKg: -0.4 })).toBe(
      20,
    );
  });

  it("arrondit à la semaine supérieure", () => {
    expect(weeksToTarget({ weightKg: 80, targetWeightKg: 75, expectedWeeklyRateKg: -0.4 })).toBe(
      13,
    );
  });

  it("pas d'estimation sans cible, sans rythme, ou si le rythme va à contresens", () => {
    expect(
      weeksToTarget({ weightKg: 80, targetWeightKg: null, expectedWeeklyRateKg: -0.4 }),
    ).toBeNull();
    expect(weeksToTarget({ weightKg: 80, targetWeightKg: 72, expectedWeeklyRateKg: 0 })).toBeNull();
    expect(
      weeksToTarget({ weightKg: 80, targetWeightKg: 85, expectedWeeklyRateKg: -0.4 }),
    ).toBeNull();
  });
});

describe("garde-fous", () => {
  const adult = {
    age: 30,
    sex: "female" as const,
    weightKg: 65,
    heightCm: 170,
    goalType: "fat_loss" as const,
    targetWeightKg: 60,
    maintenanceKcal: 1900,
  };

  it("un objectif raisonnable ne déclenche rien", () => {
    expect(assessGoal(adult)).toEqual({ blocking: [], warnings: [] });
  });

  it("refuse les moins de 18 ans", () => {
    expect(assessGoal({ ...adult, age: 17 }).blocking).toContainEqual({ code: "under_age" });
    expect(assessGoal({ ...adult, age: 18 }).blocking).toEqual([]);
  });

  it("refuse un poids cible en insuffisance pondérale et propose le minimum sain", () => {
    // 170 cm : IMC 18,5 = 18,5 × 1,7² = 53,465 kg → 53,5 kg.
    expect(weightAtBmi(18.5, 170)).toBeCloseTo(53.465, 3);
    expect(assessGoal({ ...adult, targetWeightKg: 50 }).blocking).toContainEqual({
      code: "target_underweight",
      minimumWeightKg: 53.5,
    });
    expect(assessGoal({ ...adult, targetWeightKg: 53.5 }).blocking).toEqual([]);
  });

  it("refuse une perte de poids si l'IMC est déjà sous 18,5", () => {
    const result = assessGoal({ ...adult, weightKg: 52, targetWeightKg: null });
    expect(bmi(52, 170)).toBeLessThan(18.5);
    expect(result.blocking).toContainEqual({ code: "already_underweight" });
  });

  it("refuse une cible à contresens de l'objectif", () => {
    expect(assessGoal({ ...adult, targetWeightKg: 70 }).blocking).toContainEqual({
      code: "target_not_below_current",
    });
    expect(
      assessGoal({ ...adult, goalType: "muscle_gain", targetWeightKg: 60 }).blocking,
    ).toContainEqual({ code: "target_not_above_current" });
  });

  it("recommande un accompagnement à partir d'un IMC de 35", () => {
    expect(assessGoal({ ...adult, weightKg: 105, targetWeightKg: 90 }).warnings).toContain(
      "bmi_high",
    );
  });

  it("signale une perte visée de plus de 20 % du poids", () => {
    expect(assessGoal({ ...adult, weightKg: 100, targetWeightKg: 75 }).warnings).toContain(
      "large_loss",
    );
    expect(assessGoal({ ...adult, weightKg: 100, targetWeightKg: 85 }).warnings).not.toContain(
      "large_loss",
    );
  });

  it("signale les 65 ans et plus, un IMC bas et un maintien très faible", () => {
    expect(assessGoal({ ...adult, age: 65 }).warnings).toContain("senior");
    expect(assessGoal({ ...adult, weightKg: 56, targetWeightKg: 54 }).warnings).toContain(
      "low_bmi_loss",
    );
    expect(assessGoal({ ...adult, maintenanceKcal: 1150 }).warnings).toContain("low_maintenance");
  });
});

describe("plan complet", () => {
  it("enchaîne les calculs de bout en bout", () => {
    const plan = buildNutritionPlan({
      age: 30,
      sex: "male",
      heightCm: 180,
      weightKg: 80,
      activityLevel: "moderate",
      goalType: "fat_loss",
      pace: "moderate",
      targetWeightKg: 72,
    });
    expect(plan.bmr.kcal).toBe(1780);
    expect(plan.maintenanceKcal).toBe(2759);
    expect(plan.calories.targetKcal).toBe(2320);
    expect(plan.macros.proteinG).toBe(160);
    expect(plan.weeksToTarget).toBe(20);
    expect(plan.bmi).toBe(24.7);
    expect(plan.assessment).toEqual({ blocking: [], warnings: [] });
  });
});

describe("repères divers", () => {
  it("eau : 33 ml/kg arrondi à 100 ml, entre 1,5 et 3,5 L", () => {
    expect(suggestedWaterMl(70)).toBe(2300);
    expect(suggestedWaterMl(40)).toBe(1500);
    expect(suggestedWaterMl(130)).toBe(3500);
  });

  it("propose de recalculer à partir de 2 kg d'écart", () => {
    expect(shouldRecalculate(80, 78.1)).toBe(false);
    expect(shouldRecalculate(80, 78)).toBe(true);
    expect(shouldRecalculate(80, 82.4)).toBe(true);
  });
});
