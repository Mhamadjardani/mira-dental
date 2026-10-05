"use client";

import { motion } from "motion/react";
import { useEffect, useState } from "react";
import type { Locale } from "@/lib/i18n";

export type Day = { date: string; free: number };
export type Slot = { start: string; end: string; dentistIds: string[] };

export function useOpenDays(serviceId: string | null, dentistId: string | null) {
  const [days, setDays] = useState<Day[] | null>(null);
  useEffect(() => {
    if (!serviceId) return;
    let alive = true;
    const q = new URLSearchParams({ service: serviceId, ...(dentistId ? { dentist: dentistId } : {}) });
    const t = setTimeout(() => setDays(null), 0);
    fetch(`/api/open-days?${q}`)
      .then((r) => r.json())
      .then((j) => alive && setDays(j.days ?? []))
      .catch(() => alive && setDays([]));
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [serviceId, dentistId]);
  return days;
}

export function useSlots(serviceId: string | null, dentistId: string | null, date: string | null, refresh = 0) {
  const [slots, setSlots] = useState<Slot[] | null>(null);
  useEffect(() => {
    if (!serviceId || !date) return;
    let alive = true;
    const q = new URLSearchParams({ service: serviceId, date, ...(dentistId ? { dentist: dentistId } : {}) });
    const t = setTimeout(() => setSlots(null), 0);
    fetch(`/api/slots?${q}`)
      .then((r) => r.json())
      .then((j) => alive && setSlots(j.slots ?? []))
      .catch(() => alive && setSlots([]));
    return () => {
      alive = false;
      clearTimeout(t);
    };
  }, [serviceId, dentistId, date, refresh]);
  return slots;
}

const fmt = (locale: Locale, date: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale === "ar" ? "ar-LB" : locale, { timeZone: "UTC", ...o }).format(new Date(date + "T12:00:00Z"));

const FIRST_PAGE = 12;

export function DayPicker({
  days,
  value,
  onChange,
  locale,
  empty,
  loading,
  more,
}: {
  days: Day[] | null;
  value: string | null;
  onChange: (d: string) => void;
  locale: Locale;
  empty: string;
  loading: string;
  more: string;
}) {
  const [all, setAll] = useState(false);
  if (!days) return <Skeleton label={loading} />;
  if (!days.length) return <p className="rounded-2xl bg-sand p-4 text-sm">{empty}</p>;
  // Keep a chosen later date visible even when the list is collapsed.
  const selectedIndex = value ? days.findIndex((d) => d.date === value) : -1;
  const shown = all ? days : days.slice(0, Math.max(FIRST_PAGE, selectedIndex + 1));
  return (
    <div>
      <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
        {shown.map((d) => {
          const active = d.date === value;
          return (
            <button
              key={d.date}
              type="button"
              onClick={() => onChange(d.date)}
              aria-pressed={active}
              className={`flex min-w-0 flex-col items-center rounded-2xl border px-1 py-2.5 transition ${
                active ? "border-brand bg-brand text-white shadow-lg shadow-brand/25" : "border-line bg-surface hover:border-brand/50"
              }`}
            >
              <span className={`text-xs font-medium ${active ? "text-white/80" : "text-muted"}`}>{fmt(locale, d.date, { weekday: "short" })}</span>
              <span className="text-xl font-bold">{fmt(locale, d.date, { day: "numeric" })}</span>
              <span className={`text-[11px] ${active ? "text-white/80" : "text-muted"}`}>{fmt(locale, d.date, { month: "short" })}</span>
            </button>
          );
        })}
      </div>
      {!all && shown.length < days.length && (
        <button type="button" onClick={() => setAll(true)} className="mt-3 text-sm font-semibold text-brand hover:text-brand-dark">
          + {more} ({days.length - shown.length})
        </button>
      )}
    </div>
  );
}

export function TimePicker({
  slots,
  value,
  onChange,
  empty,
  loading,
}: {
  slots: Slot[] | null;
  value: string | null;
  onChange: (s: string) => void;
  empty: string;
  loading: string;
}) {
  if (!slots) return <Skeleton label={loading} />;
  if (!slots.length) return <p className="rounded-2xl bg-sand p-4 text-sm">{empty}</p>;
  return (
    <div className="grid grid-cols-3 gap-2 sm:grid-cols-5" dir="ltr">
      {slots.map((s) => {
        const active = s.start === value;
        return (
          <motion.button
            key={s.start}
            type="button"
            whileTap={{ scale: 0.96 }}
            onClick={() => onChange(s.start)}
            className={`rounded-xl border py-2.5 text-sm font-semibold tabular-nums transition ${
              active ? "border-brand bg-brand text-white" : "border-line bg-surface hover:border-brand/50"
            }`}
          >
            {s.start}
          </motion.button>
        );
      })}
    </div>
  );
}

function Skeleton({ label }: { label: string }) {
  return (
    <div className="flex items-center gap-3 rounded-2xl border border-dashed border-line p-4 text-sm text-muted">
      <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand border-t-transparent" />
      {label}
    </div>
  );
}

export const formatLong = (locale: Locale, date: string) => fmt(locale, date, { weekday: "long", day: "numeric", month: "long" });
