/**
 * Jours civils au format ISO « AAAA-MM-JJ ».
 * Le journal et les pesées sont rattachés à un JOUR vécu par l'utilisateur,
 * pas à un instant : « aujourd'hui » dépend donc de son fuseau horaire.
 */
export type IsoDate = string;

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export function isIsoDate(value: unknown): value is IsoDate {
  if (typeof value !== "string" || !ISO_DATE.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

/** Jour civil courant dans un fuseau IANA (ex. « Europe/Brussels »). */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): IsoDate {
  try {
    // Le format « en-CA » produit directement AAAA-MM-JJ.
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    // Fuseau inconnu : on retombe sur UTC plutôt que d'échouer.
    return now.toISOString().slice(0, 10);
  }
}

const toUtc = (date: IsoDate) => new Date(`${date}T00:00:00Z`);

export function addDays(date: IsoDate, days: number): IsoDate {
  const result = toUtc(date);
  result.setUTCDate(result.getUTCDate() + days);
  return result.toISOString().slice(0, 10);
}

/** Nombre de jours de `from` à `to` (positif si `to` est après `from`). */
export function diffDays(from: IsoDate, to: IsoDate): number {
  return Math.round((toUtc(to).getTime() - toUtc(from).getTime()) / 86_400_000);
}

/** Âge en années révolues à une date donnée. */
export function ageOn(birthDate: IsoDate, today: IsoDate): number {
  const [birthYear = 0, birthMonth = 0, birthDay = 0] = birthDate.split("-").map(Number);
  const [year = 0, month = 0, day = 0] = today.split("-").map(Number);
  const hadBirthday = month > birthMonth || (month === birthMonth && day >= birthDay);
  return year - birthYear - (hadBirthday ? 0 : 1);
}

/** Liste des jours de `from` à `to` inclus. */
export function eachDay(from: IsoDate, to: IsoDate): IsoDate[] {
  const days: IsoDate[] = [];
  for (let day = from; day <= to; day = addDays(day, 1)) days.push(day);
  return days;
}

/** Lundi de la semaine (ISO 8601) qui contient ce jour. */
export function startOfIsoWeek(date: IsoDate): IsoDate {
  const weekday = toUtc(date).getUTCDay(); // 0 = dimanche … 6 = samedi
  return addDays(date, -((weekday + 6) % 7));
}
