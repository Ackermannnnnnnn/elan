import { z } from "zod";

/** Types de notifications envoyées par l'application. */
export const PUSH_KINDS = ["rest", "weigh_in", "meal_log", "workout", "meal_prep", "test"] as const;
export type PushKind = (typeof PUSH_KINDS)[number];

/** Page ouverte en touchant la notification, quand le message n'en précise pas. */
export const PUSH_DEFAULT_URL: Record<PushKind, string> = {
  rest: "/training",
  weigh_in: "/progress#weight",
  meal_log: "/nutrition",
  workout: "/training",
  meal_prep: "/nutrition/plan",
  test: "/profile/notifications",
};

/** Ce que reçoit le service worker (public/sw.js). */
export type PushPayload = { title: string; body: string; url: string; tag: string };

const internalUrl = z
  .string()
  .max(200)
  .regex(/^\/(?!\/)[^\s\\]*$/);

/** Corps de la requête envoyée par Supabase (pg_net) à /api/push. */
export const pushRequestSchema = z.object({
  messages: z
    .array(
      z.object({
        endpoint: z.url({ protocol: /^https$/ }).max(1000),
        p256dh: z.string().min(10).max(200),
        auth: z.string().min(8).max(100),
        kind: z.enum(PUSH_KINDS),
        detail: z.string().max(120).nullable().optional(),
        url: internalUrl.nullable().optional(),
      }),
    )
    .max(500),
});

export type PushRequest = z.infer<typeof pushRequestSchema>;

/** Une alarme de repos doit arriver tout de suite ou pas du tout ; un rappel peut attendre. */
export const PUSH_OPTIONS: Record<PushKind, { ttl: number; urgency: "high" | "normal" }> = {
  rest: { ttl: 60, urgency: "high" },
  weigh_in: { ttl: 3600, urgency: "normal" },
  meal_log: { ttl: 3600, urgency: "normal" },
  workout: { ttl: 3600, urgency: "normal" },
  meal_prep: { ttl: 3600, urgency: "normal" },
  test: { ttl: 300, urgency: "high" },
};
