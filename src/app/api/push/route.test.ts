import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sendPush = vi.fn();
vi.mock("@/lib/push/send", () => ({
  buildPayload: vi.fn(async (kind: string, detail?: string | null, url?: string | null) => ({
    title: kind,
    body: detail ?? "",
    url: url ?? "/",
    tag: `elan-${kind}`,
  })),
  sendPush: (...args: unknown[]) => sendPush(...args),
}));

const SECRET = "s".repeat(64);
const message = {
  endpoint: "https://push.example.test/abc",
  p256dh: "p256dh-key-abcdefghij",
  auth: "auth-secret",
  kind: "rest",
  detail: "Squat",
  url: "/training/sessions/1",
};
const call = async (body: unknown, token = SECRET) => {
  const { POST } = await import("./route");
  return POST(
    new Request("https://app.test/api/push", {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
  );
};

beforeEach(() => {
  vi.stubEnv("NEXT_PUBLIC_VAPID_PUBLIC_KEY", "public");
  vi.stubEnv("VAPID_PRIVATE_KEY", "private");
  vi.stubEnv("PUSH_SECRET", SECRET);
  sendPush.mockReset();
});
afterEach(() => vi.unstubAllEnvs());

describe("POST /api/push", () => {
  it("refuse un appel sans le bon secret", async () => {
    const response = await call({ messages: [message] }, "mauvais");
    expect(response.status).toBe(401);
    expect(sendPush).not.toHaveBeenCalled();
  });

  it("ne fait rien tant que les notifications ne sont pas configurées", async () => {
    vi.stubEnv("PUSH_SECRET", "");
    expect((await call({ messages: [message] })).status).toBe(503);
  });

  it("refuse une adresse externe ou un abonnement non https", async () => {
    expect((await call({ messages: [{ ...message, url: "//evil.test" }] })).status).toBe(400);
    expect((await call({ messages: [{ ...message, url: "https://evil.test" }] })).status).toBe(400);
    expect(
      (await call({ messages: [{ ...message, endpoint: "http://push.example.test/x" }] })).status,
    ).toBe(400);
  });

  it("envoie chaque message et compte les résultats", async () => {
    sendPush.mockResolvedValueOnce("sent").mockResolvedValueOnce("gone");
    const response = await call({ messages: [message, { ...message, kind: "weigh_in" }] });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ sent: 1, gone: 1, failed: 0 });
    expect(sendPush).toHaveBeenCalledTimes(2);
    expect(sendPush.mock.calls[0]?.[3]).toMatchObject({ body: "Squat", tag: "elan-rest" });
  });
});
