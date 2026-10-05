"use client";

import { AnimatePresence, motion } from "motion/react";
import { Fragment, useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import type { Dict, Locale } from "@/lib/i18n";
import { Icon } from "./Icons";

type BookingCard = {
  type: "booked" | "cancelled" | "rescheduled";
  booking: { code: string; service: string; serviceId: string; dentist: string; date: string; start: string; end: string };
};
type Msg = { role: "user" | "assistant"; text: string; events?: BookingCard[]; status?: string };

const SPEECH_LANG: Record<Locale, string> = { en: "en-US", ar: "ar-LB", fr: "fr-FR" };

/** Opens the assistant from anywhere on the page: window.dispatchEvent(new Event("mira:open")). */
export const openMira = () => window.dispatchEvent(new Event("mira:open"));

function sessionId(): string {
  const make = () => (crypto.randomUUID?.() ?? Math.random().toString(36).slice(2) + Date.now().toString(36)).replace(/[^a-zA-Z0-9-]/g, "");
  try {
    const existing = sessionStorage.getItem("mira-session");
    if (existing) return existing;
    const id = make();
    sessionStorage.setItem("mira-session", id);
    return id;
  } catch {
    return make();
  }
}

/** Renders **bold** and line breaks from the model's plain text. */
function RichText({ text }: { text: string }) {
  return (
    <>
      {text.split("\n").map((line, i) => (
        <Fragment key={i}>
          {i > 0 && <br />}
          {line.split(/(\*\*[^*]+\*\*)/g).map((part, j) =>
            part.startsWith("**") && part.endsWith("**") ? <strong key={j}>{part.slice(2, -2)}</strong> : <Fragment key={j}>{part}</Fragment>,
          )}
        </Fragment>
      ))}
    </>
  );
}

type SR = {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  start: () => void;
  stop: () => void;
  onresult: ((e: { results: ArrayLike<ArrayLike<{ transcript: string }> & { isFinal: boolean }> }) => void) | null;
  onend: (() => void) | null;
  onerror: (() => void) | null;
};

export function ChatWidget({ locale, t }: { locale: Locale; t: Dict["chat"] }) {
  const [open, setOpen] = useState(false);
  const [msgs, setMsgs] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [listening, setListening] = useState(false);
  const [speak, setSpeak] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const idRef = useRef<string>("");
  const listRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    const onOpen = () => setOpen(true);
    window.addEventListener("mira:open", onOpen);
    const w = window as unknown as { SpeechRecognition?: unknown; webkitSpeechRecognition?: unknown };
    const supported = !!(w.SpeechRecognition || w.webkitSpeechRecognition);
    const t0 = setTimeout(() => setVoiceSupported(supported), 0);
    return () => {
      window.removeEventListener("mira:open", onOpen);
      clearTimeout(t0);
    };
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  }, [msgs, busy]);

  useEffect(() => {
    if (open) setTimeout(() => inputRef.current?.focus({ preventScroll: true }), 250);
  }, [open]);

  const say = useCallback(
    (text: string) => {
      if (!("speechSynthesis" in window)) return;
      window.speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text.replace(/\*\*/g, ""));
      u.lang = SPEECH_LANG[locale];
      const voice = window.speechSynthesis.getVoices().find((v) => v.lang.startsWith(locale));
      if (voice) u.voice = voice;
      window.speechSynthesis.speak(u);
    },
    [locale],
  );

  const send = useCallback(
    async (text: string, fromVoice = false) => {
      const clean = text.trim();
      if (!clean || busy) return;
      if (!idRef.current) idRef.current = sessionId();
      setInput("");
      setMsgs((m) => [...m, { role: "user", text: clean }]);
      setBusy(true);
      try {
        const res = await fetch("/api/chat", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ sessionId: idRef.current, locale, text: clean }),
        });
        if (!res.ok) throw new Error(String(res.status));
        const data = (await res.json()) as { reply?: string; events?: BookingCard[]; status?: string };
        const reply = data.reply ?? "…";
        setMsgs((m) => [...m, { role: "assistant", text: reply, events: data.events, status: data.status }]);
        if (speak || fromVoice) say(reply);
      } catch {
        setMsgs((m) => [...m, { role: "assistant", text: t.failed, status: "error" }]);
      } finally {
        setBusy(false);
      }
    },
    [busy, locale, say, speak],
  );

  function toggleMic() {
    if (listening) {
      recRef.current?.stop();
      return;
    }
    const w = window as unknown as { SpeechRecognition?: new () => SR; webkitSpeechRecognition?: new () => SR };
    const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.lang = SPEECH_LANG[locale];
    rec.interimResults = true;
    rec.continuous = false;
    let finalText = "";
    rec.onresult = (e) => {
      let interim = "";
      for (let i = 0; i < e.results.length; i++) {
        const r = e.results[i];
        if (r.isFinal) finalText += r[0].transcript;
        else interim += r[0].transcript;
      }
      setInput(finalText + interim);
    };
    rec.onend = () => {
      setListening(false);
      if (finalText.trim()) send(finalText, true);
    };
    rec.onerror = () => setListening(false);
    recRef.current = rec;
    window.speechSynthesis?.cancel();
    setListening(true);
    rec.start();
  }

  const fmtDate = (d: string) =>
    new Intl.DateTimeFormat(locale === "ar" ? "ar-LB" : locale, { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" }).format(
      new Date(d + "T12:00:00Z"),
    );

  return (
    <>
      {/* Launcher */}
      <AnimatePresence>
        {!open && (
          <motion.button
            type="button"
            onClick={() => setOpen(true)}
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.8, opacity: 0 }}
            whileHover={{ y: -2 }}
            className="fixed bottom-5 end-5 z-50 flex items-center gap-2.5 rounded-full bg-ink p-2.5 text-sm font-semibold text-white shadow-xl shadow-ink/25 sm:py-3 sm:pe-5 sm:ps-3"
            aria-label={t.open}
          >
            <span className="relative grid h-9 w-9 place-items-center rounded-full bg-brand">
              <Icon.Chat size={18} />
              <span className="absolute -end-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-ink bg-emerald-400" />
            </span>
            <span className="hidden sm:inline">{t.open}</span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Panel */}
      <AnimatePresence>
        {open && (
          <motion.section
            role="dialog"
            aria-label={t.title}
            initial={{ opacity: 0, y: 24, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 24, scale: 0.97 }}
            transition={{ type: "spring", stiffness: 320, damping: 30 }}
            className="fixed inset-x-0 bottom-0 z-50 flex h-[88dvh] flex-col overflow-hidden rounded-t-3xl border border-line bg-surface shadow-2xl sm:inset-x-auto sm:bottom-5 sm:end-5 sm:h-[600px] sm:w-[400px] sm:rounded-3xl"
          >
            <header className="flex items-center gap-3 bg-ink px-4 py-3.5 text-white">
              <span className="relative grid h-10 w-10 place-items-center rounded-full bg-brand text-sm font-bold">
                M
                <span className="absolute -end-0.5 bottom-0 h-3 w-3 rounded-full border-2 border-ink bg-emerald-400" />
              </span>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-semibold">{t.title}</p>
                <p className="truncate text-xs text-white/60">{t.subtitle}</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setSpeak((s) => !s);
                  window.speechSynthesis?.cancel();
                }}
                aria-pressed={speak}
                title={t.voiceOn}
                className={`grid h-9 w-9 place-items-center rounded-full transition ${speak ? "bg-white text-ink" : "text-white/70 hover:bg-white/10"}`}
              >
                <Icon.Speaker size={18} />
              </button>
              <button type="button" onClick={() => setOpen(false)} aria-label="Close" className="grid h-9 w-9 place-items-center rounded-full text-white/70 hover:bg-white/10">
                <Icon.Close size={18} />
              </button>
            </header>

            <div ref={listRef} className="flex-1 space-y-3 overflow-y-auto bg-bg px-4 py-4" aria-live="polite">
              <Bubble role="assistant">{t.hello}</Bubble>
              {msgs.length === 0 && (
                <div className="flex flex-wrap gap-2 pt-1">
                  {t.suggestions.map((s) => (
                    <button
                      key={s}
                      type="button"
                      onClick={() => send(s)}
                      className="rounded-full border border-brand/30 bg-surface px-3 py-1.5 text-xs font-medium text-brand-dark transition hover:border-brand hover:bg-mint"
                    >
                      {s}
                    </button>
                  ))}
                </div>
              )}
              {msgs.map((m, i) => (
                <div key={i} className="space-y-2">
                  <Bubble role={m.role} muted={m.status === "offline" || m.status === "limited" || m.status === "error"}>
                    <RichText text={m.text} />
                  </Bubble>
                  {m.events?.map((e) => (
                    <motion.div
                      key={e.booking.code + e.type}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      className={`me-8 rounded-2xl border p-3.5 text-sm ${e.type === "cancelled" ? "border-line bg-surface" : "border-brand/30 bg-mint/60"}`}
                    >
                      <div className="flex items-center justify-between">
                        <span
                          className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                            e.type === "cancelled" ? "bg-line text-muted" : "bg-brand text-white"
                          }`}
                        >
                          <Icon.Check size={12} />
                          {t[e.type]}
                        </span>
                        <span className="font-mono text-sm font-bold tracking-wider" dir="ltr">
                          {e.booking.code}
                        </span>
                      </div>
                      <p className="mt-2 font-semibold">{e.booking.service}</p>
                      <p className="mt-0.5 text-muted">
                        {fmtDate(e.booking.date)} · <span dir="ltr">{e.booking.start}</span> · {e.booking.dentist}
                      </p>
                    </motion.div>
                  ))}
                </div>
              ))}
              {busy && (
                <div className="flex w-fit gap-1 rounded-2xl rounded-ss-md bg-surface px-4 py-3 shadow-sm">
                  {[0, 1, 2].map((i) => (
                    <motion.span
                      key={i}
                      className="h-1.5 w-1.5 rounded-full bg-muted"
                      animate={{ opacity: [0.3, 1, 0.3] }}
                      transition={{ duration: 1, repeat: Infinity, delay: i * 0.15 }}
                    />
                  ))}
                </div>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                send(input);
              }}
              className="border-t border-line bg-surface p-3"
            >
              <div className="flex items-center gap-2 rounded-2xl border border-line bg-bg px-2 py-1.5 focus-within:border-brand">
                {voiceSupported && (
                  <button
                    type="button"
                    onClick={toggleMic}
                    aria-label={listening ? t.stop : t.listen}
                    className={`relative grid h-9 w-9 shrink-0 place-items-center rounded-full transition ${
                      listening ? "bg-coral text-white" : "text-muted hover:bg-mint hover:text-brand-dark"
                    }`}
                  >
                    {listening && <span className="absolute inset-0 animate-ping rounded-full bg-coral/40" />}
                    <Icon.Mic size={18} />
                  </button>
                )}
                <input
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  placeholder={listening ? "…" : t.placeholder}
                  maxLength={600}
                  className="min-w-0 flex-1 bg-transparent px-1 py-2 text-sm outline-none placeholder:text-muted/70"
                />
                <button
                  type="submit"
                  disabled={!input.trim() || busy}
                  aria-label={t.send}
                  className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-brand text-white transition disabled:opacity-40"
                >
                  <Icon.Send size={16} className="rtl:-scale-x-100" />
                </button>
              </div>
              <p className="mt-2 text-center text-[11px] text-muted">{t.disclaimer}</p>
            </form>
          </motion.section>
        )}
      </AnimatePresence>
    </>
  );
}

function Bubble({ role, children, muted }: { role: "user" | "assistant"; children: ReactNode; muted?: boolean }) {
  const mine = role === "user";
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={`max-w-[85%] whitespace-pre-line rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
        mine ? "ms-auto rounded-se-md bg-brand text-white" : `rounded-ss-md shadow-sm ${muted ? "bg-sand text-ink" : "bg-surface"}`
      }`}
    >
      {children}
    </motion.div>
  );
}
