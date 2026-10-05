import "server-only";
import postgres from "postgres";

export type BookingStatus = "confirmed" | "cancelled";
export type BookingSource = "website" | "assistant";

export type Booking = {
  code: string;
  serviceId: string;
  dentistId: string;
  date: string; // YYYY-MM-DD (clinic time)
  start: string; // HH:mm
  end: string; // HH:mm
  patientName: string;
  phone: string;
  status: BookingStatus;
  source: BookingSource;
  createdAt: string; // ISO
};

export type NewBooking = Omit<Booking, "code" | "status" | "createdAt">;

export type ChatTurn = {
  role: "user" | "assistant" | "tool";
  text: string;
  /** For tool turns: the tool name and a compact result summary. */
  tool?: string;
  at: string;
};

export type Conversation = {
  sessionId: string;
  locale: string;
  /** Readable transcript (for the admin page). */
  turns: ChatTurn[];
  /** Model context, including tool calls (provider-neutral). */
  messages: unknown[];
  updatedAt: string;
};

export class SlotTakenError extends Error {
  constructor() {
    super("slot_taken");
  }
}

export interface Store {
  listBookings(filter?: { date?: string; dentistId?: string; status?: BookingStatus }): Promise<Booking[]>;
  getBooking(code: string): Promise<Booking | null>;
  /** Inserts atomically; throws SlotTakenError if it overlaps a confirmed booking for that dentist. */
  createBooking(b: NewBooking): Promise<Booking>;
  setStatus(code: string, status: BookingStatus): Promise<Booking | null>;
  /** Moves a booking atomically; throws SlotTakenError on overlap. */
  moveBooking(code: string, to: { dentistId: string; date: string; start: string; end: string }): Promise<Booking | null>;
  getConversation(sessionId: string): Promise<Conversation | null>;
  saveConversation(c: Conversation): Promise<void>;
  listConversations(limit?: number): Promise<Conversation[]>;
  /** Increments a counter and returns the new value. */
  bump(key: string): Promise<number>;
}

const overlaps = (aStart: string, aEnd: string, bStart: string, bEnd: string) => aStart < bEnd && bStart < aEnd;

export function makeCode(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // no 0/O/1/I
  let s = "";
  const bytes = crypto.getRandomValues(new Uint8Array(5));
  for (const b of bytes) s += alphabet[b % alphabet.length];
  return `MD-${s}`;
}

/* ------------------------------------------------------------------ */
/* In-memory store (local development, tests, demo without a DB)       */
/* ------------------------------------------------------------------ */

export class MemoryStore implements Store {
  bookings = new Map<string, Booking>();
  conversations = new Map<string, Conversation>();
  counters = new Map<string, number>();

  async listBookings(f: { date?: string; dentistId?: string; status?: BookingStatus } = {}) {
    return [...this.bookings.values()]
      .filter((b) => (!f.date || b.date === f.date) && (!f.dentistId || b.dentistId === f.dentistId) && (!f.status || b.status === f.status))
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
  }
  async getBooking(code: string) {
    return this.bookings.get(code.toUpperCase()) ?? null;
  }
  private clash(dentistId: string, date: string, start: string, end: string, ignore?: string) {
    return [...this.bookings.values()].some(
      (b) => b.code !== ignore && b.status === "confirmed" && b.dentistId === dentistId && b.date === date && overlaps(b.start, b.end, start, end),
    );
  }
  async createBooking(nb: NewBooking) {
    // JS is single-threaded: check-and-insert runs without interleaving.
    if (this.clash(nb.dentistId, nb.date, nb.start, nb.end)) throw new SlotTakenError();
    const b: Booking = { ...nb, code: makeCode(), status: "confirmed", createdAt: new Date().toISOString() };
    this.bookings.set(b.code, b);
    return b;
  }
  async setStatus(code: string, status: BookingStatus) {
    const b = this.bookings.get(code.toUpperCase());
    if (!b) return null;
    b.status = status;
    return b;
  }
  async moveBooking(code: string, to: { dentistId: string; date: string; start: string; end: string }) {
    const b = this.bookings.get(code.toUpperCase());
    if (!b) return null;
    if (this.clash(to.dentistId, to.date, to.start, to.end, b.code)) throw new SlotTakenError();
    Object.assign(b, to);
    return b;
  }
  async getConversation(id: string) {
    return this.conversations.get(id) ?? null;
  }
  async saveConversation(c: Conversation) {
    this.conversations.set(c.sessionId, c);
  }
  async listConversations(limit = 50) {
    return [...this.conversations.values()].sort((a, b) => b.updatedAt.localeCompare(a.updatedAt)).slice(0, limit);
  }
  async bump(key: string) {
    const n = (this.counters.get(key) ?? 0) + 1;
    this.counters.set(key, n);
    return n;
  }
}

/* ------------------------------------------------------------------ */
/* Postgres store (production; works with Neon / Supabase free tiers)  */
/* ------------------------------------------------------------------ */

type Row = {
  code: string;
  service_id: string;
  dentist_id: string;
  date: string;
  start_time: string;
  end_time: string;
  patient_name: string;
  phone: string;
  status: BookingStatus;
  source: BookingSource;
  created_at: Date;
};

const fromRow = (r: Row): Booking => ({
  code: r.code,
  serviceId: r.service_id,
  dentistId: r.dentist_id,
  date: r.date,
  start: r.start_time,
  end: r.end_time,
  patientName: r.patient_name,
  phone: r.phone,
  status: r.status,
  source: r.source,
  createdAt: new Date(r.created_at).toISOString(),
});

export class PostgresStore implements Store {
  private sql: postgres.Sql;
  private ready: Promise<void> | null = null;

  constructor(url: string) {
    this.sql = postgres(url, { ssl: url.includes("localhost") ? false : "require", max: 3, idle_timeout: 20 });
  }

  private init() {
    this.ready ??= (async () => {
      await this.sql`
        create table if not exists bookings (
          code text primary key,
          service_id text not null,
          dentist_id text not null,
          date text not null,
          start_time text not null,
          end_time text not null,
          patient_name text not null,
          phone text not null,
          status text not null default 'confirmed',
          source text not null default 'website',
          created_at timestamptz not null default now()
        )`;
      await this.sql`create index if not exists bookings_dentist_date on bookings (dentist_id, date)`;
      await this.sql`
        create table if not exists conversations (
          session_id text primary key,
          locale text not null,
          turns jsonb not null,
          messages jsonb not null default '[]'::jsonb,
          updated_at timestamptz not null default now()
        )`;
      await this.sql`create table if not exists counters (key text primary key, value int not null)`;
    })();
    return this.ready;
  }

  async listBookings(f: { date?: string; dentistId?: string; status?: BookingStatus } = {}) {
    await this.init();
    const rows = await this.sql<Row[]>`
      select * from bookings
      where (${f.date ?? null}::text is null or date = ${f.date ?? null})
        and (${f.dentistId ?? null}::text is null or dentist_id = ${f.dentistId ?? null})
        and (${f.status ?? null}::text is null or status = ${f.status ?? null})
      order by date, start_time`;
    return rows.map(fromRow);
  }

  async getBooking(code: string) {
    await this.init();
    const [r] = await this.sql<Row[]>`select * from bookings where code = ${code.toUpperCase()}`;
    return r ? fromRow(r) : null;
  }

  async createBooking(nb: NewBooking) {
    await this.init();
    return this.sql.begin(async (tx) => {
      // Serialise writes per dentist and day so two requests can't take the same slot.
      await tx`select pg_advisory_xact_lock(hashtext(${nb.dentistId + "|" + nb.date}))`;
      const clash = await tx`
        select 1 from bookings
        where dentist_id = ${nb.dentistId} and date = ${nb.date} and status = 'confirmed'
          and start_time < ${nb.end} and ${nb.start} < end_time
        limit 1`;
      if (clash.length) throw new SlotTakenError();
      const code = makeCode();
      const [r] = await tx<Row[]>`
        insert into bookings (code, service_id, dentist_id, date, start_time, end_time, patient_name, phone, source)
        values (${code}, ${nb.serviceId}, ${nb.dentistId}, ${nb.date}, ${nb.start}, ${nb.end}, ${nb.patientName}, ${nb.phone}, ${nb.source})
        returning *`;
      return fromRow(r);
    }) as Promise<Booking>;
  }

  async setStatus(code: string, status: BookingStatus) {
    await this.init();
    const [r] = await this.sql<Row[]>`update bookings set status = ${status} where code = ${code.toUpperCase()} returning *`;
    return r ? fromRow(r) : null;
  }

  async moveBooking(code: string, to: { dentistId: string; date: string; start: string; end: string }) {
    await this.init();
    return this.sql.begin(async (tx) => {
      await tx`select pg_advisory_xact_lock(hashtext(${to.dentistId + "|" + to.date}))`;
      const clash = await tx`
        select 1 from bookings
        where dentist_id = ${to.dentistId} and date = ${to.date} and status = 'confirmed' and code <> ${code.toUpperCase()}
          and start_time < ${to.end} and ${to.start} < end_time
        limit 1`;
      if (clash.length) throw new SlotTakenError();
      const [r] = await tx<Row[]>`
        update bookings set dentist_id = ${to.dentistId}, date = ${to.date}, start_time = ${to.start}, end_time = ${to.end}
        where code = ${code.toUpperCase()} returning *`;
      return r ? fromRow(r) : null;
    }) as Promise<Booking | null>;
  }

  async getConversation(id: string) {
    await this.init();
    const [r] = await this.sql<{ session_id: string; locale: string; turns: ChatTurn[]; messages: unknown[]; updated_at: Date }[]>`
      select * from conversations where session_id = ${id}`;
    return r
      ? { sessionId: r.session_id, locale: r.locale, turns: r.turns, messages: r.messages, updatedAt: new Date(r.updated_at).toISOString() }
      : null;
  }

  async saveConversation(c: Conversation) {
    await this.init();
    await this.sql`
      insert into conversations (session_id, locale, turns, messages, updated_at)
      values (${c.sessionId}, ${c.locale}, ${this.sql.json(c.turns as unknown as postgres.JSONValue)}, ${this.sql.json(c.messages as postgres.JSONValue)}, now())
      on conflict (session_id) do update
        set turns = excluded.turns, messages = excluded.messages, locale = excluded.locale, updated_at = now()`;
  }

  async listConversations(limit = 50) {
    await this.init();
    const rows = await this.sql<{ session_id: string; locale: string; turns: ChatTurn[]; updated_at: Date }[]>`
      select session_id, locale, turns, updated_at from conversations order by updated_at desc limit ${limit}`;
    return rows.map((r) => ({ sessionId: r.session_id, locale: r.locale, turns: r.turns, messages: [], updatedAt: new Date(r.updated_at).toISOString() }));
  }

  async bump(key: string) {
    await this.init();
    const [r] = await this.sql<{ value: number }[]>`
      insert into counters (key, value) values (${key}, 1)
      on conflict (key) do update set value = counters.value + 1
      returning value`;
    return r.value;
  }
}

/* ------------------------------------------------------------------ */

const g = globalThis as unknown as { __miraStore?: Store };

/** Connection string: DATABASE_URL, or the name Vercel's Neon/Postgres integration uses. */
export const databaseUrl = () => process.env.DATABASE_URL || process.env.POSTGRES_URL || "";

/** Postgres when a database URL is set, otherwise an in-memory store. */
export function getStore(): Store {
  if (!g.__miraStore) {
    g.__miraStore = databaseUrl() ? new PostgresStore(databaseUrl()) : new MemoryStore();
  }
  return g.__miraStore;
}

/** For tests. */
export function setStore(s: Store) {
  g.__miraStore = s;
}
