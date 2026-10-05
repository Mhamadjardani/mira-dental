import "server-only";
import { CLINIC, DENTISTS, OPENING_HOURS, dentistsFor, getDentist, getService } from "./clinic";
import { addDays, clinicNow, daysBetween, fromMinutes, isDate, isTime, toMinutes, weekdayOf } from "./time";
import { getStore, SlotTakenError, type Booking, type BookingSource } from "./store";

/* Every rule lives here, on the server. The website form and the AI assistant
   both go through these functions, so neither can book something invalid. */

export type ErrorCode =
  | "unknown_service"
  | "unknown_dentist"
  | "dentist_not_for_service"
  | "bad_date"
  | "past_date"
  | "too_far"
  | "closed"
  | "dentist_off"
  | "bad_time"
  | "outside_hours"
  | "too_soon"
  | "not_on_grid"
  | "slot_taken"
  | "bad_name"
  | "bad_phone"
  | "not_found"
  | "phone_mismatch"
  | "already_cancelled"
  | "in_past";

export type Result<T> = { ok: true; value: T } | { ok: false; error: ErrorCode; message: string };

const MESSAGES: Record<ErrorCode, string> = {
  unknown_service: "That service does not exist.",
  unknown_dentist: "That dentist does not exist.",
  dentist_not_for_service: "That dentist does not offer this service.",
  bad_date: "The date must look like YYYY-MM-DD.",
  past_date: "That date is in the past.",
  too_far: `Bookings open up to ${CLINIC.bookingWindowDays} days ahead.`,
  closed: "The clinic is closed on that day.",
  dentist_off: "That dentist does not work on that day.",
  bad_time: "The time must look like HH:mm.",
  outside_hours: "That time is outside opening hours.",
  too_soon: `Appointments need at least ${CLINIC.minNoticeMinutes} minutes' notice.`,
  not_on_grid: `Appointments start every ${CLINIC.slotStep} minutes.`,
  slot_taken: "That time was just taken. Please pick another.",
  bad_name: "Please give the patient's full name.",
  bad_phone: "Please give a valid phone number.",
  not_found: "No booking matches that code.",
  phone_mismatch: "The phone number does not match this booking.",
  already_cancelled: "This booking is already cancelled.",
  in_past: "This appointment has already passed.",
};

const fail = <T>(error: ErrorCode): Result<T> => ({ ok: false, error, message: MESSAGES[error] });
const ok = <T>(value: T): Result<T> => ({ ok: true, value });

export const normalizePhone = (p: string) => p.replace(/[^\d+]/g, "");
const validPhone = (p: string) => /^\+?\d{7,15}$/.test(normalizePhone(p));
const validName = (n: string) => n.trim().length >= 2 && n.trim().length <= 60 && /\p{L}/u.test(n);

/** Checks that a day can take bookings at all. */
function checkDay(date: string, now = clinicNow()): ErrorCode | null {
  if (!isDate(date)) return "bad_date";
  const diff = daysBetween(now.date, date);
  if (diff < 0) return "past_date";
  if (diff > CLINIC.bookingWindowDays) return "too_far";
  if (!OPENING_HOURS[weekdayOf(date)]) return "closed";
  return null;
}

/** Checks one dentist + start time against every rule except overlaps. */
function checkSlot(serviceId: string, dentistId: string, date: string, start: string, now = clinicNow()): ErrorCode | null {
  const service = getService(serviceId);
  if (!service) return "unknown_service";
  const dentist = getDentist(dentistId);
  if (!dentist) return "unknown_dentist";
  if (!dentist.services.includes(serviceId)) return "dentist_not_for_service";
  const dayErr = checkDay(date, now);
  if (dayErr) return dayErr;
  if (!dentist.days.includes(weekdayOf(date))) return "dentist_off";
  if (!isTime(start)) return "bad_time";
  const hours = OPENING_HOURS[weekdayOf(date)]!;
  const s = toMinutes(start);
  if (s % CLINIC.slotStep !== 0) return "not_on_grid";
  if (s < toMinutes(hours.open) || s + service.duration > toMinutes(hours.close)) return "outside_hours";
  if (date === now.date && s < now.minutes + CLINIC.minNoticeMinutes) return "too_soon";
  return null;
}

export type Slot = { start: string; end: string; dentistIds: string[] };

/** Free start times for a service on a date, grouped across dentists. */
export async function findSlots(
  input: { serviceId: string; date: string; dentistId?: string },
  now = clinicNow(),
): Promise<Result<Slot[]>> {
  const service = getService(input.serviceId);
  if (!service) return fail("unknown_service");
  if (input.dentistId) {
    const d = getDentist(input.dentistId);
    if (!d) return fail("unknown_dentist");
    if (!d.services.includes(service.id)) return fail("dentist_not_for_service");
  }
  const dayErr = checkDay(input.date, now);
  if (dayErr) return fail(dayErr);

  const hours = OPENING_HOURS[weekdayOf(input.date)]!;
  const candidates = (input.dentistId ? [getDentist(input.dentistId)!] : dentistsFor(service.id)).filter((d) =>
    d.days.includes(weekdayOf(input.date)),
  );
  if (!candidates.length) return input.dentistId ? fail("dentist_off") : ok([]);

  const taken = await getStore().listBookings({ date: input.date, status: "confirmed" });
  const slots = new Map<string, Slot>();
  for (let m = toMinutes(hours.open); m + service.duration <= toMinutes(hours.close); m += CLINIC.slotStep) {
    const start = fromMinutes(m);
    const end = fromMinutes(m + service.duration);
    if (input.date === now.date && m < now.minutes + CLINIC.minNoticeMinutes) continue;
    for (const d of candidates) {
      const busy = taken.some((b) => b.dentistId === d.id && b.start < end && start < b.end);
      if (busy) continue;
      const slot = slots.get(start) ?? { start, end, dentistIds: [] };
      slot.dentistIds.push(d.id);
      slots.set(start, slot);
    }
  }
  return ok([...slots.values()]);
}

/** Days in the next `days` that have at least one free slot for the service. */
export async function findOpenDays(input: { serviceId: string; dentistId?: string; from?: string; days?: number }, now = clinicNow()) {
  const from = input.from && isDate(input.from) && daysBetween(now.date, input.from) >= 0 ? input.from : now.date;
  const out: { date: string; free: number }[] = [];
  const limit = Math.min(input.days ?? 7, 14);
  for (let i = 0; i < 40 && out.length < limit; i++) {
    const date = addDays(from, i);
    if (daysBetween(now.date, date) > CLINIC.bookingWindowDays) break;
    const r = await findSlots({ serviceId: input.serviceId, date, dentistId: input.dentistId }, now);
    if (r.ok && r.value.length) out.push({ date, free: r.value.length });
    else if (!r.ok && !["closed", "dentist_off"].includes(r.error)) return r;
  }
  return ok(out);
}

export async function createBooking(
  input: { serviceId: string; date: string; start: string; dentistId?: string; patientName: string; phone: string; source: BookingSource },
  now = clinicNow(),
): Promise<Result<Booking>> {
  if (!validName(input.patientName)) return fail("bad_name");
  if (!validPhone(input.phone)) return fail("bad_phone");
  const service = getService(input.serviceId);
  if (!service) return fail("unknown_service");

  // No dentist chosen: take the first one free at that time.
  const order = input.dentistId ? [input.dentistId] : dentistsFor(service.id).map((d) => d.id);
  const errors: ErrorCode[] = [];
  for (const dentistId of order) {
    const err = checkSlot(service.id, dentistId, input.date, input.start, now);
    if (err) {
      errors.push(err);
      if (input.dentistId) return fail(err);
      continue;
    }
    try {
      const booking = await getStore().createBooking({
        serviceId: service.id,
        dentistId,
        date: input.date,
        start: input.start,
        end: fromMinutes(toMinutes(input.start) + service.duration),
        patientName: input.patientName.trim(),
        phone: normalizePhone(input.phone),
        source: input.source,
      });
      return ok(booking);
    } catch (e) {
      if (!(e instanceof SlotTakenError)) throw e;
      errors.push("slot_taken");
    }
  }
  return fail(mostRelevant(errors));
}

/** When trying several dentists, report the error that best explains the failure. */
function mostRelevant(errors: ErrorCode[]): ErrorCode {
  if (errors.includes("slot_taken")) return "slot_taken";
  return errors.find((e) => e !== "dentist_off") ?? errors[0] ?? "slot_taken";
}

async function ownBooking(code: string, phone: string, now = clinicNow()): Promise<Result<Booking>> {
  const b = await getStore().getBooking(code.trim());
  if (!b) return fail("not_found");
  if (normalizePhone(b.phone).slice(-7) !== normalizePhone(phone).slice(-7)) return fail("phone_mismatch");
  if (b.status === "cancelled") return fail("already_cancelled");
  if (b.date < now.date || (b.date === now.date && toMinutes(b.start) <= now.minutes)) return fail("in_past");
  return ok(b);
}

export async function cancelBooking(input: { code: string; phone: string }, now = clinicNow()): Promise<Result<Booking>> {
  const own = await ownBooking(input.code, input.phone, now);
  if (!own.ok) return own;
  const b = await getStore().setStatus(own.value.code, "cancelled");
  return b ? ok(b) : fail("not_found");
}

export async function rescheduleBooking(
  input: { code: string; phone: string; date: string; start: string; dentistId?: string },
  now = clinicNow(),
): Promise<Result<Booking>> {
  const own = await ownBooking(input.code, input.phone, now);
  if (!own.ok) return own;
  const b = own.value;
  const service = getService(b.serviceId)!;
  const order = input.dentistId ? [input.dentistId] : [b.dentistId, ...dentistsFor(service.id).map((d) => d.id).filter((id) => id !== b.dentistId)];
  const errors: ErrorCode[] = [];
  for (const dentistId of order) {
    const err = checkSlot(service.id, dentistId, input.date, input.start, now);
    if (err) {
      errors.push(err);
      if (input.dentistId) return fail(err);
      continue;
    }
    try {
      const moved = await getStore().moveBooking(b.code, {
        dentistId,
        date: input.date,
        start: input.start,
        end: fromMinutes(toMinutes(input.start) + service.duration),
      });
      return moved ? ok(moved) : fail("not_found");
    } catch (e) {
      if (!(e instanceof SlotTakenError)) throw e;
      errors.push("slot_taken");
    }
  }
  return fail(mostRelevant(errors));
}

/** A short public view of a booking (no phone number). */
export const publicBooking = (b: Booking) => ({
  code: b.code,
  service: getService(b.serviceId)?.name.en ?? b.serviceId,
  serviceId: b.serviceId,
  dentist: getDentist(b.dentistId)?.name ?? b.dentistId,
  dentistId: b.dentistId,
  date: b.date,
  start: b.start,
  end: b.end,
  status: b.status,
});

export { DENTISTS };
