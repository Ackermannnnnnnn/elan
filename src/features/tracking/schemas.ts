import { z } from "zod";
import { isoDate, optionalNumber, requiredNumber } from "@/lib/form-fields";

export const weightSchema = z.object({
  date: isoDate,
  weightKg: requiredNumber({ min: 30, max: 300 }),
  note: z.string().trim().max(300, "textTooLong"),
});

const measure = (min: number, max: number) => optionalNumber({ min, max });

export const measurementSchema = z
  .object({
    date: isoDate,
    waistCm: measure(30, 250),
    hipsCm: measure(30, 250),
    chestCm: measure(30, 250),
    armCm: measure(10, 100),
    thighCm: measure(20, 150),
  })
  .refine(
    (values) =>
      [values.waistCm, values.hipsCm, values.chestCm, values.armCm, values.thighCm].some(
        (value) => value !== null,
      ),
    { path: ["waistCm"], message: "atLeastOneValue" },
  );

export const stepsSchema = z.object({
  steps: requiredNumber({ min: 0, max: 200000, integer: true }),
});

/** Quantités d'eau proposées en un geste (ml). */
export const WATER_AMOUNTS = [250, 500] as const;
export const waterAmountSchema = z.union([z.literal(250), z.literal(500)]);

export const idSchema = z.uuid();

export type WeightFormValues = z.input<typeof weightSchema>;
export type MeasurementFormValues = z.input<typeof measurementSchema>;
export type StepsFormValues = z.input<typeof stepsSchema>;
