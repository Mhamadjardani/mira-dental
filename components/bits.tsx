"use client";

import { useEffect, useState } from "react";
import { openMira } from "./ChatWidget";
import { Icon } from "./Icons";
import type { Locale } from "@/lib/i18n";

export function AskMiraButton({ label, className = "" }: { label: string; className?: string }) {
  return (
    <button type="button" onClick={openMira} className={className}>
      <Icon.Chat size={18} />
      {label}
    </button>
  );
}

const NEXT_LABEL: Record<Locale, string> = { en: "Next free check-up", ar: "أقرب موعد فحص متاح", fr: "Prochain contrôle libre" };

/** Live "next available" pill, read from the real booking engine. */
export function NextAvailable({ locale }: { locale: Locale }) {
  const [slot, setSlot] = useState<{ date: string; start: string } | null>(null);
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const days = await fetch("/api/open-days?service=checkup").then((r) => r.json());
        const first = days.days?.[0]?.date;
        if (!first) return;
        const s = await fetch(`/api/slots?service=checkup&date=${first}`).then((r) => r.json());
        if (alive && s.slots?.[0]) setSlot({ date: first, start: s.slots[0].start });
      } catch {
        /* decorative */
      }
    })();
    return () => {
      alive = false;
    };
  }, []);
  const day = slot
    ? new Intl.DateTimeFormat(locale === "ar" ? "ar-LB" : locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
        new Date(slot.date + "T12:00:00Z"),
      )
    : "—";
  return (
    <div className="flex items-center gap-3 rounded-2xl bg-surface/95 p-3 pe-4 shadow-lg shadow-ink/10 backdrop-blur">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-mint text-brand-dark">
        <Icon.Calendar size={20} />
      </span>
      <div>
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted">{NEXT_LABEL[locale]}</p>
        <p className="text-sm font-bold">
          {day} · <span dir="ltr">{slot?.start ?? "--:--"}</span>
        </p>
      </div>
      <span className="ms-1 h-2 w-2 animate-pulse rounded-full bg-emerald-500" />
    </div>
  );
}
