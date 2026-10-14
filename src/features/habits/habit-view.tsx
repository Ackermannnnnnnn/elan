import { Bed, Droplet, Dumbbell, Footprints, Utensils, type LucideIcon } from "lucide-react";
import { getFormatter, getTranslations } from "next-intl/server";
import type { ReactNode } from "react";
import type { HabitData } from "@/data/habits";
import {
  bestDayStreak,
  dayStreak,
  doneDays,
  habitMood,
  type HabitKey,
  lastDays,
  lastWeeks,
  weekStreak,
} from "@/domain/habits";
import { addDays, type IsoDate, startOfIsoWeek } from "@/lib/dates";
import { cn } from "@/lib/utils";

export const HABIT_ICONS: Record<HabitKey, LucideIcon> = {
  meals_logged: Utensils,
  hydration: Droplet,
  walking: Footprints,
  sleep: Bed,
  workouts: Dumbbell,
};

/** Valeur du jour / de la semaine, formatée avec l'objectif. */
async function progressText(habit: HabitData, today: IsoDate): Promise<string> {
  const t = await getTranslations("Habits.progress");
  const format = await getFormatter();
  const number = (value: number, digits = 0) =>
    format.number(value, { maximumFractionDigits: digits });
  if (habit.key === "workouts") {
    return t("workouts", {
      value: habit.weeks.get(startOfIsoWeek(today)) ?? 0,
      target: habit.target,
    });
  }
  const value = habit.values.get(today);
  switch (habit.key) {
    case "meals_logged":
      return t("meals_logged", { value: value ?? 0, target: habit.target });
    case "hydration":
      return t("hydration", {
        value: number((value ?? 0) / 1000, 1),
        target: number(habit.target / 1000, 1),
      });
    case "walking":
      return t("walking", { value: number(value ?? 0), target: number(habit.target) });
    case "sleep":
      return value === undefined
        ? t("sleepNone")
        : t("sleep", { value: number(value, 1), target: number(habit.target, 1) });
  }
}

/** Message d'encouragement, jamais de reproche. */
async function moodText(habit: HabitData, today: IsoDate): Promise<string> {
  const t = await getTranslations("Habits.mood");
  if (habit.key === "workouts") {
    const streak = weekStreak(habit.weeks, habit.target, today);
    if (streak >= 1) return t("weekStreak", { weeks: streak });
    const thisWeek = habit.weeks.get(startOfIsoWeek(today)) ?? 0;
    return thisWeek > 0 ? t("weekStarted") : t("weekRestart");
  }
  const mood = habitMood(doneDays(habit.values, habit.target), today);
  if (mood.kind === "streak") return t("streak", { days: mood.days });
  if (mood.kind === "regular") return t("regular", { days: mood.days });
  return t("restart");
}

/** Pastilles des 7 derniers jours : faite, pas faite (gris, jamais rouge), aujourd'hui en cours. */
function DayDots({
  days,
  today,
  label,
}: {
  days: { date: IsoDate; done: boolean }[];
  today: IsoDate;
  label: (date: IsoDate, done: boolean) => string;
}) {
  return (
    <ol className="flex gap-1.5">
      {days.map((day) => (
        <li
          key={day.date}
          title={label(day.date, day.done)}
          className={cn(
            "size-4 rounded-full",
            day.done
              ? "bg-primary"
              : day.date === today
                ? "border-2 border-dashed border-border-strong"
                : "bg-surface-muted",
          )}
        >
          <span className="sr-only">{label(day.date, day.done)}</span>
        </li>
      ))}
    </ol>
  );
}

/** Pastilles de la semaine : une par séance visée, remplies au fil des séances. */
function WeekPips({ count, target, label }: { count: number; target: number; label: string }) {
  const total = Math.max(target, count);
  return (
    <ol className="flex gap-1.5" aria-label={label}>
      {Array.from({ length: total }, (_, index) => (
        <li
          key={index}
          className={cn(
            "h-4 w-6 rounded-full",
            index < count ? "bg-primary" : "border-2 border-dashed border-border-strong",
          )}
        />
      ))}
    </ol>
  );
}

/** Une ligne compacte (accueil) : nom, valeur du jour, pastilles, encouragement. */
export async function HabitRow({ habit, today }: { habit: HabitData; today: IsoDate }) {
  const t = await getTranslations("Habits");
  const format = await getFormatter();
  const Icon = HABIT_ICONS[habit.key];
  const label = (date: IsoDate, done: boolean) =>
    t(done ? "dot.done" : "dot.notDone", {
      date: format.dateTime(new Date(`${date}T12:00:00Z`), {
        weekday: "long",
        day: "numeric",
        timeZone: "UTC",
      }),
    });
  const thisWeek = habit.weeks.get(startOfIsoWeek(today)) ?? 0;
  const progress = await progressText(habit, today);

  return (
    <li className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
      <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
        <Icon aria-hidden="true" className="size-[1.125rem]" />
      </span>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-baseline justify-between gap-x-3">
          <h3 className="font-sans text-[0.9375rem] font-semibold tracking-normal">
            {t(`name.${habit.key}`)}
          </h3>
          <p className="text-sm text-muted-foreground tabular-nums">{progress}</p>
        </div>
        <div className="mt-2 flex flex-wrap items-center justify-between gap-x-3 gap-y-1.5">
          {habit.key === "workouts" ? (
            <WeekPips count={thisWeek} target={habit.target} label={progress} />
          ) : (
            <DayDots
              days={lastDays(doneDays(habit.values, habit.target), today, 7)}
              today={today}
              label={label}
            />
          )}
          <p className="text-sm font-medium text-primary">{await moodText(habit, today)}</p>
        </div>
      </div>
    </li>
  );
}

/** Détail d'une habitude (page Habitudes) : 4 semaines, séries, régularité. */
export async function HabitDetail({ habit, today }: { habit: HabitData; today: IsoDate }) {
  const t = await getTranslations("Habits");
  const format = await getFormatter();
  const Icon = HABIT_ICONS[habit.key];
  const from = addDays(today, -83);

  const short = (date: IsoDate) =>
    format.dateTime(new Date(`${date}T12:00:00Z`), {
      day: "numeric",
      month: "short",
      timeZone: "UTC",
    });

  let stats: [string, string][];
  let body: ReactNode;
  if (habit.key === "workouts") {
    const weeks = lastWeeks(habit.weeks, today, 8);
    let run = 0;
    let best = 0;
    for (const week of lastWeeks(habit.weeks, today, 12)) {
      run = week.count >= habit.target ? run + 1 : 0;
      best = Math.max(best, run);
    }
    stats = [
      [
        t("detail.currentStreak"),
        t("detail.weeks", { count: weekStreak(habit.weeks, habit.target, today) }),
      ],
      [t("detail.bestStreak"), t("detail.weeks", { count: best })],
      [
        t("detail.weeksReached"),
        t("detail.outOf", {
          value: weeks.filter((week) => week.count >= habit.target).length,
          total: weeks.length,
        }),
      ],
    ];
    const max = Math.max(habit.target, ...weeks.map((week) => week.count), 1);
    body = (
      <ol className="mt-4 flex flex-col gap-2">
        {weeks.map((week) => (
          <li key={week.week} className="flex items-center gap-3 text-sm">
            <span className="w-16 shrink-0 text-muted-foreground">{short(week.week)}</span>
            <span className="relative h-3 flex-1 overflow-hidden rounded-full bg-surface-muted">
              <span
                className={cn(
                  "absolute inset-y-0 left-0 rounded-full",
                  week.count >= habit.target ? "bg-primary" : "bg-primary/45",
                )}
                style={{ width: `${(week.count / max) * 100}%` }}
              />
            </span>
            <span className="w-10 shrink-0 text-right tabular-nums">
              {t("detail.outOf", { value: week.count, total: habit.target })}
            </span>
          </li>
        ))}
      </ol>
    );
  } else {
    const done = doneDays(habit.values, habit.target);
    const days = lastDays(done, today, 28);
    stats = [
      [t("detail.currentStreak"), t("detail.days", { count: dayStreak(done, today) })],
      [t("detail.bestStreak"), t("detail.days", { count: bestDayStreak(done, from, today) })],
      [
        t("detail.daysReached"),
        t("detail.outOf", { value: days.filter((day) => day.done).length, total: days.length }),
      ],
    ];
    body = (
      <ol className="mt-4 grid grid-cols-7 gap-1.5" aria-label={t("detail.grid")}>
        {days.map((day) => {
          const label = t(day.done ? "dot.done" : "dot.notDone", { date: short(day.date) });
          return (
            <li
              key={day.date}
              title={label}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-xs tabular-nums",
                day.done
                  ? "bg-primary text-primary-foreground"
                  : day.date === today
                    ? "border-2 border-dashed border-border-strong text-muted-foreground"
                    : "bg-surface-muted text-muted-foreground",
              )}
            >
              <span className="sr-only">{label}</span>
              <span aria-hidden="true">{Number(day.date.slice(8))}</span>
            </li>
          );
        })}
      </ol>
    );
  }

  return (
    <section aria-labelledby={`habit-${habit.key}`}>
      <div className="flex items-start gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary-soft text-primary-soft-foreground">
          <Icon aria-hidden="true" className="size-5" />
        </span>
        <div className="min-w-0 flex-1">
          <h2 id={`habit-${habit.key}`} className="text-lg font-semibold">
            {t(`name.${habit.key}`)}
          </h2>
          <p className="text-sm text-muted-foreground tabular-nums">
            {await progressText(habit, today)}
          </p>
          <p className="mt-1 text-sm font-medium text-primary">{await moodText(habit, today)}</p>
        </div>
      </div>
      {body}
      <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
        {stats.map(([label, value]) => (
          <div key={label} className="rounded-control bg-surface-muted px-2 py-2.5">
            <dt className="text-xs text-muted-foreground">{label}</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}
