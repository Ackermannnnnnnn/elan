import { z } from "zod";
import { HABIT_KEYS, HABIT_TARGET_LIMITS, type HabitKey } from "@/domain/habits";
import { isoDate, optionalNumber, requiredNumber } from "@/lib/form-fields";

const habitSetting = (key: HabitKey) =>
  z.object({
    active: z.boolean(),
    target: requiredNumber({
      min: HABIT_TARGET_LIMITS[key].min,
      max: HABIT_TARGET_LIMITS[key].max,
      integer: key !== "sleep",
    }),
  });

export const habitSettingsSchema = z.object(
  Object.fromEntries(HABIT_KEYS.map((key) => [key, habitSetting(key)])) as {
    [K in HabitKey]: ReturnType<typeof habitSetting>;
  },
);

export const sleepSchema = z.object({
  date: isoDate,
  /** Vide = effacer la saisie de cette nuit. */
  hours: optionalNumber({ min: 0, max: 16 }),
});

export type HabitSettingsFormValues = z.input<typeof habitSettingsSchema>;
export type SleepFormValues = z.input<typeof sleepSchema>;
