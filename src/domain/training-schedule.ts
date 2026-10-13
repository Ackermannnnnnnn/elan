/**
 * Planning d'entraînement d'une semaine, SANS IA : les séances types se
 * répètent chaque semaine à leur jour habituel, et chaque occurrence peut être
 * déplacée ou sautée une fois ; des séances supplémentaires peuvent être
 * planifiées à n'importe quelle date. Règles : docs/CALCULS.md.
 */
import { addDays, type IsoDate, startOfIsoWeek } from "@/lib/dates";

export type ScheduleWorkout = {
  id: string;
  name: string;
  /** 1 = lundi … 7 = dimanche ; null = séance « à la demande ». */
  weekday: number | null;
};

export type SessionStatus = "planned" | "in_progress" | "paused" | "completed" | "skipped";

export type ScheduleSession = {
  id: string;
  workoutId: string | null;
  name: string;
  scheduledOn: IsoDate;
  /** Date de l'occurrence hebdomadaire remplacée (déplacée, sautée, faite un autre jour). */
  originalDate: IsoDate | null;
  status: SessionStatus;
};

export type WeekEntry = {
  key: string;
  /**
   * recurring : occurrence hebdomadaire non encore traitée ;
   * planned   : séance planifiée à cette date (déplacée ou supplémentaire) ;
   * active    : séance en cours ou en pause ; done : terminée ;
   * skipped   : occurrence sautée (peut être rétablie).
   */
  kind: "recurring" | "planned" | "active" | "done" | "skipped";
  date: IsoDate;
  name: string;
  workoutId: string | null;
  sessionId: string | null;
  /** Pour une séance déplacée : la date où elle était prévue. */
  movedFrom: IsoDate | null;
  /** Jour passé (une occurrence non faite y est « manquée »). */
  past: boolean;
};

export type WeekDay = { date: IsoDate; weekday: number; isToday: boolean; entries: WeekEntry[] };

/** 1 = lundi … 7 = dimanche. */
export function isoWeekday(date: IsoDate): number {
  return ((new Date(`${date}T12:00:00Z`).getUTCDay() + 6) % 7) + 1;
}

export function weekDates(weekStart: IsoDate): IsoDate[] {
  return Array.from({ length: 7 }, (_, index) => addDays(weekStart, index));
}

/** Lundi de la semaine demandée, borné à ±1 an autour d'aujourd'hui. */
export function resolveWeekStart(requested: string | undefined, today: IsoDate): IsoDate {
  const current = startOfIsoWeek(today);
  if (!requested || !/^\d{4}-\d{2}-\d{2}$/.test(requested)) return current;
  const parsed = new Date(`${requested}T00:00:00Z`);
  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== requested) {
    return current;
  }
  const monday = startOfIsoWeek(requested);
  const min = addDays(current, -364);
  const max = addDays(current, 364);
  return monday < min ? min : monday > max ? max : monday;
}

const ORDER: Record<WeekEntry["kind"], number> = {
  done: 0,
  active: 1,
  planned: 2,
  recurring: 3,
  skipped: 4,
};

/**
 * Construit la semaine qui commence au lundi `weekStart`.
 * Une occurrence hebdomadaire (séance type W, date D) est masquée lorsqu'une
 * séance la remplace : même W avec original_date = D (déplacée, sautée, faite
 * un autre jour) ou même W faite / en cours / planifiée le jour D.
 * `since` : aucune occurrence n'est affichée avant cette date (création du programme).
 */
export function buildWeek(input: {
  weekStart: IsoDate;
  today: IsoDate;
  since: IsoDate | null;
  workouts: readonly ScheduleWorkout[];
  sessions: readonly ScheduleSession[];
}): WeekDay[] {
  const { today, since } = input;
  return weekDates(input.weekStart).map((date) => {
    const weekday = isoWeekday(date);
    const past = date < today;
    const entries: WeekEntry[] = [];

    for (const session of input.sessions) {
      if (session.scheduledOn !== date) continue;
      const kind: WeekEntry["kind"] =
        session.status === "completed"
          ? "done"
          : session.status === "skipped"
            ? "skipped"
            : session.status === "planned"
              ? "planned"
              : "active";
      entries.push({
        key: `s:${session.id}`,
        kind,
        date,
        name: session.name,
        workoutId: session.workoutId,
        sessionId: session.id,
        movedFrom:
          kind === "planned" && session.originalDate && session.originalDate !== date
            ? session.originalDate
            : null,
        past,
      });
    }

    if (since === null || date >= since) {
      for (const workout of input.workouts) {
        if (workout.weekday !== weekday) continue;
        const replaced = input.sessions.some(
          (session) =>
            session.workoutId === workout.id &&
            (session.originalDate === date ||
              (session.originalDate === null &&
                session.scheduledOn === date &&
                session.status !== "skipped")),
        );
        if (replaced) continue;
        entries.push({
          key: `w:${workout.id}:${date}`,
          kind: "recurring",
          date,
          name: workout.name,
          workoutId: workout.id,
          sessionId: null,
          movedFrom: null,
          past,
        });
      }
    }

    entries.sort((a, b) => ORDER[a.kind] - ORDER[b.kind]);
    return { date, weekday, isToday: date === today, entries };
  });
}
