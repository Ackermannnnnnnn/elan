import { describe, expect, it } from "vitest";
import { ROUTES, safeRedirectPath } from "./routes";

describe("safeRedirectPath", () => {
  it("accepte un chemin interne, avec ses paramètres", () => {
    expect(safeRedirectPath("/profile")).toBe("/profile");
    expect(safeRedirectPath("/nutrition?day=2026-10-10")).toBe("/nutrition?day=2026-10-10");
  });

  it("retombe sur l'accueil sans destination", () => {
    expect(safeRedirectPath(null)).toBe(ROUTES.home);
    expect(safeRedirectPath(undefined)).toBe(ROUTES.home);
    expect(safeRedirectPath("")).toBe(ROUTES.home);
  });

  it.each([
    "https://evil.test",
    "//evil.test",
    "/\\evil.test",
    "\\\\evil.test",
    "javascript:alert(1)",
    "profile",
    "/ok\nSet-Cookie: x=1",
  ])("bloque la redirection ouverte %j", (candidate) => {
    expect(safeRedirectPath(candidate)).toBe(ROUTES.home);
  });
});
