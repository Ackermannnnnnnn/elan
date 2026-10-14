import { describe, expect, it } from "vitest";
import { type PlanItem, planAfterSet } from "./session-flow";

const item = (
  id: string,
  done: number,
  total = 3,
  options: Partial<Pick<PlanItem, "supersetWithNext" | "restSeconds">> = {},
): PlanItem => ({
  id,
  name: id.toUpperCase(),
  supersetWithNext: options.supersetWithNext ?? false,
  restSeconds: options.restSeconds === undefined ? 90 : options.restSeconds,
  sets: Array.from({ length: total }, (_, index) => ({
    setNumber: index + 1,
    done: index < done,
  })),
});

describe("planAfterSet : prochaine série", () => {
  it("reste sur l'exercice tant qu'il a des séries", () => {
    expect(planAfterSet([item("a", 0), item("b", 0)], { itemId: "a", setNumber: 1 })).toEqual({
      kind: "rest",
      seconds: 90,
      sources: ["a"],
      next: { itemId: "a", name: "A", setNumber: 2 },
    });
  });

  it("passe au premier exercice restant, jamais à un exercice déjà terminé", () => {
    // b est terminé, c ne l'est pas : après a, c'est c.
    const plan = [item("a", 2), item("b", 3), item("c", 0)];
    expect(planAfterSet(plan, { itemId: "a", setNumber: 3 })).toMatchObject({
      kind: "rest",
      next: { itemId: "c", setNumber: 1 },
    });
  });

  it("suit l'ordre actuel : un exercice resté en arrière (avant) passe en premier", () => {
    // a a été repoussé : il est maintenant après c ; b est fini.
    const plan = [item("b", 3), item("c", 2), item("a", 1)];
    expect(planAfterSet(plan, { itemId: "c", setNumber: 3 })).toMatchObject({
      next: { itemId: "a", setNumber: 2 },
    });
    // Un exercice sauté plus haut dans la liste est repris d'abord.
    const skipped = [item("a", 0), item("b", 2), item("c", 0)];
    expect(planAfterSet(skipped, { itemId: "b", setNumber: 3 })).toMatchObject({
      next: { itemId: "a", setNumber: 1 },
    });
  });

  it("reprend la plus petite série non faite (série sautée)", () => {
    const plan: PlanItem[] = [
      {
        ...item("a", 0),
        sets: [
          { setNumber: 1, done: true },
          { setNumber: 2, done: false },
          { setNumber: 3, done: false },
        ],
      },
    ];
    expect(planAfterSet(plan, { itemId: "a", setNumber: 3 })).toMatchObject({
      next: { itemId: "a", setNumber: 2 },
    });
  });

  it("annonce la fin de la séance quand tout est fait", () => {
    expect(planAfterSet([item("a", 3), item("b", 2)], { itemId: "b", setNumber: 3 })).toEqual({
      kind: "finished",
    });
  });

  it("superset : enchaîne, puis repos (le plus long) et retour au premier du groupe", () => {
    const plan = [
      item("a", 3),
      item("b", 0, 3, { supersetWithNext: true, restSeconds: 60 }),
      item("c", 0, 3, { restSeconds: 90 }),
      item("d", 0),
    ];
    expect(planAfterSet(plan, { itemId: "b", setNumber: 1 })).toEqual({
      kind: "chain",
      next: { itemId: "c", name: "C", setNumber: 1 },
    });
    const afterRound = [
      item("a", 3),
      item("b", 1, 3, { supersetWithNext: true, restSeconds: 60 }),
      item("c", 0, 3, { restSeconds: 90 }),
      item("d", 0),
    ];
    expect(planAfterSet(afterRound, { itemId: "c", setNumber: 1 })).toEqual({
      kind: "rest",
      seconds: 90,
      sources: ["b", "c"],
      next: { itemId: "b", name: "B", setNumber: 2 },
    });
  });

  it("superset : un exercice du groupe déjà fini est sauté", () => {
    const plan = [item("b", 2, 2, { supersetWithNext: true }), item("c", 1, 3), item("d", 0)];
    // b est fini : après c, repos puis c encore (pas b).
    expect(planAfterSet(plan, { itemId: "c", setNumber: 2 })).toMatchObject({
      kind: "rest",
      next: { itemId: "c", setNumber: 3 },
    });
    // Superset entièrement fini : on passe au premier exercice restant (d).
    const lastRound = [item("b", 2, 2, { supersetWithNext: true }), item("c", 2, 3), item("d", 0)];
    expect(planAfterSet(lastRound, { itemId: "c", setNumber: 3 })).toMatchObject({
      kind: "rest",
      next: { itemId: "d", setNumber: 1 },
    });
  });

  it("sans repos prévu : la série suivante tout de suite", () => {
    expect(
      planAfterSet([item("a", 0, 2, { restSeconds: null })], { itemId: "a", setNumber: 1 }),
    ).toEqual({ kind: "go", next: { itemId: "a", name: "A", setNumber: 2 } });
  });
});
