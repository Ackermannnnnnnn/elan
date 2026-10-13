import { describe, expect, it } from "vitest";
import {
  addDays,
  ageOn,
  diffDays,
  eachDay,
  isIsoDate,
  startOfIsoWeek,
  todayInTimeZone,
} from "./dates";

describe("jour courant selon le fuseau", () => {
  it("à 23 h 30 UTC, il est déjà demain à Bruxelles", () => {
    const instant = new Date("2026-10-11T23:30:00Z");
    expect(todayInTimeZone("UTC", instant)).toBe("2026-10-11");
    expect(todayInTimeZone("Europe/Brussels", instant)).toBe("2026-10-12");
  });

  it("retombe sur UTC si le fuseau est inconnu", () => {
    expect(todayInTimeZone("Pas/Un-Fuseau", new Date("2026-10-11T12:00:00Z"))).toBe("2026-10-11");
  });
});

describe("arithmétique sur les jours", () => {
  it("franchit les mois, les années et le 29 février", () => {
    expect(addDays("2026-01-31", 1)).toBe("2026-02-01");
    expect(addDays("2026-01-01", -1)).toBe("2025-12-31");
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
  });

  it("n'est pas perturbée par le changement d'heure", () => {
    // Passage à l'heure d'hiver en Belgique : nuit du 24 au 25 octobre 2026.
    expect(addDays("2026-10-24", 2)).toBe("2026-10-26");
    expect(diffDays("2026-10-24", "2026-10-26")).toBe(2);
  });

  it("compte les jours dans les deux sens", () => {
    expect(diffDays("2026-10-01", "2026-10-28")).toBe(27);
    expect(diffDays("2026-10-28", "2026-10-01")).toBe(-27);
  });

  it("liste les jours d'un intervalle, bornes comprises", () => {
    expect(eachDay("2026-10-30", "2026-11-02")).toEqual([
      "2026-10-30",
      "2026-10-31",
      "2026-11-01",
      "2026-11-02",
    ]);
  });
});

describe("âge", () => {
  it("change le jour de l'anniversaire, pas avant", () => {
    expect(ageOn("2008-10-12", "2026-10-11")).toBe(17);
    expect(ageOn("2008-10-12", "2026-10-12")).toBe(18);
    expect(ageOn("1996-03-05", "2026-10-12")).toBe(30);
  });
});

describe("validation d'un jour ISO", () => {
  it("accepte un vrai jour, refuse le reste", () => {
    expect(isIsoDate("2026-10-12")).toBe(true);
    expect(isIsoDate("2026-02-30")).toBe(false);
    expect(isIsoDate("12/10/2026")).toBe(false);
    expect(isIsoDate("2026-10-12T00:00:00Z")).toBe(false);
    expect(isIsoDate(null)).toBe(false);
  });
});

describe("startOfIsoWeek", () => {
  it("renvoie le lundi de la semaine", () => {
    expect(startOfIsoWeek("2026-10-12")).toBe("2026-10-12"); // lundi
    expect(startOfIsoWeek("2026-10-18")).toBe("2026-10-12"); // dimanche
    expect(startOfIsoWeek("2026-10-14")).toBe("2026-10-12");
    expect(startOfIsoWeek("2027-01-01")).toBe("2026-12-28"); // vendredi, change d'année
  });
});
