import { beforeEach, describe, expect, it } from "vitest";
import type { PlanItem } from "@/domain/session-flow";
import {
  adjust,
  cancelSet,
  getSnapshot,
  resetForTests,
  setOverride,
  setPlan,
  startAfterSet,
  stepFor,
} from "./rest-timer-store";

const item = (id: string, done: number, total = 2, rest: number | null = 60): PlanItem => ({
  id,
  name: id.toUpperCase(),
  supersetWithNext: false,
  restSeconds: rest,
  sets: Array.from({ length: total }, (_, i) => ({ setNumber: i + 1, done: i < done })),
});

beforeEach(() => resetForTests());

describe("minuteur de repos partagé", () => {
  it("démarre le repos prévu et annonce la série suivante", () => {
    setPlan("s1", [item("a", 0), item("b", 0)]);
    startAfterSet("s1", { itemId: "a", setNumber: 1 });
    const state = getSnapshot();
    expect(state.active).toMatchObject({ kind: "rest", total: 60, sessionId: "s1" });
    expect(stepFor(state, { itemId: "a", setNumber: 1 })).toMatchObject({
      next: { itemId: "a", setNumber: 2 },
    });
  });

  it("compte une série validée à l'instant comme faite, avant la réponse du serveur", () => {
    setPlan("s1", [item("a", 0), item("b", 2)]);
    startAfterSet("s1", { itemId: "a", setNumber: 1 });
    // Le serveur n'a pas encore confirmé la série 1 ; la série 2 est validée.
    startAfterSet("s1", { itemId: "a", setNumber: 2 });
    expect(getSnapshot().active).toEqual({
      sessionId: "s1",
      kind: "finished",
      at: expect.any(Number),
    });
  });

  it("recalcule le prochain exercice quand l'ordre change pendant le repos", () => {
    setPlan("s1", [item("a", 1), item("b", 0), item("c", 0)]);
    startAfterSet("s1", { itemId: "a", setNumber: 2 });
    expect(stepFor(getSnapshot(), { itemId: "a", setNumber: 2 })).toMatchObject({
      next: { itemId: "b" },
    });
    // c remonté avant b pendant le repos.
    setPlan("s1", [item("a", 2), item("c", 0), item("b", 0)]);
    expect(stepFor(getSnapshot(), { itemId: "a", setNumber: 2 })).toMatchObject({
      next: { itemId: "c" },
    });
  });

  it("utilise un repos changé à l'instant", () => {
    setPlan("s1", [item("a", 0)]);
    setOverride("a", 120);
    startAfterSet("s1", { itemId: "a", setNumber: 1 });
    expect(getSnapshot().active).toMatchObject({ kind: "rest", total: 120 });
    adjust(15);
    expect(getSnapshot().active).toMatchObject({ total: 135 });
  });

  it("annule le repos si la série n'a pas pu être enregistrée", () => {
    setPlan("s1", [item("a", 0)]);
    startAfterSet("s1", { itemId: "a", setNumber: 1 });
    cancelSet("s1", { itemId: "a", setNumber: 1 });
    expect(getSnapshot().active).toBeNull();
    expect(getSnapshot().pending.size).toBe(0);
  });

  it("sans repos prévu : pas de minuteur", () => {
    setPlan("s1", [item("a", 0, 2, null)]);
    startAfterSet("s1", { itemId: "a", setNumber: 1 });
    expect(getSnapshot().active).toBeNull();
  });
});
