import { describe, expect, it } from "vitest";
import {
  afterSet,
  type FlowItem,
  proposedValues,
  supersetGroups,
  supersetLabels,
} from "./session-flow";

const item = (name: string, restSeconds: number | null, supersetWithNext = false): FlowItem => ({
  name,
  restSeconds,
  supersetWithNext,
});

describe("supersets", () => {
  const items = [
    item("Développé couché", 120),
    item("Curl", 60, true),
    item("Extension triceps", 90),
    item("Gainage", 45, true), // dernier exercice : le drapeau est ignoré
  ];

  it("regroupe les exercices enchaînés", () => {
    expect(supersetGroups(items)).toEqual([[0], [1, 2], [3]]);
    expect(supersetLabels(items)).toEqual([null, "A1", "A2", null]);
  });

  it("enchaîne sans repos dans le superset, repos après le dernier (le plus long du groupe)", () => {
    expect(afterSet(items, 1)).toEqual({ kind: "chain", next: "Extension triceps" });
    expect(afterSet(items, 2)).toEqual({ kind: "rest", seconds: 90, next: "Curl" });
  });

  it("exercice seul : son repos, sans « suivant »", () => {
    expect(afterSet(items, 0)).toEqual({ kind: "rest", seconds: 120, next: null });
    expect(afterSet([item("Pompes", null)], 0)).toEqual({ kind: "none" });
    expect(afterSet(items, 9)).toEqual({ kind: "none" });
  });

  it("superset de trois exercices (tri-set), lettres successives", () => {
    const tri = [
      item("A", 30, true),
      item("B", 30, true),
      item("C", 75),
      item("D", 60, true),
      item("E", 60),
    ];
    expect(supersetLabels(tri)).toEqual(["A1", "A2", "A3", "B1", "B2"]);
    expect(afterSet(tri, 1)).toEqual({ kind: "chain", next: "C" });
    expect(afterSet(tri, 2)).toEqual({ kind: "rest", seconds: 75, next: "A" });
  });
});

describe("valeurs proposées pour la série suivante", () => {
  const target = { weightKg: 60, reps: 8 };
  it("reprend la dernière série validée de la séance", () => {
    const sets = [
      { setNumber: 1, done: true, weightKg: 62.5, reps: 8 },
      { setNumber: 2, done: true, weightKg: 62.5, reps: 7 },
      { setNumber: 3, done: false, weightKg: null, reps: null },
    ];
    expect(proposedValues(sets, 3, target)).toEqual({ weightKg: 62.5, reps: 7 });
  });
  it("sinon l'objectif du jour (ou rien)", () => {
    expect(
      proposedValues([{ setNumber: 1, done: false, weightKg: null, reps: null }], 1, target),
    ).toEqual(target);
    expect(proposedValues([], 1, null)).toBeNull();
  });
});
