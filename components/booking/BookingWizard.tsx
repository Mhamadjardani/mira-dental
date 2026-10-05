"use client";

import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { Icon, ServiceIcon } from "../Icons";
import { DayPicker, TimePicker, formatLong, useOpenDays, useSlots } from "./Pickers";

export type WizardService = { id: string; name: string; duration: number; price: string; icon: string };
export type WizardDentist = { id: string; name: string; role: string; initials: string; hue: number; services: string[] };

type Booked = { code: string; serviceId: string; dentistId: string; dentist: string; date: string; start: string; end: string };

export function BookingWizard({
  locale,
  t,
  minutes,
  services,
  dentists,
  errors,
  initialService,
  initialDentist,
}: {
  locale: Locale;
  t: Dict["book"];
  minutes: string;
  services: WizardService[];
  dentists: WizardDentist[];
  errors: Record<string, string>;
  initialService?: string;
  initialDentist?: string;
}) {
  const valid = (id?: string) => (id && services.some((s) => s.id === id) ? id : null);
  const [serviceId, setServiceId] = useState<string | null>(valid(initialService));
  const [dentistId, setDentistId] = useState<string | null>(
    initialDentist && dentists.find((d) => d.id === initialDentist)?.services.includes(initialService ?? "") ? initialDentist : null,
  );
  const [date, setDate] = useState<string | null>(null);
  const [time, setTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refresh, setRefresh] = useState(0);
  const [booked, setBooked] = useState<Booked | null>(null);

  const days = useOpenDays(serviceId, dentistId);
  const slots = useSlots(serviceId, dentistId, date, refresh);
  const service = services.find((s) => s.id === serviceId);
  const options = dentists.filter((d) => serviceId && d.services.includes(serviceId));

  function pickService(id: string) {
    setServiceId(id);
    if (dentistId && !dentists.find((d) => d.id === dentistId)?.services.includes(id)) setDentistId(null);
    setDate(null);
    setTime(null);
  }

  async function submit() {
    if (!serviceId || !date || !time) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/bookings", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ serviceId, dentistId, date, start: time, patientName: name, phone }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(errors[data.error] ?? errors.generic);
        if (data.error === "slot_taken" || data.error === "too_soon") {
          setTime(null);
          setRefresh((r) => r + 1);
        }
        return;
      }
      setBooked(data.booking);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setError(errors.generic);
    } finally {
      setBusy(false);
    }
  }

  if (booked) {
    return <Success t={t} locale={locale} booked={booked} service={services.find((s) => s.id === booked.serviceId)!} onAgain={() => location.reload()} />;
  }

  const canSubmit = !!(serviceId && date && time && name.trim().length > 1 && phone.replace(/\D/g, "").length >= 7);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_340px]">
      <div className="space-y-8">
        <Step n={1} title={t.step1} done={!!serviceId}>
          <div className="grid gap-3 sm:grid-cols-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => pickService(s.id)}
                className={`flex items-center gap-3 rounded-2xl border p-4 text-start transition ${
                  s.id === serviceId ? "border-brand bg-mint/60 ring-1 ring-brand" : "border-line bg-surface hover:border-brand/40"
                }`}
              >
                <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${s.id === serviceId ? "bg-brand text-white" : "bg-mint text-brand-dark"}`}>
                  <ServiceIcon name={s.icon} size={20} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-semibold">{s.name}</span>
                  <span className="block text-xs text-muted">
                    <span dir="ltr">{s.duration}</span> {minutes} · {s.price}
                  </span>
                </span>
              </button>
            ))}
          </div>
        </Step>

        <AnimatePresence initial={false}>
          {serviceId && (
            <Step key="dentist" n={2} title={t.step2} done>
              <div className="flex flex-wrap gap-2">
                <Chip active={!dentistId} onClick={() => (setDentistId(null), setDate(null), setTime(null))}>
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-ink text-xs text-white">★</span>
                  <span>
                    <span className="block text-sm font-semibold">{t.anyDentist}</span>
                    <span className="block text-[11px] text-muted">{t.anyDentistHint}</span>
                  </span>
                </Chip>
                {options.map((d) => (
                  <Chip key={d.id} active={dentistId === d.id} onClick={() => (setDentistId(d.id), setDate(null), setTime(null))}>
                    <span
                      className="grid h-7 w-7 place-items-center rounded-full text-[11px] font-bold text-white"
                      style={{ background: `hsl(${d.hue} 50% 40%)` }}
                    >
                      {d.initials}
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{d.name}</span>
                      <span className="block text-[11px] text-muted">{d.role}</span>
                    </span>
                  </Chip>
                ))}
              </div>
            </Step>
          )}

          {serviceId && (
            <Step key="day" n={3} title={t.step3} done={!!date}>
              <DayPicker days={days} value={date} onChange={(d) => (setDate(d), setTime(null))} locale={locale} empty={t.noDays} loading={t.loading} />
            </Step>
          )}

          {date && (
            <Step key="time" n={4} title={t.step4} done={!!time}>
              <TimePicker slots={slots} value={time} onChange={setTime} empty={t.noTimes} loading={t.loading} />
            </Step>
          )}

          {time && (
            <Step key="details" n={5} title={t.step5} done={canSubmit}>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label={t.name}>
                  <input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" className="input" maxLength={60} />
                </Field>
                <Field label={t.phone} hint={t.phoneHint}>
                  <input
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    autoComplete="tel"
                    inputMode="tel"
                    dir="ltr"
                    placeholder="+961 …"
                    className="input"
                    maxLength={20}
                  />
                </Field>
              </div>
            </Step>
          )}
        </AnimatePresence>
      </div>

      {/* Summary */}
      <aside className="h-fit rounded-3xl border border-line bg-surface p-6 lg:sticky lg:top-24">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">{t.summary}</p>
        <dl className="mt-4 space-y-3 text-sm">
          <Row icon={<ServiceIcon name={service?.icon ?? "tooth"} size={18} />} value={service ? `${service.name} · ${service.price}` : "—"} />
          <Row icon={<Icon.Calendar size={18} />} value={date ? formatLong(locale, date) : "—"} />
          <Row
            icon={<Icon.Clock size={18} />}
            value={
              time ? (
                <span dir="ltr">
                  {time} · {service?.duration} {minutes}
                </span>
              ) : (
                "—"
              )
            }
          />
          <Row
            icon={<span className="text-xs font-bold">Dr</span>}
            value={dentistId ? dentists.find((d) => d.id === dentistId)?.name : `${t.anyDentist} (${t.anyDentistHint})`}
          />
        </dl>
        {error && <p className="mt-4 rounded-xl bg-coral/10 p-3 text-sm text-coral">{error}</p>}
        <button
          type="button"
          disabled={!canSubmit || busy}
          onClick={submit}
          className="mt-6 w-full rounded-full bg-brand py-3.5 font-semibold text-white shadow-lg shadow-brand/25 transition hover:bg-brand-dark disabled:cursor-not-allowed disabled:opacity-40 disabled:shadow-none"
        >
          {busy ? t.booking : t.confirm}
        </button>
      </aside>
    </div>
  );
}

function Step({ n, title, done, children }: { n: number; title: string; done?: boolean; children: ReactNode }) {
  return (
    <motion.section initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.3 }}>
      <h2 className="mb-4 flex items-center gap-3 text-lg font-semibold">
        <span className={`grid h-8 w-8 place-items-center rounded-full text-sm ${done ? "bg-brand text-white" : "border border-line bg-surface text-muted"}`}>
          {done ? <Icon.Check size={16} /> : n}
        </span>
        {title}
      </h2>
      {children}
    </motion.section>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`flex items-center gap-2.5 rounded-2xl border py-2 pe-4 ps-2 text-start transition ${
        active ? "border-brand bg-mint/60 ring-1 ring-brand" : "border-line bg-surface hover:border-brand/40"
      }`}
    >
      {children}
    </button>
  );
}

function Field({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-sm font-medium">{label}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-muted">{hint}</span>}
    </label>
  );
}

function Row({ icon, value }: { icon: ReactNode; value: ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-mint text-brand-dark">{icon}</span>
      <dd className="pt-1.5 font-medium">{value}</dd>
    </div>
  );
}

function Success({ t, locale, booked, service, onAgain }: { t: Dict["book"]; locale: Locale; booked: Booked; service: WizardService; onAgain: () => void }) {
  const ics = () => {
    const dt = (d: string, hm: string) => d.replace(/-/g, "") + "T" + hm.replace(":", "") + "00";
    const body = [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Mira Dental Studio//EN",
      "BEGIN:VEVENT",
      `UID:${booked.code}@miradental.example`,
      `DTSTART;TZID=Asia/Beirut:${dt(booked.date, booked.start)}`,
      `DTEND;TZID=Asia/Beirut:${dt(booked.date, booked.end)}`,
      `SUMMARY:${service.name} – Mira Dental Studio`,
      `DESCRIPTION:Booking code ${booked.code} with ${booked.dentist}`,
      "END:VEVENT",
      "END:VCALENDAR",
    ].join("\r\n");
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([body], { type: "text/calendar" }));
    a.download = `${booked.code}.ics`;
    a.click();
  };
  return (
    <motion.div initial={{ opacity: 0, scale: 0.97 }} animate={{ opacity: 1, scale: 1 }} className="mx-auto max-w-xl rounded-[2rem] border border-line bg-surface p-8 text-center shadow-xl shadow-brand/5">
      <motion.span
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 260, damping: 14, delay: 0.1 }}
        className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-brand text-white"
      >
        <Icon.Check size={30} />
      </motion.span>
      <h2 className="mt-5 text-3xl font-extrabold">{t.successTitle}</h2>
      <p className="mt-2 text-muted">{t.successLead}</p>
      <p className="mx-auto mt-6 w-fit rounded-2xl border-2 border-dashed border-brand/40 bg-mint/50 px-6 py-3 font-mono text-3xl font-bold tracking-[0.2em]" dir="ltr">
        {booked.code}
      </p>
      <div className="mt-6 space-y-1 text-sm">
        <p className="font-semibold">{service.name}</p>
        <p className="text-muted">
          {formatLong(locale, booked.date)} · <span dir="ltr">{booked.start}</span> · {booked.dentist}
        </p>
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <button type="button" onClick={ics} className="inline-flex items-center gap-2 rounded-full bg-ink px-5 py-3 text-sm font-semibold text-white">
          <Icon.Calendar size={16} /> .ics
        </button>
        <Link href={`/${locale}/manage`} className="rounded-full border border-line px-5 py-3 text-sm font-semibold hover:border-brand">
          {t.manage}
        </Link>
        <button type="button" onClick={onAgain} className="rounded-full px-5 py-3 text-sm font-semibold text-brand">
          {t.another}
        </button>
      </div>
    </motion.div>
  );
}
