import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { isLocale } from "@/lib/i18n";
import { DENTISTS, SERVICES, getDentist, getService } from "@/lib/clinic";
import { databaseUrl, getStore } from "@/lib/store";
import { clinicNow, addDays, formatDate } from "@/lib/time";
import { isAdmin, isDemoAdmin, maskName, maskPhone } from "@/lib/admin";
import { getProviderChain } from "@/lib/agent/providers";

export const metadata: Metadata = { title: "Front desk", robots: { index: false } };
export const dynamic = "force-dynamic";

export default async function Admin({ params, searchParams }: PageProps<"/[locale]/admin">) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const sp = await searchParams;

  if (!(await isAdmin())) {
    return (
      <section className="mx-auto max-w-sm px-5 py-24" dir="ltr">
        <h1 className="text-2xl font-bold">Front desk</h1>
        <p className="mt-2 text-sm text-muted">Staff dashboard: bookings, AI conversations and stats.</p>
        <form action="/api/admin/login" method="post" className="mt-6 space-y-3">
          <input type="hidden" name="locale" value={locale} />
          <input name="password" type="password" placeholder="Password" className="input" autoComplete="current-password" />
          {sp.error && <p className="text-sm text-coral">Wrong password.</p>}
          <button className="w-full rounded-full bg-ink py-3 font-semibold text-white">Sign in</button>
        </form>
        {isDemoAdmin() && (
          <p className="mt-4 rounded-xl bg-mint p-3 text-xs text-brand-dark">
            Portfolio demo: the password is <b>demo</b>. Patient names and phone numbers are masked.
          </p>
        )}
      </section>
    );
  }

  const store = getStore();
  const now = clinicNow();
  const all = await store.listBookings();
  const upcoming = all.filter((b) => b.status === "confirmed" && b.date >= now.date);
  const week = new Set(Array.from({ length: 7 }, (_, i) => addDays(now.date, i)));
  const conversations = await store.listConversations(12);
  const mask = isDemoAdmin();
  const viaAi = all.filter((b) => b.source === "assistant").length;
  const revenue = upcoming.reduce((s, b) => s + (getService(b.serviceId)?.priceUsd ?? 0), 0);
  const provider = getProviderChain();

  const stats = [
    { label: "Upcoming visits", value: upcoming.length },
    { label: "Next 7 days", value: upcoming.filter((b) => week.has(b.date)).length },
    { label: "Booked by AI assistant", value: all.length ? `${Math.round((viaAi / all.length) * 100)}%` : "—" },
    { label: "Expected revenue", value: `$${revenue}` },
  ];
  const perDentist = DENTISTS.map((d) => ({ d, n: upcoming.filter((b) => b.dentistId === d.id).length }));
  const max = Math.max(1, ...perDentist.map((x) => x.n));

  return (
    <section className="mx-auto max-w-6xl space-y-8 px-5 py-12" dir="ltr">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Front desk</h1>
          <p className="text-sm text-muted">
            {formatDate(now.date, "en")} · AI: {provider ? describeChain(provider.name) : "not configured"} · Storage: {databaseUrl() ? "Postgres" : "in-memory (demo)"}
          </p>
        </div>
        {mask && <span className="rounded-full bg-sand px-3 py-1.5 text-xs font-medium">Demo mode · personal data masked</span>}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => (
          <div key={s.label} className="rounded-3xl border border-line bg-surface p-5">
            <p className="text-xs text-muted">{s.label}</p>
            <p className="mt-2 text-3xl font-bold">{s.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        <div className="overflow-hidden rounded-3xl border border-line bg-surface">
          <p className="border-b border-line px-5 py-4 font-semibold">Upcoming appointments</p>
          {upcoming.length === 0 ? (
            <p className="p-5 text-sm text-muted">No bookings yet. Book one on the site or through the assistant.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-bg text-left text-xs uppercase tracking-wide text-muted">
                  <tr>
                    {["When", "Patient", "Treatment", "Dentist", "Via", "Code"].map((h) => (
                      <th key={h} className="px-4 py-3 font-medium">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {upcoming.slice(0, 25).map((b) => (
                    <tr key={b.code}>
                      <td className="whitespace-nowrap px-4 py-3 font-medium">
                        {formatDate(b.date, "en", { weekday: "short", month: "short" })} · {b.start}
                      </td>
                      <td className="whitespace-nowrap px-4 py-3">
                        {mask ? maskName(b.patientName) : b.patientName}
                        <span className="block text-xs text-muted">{mask ? maskPhone(b.phone) : b.phone}</span>
                      </td>
                      <td className="px-4 py-3">{getService(b.serviceId)?.name.en}</td>
                      <td className="px-4 py-3">{getDentist(b.dentistId)?.name}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${b.source === "assistant" ? "bg-mint text-brand-dark" : "bg-sand"}`}>
                          {b.source === "assistant" ? "AI" : "Web"}
                        </span>
                      </td>
                      <td className="whitespace-nowrap px-4 py-3 font-mono text-xs">{b.code}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className="rounded-3xl border border-line bg-surface p-5">
            <p className="font-semibold">Load per dentist</p>
            <div className="mt-4 space-y-3">
              {perDentist.map(({ d, n }) => (
                <div key={d.id}>
                  <div className="flex justify-between text-sm">
                    <span>{d.name}</span>
                    <span className="font-semibold">{n}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-bg">
                    <div className="h-2 rounded-full" style={{ width: `${(n / max) * 100}%`, background: `hsl(${d.hue} 50% 42%)` }} />
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="rounded-3xl border border-line bg-surface p-5">
            <p className="font-semibold">Treatments booked</p>
            <ul className="mt-3 space-y-1.5 text-sm">
              {SERVICES.map((s) => ({ s, n: all.filter((b) => b.serviceId === s.id).length }))
                .filter((x) => x.n)
                .sort((a, b) => b.n - a.n)
                .map(({ s, n }) => (
                  <li key={s.id} className="flex justify-between">
                    <span className="text-muted">{s.name.en}</span>
                    <span className="font-semibold">{n}</span>
                  </li>
                ))}
              {!all.length && <li className="text-muted">—</li>}
            </ul>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-line bg-surface">
        <p className="border-b border-line px-5 py-4 font-semibold">Recent AI conversations</p>
        {conversations.length === 0 ? (
          <p className="p-5 text-sm text-muted">No conversations yet.</p>
        ) : (
          <div className="grid gap-4 p-5 md:grid-cols-2">
            {conversations.map((c) => (
              <details key={c.sessionId} className="rounded-2xl border border-line p-4">
                <summary className="cursor-pointer text-sm">
                  <span className="font-semibold">{c.turns.find((t) => t.role === "user")?.text.slice(0, 60) ?? "…"}</span>
                  <span className="block text-xs text-muted">
                    {c.locale.toUpperCase()} · {c.turns.filter((t) => t.role === "user").length} messages · {new Date(c.updatedAt).toLocaleString("en-GB", { timeZone: "Asia/Beirut" })}
                  </span>
                </summary>
                <div className="mt-3 space-y-2 text-sm">
                  {c.turns.map((t, i) =>
                    t.role === "tool" ? (
                      <p key={i} className="font-mono text-[11px] text-muted">
                        ⚙ {t.tool} → {t.text}
                      </p>
                    ) : (
                      <p key={i} className={t.role === "user" ? "text-ink" : "text-brand-dark"}>
                        <b>{t.role === "user" ? "Patient" : "Mira"}:</b> {mask && t.role === "user" ? t.text.replace(/\+?\d[\d\s-]{6,}\d/g, "•••") : t.text}
                      </p>
                    ),
                  )}
                </div>
              </details>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

/** "gemini:a → gemini:b → groq:c" → "Gemini → Groq · 3 models" */
function describeChain(name: string) {
  const models = name.split(" → ");
  const vendors = [...new Set(models.map((m) => m.split(":")[0]))].map((v) => v.charAt(0).toUpperCase() + v.slice(1));
  return `${vendors.join(" → ")}${models.length > 1 ? ` · ${models.length} models` : ""}`;
}
