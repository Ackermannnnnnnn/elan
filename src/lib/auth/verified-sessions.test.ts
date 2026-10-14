import { describe, expect, it } from "vitest";
import {
  forgetVerified,
  recallVerified,
  rememberVerified,
  sessionKeyFrom,
} from "./verified-sessions";

const user = { id: "u1", email: null };
const cookie = (value: string) => [
  { name: "sb-abc-auth-token", value },
  { name: "theme", value: "dark" },
];

describe("sessions vérifiées récemment", () => {
  it("ne s'appuie que sur les cookies de session, à l'identique", () => {
    expect(sessionKeyFrom([{ name: "theme", value: "dark" }])).toBeNull();
    expect(sessionKeyFrom(cookie("a"))).toBe(sessionKeyFrom(cookie("a")));
    expect(sessionKeyFrom(cookie("a"))).not.toBe(sessionKeyFrom(cookie("b")));
  });

  it("se souvient 20 secondes au plus", () => {
    const key = sessionKeyFrom(cookie("t1"));
    const now = 1_000_000;
    rememberVerified(key, user, now / 1000 + 3600, now);
    expect(recallVerified(key, now + 19_000)).toEqual(user);
    expect(recallVerified(key, now + 21_000)).toBeNull();
  });

  it("ne mémorise pas un jeton proche de son expiration (rafraîchissement normal)", () => {
    const key = sessionKeyFrom(cookie("t2"));
    const now = 2_000_000;
    rememberVerified(key, user, now / 1000 + 60, now);
    expect(recallVerified(key, now + 1000)).toBeNull();
  });

  it("oublie une session à la déconnexion", () => {
    const key = sessionKeyFrom(cookie("t3"));
    rememberVerified(key, user, Date.now() / 1000 + 3600);
    forgetVerified(key);
    expect(recallVerified(key)).toBeNull();
  });
});
