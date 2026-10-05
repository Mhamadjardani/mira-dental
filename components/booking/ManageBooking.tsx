"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { Icon } from "../Icons";
import { DayPicker, TimePicker, formatLong, useOpenDays, useSlots } from "./Pickers";

type B = { code: string; serviceId: string; service: string; dentistId: string; dentist: string; date: string; start: string; end: string; status: string };

export function ManageBooking({
  locale,
  t,
  book,
  errors,
  serviceNames,
}: {
  locale: Locale;
  t: Dict["manage"];
  book: Dict["book"];
  errors: Record<string, string>;
  serviceNames: Record<string, string>;
}) {
  const [code, setCode] = useState("");
  const [phone, setPhone] = useState("");
  const [booking, setBooking] = useState<B | null>(null);
  const [mode, setMode] = useState<"view" | "move">("view");
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);

  const days = useOpenDays(mode === "move" ? booking?.serviceId ?? null : null, null);
  const slots = useSlots(mode === "move" ? booking?.serviceId ?? null : null, null, date, refresh);

  async function call(path: string, body: Record<string, string>) {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
      const data = await res.json();
      if (!res.ok) {
        setError(errors[data.error] ?? errors.generic);
        if (data.error === "slot_taken") setRefresh((r) => r + 1);
        return null;
      }
      return data.booking as B;
    } catch {
      setError(errors.generic);
      return null;
    } finally {
      setBusy(false);
    }
  }

  const status = booking?.status === "cancelled";

  return (
    <div className="mx-auto max-w-2xl">
      {!booking ? (
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            const b = await call("/api/bookings/reschedule", { code, phone });
            if (b) setBooking(b);
          }}
          className="space-y-4 rounded-3xl border border-line bg-surface p-7"
        >
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t.code}</span>
            <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="MD-XXXXX" dir="ltr" className="input font-mono tracking-wider" maxLength={12} />
          </label>
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium">{t.phone}</span>
            <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel" dir="ltr" className="input" maxLength={20} />
          </label>
          {error && <p className="rounded-xl bg-coral/10 p-3 text-sm text-coral">{error}</p>}
          <button disabled={busy || code.length < 6 || phone.length < 7} className="w-full rounded-full bg-brand py-3.5 font-semibold text-white disabled:opacity-40">
            {t.find}
          </button>
        </form>
      ) : (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className={`rounded-3xl border p-7 ${status ? "border-line bg-surface opacity-80" : "border-brand/30 bg-mint/40"}`}>
            <div className="flex items-center justify-between">
              <span className="font-mono text-xl font-bold tracking-wider" dir="ltr">
                {booking.code}
              </span>
              <span className={`rounded-full px-3 py-1 text-xs font-semibold ${status ? "bg-line text-muted" : "bg-brand text-white"}`}>
                {status ? "✕" : <Icon.Check size={14} />}
              </span>
            </div>
            <p className="mt-4 text-lg font-semibold">{serviceNames[booking.serviceId] ?? booking.service}</p>
            <p className="mt-1 text-muted">
              {formatLong(locale, booking.date)} · <span dir="ltr">{booking.start}</span> · {booking.dentist}
            </p>
          </div>

          {notice && <p className="rounded-2xl bg-brand/10 p-4 text-sm font-medium text-brand-dark">{notice}</p>}
          {error && <p className="rounded-2xl bg-coral/10 p-4 text-sm text-coral">{error}</p>}

          {!status && mode === "view" && (
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={() => (setMode("move"), setNotice(null))} className="rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
                {t.reschedule}
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  const b = await call("/api/bookings/cancel", { code: booking.code, phone });
                  if (b) {
                    setBooking({ ...booking, ...b });
                    setNotice(t.cancelled);
                  }
                }}
                className="rounded-full border border-coral/40 px-5 py-3 text-sm font-semibold text-coral hover:bg-coral/10"
              >
                {t.cancel}
              </button>
            </div>
          )}

          <AnimatePresence>
            {mode === "move" && !status && (
              <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} className="space-y-5 overflow-hidden">
                <DayPicker days={days} value={date} onChange={(d) => (setDate(d), setTime(null))} locale={locale} empty={book.noDays} loading={book.loading} />
                {date && <TimePicker slots={slots} value={time} onChange={setTime} empty={book.noTimes} loading={book.loading} />}
                <button
                  type="button"
                  disabled={!date || !time || busy}
                  onClick={async () => {
                    const b = await call("/api/bookings/reschedule", { code: booking.code, phone, date: date!, start: time! });
                    if (b) {
                      setBooking({ ...booking, ...b });
                      setMode("view");
                      setNotice(t.moved);
                      setDate(null);
                      setTime(null);
                    }
                  }}
                  className="w-full rounded-full bg-brand py-3.5 font-semibold text-white disabled:opacity-40"
                >
                  {book.confirm}
                </button>
              </motion.div>
            )}
          </AnimatePresence>
        </motion.div>
      )}
    </div>
  );
}
