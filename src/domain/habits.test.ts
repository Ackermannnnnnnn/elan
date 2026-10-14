import { describe, expect, it } from "vitest";
import {
  bestDayStreak,
  countByWeek,
  dayStreak,
  daysDoneThisWeek,
  doneDays,
  habitMood,
  lastDays,
  lastWeeks,
  weekStreak,
} from "./habits";

const set = (...dates: string[]) => new Set(dates);
const TODAY = "2026-10-14"; // mercredi

describe("doneDays", () => {
  it("retient les jours où l'objectif est atteint (égalité comprise)", () => {
    const values = new Map([
      ["2026-10-12", 7],
      ["2026-10-13", 6.5],
      ["2026-10-14", 8],
    ]);
    expect([...doneDays(values, 7)]).toEqual(["2026-10-12", "2026-10-14"]);
  });

  it("n'accepte pas un objectif nul", () => {
    expect(doneDays(new Map([["2026-10-14", 0]]), 0).size).toBe(0);
  });
});

describe("dayStreak", () => {
  it("compte les jours consécutifs jusqu'à aujourd'hui", () => {
    expect(dayStreak(set("2026-10-12", "2026-10-13", "2026-10-14"), TODAY)).toBe(3);
  });

  it("ne casse pas la série tant que la journée n'est pas finie", () => {
    expect(dayStreak(set("2026-10-12", "2026-10-13"), TODAY)).toBe(2);
  });

  it("repart de zéro après un jour manqué", () => {
    expect(dayStreak(set("2026-10-11", "2026-10-12"), TODAY)).toBe(0);
    expect(dayStreak(set("2026-10-10", "2026-10-12", "2026-10-14"), TODAY)).toBe(1);
  });
});

describe("bestDayStreak", () => {
  it("trouve la plus longue série de la période", () => {
    const done = set("2026-10-01", "2026-10-02", "2026-10-03", "2026-10-05", "2026-10-06");
    expect(bestDayStreak(done, "2026-10-01", TODAY)).toBe(3);
  });
});

describe("lastDays et daysDoneThisWeek", () => {
  it("liste les 7 derniers jours, le plus ancien d'abord", () => {
    const days = lastDays(set("2026-10-08", "2026-10-14"), TODAY, 7);
    expect(days.map((day) => day.date)).toEqual([
      "2026-10-08",
      "2026-10-09",
      "2026-10-10",
      "2026-10-11",
      "2026-10-12",
      "2026-10-13",
      "2026-10-14",
    ]);
    expect(days.map((day) => day.done)).toEqual([true, false, false, false, false, false, true]);
  });

  it("compte les jours faits sur 7 jours glissants", () => {
    expect(daysDoneThisWeek(set("2026-10-07", "2026-10-08", "2026-10-14"), TODAY)).toBe(2);
  });
});

describe("habitudes hebdomadaires (séances)", () => {
  const sessions = [
    "2026-09-21",
    "2026-09-23",
    "2026-09-25", // semaine du 21/09 : 3
    "2026-09-29",
    "2026-10-01",
    "2026-10-04", // semaine du 28/09 : 3 (dimanche compris)
    "2026-10-06",
    "2026-10-08",
    "2026-10-10", // semaine du 05/10 : 3
    "2026-10-12", // semaine en cours : 1
  ];
  const weeks = countByWeek(sessions);

  it("regroupe par semaine ISO (lundi → dimanche)", () => {
    expect(Object.fromEntries(weeks)).toEqual({
      "2026-09-21": 3,
      "2026-09-28": 3,
      "2026-10-05": 3,
      "2026-10-12": 1,
    });
  });

  it("ne casse pas la série pendant la semaine en cours", () => {
    expect(weekStreak(weeks, 3, TODAY)).toBe(3);
  });

  it("compte la semaine en cours dès que l'objectif est atteint", () => {
    expect(weekStreak(countByWeek([...sessions, "2026-10-13", "2026-10-14"]), 3, TODAY)).toBe(4);
  });

  it("repart de zéro après une semaine sous l'objectif", () => {
    expect(weekStreak(weeks, 4, TODAY)).toBe(0);
  });

  it("liste les dernières semaines", () => {
    expect(lastWeeks(weeks, TODAY, 3)).toEqual([
      { week: "2026-09-28", count: 3 },
      { week: "2026-10-05", count: 3 },
      { week: "2026-10-12", count: 1 },
    ]);
  });
});

describe("habitMood", () => {
  it("salue une série d'au moins 2 jours", () => {
    expect(habitMood(set("2026-10-13", "2026-10-14"), TODAY)).toEqual({ kind: "streak", days: 2 });
  });

  it("montre la régularité de la semaine quand la série est interrompue", () => {
    expect(habitMood(set("2026-10-09", "2026-10-11", "2026-10-14"), TODAY)).toEqual({
      kind: "regular",
      days: 3,
    });
  });

  it("invite à reprendre, sans reproche, quand rien n'est fait", () => {
    expect(habitMood(set("2026-09-01"), TODAY)).toEqual({ kind: "restart" });
  });
});
