import { z } from "zod";

const REMINDER_KEYS = ["weigh_in", "meal_log", "workout", "meal_prep"] as const;

export const pushSubscriptionSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({
    p256dh: z.string().min(10).max(200),
    auth: z.string().min(8).max(100),
  }),
});

export const endpointSchema = z.url({ protocol: /^https$/ }).max(1000);

export const restAlarmSchema = z.object({
  seconds: z.number().int().min(1).max(1800),
  detail: z.string().trim().max(120).nullable(),
  sessionId: z.uuid(),
});

const reminder = z
  .object({
    enabled: z.boolean(),
    time: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "timeInvalid"),
    // Cases à cocher : valeurs « 1 » … « 7 » (lundi … dimanche).
    weekdays: z
      .array(z.enum(["1", "2", "3", "4", "5", "6", "7"]))
      .transform((days) => [...new Set(days.map(Number))].sort()),
  })
  .refine((value) => !value.enabled || value.weekdays.length > 0, {
    path: ["weekdays"],
    message: "pickAtLeastOneDay",
  });

export const remindersSchema = z.object(
  Object.fromEntries(REMINDER_KEYS.map((key) => [key, reminder])) as {
    [K in (typeof REMINDER_KEYS)[number]]: typeof reminder;
  },
);

export type PushSubscriptionJson = z.input<typeof pushSubscriptionSchema>;
export type RemindersFormValues = z.input<typeof remindersSchema>;
