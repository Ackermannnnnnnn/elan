import "server-only";
import { cache } from "react";
import type { CautionArea, Equipment, Level, Muscle, Pattern } from "@/domain/exercise-catalog";
import { type ReplacementFilters, findReplacements } from "@/domain/exercise-replacement";
import { liftedLoad, type LoggedSet, type Suggestion, suggestNext } from "@/domain/progression";
import {
  availableEquipment,
  estimateWorkoutMinutes,
  generateProgram,
  type LibraryExercise,
  prescriptionFor,
  type Structure,
  type TrainingContext,
  type TrainingGoal,
} from "@/domain/training-program";
import {
  buildWeek,
  isoWeekday,
  type ScheduleSession,
  type SessionStatus,
  type WeekDay,
} from "@/domain/training-schedule";
import { addDays, diffDays, type IsoDate } from "@/lib/dates";
import type { Row } from "@/types/database";
import { DataError, fail, getDb } from "./client";
import { getOwnPreferences } from "./plan";
import { getOwnProfile } from "./profile";

// --- Bibliothèque ------------------------------------------------------------------

const EXERCISE_COLUMNS =
  "id, owner_id, slug, name, primary_muscle, secondary_muscles, movement_pattern, equipment, difficulty, is_compound, is_timed, load_basis, caution_areas, instructions, media_url" as const;

export type Exercise = Pick<
  Row<"exercise_library">,
  | "id"
  | "owner_id"
  | "slug"
  | "name"
  | "primary_muscle"
  | "secondary_muscles"
  | "movement_pattern"
  | "equipment"
  | "difficulty"
  | "is_compound"
  | "is_timed"
  | "load_basis"
  | "caution_areas"
  | "instructions"
  | "media_url"
>;

export function toLibraryExercise(exercise: Exercise): LibraryExercise {
  return {
    id: exercise.id,
    slug: exercise.slug,
    name: exercise.name,
    primary: exercise.primary_muscle,
    pattern: exercise.movement_pattern,
    equipment: exercise.equipment as Equipment[],
    difficulty: exercise.difficulty,
    compound: exercise.is_compound,
    timed: exercise.is_timed,
    caution: exercise.caution_areas as CautionArea[],
  };
}

/**
 * Bibliothèque visible par l'utilisateur (référence + exercices personnels).
 * Mise en cache le temps d'une requête : plusieurs fonctions en ont besoin.
 */
export const listExercises = cache(async (): Promise<Exercise[]> => {
  const { supabase } = await getDb();
  const { data, error } = await supabase
    .from("exercise_library")
    .select(EXERCISE_COLUMNS)
    .order("name", { ascending: true })
    .limit(1000);
  if (error) fail("listExercises", error);
  return data;
});

export async function getExercise(id: string): Promise<Exercise | null> {
  const { supabase } = await getDb();
  const { data, error } = await supabase
    .from("exercise_library")
    .select(EXERCISE_COLUMNS)
    .eq("id", id)
    .maybeSingle();
  if (error) fail("getExercise", error);
  return data;
}

/** Schéma de mouvement déduit du muscle principal d'un exercice personnel. */
const PATTERN_BY_MUSCLE: Record<Muscle, Pattern> = {
  chest: "push_horizontal",
  back: "pull_horizontal",
  shoulders: "push_vertical",
  biceps: "isolation",
  triceps: "isolation",
  forearms: "isolation",
  core: "core",
  glutes: "hinge",
  quadriceps: "squat",
  hamstrings: "hinge",
  calves: "isolation",
  full_body: "carry",
  cardio: "cardio",
};

export type OwnExerciseInput = {
  name: string;
  primary: Muscle;
  equipment: Equipment[];
  timed: boolean;
  /** Charge saisie par haltère (« kg / bras ») plutôt que totale. */
  perHand: boolean;
  instructions: string | null;
};

const MAX_OWN_EXERCISES = 200;

/** Exercice personnel (visible de son seul auteur, jamais proposé automatiquement). */
export async function createOwnExercise(input: OwnExerciseInput): Promise<string> {
  const { supabase, user } = await getDb();
  const { count, error: countError } = await supabase
    .from("exercise_library")
    .select("id", { count: "exact", head: true })
    .eq("owner_id", user.id);
  if (countError) fail("createOwnExercise.count", countError);
  if ((count ?? 0) >= MAX_OWN_EXERCISES) throw new DataError("tooManyOwnExercises");
  const { data, error } = await supabase
    .from("exercise_library")
    .insert({
      owner_id: user.id,
      name: input.name,
      primary_muscle: input.primary,
      movement_pattern: PATTERN_BY_MUSCLE[input.primary],
      equipment: input.equipment,
      difficulty: "beginner",
      is_compound: false,
      is_timed: input.timed,
      load_basis: input.perHand ? "per_hand" : "total",
      instructions: input.instructions,
    })
    .select("id")
    .single();
  if (error) fail("createOwnExercise", error, "saveFailed");
  return data.id;
}

export async function updateOwnExercise(id: string, input: OwnExerciseInput): Promise<void> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("exercise_library")
    .update({
      name: input.name,
      primary_muscle: input.primary,
      movement_pattern: PATTERN_BY_MUSCLE[input.primary],
      equipment: input.equipment,
      is_timed: input.timed,
      load_basis: input.perHand ? "per_hand" : "total",
      instructions: input.instructions,
    })
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id");
  if (error) fail("updateOwnExercise", error, "saveFailed");
  if (data.length === 0) throw new DataError("itemNotFound");
}

/** Supprime un exercice personnel jamais utilisé (sinon l'historique serait perdu). */
export async function deleteOwnExercise(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("exercise_library")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id)
    .select("id");
  if (error) {
    if (error.code === "23503") throw new DataError("exerciseInUse");
    fail("deleteOwnExercise", error, "deleteFailed");
  }
  if (data.length === 0) throw new DataError("itemNotFound");
}

// --- Préférences --------------------------------------------------------------------

export type TrainingSettings = {
  goal: TrainingGoal;
  level: Level;
  sessionsPerWeek: number;
  minutesPerSession: number;
  location: "gym" | "home" | "both" | "outdoor";
  equipment: Equipment[];
  limitations: CautionArea[];
  priorityMuscles: Muscle[];
  disliked: string[];
  liked: string[];
};

/** Réglages d'entraînement enregistrés (avec des valeurs par défaut prudentes). */
export async function getTrainingSettings(): Promise<TrainingSettings> {
  const [preferences, profile] = await Promise.all([getOwnPreferences(), getOwnProfile()]);
  return {
    goal: (preferences?.training_goal ?? "general_fitness") as TrainingGoal,
    level: (profile?.training_level ?? "beginner") as Level,
    sessionsPerWeek: Math.min(6, Math.max(1, preferences?.sessions_per_week || 3)),
    minutesPerSession: Math.min(180, Math.max(20, preferences?.session_duration_minutes || 45)),
    location: preferences?.training_location ?? "gym",
    equipment: (preferences?.equipment ?? []) as Equipment[],
    limitations: (preferences?.limitations ?? []) as CautionArea[],
    priorityMuscles: (preferences?.priority_muscles ?? []) as Muscle[],
    disliked: preferences?.disliked_exercises ?? [],
    liked: preferences?.liked_exercises ?? [],
  };
}

export function contextFrom(settings: TrainingSettings): TrainingContext {
  return {
    level: settings.level,
    equipment: availableEquipment(settings.location, settings.equipment),
    limitations: settings.limitations,
    disliked: settings.disliked,
    liked: settings.liked,
  };
}

// --- Programme ----------------------------------------------------------------------

export type Program = Pick<
  Row<"training_programs">,
  | "id"
  | "name"
  | "structure"
  | "goal"
  | "sessions_per_week"
  | "level"
  | "minutes_per_session"
  | "created_at"
>;
export type Workout = Pick<
  Row<"workouts">,
  "id" | "program_id" | "name" | "weekday" | "position" | "estimated_minutes" | "focus"
>;
export type WorkoutExercise = Pick<
  Row<"workout_exercises">,
  | "id"
  | "workout_id"
  | "exercise_id"
  | "position"
  | "target_sets"
  | "rep_min"
  | "rep_max"
  | "rest_seconds"
  | "replaced_exercise_id"
  | "superset_with_next"
>;

const PROGRAM_COLUMNS =
  "id, name, structure, goal, sessions_per_week, level, minutes_per_session, created_at" as const;
const WORKOUT_COLUMNS =
  "id, program_id, name, weekday, position, estimated_minutes, focus" as const;
const WORKOUT_EXERCISE_COLUMNS =
  "id, workout_id, exercise_id, position, target_sets, rep_min, rep_max, rest_seconds, replaced_exercise_id, superset_with_next" as const;

/**
 * Enregistre les réglages puis génère et active un nouveau programme (l'ancien
 * est conservé, désactivé, pour l'historique des séances).
 */
export async function createProgram(input: {
  settings: Omit<TrainingSettings, "disliked" | "liked">;
  structure: Structure;
  name: string;
  workoutNames: Record<string, string>;
}): Promise<string> {
  const { supabase, user } = await getDb();
  const { settings } = input;

  const { error: preferencesError } = await supabase
    .from("user_preferences")
    .update({
      training_goal: settings.goal,
      sessions_per_week: settings.sessionsPerWeek,
      session_duration_minutes: settings.minutesPerSession,
      training_location: settings.location,
      equipment: settings.equipment,
      limitations: settings.limitations,
      priority_muscles: settings.priorityMuscles,
    })
    .eq("user_id", user.id);
  if (preferencesError) fail("createProgram.preferences", preferencesError, "saveFailed");
  const { error: profileError } = await supabase
    .from("profiles")
    .update({ training_level: settings.level })
    .eq("id", user.id);
  if (profileError) fail("createProgram.profile", profileError, "saveFailed");

  const full = await getTrainingSettings();
  // Le générateur n'utilise que la bibliothèque de référence (zones sensibles renseignées).
  const library = (await listExercises())
    .filter((exercise) => exercise.owner_id === null)
    .map(toLibraryExercise);
  const generated = generateProgram({
    library,
    context: contextFrom({ ...full, ...settings }),
    goal: settings.goal,
    structure: input.structure,
    sessionsPerWeek: settings.sessionsPerWeek,
    minutesPerSession: settings.minutesPerSession,
    priorityMuscles: settings.priorityMuscles,
  });
  if (generated.workouts.every((workout) => workout.exercises.length === 0)) {
    throw new DataError("noExercisesAvailable");
  }

  const { data: previous, error: previousError } = await supabase
    .from("training_programs")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (previousError) fail("createProgram.previous", previousError);

  const { error: deactivateError } = await supabase
    .from("training_programs")
    .update({ is_active: false })
    .eq("user_id", user.id)
    .eq("is_active", true);
  if (deactivateError) fail("createProgram.deactivate", deactivateError, "saveFailed");

  const { data: program, error } = await supabase
    .from("training_programs")
    .insert({
      user_id: user.id,
      name: input.name.slice(0, 120),
      structure: generated.structure,
      goal: settings.goal,
      sessions_per_week: settings.sessionsPerWeek,
      level: settings.level,
      minutes_per_session: settings.minutesPerSession,
      origin: "generated",
      is_active: true,
    })
    .select("id")
    .single();
  if (error) fail("createProgram", error, "saveFailed");

  // Les séances d'un même thème sont numérotées : « Haut du corps A », « … B ».
  const seen = new Map<string, number>();
  const { data: workouts, error: workoutsError } = await supabase
    .from("workouts")
    .insert(
      generated.workouts.map((workout) => {
        const count = seen.get(workout.focus) ?? 0;
        seen.set(workout.focus, count + 1);
        const base = input.workoutNames[workout.focus] ?? workout.focus;
        const repeated = generated.workouts.filter((w) => w.focus === workout.focus).length > 1;
        return {
          user_id: user.id,
          program_id: program.id,
          name: repeated ? `${base} ${String.fromCharCode(65 + count)}` : base,
          weekday: workout.weekday,
          position: workout.index,
          estimated_minutes: Math.max(5, workout.estimatedMinutes),
          focus: workout.focus,
        };
      }),
    )
    .select("id, position");
  if (workoutsError) fail("createProgram.workouts", workoutsError, "saveFailed");

  const idByPosition = new Map(workouts.map((workout) => [workout.position, workout.id]));
  const rows = generated.workouts.flatMap((workout) =>
    workout.exercises.map((exercise, position) => ({
      user_id: user.id,
      workout_id: idByPosition.get(workout.index) as string,
      exercise_id: exercise.exerciseId,
      position,
      target_sets: exercise.sets,
      rep_min: exercise.repMin,
      rep_max: exercise.repMax,
      rest_seconds: exercise.restSeconds,
    })),
  );
  const { error: exercisesError } = await supabase.from("workout_exercises").insert(rows);
  if (exercisesError) {
    await supabase.from("training_programs").delete().eq("id", program.id).eq("user_id", user.id);
    fail("createProgram.exercises", exercisesError, "saveFailed");
  }

  // Les séances créées à la main suivent dans le nouveau programme.
  if (previous) {
    const { error: carryError } = await supabase
      .from("workouts")
      .update({ program_id: program.id })
      .eq("user_id", user.id)
      .eq("program_id", previous.id)
      .eq("focus", "custom");
    if (carryError) fail("createProgram.carry", carryError, "saveFailed");
    await syncProgramSessions(program.id);
  }
  return program.id;
}

/** Nombre de séances hebdomadaires du programme = séances types ayant un jour fixe. */
async function syncProgramSessions(programId: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workouts")
    .select("id")
    .eq("user_id", user.id)
    .eq("program_id", programId)
    .not("weekday", "is", null);
  if (error) fail("syncProgramSessions", error);
  const { error: updateError } = await supabase
    .from("training_programs")
    .update({ sessions_per_week: Math.min(7, Math.max(1, data.length)) })
    .eq("id", programId)
    .eq("user_id", user.id);
  if (updateError) fail("syncProgramSessions.update", updateError, "saveFailed");
}

/**
 * Programme actif ; s'il n'y en a pas, crée un programme « manuel » vide pour
 * accueillir les séances composées à la main.
 */
async function ensureActiveProgram(name: string): Promise<string> {
  const { supabase, user } = await getDb();
  const { data: existing, error } = await supabase
    .from("training_programs")
    .select("id")
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) fail("ensureActiveProgram", error);
  if (existing) return existing.id;
  const settings = await getTrainingSettings();
  const { data, error: insertError } = await supabase
    .from("training_programs")
    .insert({
      user_id: user.id,
      name: name.slice(0, 120),
      structure: "custom",
      goal: settings.goal,
      sessions_per_week: 1,
      level: settings.level,
      minutes_per_session: settings.minutesPerSession,
      origin: "manual",
      is_active: true,
    })
    .select("id")
    .single();
  if (insertError) fail("ensureActiveProgram.insert", insertError, "saveFailed");
  return data.id;
}

const MAX_WORKOUTS = 14;
const MAX_WORKOUT_EXERCISES = 20;

/** Nouvelle séance type, vide, composée ensuite à partir de la bibliothèque. */
export async function createWorkout(input: {
  name: string;
  weekday: number | null;
  programName: string;
}): Promise<string> {
  const { supabase, user } = await getDb();
  const programId = await ensureActiveProgram(input.programName);
  const { data: siblings, error: siblingsError } = await supabase
    .from("workouts")
    .select("position")
    .eq("user_id", user.id)
    .eq("program_id", programId)
    .order("position", { ascending: false });
  if (siblingsError) fail("createWorkout.siblings", siblingsError);
  if (siblings.length >= MAX_WORKOUTS) throw new DataError("tooManyWorkouts");
  const { data, error } = await supabase
    .from("workouts")
    .insert({
      user_id: user.id,
      program_id: programId,
      name: input.name.slice(0, 120),
      weekday: input.weekday,
      position: (siblings[0]?.position ?? -1) + 1,
      estimated_minutes: 5,
      focus: "custom",
    })
    .select("id")
    .single();
  if (error) fail("createWorkout", error, "saveFailed");
  await syncProgramSessions(programId);
  return data.id;
}

/** Séance type du programme actif (sinon : introuvable). */
async function getOwnWorkout(id: string) {
  const found = await getWorkout(id);
  if (!found) throw new DataError("itemNotFound");
  return found;
}

export async function updateWorkout(
  id: string,
  input: { name: string; weekday: number | null },
): Promise<void> {
  const { supabase, user } = await getDb();
  const { workout } = await getOwnWorkout(id);
  const { error } = await supabase
    .from("workouts")
    .update({ name: input.name.slice(0, 120), weekday: input.weekday })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) fail("updateWorkout", error, "saveFailed");
  await syncProgramSessions(workout.program_id);
}

/** Change seulement le jour habituel (null = à la demande). */
export async function setWorkoutWeekday(id: string, weekday: number | null): Promise<void> {
  const { workout } = await getOwnWorkout(id);
  await updateWorkout(id, { name: workout.name, weekday });
}

/** Supprime une séance type ; les séances déjà faites restent dans l'historique. */
export async function deleteWorkout(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { workout } = await getOwnWorkout(id);
  const { error: plannedError } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("user_id", user.id)
    .eq("workout_id", id)
    .in("status", ["planned", "skipped"]);
  if (plannedError) fail("deleteWorkout.planned", plannedError, "deleteFailed");
  const { error } = await supabase.from("workouts").delete().eq("id", id).eq("user_id", user.id);
  if (error) fail("deleteWorkout", error, "deleteFailed");
  await syncProgramSessions(workout.program_id);
}

/** Recalcule la durée estimée d'une séance type après modification. */
async function refreshWorkoutMinutes(workoutId: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("exercise_id, target_sets, rep_min, rep_max, rest_seconds")
    .eq("user_id", user.id)
    .eq("workout_id", workoutId);
  if (error) fail("refreshWorkoutMinutes", error);
  const timed = new Map(
    (await listExercises()).map((exercise) => [exercise.id, exercise.is_timed]),
  );
  const { error: updateError } = await supabase
    .from("workouts")
    .update({
      estimated_minutes: estimateWorkoutMinutes(
        data.map((item) => ({
          sets: item.target_sets,
          repMin: item.rep_min,
          repMax: item.rep_max,
          restSeconds: item.rest_seconds ?? 0,
          timed: timed.get(item.exercise_id) ?? false,
        })),
      ),
    })
    .eq("id", workoutId)
    .eq("user_id", user.id);
  if (updateError) fail("refreshWorkoutMinutes.update", updateError, "saveFailed");
}

/** Ajoute un exercice de la bibliothèque à la fin d'une séance type. */
export async function addWorkoutExercise(workoutId: string, exerciseId: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { workout } = await getOwnWorkout(workoutId);
  if (workout.exercises.some((item) => item.exercise_id === exerciseId)) {
    throw new DataError("exerciseAlreadyInWorkout");
  }
  if (workout.exercises.length >= MAX_WORKOUT_EXERCISES) throw new DataError("tooManyExercises");
  const [exercise, settings] = await Promise.all([getExercise(exerciseId), getTrainingSettings()]);
  if (!exercise) throw new DataError("itemNotFound");
  const prescription = prescriptionFor(
    { compound: exercise.is_compound, timed: exercise.is_timed },
    settings.goal,
    settings.level,
  );
  const { error } = await supabase.from("workout_exercises").insert({
    user_id: user.id,
    workout_id: workoutId,
    exercise_id: exerciseId,
    position: Math.max(-1, ...workout.exercises.map((item) => item.position)) + 1,
    target_sets: prescription.sets,
    rep_min: prescription.repMin,
    rep_max: prescription.repMax,
    rest_seconds: prescription.restSeconds,
  });
  if (error) fail("addWorkoutExercise", error, "saveFailed");
  await refreshWorkoutMinutes(workoutId);
}

export async function removeWorkoutExercise(itemId: string): Promise<string> {
  const { supabase, user } = await getDb();
  const item = await getWorkoutExercise(itemId);
  const { error } = await supabase
    .from("workout_exercises")
    .delete()
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) fail("removeWorkoutExercise", error, "deleteFailed");
  await refreshWorkoutMinutes(item.workout_id);
  return item.workout_id;
}

/** Monte (-1) ou descend (+1) un exercice dans la séance. */
export async function moveWorkoutExercise(itemId: string, direction: -1 | 1): Promise<void> {
  const { supabase, user } = await getDb();
  const item = await getWorkoutExercise(itemId);
  const { data, error } = await supabase
    .from("workout_exercises")
    .select("id, position")
    .eq("user_id", user.id)
    .eq("workout_id", item.workout_id)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) fail("moveWorkoutExercise", error);
  const ids = data.map((row) => row.id);
  const from = ids.indexOf(itemId);
  const to = from + direction;
  if (from < 0 || to < 0 || to >= ids.length) return;
  [ids[from], ids[to]] = [ids[to] as string, ids[from] as string];
  // Positions renumérotées 0, 1, 2… (corrige au passage d'éventuels doublons).
  for (const [position, id] of ids.entries()) {
    const current = data.find((row) => row.id === id);
    if (current?.position === position) continue;
    const { error: updateError } = await supabase
      .from("workout_exercises")
      .update({ position })
      .eq("id", id)
      .eq("user_id", user.id);
    if (updateError) fail("moveWorkoutExercise.update", updateError, "saveFailed");
  }
}

/** Séries, répétitions (ou secondes) et repos d'un exercice de séance. */
/** Temps de repos d'un exercice de la séance type. */
export async function setWorkoutRest(itemId: string, seconds: number): Promise<void> {
  const { supabase, user } = await getDb();
  const item = await getWorkoutExercise(itemId);
  const { error } = await supabase
    .from("workout_exercises")
    .update({ rest_seconds: seconds })
    .eq("id", item.id)
    .eq("user_id", user.id);
  if (error) fail("setWorkoutRest", error, "saveFailed");
  await refreshWorkoutMinutes(item.workout_id);
}

/** Enchaîne (superset) ou sépare un exercice de la séance type et le suivant. */
export async function setWorkoutSuperset(itemId: string, linked: boolean): Promise<void> {
  const { supabase, user } = await getDb();
  const item = await getWorkoutExercise(itemId);
  const { error } = await supabase
    .from("workout_exercises")
    .update({ superset_with_next: linked })
    .eq("id", item.id)
    .eq("user_id", user.id);
  if (error) fail("setWorkoutSuperset", error, "saveFailed");
}

export async function updatePrescription(
  itemId: string,
  input: { sets: number; repMin: number; repMax: number; restSeconds: number },
): Promise<string> {
  const { supabase, user } = await getDb();
  const item = await getWorkoutExercise(itemId);
  const { error } = await supabase
    .from("workout_exercises")
    .update({
      target_sets: input.sets,
      rep_min: input.repMin,
      rep_max: input.repMax,
      rest_seconds: input.restSeconds,
    })
    .eq("id", itemId)
    .eq("user_id", user.id);
  if (error) fail("updatePrescription", error, "saveFailed");
  await refreshWorkoutMinutes(item.workout_id);
  return item.workout_id;
}

export type ProgramView = {
  program: Program;
  workouts: (Workout & { exercises: (WorkoutExercise & { exercise: Exercise | null })[] })[];
};

export async function getActiveProgram(): Promise<ProgramView | null> {
  const { supabase, user } = await getDb();
  const { data: program, error } = await supabase
    .from("training_programs")
    .select(PROGRAM_COLUMNS)
    .eq("user_id", user.id)
    .eq("is_active", true)
    .maybeSingle();
  if (error) fail("getActiveProgram", error);
  if (!program) return null;

  const { data: workouts, error: workoutsError } = await supabase
    .from("workouts")
    .select(WORKOUT_COLUMNS)
    .eq("user_id", user.id)
    .eq("program_id", program.id)
    .order("position", { ascending: true });
  if (workoutsError) fail("getActiveProgram.workouts", workoutsError);

  const ids = workouts.map((workout) => workout.id);
  const { data: items, error: itemsError } = ids.length
    ? await supabase
        .from("workout_exercises")
        .select(WORKOUT_EXERCISE_COLUMNS)
        .eq("user_id", user.id)
        .in("workout_id", ids)
        .order("position", { ascending: true })
    : { data: [], error: null };
  if (itemsError) fail("getActiveProgram.exercises", itemsError);

  const exercises = new Map((await listExercises()).map((exercise) => [exercise.id, exercise]));
  return {
    program,
    workouts: workouts.map((workout) => ({
      ...workout,
      exercises: items
        .filter((item) => item.workout_id === workout.id)
        .map((item) => ({ ...item, exercise: exercises.get(item.exercise_id) ?? null })),
    })),
  };
}

/** Une séance type de l'utilisateur, avec ses exercices. */
export async function getWorkout(id: string) {
  const view = await getActiveProgram();
  const workout = view?.workouts.find((candidate) => candidate.id === id);
  if (!view || !workout) {
    // Séance d'un ancien programme : lisible, non modifiable depuis cette vue.
    return null;
  }
  return { program: view.program, workout };
}

export async function setTargetSets(workoutExerciseId: string, sets: number): Promise<void> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_exercises")
    .update({ target_sets: sets })
    .eq("id", workoutExerciseId)
    .eq("user_id", user.id)
    .select("workout_id");
  if (error) fail("setTargetSets", error, "saveFailed");
  const row = data[0];
  if (!row) throw new DataError("itemNotFound");
  await refreshWorkoutMinutes(row.workout_id);
}

async function getWorkoutExercise(id: string) {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_exercises")
    .select(WORKOUT_EXERCISE_COLUMNS)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) fail("getWorkoutExercise", error);
  if (!data) throw new DataError("itemNotFound");
  return data;
}

/** Alternatives à un exercice de séance, filtrées par le moteur. */
export async function listReplacements(
  workoutExerciseId: string,
  filters: ReplacementFilters,
): Promise<{ current: Exercise; item: WorkoutExercise; options: Exercise[] }> {
  const { supabase, user } = await getDb();
  const item = await getWorkoutExercise(workoutExerciseId);
  const [all, settings, siblings] = await Promise.all([
    listExercises(),
    getTrainingSettings(),
    supabase
      .from("workout_exercises")
      .select("exercise_id")
      .eq("user_id", user.id)
      .eq("workout_id", item.workout_id),
  ]);
  if (siblings.error) fail("listReplacements.siblings", siblings.error);
  const current = all.find((exercise) => exercise.id === item.exercise_id);
  if (!current) throw new DataError("itemNotFound");
  const byId = new Map(all.map((exercise) => [exercise.id, exercise]));
  const options = findReplacements({
    current: toLibraryExercise(current),
    library: all.filter((exercise) => exercise.owner_id === null).map(toLibraryExercise),
    context: contextFrom(settings),
    inWorkout: siblings.data.map((row) => row.exercise_id),
    filters,
  }).flatMap((exercise) => byId.get(exercise.id) ?? []);
  return { current, item, options };
}

/**
 * Remplace l'exercice d'une séance type. Séries et repos sont conservés pour
 * garder l'équilibre de la séance ; seules les répétitions changent si l'on
 * passe d'un exercice chronométré à un exercice en répétitions (ou l'inverse).
 */
export async function replaceWorkoutExercise(input: {
  workoutExerciseId: string;
  exerciseId: string;
  dislikeCurrent: boolean;
}): Promise<string> {
  const { supabase, user } = await getDb();
  const { current, item, options } = await listReplacements(input.workoutExerciseId, {});
  const replacement = options.find((exercise) => exercise.id === input.exerciseId);
  // Seule une alternative proposée par le moteur est acceptée (sécurité, cohérence).
  if (!replacement) throw new DataError("replacementNotAllowed");

  const settings = await getTrainingSettings();
  const changesKind = replacement.is_timed !== current.is_timed;
  const prescription = changesKind
    ? prescriptionFor(
        { compound: replacement.is_compound, timed: replacement.is_timed },
        settings.goal,
        settings.level,
      )
    : null;
  const { error } = await supabase
    .from("workout_exercises")
    .update({
      exercise_id: replacement.id,
      replaced_exercise_id: item.replaced_exercise_id ?? current.id,
      ...(prescription ? { rep_min: prescription.repMin, rep_max: prescription.repMax } : {}),
    })
    .eq("id", item.id)
    .eq("user_id", user.id);
  if (error) fail("replaceWorkoutExercise", error, "saveFailed");

  if (input.dislikeCurrent) {
    const key = current.slug ?? current.id;
    if (!settings.disliked.includes(key)) {
      const { error: preferencesError } = await supabase
        .from("user_preferences")
        .update({ disliked_exercises: [...settings.disliked, key].slice(-60) })
        .eq("user_id", user.id);
      if (preferencesError) fail("replaceWorkoutExercise.dislike", preferencesError, "saveFailed");
    }
  }
  return item.workout_id;
}

// --- Séances réalisées ----------------------------------------------------------------

export type Session = Pick<
  Row<"workout_sessions">,
  | "id"
  | "workout_id"
  | "name"
  | "scheduled_on"
  | "original_date"
  | "status"
  | "started_at"
  | "paused_at"
  | "paused_seconds"
  | "ended_at"
  | "perceived_effort"
>;
export type SessionSet = Pick<
  Row<"workout_sets">,
  "id" | "session_id" | "exercise_id" | "set_number" | "weight_kg" | "reps" | "completed_at"
>;

const SESSION_COLUMNS =
  "id, workout_id, name, scheduled_on, original_date, status, started_at, paused_at, paused_seconds, ended_at, perceived_effort" as const;
const SET_COLUMNS =
  "id, session_id, exercise_id, set_number, weight_kg, reps, completed_at" as const;

/** Séance en cours ou en pause, s'il y en a une. */
export async function getActiveSession(): Promise<Session | null> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_COLUMNS)
    .eq("user_id", user.id)
    .in("status", ["in_progress", "paused"])
    .maybeSingle();
  if (error) fail("getActiveSession", error);
  return data;
}

/**
 * Démarre une séance à partir d'une séance type (ou reprend celle en cours).
 * `occurrence` : date prévue de l'occurrence hebdomadaire que l'on fait
 * (éventuellement un autre jour) ; `plannedId` : séance planifiée que l'on lance.
 */
export async function startSession(
  workoutId: string,
  today: IsoDate,
  from: { occurrence?: IsoDate; plannedId?: string } = {},
): Promise<string> {
  const { supabase } = await getDb();
  // Tout se fait en base, en une transaction (voir la migration start_session).
  const { data, error } = await supabase.rpc("start_session", {
    p_workout_id: workoutId,
    p_today: today,
    ...(from.occurrence ? { p_occurrence: from.occurrence } : {}),
    ...(from.plannedId ? { p_planned_id: from.plannedId } : {}),
  });
  if (error) {
    if (error.code === "P0002") throw new DataError("itemNotFound");
    if (error.code === "P0001" && error.message === "emptyWorkout") {
      throw new DataError("emptyWorkout");
    }
    fail("startSession", error, "saveFailed");
  }
  return data;
}

/** Séance libre : aucun exercice prévu, on les ajoute au fil de la séance. */
export async function startFreeSession(name: string, today: IsoDate): Promise<string> {
  const active = await getActiveSession();
  if (active) return active.id;
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_sessions")
    .insert({
      user_id: user.id,
      name: name.slice(0, 120),
      scheduled_on: today,
      status: "in_progress",
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (error) fail("startFreeSession", error, "saveFailed");
  return data.id;
}

type PlanItem = {
  exerciseId: string;
  sets: number;
  repMin: number;
  repMax: number;
  restSeconds: number | null;
  supersetWithNext: boolean;
};

/** Copie le plan d'une séance (exercices, objectifs) et crée ses séries vides. */
async function createSessionPlan(sessionId: string, items: readonly PlanItem[], startAt = 0) {
  if (items.length === 0) return;
  const { supabase, user } = await getDb();
  const { error } = await supabase.from("session_exercises").insert(
    items.map((item, index) => ({
      user_id: user.id,
      session_id: sessionId,
      exercise_id: item.exerciseId,
      position: startAt + index,
      rep_min: item.repMin,
      rep_max: item.repMax,
      rest_seconds: item.restSeconds,
      superset_with_next: item.supersetWithNext,
    })),
  );
  if (error) {
    if (isUniqueViolation(error)) throw new DataError("exerciseAlreadyInSession");
    fail("createSessionPlan", error, "saveFailed");
  }
  const { error: setsError } = await supabase.from("workout_sets").insert(
    items.flatMap((item) =>
      Array.from({ length: Math.max(1, item.sets) }, (_, index) => ({
        user_id: user.id,
        session_id: sessionId,
        exercise_id: item.exerciseId,
        set_number: index + 1,
      })),
    ),
  );
  if (setsError) fail("createSessionPlan.sets", setsError, "saveFailed");
}

// --- Planning ------------------------------------------------------------------------

/** Les dates de planning restent à moins d'un an d'aujourd'hui. */
const PLAN_RANGE_DAYS = 366;

function assertPlannable(date: IsoDate, today: IsoDate) {
  if (Math.abs(diffDays(today, date)) > PLAN_RANGE_DAYS) throw new DataError("dateOutOfRange");
}

export type WeekView = {
  program: Program | null;
  workouts: ProgramView["workouts"];
  days: WeekDay[];
};

/** Semaine datée : occurrences hebdomadaires + séances planifiées, faites ou sautées. */
export async function getWeekSchedule(weekStart: IsoDate, today: IsoDate): Promise<WeekView> {
  const { supabase, user } = await getDb();
  const weekEnd = addDays(weekStart, 6);
  const [view, scheduled, moved] = await Promise.all([
    getActiveProgram(),
    supabase
      .from("workout_sessions")
      .select(SESSION_COLUMNS)
      .eq("user_id", user.id)
      .gte("scheduled_on", weekStart)
      .lte("scheduled_on", weekEnd)
      .order("created_at", { ascending: true }),
    // Occurrences de cette semaine déplacées vers une autre semaine.
    supabase
      .from("workout_sessions")
      .select(SESSION_COLUMNS)
      .eq("user_id", user.id)
      .gte("original_date", weekStart)
      .lte("original_date", weekEnd),
  ]);
  if (scheduled.error) fail("getWeekSchedule", scheduled.error);
  if (moved.error) fail("getWeekSchedule.moved", moved.error);
  const sessions = new Map<string, Session>();
  for (const session of [...scheduled.data, ...moved.data]) sessions.set(session.id, session);

  const workouts = view?.workouts ?? [];
  return {
    program: view?.program ?? null,
    workouts,
    days: buildWeek({
      weekStart,
      today,
      since: view ? view.program.created_at.slice(0, 10) : null,
      workouts: workouts.map((workout) => ({
        id: workout.id,
        name: workout.name,
        weekday: workout.weekday,
      })),
      sessions: [...sessions.values()].map((session): ScheduleSession => ({
        id: session.id,
        workoutId: session.workout_id,
        name: session.name,
        scheduledOn: session.scheduled_on,
        originalDate: session.original_date,
        status: session.status as SessionStatus,
      })),
    }),
  };
}

/** Vérifie qu'une séance type a bien une occurrence hebdomadaire à cette date. */
async function getOccurrence(workoutId: string, date: IsoDate) {
  const { workout } = await getOwnWorkout(workoutId);
  if (workout.weekday !== isoWeekday(date)) throw new DataError("itemNotFound");
  return workout;
}

const isUniqueViolation = (error: { code?: string }) => error.code === "23505";

/** Déplace une seule occurrence hebdomadaire vers une autre date. */
export async function moveOccurrence(input: {
  workoutId: string;
  from: IsoDate;
  to: IsoDate;
  today: IsoDate;
}): Promise<void> {
  assertPlannable(input.to, input.today);
  const workout = await getOccurrence(input.workoutId, input.from);
  if (input.to === input.from) return;
  const { supabase, user } = await getDb();
  const { error } = await supabase.from("workout_sessions").insert({
    user_id: user.id,
    workout_id: workout.id,
    name: workout.name,
    scheduled_on: input.to,
    original_date: input.from,
    status: "planned",
  });
  if (error) {
    if (isUniqueViolation(error)) throw new DataError("occurrenceAlreadyChanged");
    fail("moveOccurrence", error, "saveFailed");
  }
}

/** Saute une seule occurrence hebdomadaire (rétablissable). */
export async function skipOccurrence(workoutId: string, date: IsoDate): Promise<void> {
  const workout = await getOccurrence(workoutId, date);
  const { supabase, user } = await getDb();
  const { error } = await supabase.from("workout_sessions").insert({
    user_id: user.id,
    workout_id: workout.id,
    name: workout.name,
    scheduled_on: date,
    original_date: date,
    status: "skipped",
  });
  if (error) {
    if (isUniqueViolation(error)) throw new DataError("occurrenceAlreadyChanged");
    fail("skipOccurrence", error, "saveFailed");
  }
}

/** Planifie une séance type à une date précise (en plus du rythme habituel). */
export async function planWorkout(workoutId: string, date: IsoDate, today: IsoDate) {
  assertPlannable(date, today);
  const { workout } = await getOwnWorkout(workoutId);
  if (workout.exercises.length === 0) throw new DataError("emptyWorkout");
  const { supabase, user } = await getDb();
  const { error } = await supabase.from("workout_sessions").insert({
    user_id: user.id,
    workout_id: workout.id,
    name: workout.name,
    scheduled_on: date,
    status: "planned",
  });
  if (error) fail("planWorkout", error, "saveFailed");
}

/** Séance planifiée ou sautée de l'utilisateur. */
export async function getPlannedSession(id: string): Promise<Session | null> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["planned", "skipped"])
    .maybeSingle();
  if (error) fail("getPlannedSession", error);
  return data;
}

/** Change la date d'une séance planifiée. */
export async function reschedulePlanned(id: string, to: IsoDate, today: IsoDate): Promise<void> {
  assertPlannable(to, today);
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_sessions")
    .update({ scheduled_on: to })
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("status", "planned")
    .select("id");
  if (error) fail("reschedulePlanned", error, "saveFailed");
  if (data.length === 0) throw new DataError("itemNotFound");
}

/**
 * Annule une séance planifiée ou une occurrence sautée : l'occurrence
 * hebdomadaire d'origine, s'il y en a une, retrouve sa place.
 */
export async function cancelPlanned(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id)
    .in("status", ["planned", "skipped"])
    .select("id");
  if (error) fail("cancelPlanned", error, "deleteFailed");
  if (data.length === 0) throw new DataError("itemNotFound");
}

export type SessionItem = Pick<
  Row<"session_exercises">,
  | "id"
  | "exercise_id"
  | "position"
  | "rep_min"
  | "rep_max"
  | "rest_seconds"
  | "superset_with_next"
  | "replaced_exercise_id"
  | "note"
>;
const SESSION_ITEM_COLUMNS =
  "id, exercise_id, position, rep_min, rep_max, rest_seconds, superset_with_next, replaced_exercise_id, note" as const;

export type SessionView = {
  session: Session;
  exercises: {
    item: SessionItem;
    exercise: Exercise;
    /** Exercice prévu à l'origine (changé pendant la séance). */
    replaced: Exercise | null;
    target: Pick<SessionItem, "rep_min" | "rep_max" | "rest_seconds">;
    sets: SessionSet[];
    previous: LoggedSet[];
    suggestion: Suggestion | null;
    /** Note laissée sur cet exercice lors d'une séance précédente. */
    lastNote: string | null;
  }[];
};

export async function getSession(id: string): Promise<SessionView | null> {
  const { supabase, user } = await getDb();
  // La bibliothèque ne dépend de rien : lue dès maintenant, en parallèle.
  const libraryPromise = listExercises();
  libraryPromise.catch(() => {}); // évite un rejet non suivi si la séance est introuvable
  // Séance, séries et plan en parallèle : un seul aller-retour vers la base.
  const [sessionResult, setsResult, itemsResult] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select(SESSION_COLUMNS)
      .eq("id", id)
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("workout_sets")
      .select(SET_COLUMNS)
      .eq("user_id", user.id)
      .eq("session_id", id)
      .order("set_number", { ascending: true }),
    supabase
      .from("session_exercises")
      .select(SESSION_ITEM_COLUMNS)
      .eq("user_id", user.id)
      .eq("session_id", id)
      .order("position", { ascending: true })
      .order("created_at", { ascending: true }),
  ]);
  if (sessionResult.error) fail("getSession", sessionResult.error);
  const session = sessionResult.data;
  if (!session) return null;
  if (setsResult.error) fail("getSession.sets", setsResult.error);
  if (itemsResult.error) fail("getSession.items", itemsResult.error);
  const sets = setsResult.data;
  // Une séance terminée ne montre que les exercices réellement faits.
  const items = itemsResult.data.filter(
    (item) =>
      session.status !== "completed" || sets.some((set) => set.exercise_id === item.exercise_id),
  );
  const exerciseIds = items.map((item) => item.exercise_id);

  const [library, history, notes] = await Promise.all([
    libraryPromise.then((all) => new Map(all.map((exercise) => [exercise.id, exercise]))),
    // Dernière performance AVANT cette séance (on exclut la séance elle-même).
    lastPerformance(exerciseIds, id),
    lastNotes(exerciseIds, id),
  ]);

  return {
    session,
    exercises: items.flatMap((item) => {
      const exercise = library.get(item.exercise_id);
      if (!exercise) return [];
      const previous = history.get(item.exercise_id) ?? [];
      const lowerBodyCompound =
        exercise.is_compound &&
        ["quadriceps", "hamstrings", "glutes"].includes(exercise.primary_muscle);
      return [
        {
          item,
          exercise,
          replaced: item.replaced_exercise_id
            ? (library.get(item.replaced_exercise_id) ?? null)
            : null,
          target: item,
          sets: sets.filter((set) => set.exercise_id === item.exercise_id),
          previous,
          suggestion: suggestNext({
            previous,
            repMin: item.rep_min,
            repMax: item.rep_max,
            timed: exercise.is_timed,
            lowerBodyCompound,
          }),
          lastNote: notes.get(item.exercise_id) ?? null,
        },
      ];
    }),
  };
}

/** Dernière note laissée sur chaque exercice lors d'une autre séance. */
async function lastNotes(exerciseIds: readonly string[], sessionId: string) {
  const result = new Map<string, string>();
  if (exerciseIds.length === 0) return result;
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("session_exercises")
    .select("exercise_id, note, updated_at")
    .eq("user_id", user.id)
    .in("exercise_id", [...exerciseIds])
    .neq("session_id", sessionId)
    .not("note", "is", null)
    .order("updated_at", { ascending: false })
    .limit(200);
  if (error) fail("lastNotes", error);
  for (const row of data) {
    if (row.note && !result.has(row.exercise_id)) result.set(row.exercise_id, row.note);
  }
  return result;
}

// --- Modifier la séance en cours -------------------------------------------------------

/** Séance en cours ou en pause (sinon : introuvable). */
async function getOpenSession(id: string): Promise<Session> {
  const session = await getOwnSession(id);
  if (session.status !== "in_progress" && session.status !== "paused") {
    throw new DataError("sessionNotOpen");
  }
  return session;
}

async function listSessionItems(sessionId: string) {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("session_exercises")
    .select(SESSION_ITEM_COLUMNS)
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  if (error) fail("listSessionItems", error);
  return data;
}

/**
 * Exercice de la séance + la séance (ouverte), en une seule requête (la
 * séance est jointe par sa clé étrangère).
 */
async function getSessionItem(itemId: string) {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("session_exercises")
    .select(
      `${SESSION_ITEM_COLUMNS}, session_id, session:workout_sessions!inner(${SESSION_COLUMNS})`,
    )
    .eq("id", itemId)
    .eq("user_id", user.id)
    .maybeSingle()
    .overrideTypes<SessionItem & { session_id: string; session: Session }, { merge: false }>();
  if (error) fail("getSessionItem", error);
  if (!data) throw new DataError("itemNotFound");
  const { session, ...item } = data;
  if (session.status !== "in_progress" && session.status !== "paused") {
    throw new DataError("sessionNotOpen");
  }
  return { item, session };
}

/** Réécrit les positions 0, 1, 2… dans l'ordre donné. */
async function writeOrder(
  items: readonly { id: string; position: number; superset_with_next: boolean }[],
  flags: Map<string, boolean> = new Map(),
) {
  const { supabase, user } = await getDb();
  for (const [position, item] of items.entries()) {
    const superset = flags.get(item.id) ?? item.superset_with_next;
    if (item.position === position && superset === item.superset_with_next) continue;
    const { error } = await supabase
      .from("session_exercises")
      .update({ position, superset_with_next: superset })
      .eq("id", item.id)
      .eq("user_id", user.id);
    if (error) fail("writeOrder", error, "saveFailed");
  }
}

const MAX_SESSION_EXERCISES = 25;

/** Ajoute un exercice à la séance en cours (à la fin, ou juste après `afterItemId`). */
export async function addSessionExercise(
  sessionId: string,
  exerciseId: string,
  afterItemId?: string,
): Promise<void> {
  await getOpenSession(sessionId);
  const items = await listSessionItems(sessionId);
  if (items.some((item) => item.exercise_id === exerciseId)) {
    throw new DataError("exerciseAlreadyInSession");
  }
  if (items.length >= MAX_SESSION_EXERCISES) throw new DataError("tooManyExercises");
  const [exercise, settings] = await Promise.all([getExercise(exerciseId), getTrainingSettings()]);
  if (!exercise) throw new DataError("itemNotFound");
  const prescription = prescriptionFor(
    { compound: exercise.is_compound, timed: exercise.is_timed },
    settings.goal,
    settings.level,
  );
  await createSessionPlan(
    sessionId,
    [
      {
        exerciseId,
        sets: prescription.sets,
        repMin: prescription.repMin,
        repMax: prescription.repMax,
        restSeconds: prescription.restSeconds,
        supersetWithNext: false,
      },
    ],
    items.length,
  );
  if (afterItemId) {
    const after = items.findIndex((item) => item.id === afterItemId);
    if (after >= 0) {
      const fresh = await listSessionItems(sessionId);
      const added = fresh.find((item) => item.exercise_id === exerciseId);
      if (added) {
        const rest = fresh.filter((item) => item.id !== added.id);
        rest.splice(after + 1, 0, added);
        await writeOrder(rest);
      }
    }
  }
}

/**
 * Change un exercice de la séance en cours (machine prise, douleur…).
 * Les séries déjà validées restent sur l'exercice d'origine ; les séries
 * restantes passent au nouvel exercice, placé au même endroit.
 * `inProgram` : remplacer aussi l'exercice dans la séance type.
 */
export async function swapSessionExercise(input: {
  itemId: string;
  exerciseId: string;
  inProgram: boolean;
}): Promise<string> {
  const { supabase } = await getDb();
  // Tout se fait en base, en une transaction (migration « session_speed »).
  const call = (prescription?: { repMin: number; repMax: number; restSeconds: number | null }) =>
    supabase.rpc("swap_session_exercise", {
      p_item_id: input.itemId,
      p_exercise_id: input.exerciseId,
      p_in_program: input.inProgram,
      ...(prescription
        ? {
            p_rep_min: prescription.repMin,
            p_rep_max: prescription.repMax,
            ...(prescription.restSeconds === null
              ? {}
              : { p_rest_seconds: prescription.restSeconds }),
          }
        : {}),
    });
  let { data, error } = await call();
  // Passage répétitions ↔ secondes (rare) : il faut l'objectif propre au nouvel exercice.
  if (error?.code === "P0001" && error.message === "needsPrescription") {
    const [replacement, settings] = await Promise.all([
      getExercise(input.exerciseId),
      getTrainingSettings(),
    ]);
    if (!replacement) throw new DataError("itemNotFound");
    const prescription = prescriptionFor(
      { compound: replacement.is_compound, timed: replacement.is_timed },
      settings.goal,
      settings.level,
    );
    ({ data, error } = await call(prescription));
  }
  if (error) sessionEditError("swapSessionExercise", error);
  return data as string;
}

/** Traduit les erreurs des fonctions SQL de la séance en cours. */
function sessionEditError(context: string, error: { code?: string; message?: string }): never {
  if (error.code === "P0002") throw new DataError("itemNotFound");
  if (error.code === "P0001" && error.message === "sessionNotOpen") {
    throw new DataError("sessionNotOpen");
  }
  if (error.code === "P0001" && error.message === "exerciseAlreadyInSession") {
    throw new DataError("exerciseAlreadyInSession");
  }
  fail(context, error, "saveFailed");
}

/**
 * Retire un exercice de la séance en cours : les séries non faites disparaissent.
 * S'il a déjà des séries validées, il reste affiché avec elles.
 */
export async function removeSessionExercise(itemId: string): Promise<string> {
  const { supabase, user } = await getDb();
  const { item, session } = await getSessionItem(itemId);
  const { error } = await supabase
    .from("workout_sets")
    .delete()
    .eq("user_id", user.id)
    .eq("session_id", session.id)
    .eq("exercise_id", item.exercise_id)
    .is("completed_at", null);
  if (error) fail("removeSessionExercise.sets", error, "deleteFailed");
  const { count, error: countError } = await supabase
    .from("workout_sets")
    .select("id", { count: "exact", head: true })
    .eq("user_id", user.id)
    .eq("session_id", session.id)
    .eq("exercise_id", item.exercise_id);
  if (countError) fail("removeSessionExercise.count", countError);
  const items = await listSessionItems(session.id);
  const index = items.findIndex((other) => other.id === item.id);
  const previous = items[index - 1];
  if ((count ?? 0) === 0) {
    const { error: deleteError } = await supabase
      .from("session_exercises")
      .delete()
      .eq("id", item.id)
      .eq("user_id", user.id);
    if (deleteError) fail("removeSessionExercise", deleteError, "deleteFailed");
    // Le superset qui pointait vers lui est rompu.
    await writeOrder(
      items.filter((other) => other.id !== item.id),
      new Map(previous ? [[previous.id, false]] : []),
    );
  } else {
    await writeOrder(
      items,
      new Map([[item.id, false], ...(previous ? ([[previous.id, false]] as const) : [])]),
    );
  }
  return session.id;
}

/**
 * Déplace un exercice : -1 (monter), +1 (descendre) ou "last" (faire plus
 * tard, en fin de séance). Un exercice déplacé sort de son superset.
 */
export async function moveSessionExercise(
  itemId: string,
  direction: -1 | 1 | "last",
): Promise<string> {
  const { supabase } = await getDb();
  // Une seule requête : bornes, supersets et positions sont gérés en base.
  const { data, error } = await supabase.rpc("move_session_exercise", {
    p_item_id: itemId,
    p_direction: direction === "last" ? "last" : direction === -1 ? "up" : "down",
  });
  if (error) sessionEditError("moveSessionExercise", error);
  return data;
}

/** Enchaîne (ou sépare) un exercice avec le suivant, pendant la séance. */
export async function setSessionSuperset(itemId: string, linked: boolean): Promise<string> {
  const { supabase, user } = await getDb();
  const { item, session } = await getSessionItem(itemId);
  const items = await listSessionItems(session.id);
  if (linked && items[items.length - 1]?.id === item.id) throw new DataError("nothingToLink");
  const { error } = await supabase
    .from("session_exercises")
    .update({ superset_with_next: linked })
    .eq("id", item.id)
    .eq("user_id", user.id);
  if (error) fail("setSessionSuperset", error, "saveFailed");
  return session.id;
}

/**
 * Temps de repos d'un exercice de la séance en cours. Il est aussi enregistré
 * dans la séance type, pour les prochaines fois.
 */
export async function setSessionRest(itemId: string, seconds: number): Promise<string> {
  const { supabase, user } = await getDb();
  const { item, session } = await getSessionItem(itemId);
  const { error } = await supabase
    .from("session_exercises")
    .update({ rest_seconds: seconds })
    .eq("id", item.id)
    .eq("user_id", user.id);
  if (error) fail("setSessionRest", error, "saveFailed");
  if (session.workout_id) {
    const { error: templateError } = await supabase
      .from("workout_exercises")
      .update({ rest_seconds: seconds })
      .eq("user_id", user.id)
      .eq("workout_id", session.workout_id)
      .eq("exercise_id", item.exercise_id);
    if (templateError) fail("setSessionRest.template", templateError, "saveFailed");
    await refreshWorkoutMinutes(session.workout_id);
  }
  return session.id;
}

/** Note libre sur un exercice de la séance (vide = supprimée). */
export async function setSessionNote(itemId: string, note: string | null): Promise<string> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("session_exercises")
    .update({ note })
    .eq("id", itemId)
    .eq("user_id", user.id)
    .select("session_id");
  if (error) fail("setSessionNote", error, "saveFailed");
  const row = data[0];
  if (!row) throw new DataError("itemNotFound");
  return row.session_id;
}

/** Alternatives proposées par le moteur pour un exercice de la séance en cours. */
export async function listSessionAlternatives(
  itemId: string,
  filters: ReplacementFilters,
): Promise<{
  current: Exercise;
  sessionId: string;
  workoutId: string | null;
  options: Exercise[];
}> {
  // Bibliothèque et réglages ne dépendent pas de la séance : lus en même temps.
  const library = Promise.all([listExercises(), getTrainingSettings()]);
  library.catch(() => {}); // évite un rejet non suivi si la séance est introuvable
  const { item, session } = await getSessionItem(itemId);
  const [[all, settings], items] = await Promise.all([library, listSessionItems(session.id)]);
  const current = all.find((exercise) => exercise.id === item.exercise_id);
  if (!current) throw new DataError("itemNotFound");
  const byId = new Map(all.map((exercise) => [exercise.id, exercise]));
  const options = findReplacements({
    current: toLibraryExercise(current),
    library: all.filter((exercise) => exercise.owner_id === null).map(toLibraryExercise),
    context: contextFrom(settings),
    inWorkout: items.map((other) => other.exercise_id),
    filters,
  }).flatMap((exercise) => byId.get(exercise.id) ?? []);
  return { current, sessionId: session.id, workoutId: session.workout_id, options };
}

/** Exercice de séance (pour les pages « changer » et « ajouter »). */
export async function getSessionItemView(itemId: string) {
  const { item, session } = await getSessionItem(itemId);
  const exercise = await getExercise(item.exercise_id);
  if (!exercise) throw new DataError("itemNotFound");
  return { item, session, exercise, items: await listSessionItems(session.id) };
}

export async function getOpenSessionView(sessionId: string) {
  const session = await getOpenSession(sessionId);
  return { session, items: await listSessionItems(sessionId) };
}

/** Séries validées de la dernière autre séance où figurait chaque exercice. */
async function lastPerformance(exerciseIds: readonly string[], sessionId: string) {
  const result = new Map<string, LoggedSet[]>();
  if (exerciseIds.length === 0) return result;
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_sets")
    .select("session_id, exercise_id, weight_kg, reps, completed_at")
    .eq("user_id", user.id)
    .in("exercise_id", [...exerciseIds])
    .neq("session_id", sessionId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(500);
  if (error) fail("lastPerformance", error);
  const sessionOf = new Map<string, string>();
  for (const row of data) {
    const latest = sessionOf.get(row.exercise_id) ?? row.session_id;
    sessionOf.set(row.exercise_id, latest);
    if (row.session_id !== latest) continue;
    result.set(row.exercise_id, [
      ...(result.get(row.exercise_id) ?? []),
      { weightKg: row.weight_kg, reps: row.reps },
    ]);
  }
  return result;
}

async function getOwnSession(id: string): Promise<Session> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_sessions")
    .select(SESSION_COLUMNS)
    .eq("id", id)
    .eq("user_id", user.id)
    .maybeSingle();
  if (error) fail("getOwnSession", error);
  if (!data) throw new DataError("itemNotFound");
  return data;
}

/** Valide (ou corrige) une série : charge et répétitions réellement faites. */
export async function logSet(input: {
  setId: string;
  weightKg: number | null;
  reps: number;
}): Promise<string> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_sets")
    .update({
      weight_kg: input.weightKg,
      reps: input.reps,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.setId)
    .eq("user_id", user.id)
    .select("session_id");
  if (error) fail("logSet", error, "saveFailed");
  const row = data[0];
  if (!row) throw new DataError("itemNotFound");
  return row.session_id;
}

export async function addSet(sessionId: string, exerciseId: string): Promise<void> {
  const { supabase, user } = await getDb();
  await getOwnSession(sessionId);
  const { data, error } = await supabase
    .from("workout_sets")
    .select("set_number")
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId)
    .order("set_number", { ascending: false })
    .limit(1);
  if (error) fail("addSet.last", error);
  const next = (data[0]?.set_number ?? 0) + 1;
  if (next > 30) throw new DataError("tooManySets");
  const { error: insertError } = await supabase.from("workout_sets").insert({
    user_id: user.id,
    session_id: sessionId,
    exercise_id: exerciseId,
    set_number: next,
  });
  if (insertError) fail("addSet", insertError, "saveFailed");
}

/** Retire la dernière série non validée d'un exercice. */
export async function removeLastSet(sessionId: string, exerciseId: string): Promise<void> {
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_sets")
    .select("id, completed_at")
    .eq("user_id", user.id)
    .eq("session_id", sessionId)
    .eq("exercise_id", exerciseId)
    .order("set_number", { ascending: false })
    .limit(1);
  if (error) fail("removeLastSet.find", error);
  const last = data[0];
  if (!last) return;
  if (last.completed_at) throw new DataError("setAlreadyDone");
  const { error: deleteError } = await supabase
    .from("workout_sets")
    .delete()
    .eq("id", last.id)
    .eq("user_id", user.id);
  if (deleteError) fail("removeLastSet", deleteError, "deleteFailed");
}

const secondsBetween = (from: string, to: Date) =>
  Math.max(0, Math.round((to.getTime() - new Date(from).getTime()) / 1000));

export async function pauseSession(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const session = await getOwnSession(id);
  if (session.status !== "in_progress") return;
  const { error } = await supabase
    .from("workout_sessions")
    .update({ status: "paused", paused_at: new Date().toISOString() })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) fail("pauseSession", error, "saveFailed");
}

export async function resumeSession(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const session = await getOwnSession(id);
  if (session.status !== "paused") return;
  const now = new Date();
  const { error } = await supabase
    .from("workout_sessions")
    .update({
      status: "in_progress",
      paused_at: null,
      paused_seconds:
        session.paused_seconds + (session.paused_at ? secondsBetween(session.paused_at, now) : 0),
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) fail("resumeSession", error, "saveFailed");
}

/** Termine la séance : les séries non validées sont retirées. */
export async function finishSession(id: string, perceivedEffort: number | null): Promise<void> {
  const { supabase, user } = await getDb();
  const session = await getOwnSession(id);
  if (session.status === "completed") return;
  const now = new Date();
  const { error: setsError } = await supabase
    .from("workout_sets")
    .delete()
    .eq("user_id", user.id)
    .eq("session_id", id)
    .is("completed_at", null);
  if (setsError) fail("finishSession.sets", setsError, "saveFailed");
  const { error } = await supabase
    .from("workout_sessions")
    .update({
      status: "completed",
      ended_at: now.toISOString(),
      paused_at: null,
      paused_seconds:
        session.paused_seconds +
        (session.status === "paused" && session.paused_at
          ? secondsBetween(session.paused_at, now)
          : 0),
      perceived_effort: perceivedEffort,
    })
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) fail("finishSession", error, "saveFailed");
}

/** Abandonne une séance en cours : rien n'est conservé. */
export async function discardSession(id: string): Promise<void> {
  const { supabase, user } = await getDb();
  const session = await getOwnSession(id);
  if (session.status === "completed") throw new DataError("itemNotFound");
  const { error } = await supabase
    .from("workout_sessions")
    .delete()
    .eq("id", id)
    .eq("user_id", user.id);
  if (error) fail("discardSession", error, "deleteFailed");
}

/** Durée effective d'une séance, pauses déduites, en secondes. */
export function sessionSeconds(session: Session, now = new Date()): number {
  if (!session.started_at) return 0;
  const end = session.ended_at
    ? new Date(session.ended_at)
    : session.status === "paused" && session.paused_at
      ? new Date(session.paused_at)
      : now;
  return Math.max(0, secondsBetween(session.started_at, end) - session.paused_seconds);
}

export type SessionSummary = Session & { sets: number; volumeKg: number; exercises: number };

export async function listCompletedSessions(limit = 30): Promise<SessionSummary[]> {
  const { supabase, user } = await getDb();
  const [{ data: sessions, error }, library] = await Promise.all([
    supabase
      .from("workout_sessions")
      .select(SESSION_COLUMNS)
      .eq("user_id", user.id)
      .eq("status", "completed")
      .order("ended_at", { ascending: false })
      .limit(limit),
    listExercises(),
  ]);
  if (error) fail("listCompletedSessions", error);
  const basis = new Map(library.map((exercise) => [exercise.id, exercise.load_basis]));
  const ids = sessions.map((session) => session.id);
  const { data: sets, error: setsError } = ids.length
    ? await supabase
        .from("workout_sets")
        .select("session_id, exercise_id, weight_kg, reps")
        .eq("user_id", user.id)
        .in("session_id", ids)
        .limit(5000)
    : { data: [], error: null };
  if (setsError) fail("listCompletedSessions.sets", setsError);
  return sessions.map((session) => {
    const own = sets.filter((set) => set.session_id === session.id);
    return {
      ...session,
      sets: own.length,
      exercises: new Set(own.map((set) => set.exercise_id)).size,
      // Charge réellement soulevée : deux haltères = deux fois la charge saisie.
      volumeKg: Math.round(
        own.reduce(
          (sum, set) =>
            sum +
            (liftedLoad(set.weight_kg, basis.get(set.exercise_id) ?? "total") ?? 0) *
              (set.reps ?? 0),
          0,
        ),
      ),
    };
  });
}

/** Historique d'un exercice : séries validées, groupées par séance (plus récente d'abord). */
export async function getExerciseHistory(exerciseId: string) {
  const { supabase, user } = await getDb();
  const { data: sets, error } = await supabase
    .from("workout_sets")
    .select("session_id, set_number, weight_kg, reps, completed_at")
    .eq("user_id", user.id)
    .eq("exercise_id", exerciseId)
    .not("completed_at", "is", null)
    .order("completed_at", { ascending: false })
    .limit(1000);
  if (error) fail("getExerciseHistory", error);
  const ids = [...new Set(sets.map((set) => set.session_id))];
  const { data: sessions, error: sessionsError } = ids.length
    ? await supabase
        .from("workout_sessions")
        .select("id, name, scheduled_on, status")
        .eq("user_id", user.id)
        .in("id", ids)
    : { data: [], error: null };
  if (sessionsError) fail("getExerciseHistory.sessions", sessionsError);
  const completed = new Map(
    sessions
      .filter((session) => session.status === "completed")
      .map((session) => [session.id, session]),
  );
  return ids.flatMap((id) => {
    const session = completed.get(id);
    if (!session) return [];
    return [
      {
        sessionId: id,
        date: session.scheduled_on,
        name: session.name,
        sets: sets
          .filter((set) => set.session_id === id)
          .sort((a, b) => a.set_number - b.set_number)
          .map((set) => ({ weightKg: set.weight_kg, reps: set.reps })),
      },
    ];
  });
}

/** Exercices déjà travaillés, avec la date de la dernière séance terminée. */
export async function listTrainedExercises(): Promise<
  { exercise: Exercise; lastDate: string; sessions: number }[]
> {
  const sessions = await listCompletedSessions(200);
  if (sessions.length === 0) return [];
  const { supabase, user } = await getDb();
  const { data, error } = await supabase
    .from("workout_sets")
    .select("session_id, exercise_id")
    .eq("user_id", user.id)
    .in(
      "session_id",
      sessions.map((session) => session.id),
    )
    .limit(10000);
  if (error) fail("listTrainedExercises", error);
  const dateOf = new Map(sessions.map((session) => [session.id, session.scheduled_on]));
  const stats = new Map<string, { lastDate: string; sessions: Set<string> }>();
  for (const row of data) {
    const date = dateOf.get(row.session_id) ?? "";
    const entry = stats.get(row.exercise_id) ?? { lastDate: date, sessions: new Set<string>() };
    if (date > entry.lastDate) entry.lastDate = date;
    entry.sessions.add(row.session_id);
    stats.set(row.exercise_id, entry);
  }
  const library = new Map((await listExercises()).map((exercise) => [exercise.id, exercise]));
  return [...stats.entries()]
    .flatMap(([id, entry]) => {
      const exercise = library.get(id);
      return exercise
        ? [{ exercise, lastDate: entry.lastDate, sessions: entry.sessions.size }]
        : [];
    })
    .sort(
      (a, b) =>
        b.lastDate.localeCompare(a.lastDate) ||
        a.exercise.name.localeCompare(b.exercise.name, "fr"),
    );
}
