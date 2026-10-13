import { describe, expect, it } from "vitest";
import messages from "../../../messages/fr.json";
import { isActivePath, NAV_ITEMS } from "./nav-items";

describe("navigation", () => {
  it("expose les cinq sections, toutes traduites", () => {
    expect(NAV_ITEMS.map((item) => item.key)).toEqual([
      "home",
      "nutrition",
      "training",
      "progress",
      "profile",
    ]);
    for (const item of NAV_ITEMS) expect(messages.Nav[item.key]).toBeTruthy();
  });

  it("ne marque l'accueil actif que sur la page d'accueil", () => {
    expect(isActivePath("/", "/")).toBe(true);
    expect(isActivePath("/nutrition", "/")).toBe(false);
  });

  it("garde une section active sur ses sous-pages, sans confondre les préfixes", () => {
    expect(isActivePath("/nutrition/diary", "/nutrition")).toBe(true);
    expect(isActivePath("/nutrition-plan", "/nutrition")).toBe(false);
  });
});
