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

export function DayPicker({
  days,
  value,
  onChange,
  locale,
  empty,
  loading,
}: {
  days: Day[] | null;
  value: string | null;
  onChange: (d: string) => void;
  locale: Locale;
  empty: string;
  loading: string;
}) {
  if (!days) return <Skeleton label={loading} />;
  if (!days.length) return <p className="rounded-2xl bg-sand p-4 text-sm">{empty}</p>;
  return (
    <div className="-mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-2">
      {days.map((d) => {
        const active = d.date === value;
        return (
          <button
            key={d.date}
            type="button"
            onClick={() => onChange(d.date)}
            className={`relative flex min-w-[76px] snap-start flex-col items-center rounded-2xl border px-3 py-3 transition ${
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
