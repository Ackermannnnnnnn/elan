import { describe, expect, it } from "vitest";
import { suggestProgramStructure } from "./program";

describe("structure d'entraînement proposée", () => {
  it.each([
    [0, "walking"],
    [1, "full_body"],
    [3, "full_body"],
    [4, "upper_lower"],
    [5, "push_pull_legs"],
    [7, "push_pull_legs"],
  ] as const)("%i séance(s) par semaine → %s", (sessions, structure) => {
    expect(suggestProgramStructure(sessions)).toBe(structure);
  });
});
