"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getTranslations } from "next-intl/server";
import { z } from "zod";
import { ROUTES } from "@/config/routes";
import { getToday } from "@/data/profile";
import {
  addSessionExercise,
  addSet,
  addWorkoutExercise,
  cancelPlanned,
  createOwnExercise,
  createProgram,
  createWorkout,
  deleteOwnExercise,
  deleteWorkout,
  discardSession,
  finishSession,
  getPlannedSession,
  logSet,
  moveOccurrence,
  moveSessionExercise,
  moveWorkoutExercise,
  pauseSession,
  planWorkout,
  removeLastSet,
  removeSessionExercise,
  removeWorkoutExercise,
  replaceWorkoutExercise,
  reschedulePlanned,
  resumeSession,
  setSessionNote,
  setSessionRest,
  setSessionSuperset,
  setTargetSets,
  setWorkoutRest,
  setWorkoutSuperset,
  setWorkoutWeekday,
  skipOccurrence,
  startFreeSession,
  startSession,
  swapSessionExercise,
  updateOwnExercise,
  updatePrescription,
  updateWorkout,
} from "@/data/training";
import { DataError } from "@/data/client";
import { isoDate } from "@/lib/form-fields";
import type { ActionResult } from "@/lib/action-result";
import { runAction } from "@/lib/run-action";
import {
  type DateFormValues,
  dateSchema,
  finishSchema,
  type FinishFormValues,
  type NoteFormValues,
  noteSchema,
  type OwnExerciseFormValues,
  ownExerciseSchema,
  type PrescriptionFormValues,
  prescriptionSchema,
  setSchema,
  type SetFormValues,
  setupSchema,
  type SetupFormValues,
  type WorkoutFormValues,
  workoutSchema,
} from "./schemas";
import { addExercisesUrl, exerciseUrl, libraryUrl, sessionUrl, weekUrl, workoutUrl } from "./urls";

const refresh = () => revalidatePath("/", "layout");
const uuid = z.uuid();

export async function createProgramAction(input: SetupFormValues): Promise<ActionResult<string>> {
  const t = await getTranslations("Training");
  const result = await runAction(setupSchema, input, async (values) => {
    await createProgram({
      settings: {
        goal: values.goal,
        level: values.level,
        sessionsPerWeek: values.sessionsPerWeek,
        minutesPerSession: values.minutesPerSession,
        location: values.location,
        equipment: values.equipment,
        limitations: values.limitations,
        priorityMuscles: values.priorityMuscles,
      },
      structure: values.structure,
      name: t(`structure.${values.structure}.name`),
      workoutNames: {
        full_body: t("focus.full_body"),
        upper: t("focus.upper"),
        lower: t("focus.lower"),
        push: t("focus.push"),
        pull: t("focus.pull"),
        legs: t("focus.legs"),
      },
    });
    refresh();
  });
  if (!result.ok) return result;
  redirect(ROUTES.training);
}

/**
 * Jour habituel d'une séance type (null = à la demande). `returnDate` : revenir
 * ensuite au planning de cette semaine.
 */
export async function setWorkoutWeekdayAction(
  id: string,
  weekday: number | null,
  returnDate?: string,
): Promise<ActionResult<string>> {
  const result = await runAction(
    z.object({
      id: uuid,
      weekday: z.number().int().min(1).max(7).nullable(),
      returnDate: isoDate.optional(),
    }),
    { id, weekday, returnDate },
    async (values) => {
      await setWorkoutWeekday(values.id, values.weekday);
      refresh();
    },
  );
  if (!result.ok || !returnDate) return result;
  redirect(weekUrl(returnDate));
}

export async function setTargetSetsAction(
  itemId: string,
  sets: number,
): Promise<ActionResult<string>> {
  return runAction(
    z.object({ itemId: uuid, sets: z.number().int().min(1).max(12) }),
    { itemId, sets },
    async (values) => {
      await setTargetSets(values.itemId, values.sets);
      refresh();
    },
  );
}

export async function replaceExerciseAction(
  itemId: string,
  exerciseId: string,
  dislikeCurrent: boolean,
): Promise<ActionResult<string>> {
  let workoutId = "";
  const result = await runAction(
    z.object({ itemId: uuid, exerciseId: uuid, dislikeCurrent: z.boolean() }),
    { itemId, exerciseId, dislikeCurrent },
    async (values) => {
      workoutId = await replaceWorkoutExercise({
        workoutExerciseId: values.itemId,
        exerciseId: values.exerciseId,
        dislikeCurrent: values.dislikeCurrent,
      });
      refresh();
    },
  );
  if (!result.ok) return result;
  redirect(workoutUrl(workoutId));
}

/**
 * Démarre une séance type. `occurrence` : date prévue de l'occurrence
 * hebdomadaire que l'on fait (peut-être un autre jour) ; `plannedId` : séance
 * planifiée que l'on lance.
 */
export async function startSessionAction(
  workoutId: string,
  from: { occurrence?: string; plannedId?: string } = {},
): Promise<ActionResult<string>> {
  let sessionId = "";
  const result = await runAction(
    z.object({
      workoutId: uuid,
      occurrence: isoDate.optional(),
      plannedId: uuid.optional(),
    }),
    { workoutId, ...from },
    async (values) => {
      sessionId = await startSession(values.workoutId, await getToday(), {
        occurrence: values.occurrence,
        plannedId: values.plannedId,
      });
      refresh();
    },
  );
  if (!result.ok) return result;
  redirect(sessionUrl(sessionId));
}

export async function logSetAction(
  setId: string,
  input: SetFormValues,
): Promise<ActionResult<string>> {
  if (!uuid.safeParse(setId).success) return { ok: false, formError: "itemNotFound" };
  return runAction(setSchema, input, async (values) => {
    await logSet({ setId, weightKg: values.weightKg, reps: values.reps });
    refresh();
  });
}

export async function addSetAction(
  sessionId: string,
  exerciseId: string,
): Promise<ActionResult<string>> {
  return runAction(
    z.object({ sessionId: uuid, exerciseId: uuid }),
    { sessionId, exerciseId },
    async (ids) => {
      await addSet(ids.sessionId, ids.exerciseId);
      refresh();
    },
  );
}

export async function removeLastSetAction(
  sessionId: string,
  exerciseId: string,
): Promise<ActionResult<string>> {
  return runAction(
    z.object({ sessionId: uuid, exerciseId: uuid }),
    { sessionId, exerciseId },
    async (ids) => {
      await removeLastSet(ids.sessionId, ids.exerciseId);
      refresh();
    },
  );
}

export async function pauseSessionAction(id: string): Promise<ActionResult<string>> {
  return runAction(uuid, id, async (sessionId) => {
    await pauseSession(sessionId);
    refresh();
  });
}

export async function resumeSessionAction(id: string): Promise<ActionResult<string>> {
  return runAction(uuid, id, async (sessionId) => {
    await resumeSession(sessionId);
    refresh();
  });
}

export async function finishSessionAction(
  id: string,
  input: FinishFormValues,
): Promise<ActionResult<string>> {
  if (!uuid.safeParse(id).success) return { ok: false, formError: "itemNotFound" };
  return runAction(finishSchema, input, async (values) => {
    await finishSession(id, values.perceivedEffort);
    refresh();
  });
}

export async function discardSessionAction(id: string): Promise<ActionResult<string>> {
  const result = await runAction(uuid, id, async (sessionId) => {
    await discardSession(sessionId);
    refresh();
  });
  if (!result.ok) return result;
  redirect(ROUTES.training);
}

// --- Séances types composées à la main ---------------------------------------------------

export async function createWorkoutAction(input: WorkoutFormValues): Promise<ActionResult<string>> {
  const t = await getTranslations("Training");
  let id = "";
  const result = await runAction(workoutSchema, input, async (values) => {
    id = await createWorkout({ ...values, programName: t("manualProgram") });
    refresh();
  });
  if (!result.ok) return result;
  redirect(addExercisesUrl(id));
}

export async function updateWorkoutAction(
  id: string,
  input: WorkoutFormValues,
): Promise<ActionResult<string>> {
  if (!uuid.safeParse(id).success) return { ok: false, formError: "itemNotFound" };
  return runAction(workoutSchema, input, async (values) => {
    await updateWorkout(id, values);
    refresh();
  });
}

export async function deleteWorkoutAction(id: string): Promise<ActionResult<string>> {
  const result = await runAction(uuid, id, async (workoutId) => {
    await deleteWorkout(workoutId);
    refresh();
  });
  if (!result.ok) return result;
  redirect(ROUTES.training);
}

export async function addWorkoutExerciseAction(
  workoutId: string,
  exerciseId: string,
): Promise<ActionResult<string>> {
  return runAction(
    z.object({ workoutId: uuid, exerciseId: uuid }),
    { workoutId, exerciseId },
    async (ids) => {
      await addWorkoutExercise(ids.workoutId, ids.exerciseId);
      refresh();
    },
  );
}

export async function removeWorkoutExerciseAction(itemId: string): Promise<ActionResult<string>> {
  return runAction(uuid, itemId, async (id) => {
    await removeWorkoutExercise(id);
    refresh();
  });
}

export async function moveWorkoutExerciseAction(
  itemId: string,
  direction: -1 | 1,
): Promise<ActionResult<string>> {
  return runAction(
    z.object({ itemId: uuid, direction: z.union([z.literal(-1), z.literal(1)]) }),
    { itemId, direction },
    async (values) => {
      await moveWorkoutExercise(values.itemId, values.direction);
      refresh();
    },
  );
}

export async function updatePrescriptionAction(
  itemId: string,
  input: PrescriptionFormValues,
): Promise<ActionResult<string>> {
  if (!uuid.safeParse(itemId).success) return { ok: false, formError: "itemNotFound" };
  return runAction(prescriptionSchema, input, async (values) => {
    await updatePrescription(itemId, values);
    refresh();
  });
}

// --- Planning ----------------------------------------------------------------------------

/** Déplace une occurrence hebdomadaire (une seule fois) vers une autre date. */
export async function moveOccurrenceAction(
  workoutId: string,
  from: string,
  input: DateFormValues,
): Promise<ActionResult<string>> {
  let to = "";
  const result = await runAction(
    z.object({ workoutId: uuid, from: isoDate, date: dateSchema.shape.date }),
    { workoutId, from, ...input },
    async (values) => {
      to = values.date;
      await moveOccurrence({
        workoutId: values.workoutId,
        from: values.from,
        to: values.date,
        today: await getToday(),
      });
      refresh();
    },
  );
  if (!result.ok) return result;
  redirect(weekUrl(to));
}

export async function skipOccurrenceAction(
  workoutId: string,
  date: string,
): Promise<ActionResult<string>> {
  const result = await runAction(
    z.object({ workoutId: uuid, date: isoDate }),
    { workoutId, date },
    async (values) => {
      await skipOccurrence(values.workoutId, values.date);
      refresh();
    },
  );
  if (!result.ok) return result;
  redirect(weekUrl(date));
}

export async function planWorkoutAction(
  workoutId: string,
  date: string,
): Promise<ActionResult<string>> {
  const result = await runAction(
    z.object({ workoutId: uuid, date: isoDate }),
    { workoutId, date },
    async (values) => {
      await planWorkout(values.workoutId, values.date, await getToday());
      refresh();
    },
  );
  if (!result.ok) return result;
  redirect(weekUrl(date));
}

export async function reschedulePlannedAction(
  sessionId: string,
  input: DateFormValues,
): Promise<ActionResult<string>> {
  let to = "";
  const result = await runAction(
    z.object({ sessionId: uuid, date: dateSchema.shape.date }),
    { sessionId, ...input },
    async (values) => {
      to = values.date;
      await reschedulePlanned(values.sessionId, values.date, await getToday());
      refresh();
    },
  );
  if (!result.ok) return result;
  redirect(weekUrl(to));
}

/** Annule une séance planifiée, ou rétablit une occurrence sautée. */
export async function cancelPlannedAction(sessionId: string): Promise<ActionResult<string>> {
  let date = "";
  const result = await runAction(uuid, sessionId, async (id) => {
    const planned = await getPlannedSession(id);
    if (!planned) throw new DataError("itemNotFound");
    date = planned.original_date ?? planned.scheduled_on;
    await cancelPlanned(id);
    refresh();
  });
  if (!result.ok) return result;
  redirect(weekUrl(date));
}

// --- Exercices personnels ----------------------------------------------------------------

export async function createOwnExerciseAction(
  workoutId: string | null,
  input: OwnExerciseFormValues,
): Promise<ActionResult<string>> {
  let id = "";
  const result = await runAction(ownExerciseSchema, input, async (values) => {
    id = await createOwnExercise({ ...values, timed: values.kind === "timed" });
    if (workoutId && uuid.safeParse(workoutId).success) {
      await addWorkoutExercise(workoutId, id);
    }
    refresh();
  });
  if (!result.ok) return result;
  redirect(workoutId ? addExercisesUrl(workoutId) : exerciseUrl(id));
}

export async function updateOwnExerciseAction(
  id: string,
  input: OwnExerciseFormValues,
): Promise<ActionResult<string>> {
  if (!uuid.safeParse(id).success) return { ok: false, formError: "itemNotFound" };
  const result = await runAction(ownExerciseSchema, input, async (values) => {
    await updateOwnExercise(id, { ...values, timed: values.kind === "timed" });
    refresh();
  });
  if (!result.ok) return result;
  redirect(exerciseUrl(id));
}

export async function deleteOwnExerciseAction(id: string): Promise<ActionResult<string>> {
  const result = await runAction(uuid, id, async (exerciseId) => {
    await deleteOwnExercise(exerciseId);
    refresh();
  });
  if (!result.ok) return result;
  redirect(libraryUrl);
}

// --- Séance en cours : imprévus ------------------------------------------------------------

/** Séance libre : on ajoute les exercices au fil de l'eau. */
export async function startFreeSessionAction(): Promise<ActionResult<string>> {
  const t = await getTranslations("Training.session");
  let sessionId = "";
  const result = await runAction(z.object({}), {}, async () => {
    sessionId = await startFreeSession(t("freeName"), await getToday());
    refresh();
  });
  if (!result.ok) return result;
  redirect(sessionUrl(sessionId));
}

export async function addSessionExerciseAction(
  sessionId: string,
  exerciseId: string,
): Promise<ActionResult<string>> {
  return runAction(
    z.object({ sessionId: uuid, exerciseId: uuid }),
    { sessionId, exerciseId },
    async (ids) => {
      await addSessionExercise(ids.sessionId, ids.exerciseId);
      refresh();
    },
  );
}

/** Change un exercice de la séance en cours, puis revient à la séance. */
export async function swapSessionExerciseAction(
  itemId: string,
  exerciseId: string,
  inProgram: boolean,
): Promise<ActionResult<string>> {
  let sessionId = "";
  const result = await runAction(
    z.object({ itemId: uuid, exerciseId: uuid, inProgram: z.boolean() }),
    { itemId, exerciseId, inProgram },
    async (values) => {
      sessionId = await swapSessionExercise(values);
      refresh();
    },
  );
  if (!result.ok) return result;
  redirect(sessionUrl(sessionId));
}

export async function removeSessionExerciseAction(itemId: string): Promise<ActionResult<string>> {
  return runAction(uuid, itemId, async (id) => {
    await removeSessionExercise(id);
    refresh();
  });
}

export async function moveSessionExerciseAction(
  itemId: string,
  direction: -1 | 1 | "last",
): Promise<ActionResult<string>> {
  return runAction(
    z.object({
      itemId: uuid,
      direction: z.union([z.literal(-1), z.literal(1), z.literal("last")]),
    }),
    { itemId, direction },
    async (values) => {
      await moveSessionExercise(values.itemId, values.direction);
      refresh();
    },
  );
}

export async function setSessionSupersetAction(
  itemId: string,
  linked: boolean,
): Promise<ActionResult<string>> {
  return runAction(
    z.object({ itemId: uuid, linked: z.boolean() }),
    { itemId, linked },
    async (values) => {
      await setSessionSuperset(values.itemId, values.linked);
      refresh();
    },
  );
}

export async function setSessionNoteAction(
  itemId: string,
  input: NoteFormValues,
): Promise<ActionResult<string>> {
  if (!uuid.safeParse(itemId).success) return { ok: false, formError: "itemNotFound" };
  return runAction(noteSchema, input, async (values) => {
    await setSessionNote(itemId, values.note);
    refresh();
  });
}

/** Superset dans la séance type. */
export async function setWorkoutSupersetAction(
  itemId: string,
  linked: boolean,
): Promise<ActionResult<string>> {
  return runAction(
    z.object({ itemId: uuid, linked: z.boolean() }),
    { itemId, linked },
    async (values) => {
      await setWorkoutSuperset(values.itemId, values.linked);
      refresh();
    },
  );
}

const restSeconds = z.number().int().min(0).max(900);

export async function setSessionRestAction(
  itemId: string,
  seconds: number,
): Promise<ActionResult<string>> {
  return runAction(
    z.object({ itemId: uuid, seconds: restSeconds }),
    { itemId, seconds },
    async (values) => {
      await setSessionRest(values.itemId, values.seconds);
      refresh();
    },
  );
}

export async function setWorkoutRestAction(
  itemId: string,
  seconds: number,
): Promise<ActionResult<string>> {
  return runAction(
    z.object({ itemId: uuid, seconds: restSeconds }),
    { itemId, seconds },
    async (values) => {
      await setWorkoutRest(values.itemId, values.seconds);
      refresh();
    },
  );
}
