/**
 * Lecture de la courbe de poids.
 *
 * Le poids varie naturellement de 1 à 2 kg d'un jour à l'autre (eau, sel,
 * digestion). On raisonne donc sur la TENDANCE : moyenne glissante et pente
 * sur plusieurs semaines. Une mesure isolée ne déclenche jamais de conclusion.
 */
import { addDays, diffDays, type IsoDate } from "@/lib/dates";

export type WeightPoint = { date: IsoDate; weightKg: number };
export type TrendPoint = WeightPoint & { averageKg: number };

const round1 = (value: number) => Math.round(value * 10) / 10;
const round2 = (value: number) => Math.round(value * 100) / 100;

const byDate = (a: WeightPoint, b: WeightPoint) => a.date.localeCompare(b.date);

/**
 * Moyenne glissante sur `windowDays` jours civils (et non sur N mesures) :
 * pour chaque pesée, moyenne des pesées des 7 derniers jours, elle comprise.
 */
export function movingAverage(points: WeightPoint[], windowDays = 7): TrendPoint[] {
  const sorted = [...points].sort(byDate);
  return sorted.map((point) => {
    const windowStart = addDays(point.date, -(windowDays - 1));
    const inWindow = sorted.filter(
      (other) => other.date >= windowStart && other.date <= point.date,
    );
    const sum = inWindow.reduce((total, other) => total + other.weightKg, 0);
    return { ...point, averageKg: round2(sum / inWindow.length) };
  });
}

/** Pente de la droite des moindres carrés, en kg par semaine. `null` s'il faut plus de données. */
export function weeklySlope(points: WeightPoint[]): number | null {
  if (points.length < 2) return null;
  const sorted = [...points].sort(byDate);
  const origin = sorted[0]!.date;
  const xs = sorted.map((point) => diffDays(origin, point.date));
  const ys = sorted.map((point) => point.weightKg);

  const meanX = xs.reduce((a, b) => a + b, 0) / xs.length;
  const meanY = ys.reduce((a, b) => a + b, 0) / ys.length;
  let numerator = 0;
  let denominator = 0;
  for (let index = 0; index < xs.length; index += 1) {
    numerator += (xs[index]! - meanX) * (ys[index]! - meanY);
    denominator += (xs[index]! - meanX) ** 2;
  }
  if (denominator === 0) return null;
  return round2((numerator / denominator) * 7);
}

export type TrendStatus =
  /** Pas assez de pesées, ou sur une période trop courte, pour conclure. */
  | "insufficient_data"
  /** La tendance va dans le sens de l'objectif. */
  | "on_track"
  /** La tendance est quasi plate depuis au moins trois semaines. */
  | "plateau"
  /** La tendance va à l'opposé de l'objectif. */
  | "off_track"
  /** Objectif de maintien : le poids est stable. */
  | "stable";

export type TrendDirection = "loss" | "gain" | "maintain";

/** Fenêtre d'analyse et seuils de la détection de stagnation. */
export const TREND_WINDOW_DAYS = 28;
export const TREND_MIN_SPAN_DAYS = 21;
export const TREND_MIN_ENTRIES = 6;
/** En dessous de 0,1 kg par semaine, on considère la tendance comme plate. */
export const FLAT_SLOPE_KG_PER_WEEK = 0.1;

export type TrendAnalysis = {
  status: TrendStatus;
  /** kg par semaine sur la fenêtre d'analyse ; `null` si données insuffisantes. */
  weeklyRateKg: number | null;
  entriesInWindow: number;
  spanDays: number;
};

/**
 * Analyse les 28 derniers jours. Il faut au moins 6 pesées étalées sur 21 jours
 * pour se prononcer : une stagnation ne se constate pas en quelques jours.
 */
export function analyzeTrend(
  points: WeightPoint[],
  today: IsoDate,
  direction: TrendDirection,
): TrendAnalysis {
  const windowStart = addDays(today, -(TREND_WINDOW_DAYS - 1));
  const recent = points
    .filter((point) => point.date >= windowStart && point.date <= today)
    .sort(byDate);
  const spanDays = recent.length >= 2 ? diffDays(recent[0]!.date, recent.at(-1)!.date) : 0;

  if (recent.length < TREND_MIN_ENTRIES || spanDays < TREND_MIN_SPAN_DAYS) {
    return {
      status: "insufficient_data",
      weeklyRateKg: null,
      entriesInWindow: recent.length,
      spanDays,
    };
  }

  // La pente est calculée sur la moyenne glissante, moins sensible aux à-coups.
  const smoothed = movingAverage(recent).map((point) => ({
    date: point.date,
    weightKg: point.averageKg,
  }));
  const weeklyRateKg = weeklySlope(smoothed) ?? 0;
  const isFlat = Math.abs(weeklyRateKg) < FLAT_SLOPE_KG_PER_WEEK;

  let status: TrendStatus;
  if (direction === "maintain") status = isFlat ? "stable" : "off_track";
  else if (isFlat) status = "plateau";
  else if (direction === "loss") status = weeklyRateKg < 0 ? "on_track" : "off_track";
  else status = weeklyRateKg > 0 ? "on_track" : "off_track";

  return { status, weeklyRateKg, entriesInWindow: recent.length, spanDays };
}

export type WeightProgress = {
  startKg: number;
  currentKg: number;
  /** Variation depuis le départ (négatif = perte). */
  changeKg: number;
  /** Chemin restant jusqu'à la cible (positif = il reste à perdre ou à prendre). */
  remainingKg: number | null;
  /** Part du chemin parcourue, de 0 à 100. */
  percent: number | null;
};

export function weightProgress(input: {
  startKg: number;
  currentKg: number;
  targetKg: number | null;
}): WeightProgress {
  const { startKg, currentKg, targetKg } = input;
  const changeKg = round1(currentKg - startKg);
  if (targetKg === null || targetKg === startKg) {
    return { startKg, currentKg, changeKg, remainingKg: null, percent: null };
  }
  const total = targetKg - startKg;
  const done = currentKg - startKg;
  const percent = Math.min(100, Math.max(0, Math.round((done / total) * 100)));
  return {
    startKg,
    currentKg,
    changeKg,
    remainingKg: round1(Math.abs(targetKg - currentKg)),
    percent,
  };
}

export function directionForGoal(goalType: string | null | undefined): TrendDirection {
  if (goalType === "fat_loss" || goalType === "recomposition") return "loss";
  if (goalType === "muscle_gain") return "gain";
  return "maintain";
}
