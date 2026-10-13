import { ROUTES } from "@/config/routes";
import { startOfIsoWeek } from "@/lib/dates";

export const workoutUrl = (id: string) => `${ROUTES.training}/workouts/${id}`;
export const sessionUrl = (id: string) => `${ROUTES.training}/sessions/${id}`;
export const exerciseUrl = (id: string) => `${ROUTES.training}/exercises/${id}`;
export const replaceUrl = (
  itemId: string,
  filters: { easier?: boolean; noMachine?: boolean; bodyweight?: boolean } = {},
) => {
  const search = new URLSearchParams();
  if (filters.easier) search.set("easier", "1");
  if (filters.noMachine) search.set("noMachine", "1");
  if (filters.bodyweight) search.set("bodyweight", "1");
  const query = search.toString();
  return `${ROUTES.training}/replace/${itemId}${query ? `?${query}` : ""}`;
};

/** Semaine (planning) qui contient ce jour. */
export const weekUrl = (date: string) => `${ROUTES.training}?semaine=${startOfIsoWeek(date)}`;
/** Organiser une occurrence hebdomadaire (séance type + date prévue). */
export const occurrenceUrl = (workoutId: string, date: string) =>
  `${ROUTES.training}/plan?seance=${workoutId}&date=${date}`;
/** Organiser une séance planifiée ou sautée. */
export const plannedUrl = (sessionId: string) => `${ROUTES.training}/plan?planifiee=${sessionId}`;
export const planOnDateUrl = (date: string) => `${ROUTES.training}/plan/new?date=${date}`;
export const newWorkoutUrl = (weekday?: number) =>
  `${ROUTES.training}/workouts/new${weekday ? `?jour=${weekday}` : ""}`;
export const addExercisesUrl = (workoutId: string) =>
  `${ROUTES.training}/workouts/${workoutId}/add`;
export const libraryUrl = `${ROUTES.training}/exercises`;
export const newExerciseUrl = (workoutId?: string) =>
  `${libraryUrl}/new${workoutId ? `?seance=${workoutId}` : ""}`;
export const editExerciseUrl = (id: string) => `${libraryUrl}/${id}/edit`;
/** Changer un exercice de la séance en cours. */
export const swapUrl = (
  sessionId: string,
  itemId: string,
  options: { noMachine?: boolean; bodyweight?: boolean; library?: boolean } = {},
) => {
  const search = new URLSearchParams();
  if (options.noMachine) search.set("noMachine", "1");
  if (options.bodyweight) search.set("bodyweight", "1");
  if (options.library) search.set("bibliotheque", "1");
  const query = search.toString();
  return `${sessionUrl(sessionId)}/swap/${itemId}${query ? `?${query}` : ""}`;
};
export const addToSessionUrl = (sessionId: string) => `${sessionUrl(sessionId)}/add`;
