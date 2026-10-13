import { z } from "zod";
import { CAUTION_AREAS, EQUIPMENT, LEVELS, MUSCLES } from "@/domain/exercise-catalog";
import { STRUCTURES, TRAINING_GOALS } from "@/domain/training-program";
import { isoDate, optionalNumber, requiredNumber } from "@/lib/form-fields";

/** Muscles que l'on peut demander à privilégier. */
export const PRIORITY_MUSCLES = [
  "chest",
  "back",
  "shoulders",
  "biceps",
  "triceps",
  "glutes",
  "quadriceps",
  "hamstrings",
  "calves",
  "core",
] as const;

const checkboxes = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess(
    (value) => (Array.isArray(value) ? value : typeof value === "string" ? [value] : []),
    z.array(z.enum(values)),
  );

export const setupSchema = z.object({
  goal: z.enum(TRAINING_GOALS),
  level: z.enum(LEVELS),
  sessionsPerWeek: requiredNumber({ min: 1, max: 6, integer: true }),
  minutesPerSession: requiredNumber({ min: 20, max: 180, integer: true }),
  location: z.enum(["gym", "home", "both", "outdoor"]),
  equipment: checkboxes(EQUIPMENT),
  limitations: checkboxes(CAUTION_AREAS),
  priorityMuscles: checkboxes(PRIORITY_MUSCLES),
  structure: z.enum(STRUCTURES),
});
export type SetupFormValues = z.input<typeof setupSchema>;

export const setSchema = z.object({
  weightKg: optionalNumber({ min: 0, max: 1000 }),
  reps: requiredNumber({ min: 0, max: 500, integer: true }),
});
export type SetFormValues = z.input<typeof setSchema>;

export const finishSchema = z.object({
  perceivedEffort: optionalNumber({ min: 1, max: 10, integer: true }),
});
export type FinishFormValues = z.input<typeof finishSchema>;

const label = (max: number) => z.string().trim().min(1, "required").max(max, "textTooLong");

/** Jour habituel : "" = à la demande, "1" (lundi) … "7" (dimanche). */
export const WEEKDAY_VALUES = ["", "1", "2", "3", "4", "5", "6", "7"] as const;
const weekdayField = z
  .enum(WEEKDAY_VALUES)
  .transform((value) => (value === "" ? null : Number(value)));

export const workoutSchema = z.object({
  name: label(120),
  weekday: weekdayField,
});
export type WorkoutFormValues = z.input<typeof workoutSchema>;

export const prescriptionSchema = z
  .object({
    sets: requiredNumber({ min: 1, max: 12, integer: true }),
    repMin: requiredNumber({ min: 1, max: 100, integer: true }),
    repMax: requiredNumber({ min: 1, max: 100, integer: true }),
    restSeconds: requiredNumber({ min: 0, max: 900, integer: true }),
  })
  .refine((values) => values.repMax >= values.repMin, {
    path: ["repMax"],
    message: "repRangeInvalid",
  });
export type PrescriptionFormValues = z.input<typeof prescriptionSchema>;

export const dateSchema = z.object({ date: isoDate });
export type DateFormValues = z.input<typeof dateSchema>;

export const ownExerciseSchema = z.object({
  name: label(120),
  primary: z.enum(MUSCLES),
  equipment: checkboxes(EQUIPMENT),
  kind: z.enum(["reps", "timed"]),
  instructions: z
    .string()
    .trim()
    .max(3000, "textTooLong")
    .transform((value) => (value === "" ? null : value)),
});
export type OwnExerciseFormValues = z.input<typeof ownExerciseSchema>;
