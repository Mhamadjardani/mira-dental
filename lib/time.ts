import { CLINIC } from "./clinic";

/** "YYYY-MM-DD" + "HH:mm" in clinic time. */
export type ClinicDateTime = { date: string; time: string };

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export const isDate = (s: string) => DATE_RE.test(s) && !Number.isNaN(Date.parse(s + "T00:00:00Z"));
export const isTime = (s: string) => TIME_RE.test(s);

export const toMinutes = (hhmm: string) => {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
};
export const fromMinutes = (min: number) =>
  `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;

/** Current date and minutes-of-day in the clinic's time zone. */
export function clinicNow(now: Date = new Date()): { date: string; minutes: number; weekday: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: CLINIC.timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
    weekday: "short",
  }).formatToParts(now);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  const date = `${get("year")}-${get("month")}-${get("day")}`;
  return { date, minutes: Number(get("hour")) * 60 + Number(get("minute")), weekday: weekdayOf(date) };
}

/** 0 = Sunday … 6 = Saturday, for a calendar date (time-zone independent). */
export const weekdayOf = (date: string) => new Date(date + "T12:00:00Z").getUTCDay();

export function addDays(date: string, days: number): string {
  const d = new Date(date + "T12:00:00Z");
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Whole days from a to b (b - a). */
export const daysBetween = (a: string, b: string) =>
  Math.round((Date.parse(b + "T12:00:00Z") - Date.parse(a + "T12:00:00Z")) / 86_400_000);

export function formatDate(date: string, locale: string, opts: Intl.DateTimeFormatOptions = {}) {
  return new Intl.DateTimeFormat(locale === "ar" ? "ar-LB" : locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
    ...opts,
  }).format(new Date(date + "T12:00:00Z"));
}
