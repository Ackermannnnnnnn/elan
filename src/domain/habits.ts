/**
 * Habitudes : objectif du jour atteint ou non, séries et régularité.
 * Règles (docs/CALCULS.md § Habitudes) :
 *  · une habitude quotidienne est « faite » un jour si la valeur du jour
 *    atteint l'objectif (sommeil, pas, eau, repas notés) ;
 *  · les séances se comptent par semaine (lundi → dimanche) ;
 *  · la série en cours n'est pas cassée par la journée (ou la semaine) en
 *    cours tant qu'elle n'est pas finie : on ne culpabilise pas à 9 h du matin ;
 *  · l'interface met en avant la régularité (« 5 jours sur 7 ») plutôt que
 *    la série, qui repart de zéro à la moindre interruption.
 */
import { addDays, eachDay, type IsoDate, startOfIsoWeek } from "@/lib/dates";

export const HABIT_KEYS = ["meals_logged", "hydration", "walking", "sleep", "workouts"] as const;
export type HabitKey = (typeof HABIT_KEYS)[number];

export const isHabitKey = (value: unknown): value is HabitKey =>
  typeof value === "string" && (HABIT_KEYS as readonly string[]).includes(value);

/** Objectifs par défaut, quand ni l'habitude ni les préférences n'en donnent. */
export const HABIT_DEFAULT_TARGETS: Record<HabitKey, number> = {
  meals_logged: 3, // repas notés par jour
  hydration: 2000, // ml par jour
  walking: 8000, // pas par jour
  sleep: 7, // heures par nuit
  workouts: 3, // séances par semaine
};

/** Bornes des objectifs réglables. */
export const HABIT_TARGET_LIMITS: Record<HabitKey, { min: number; max: number; step: number }> = {
  meals_logged: { min: 1, max: 8, step: 1 },
  hydration: { min: 250, max: 6000, step: 250 },
  walking: { min: 1000, max: 40000, step: 500 },
  sleep: { min: 4, max: 12, step: 0.5 },
  workouts: { min: 1, max: 14, step: 1 },
};

export const isWeeklyHabit = (key: HabitKey) => key === "workouts";

/** Jours où l'objectif quotidien est atteint. */
export function doneDays(values: ReadonlyMap<IsoDate, number>, target: number): Set<IsoDate> {
  const done = new Set<IsoDate>();
  for (const [date, value] of values) if (target > 0 && value >= target) done.add(date);
  return done;
}

/**
 * Série en cours, en jours. Si aujourd'hui n'est pas (encore) fait, la série
 * se compte jusqu'à hier : elle n'est cassée qu'une fois la journée passée.
 */
export function dayStreak(done: ReadonlySet<IsoDate>, today: IsoDate): number {
  let day = done.has(today) ? today : addDays(today, -1);
  let streak = 0;
  while (done.has(day)) {
    streak += 1;
    day = addDays(day, -1);
  }
  return streak;
}

/** Plus longue série sur la période [from, to]. */
export function bestDayStreak(done: ReadonlySet<IsoDate>, from: IsoDate, to: IsoDate): number {
  let best = 0;
  let current = 0;
  for (const day of eachDay(from, to)) {
    current = done.has(day) ? current + 1 : 0;
    best = Math.max(best, current);
  }
  return best;
}

/** Les `count` derniers jours (le plus ancien d'abord), faits ou non. */
export function lastDays(
  done: ReadonlySet<IsoDate>,
  today: IsoDate,
  count: number,
): { date: IsoDate; done: boolean }[] {
  return eachDay(addDays(today, -(count - 1)), today).map((date) => ({
    date,
    done: done.has(date),
  }));
}

/** Nombre de jours faits sur les 7 derniers (aujourd'hui compris). */
export function daysDoneThisWeek(done: ReadonlySet<IsoDate>, today: IsoDate): number {
  return lastDays(done, today, 7).filter((day) => day.done).length;
}

// --- Habitude hebdomadaire (séances) ----------------------------------------------------

/** Nombre de séances par semaine (clé = lundi), à partir des dates des séances faites. */
export function countByWeek(dates: readonly IsoDate[]): Map<IsoDate, number> {
  const weeks = new Map<IsoDate, number>();
  for (const date of dates) {
    const week = startOfIsoWeek(date);
    weeks.set(week, (weeks.get(week) ?? 0) + 1);
  }
  return weeks;
}

/**
 * Série en cours, en semaines où l'objectif est atteint. La semaine en cours
 * ne casse pas la série tant qu'elle n'est pas terminée.
 */
export function weekStreak(
  weeks: ReadonlyMap<IsoDate, number>,
  target: number,
  today: IsoDate,
): number {
  if (target <= 0) return 0;
  const current = startOfIsoWeek(today);
  let week = (weeks.get(current) ?? 0) >= target ? current : addDays(current, -7);
  let streak = 0;
  while ((weeks.get(week) ?? 0) >= target) {
    streak += 1;
    week = addDays(week, -7);
  }
  return streak;
}

/** Les `count` dernières semaines (la plus ancienne d'abord) avec leur nombre de séances. */
export function lastWeeks(
  weeks: ReadonlyMap<IsoDate, number>,
  today: IsoDate,
  count: number,
): { week: IsoDate; count: number }[] {
  const current = startOfIsoWeek(today);
  return Array.from({ length: count }, (_, index) => {
    const week = addDays(current, -7 * (count - 1 - index));
    return { week, count: weeks.get(week) ?? 0 };
  });
}

// --- Message -----------------------------------------------------------------------------

export type HabitMood =
  { kind: "streak"; days: number } | { kind: "regular"; days: number } | { kind: "restart" };

/**
 * Message affiché pour une habitude quotidienne, jamais culpabilisant :
 * une série d'au moins 2 jours est saluée ; sinon on montre ce qui a été fait
 * cette semaine ; à défaut, une invitation à reprendre.
 */
export function habitMood(done: ReadonlySet<IsoDate>, today: IsoDate): HabitMood {
  const streak = dayStreak(done, today);
  if (streak >= 2) return { kind: "streak", days: streak };
  const week = daysDoneThisWeek(done, today);
  if (week > 0) return { kind: "regular", days: week };
  return { kind: "restart" };
}
