import { describe, expect, it } from "vitest";
import messages from "../../../messages/fr.json";
import { PUSH_DEFAULT_URL, PUSH_KINDS } from "./payload";

describe("textes des notifications", () => {
  it.each(PUSH_KINDS)("existent pour « %s »", (kind) => {
    const texts = (messages.Push as Record<string, Record<string, string>>)[kind];
    expect(texts?.title).toBeTruthy();
    expect(texts?.body).toBeTruthy();
    expect(texts?.bodyWithDetail).toContain("{detail}");
  });

  it("ouvrent toujours une page de l'application", () => {
    for (const url of Object.values(PUSH_DEFAULT_URL)) expect(url).toMatch(/^\/(?!\/)/);
  });
});
