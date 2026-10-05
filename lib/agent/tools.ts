import "server-only";
import { z } from "zod";
import { CLINIC, DENTISTS, OPENING_HOURS, SERVICES, getDentist } from "../clinic";
import { cancelBooking, createBooking, findOpenDays, findSlots, publicBooking, rescheduleBooking } from "../bookings";
import type { ToolSpec } from "./types";

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const serviceIds = SERVICES.map((s) => s.id);
const dentistIds = DENTISTS.map((d) => d.id);

export const TOOL_SPECS: ToolSpec[] = [
  {
    name: "get_clinic_info",
    description: "Services (with ids, durations and prices), dentists (with the services and weekdays they work), opening hours and contact details.",
    parameters: { type: "object", properties: {} },
  },
  {
    name: "find_open_days",
    description: "Next days that still have free appointments for a service. Use this when the patient has no date in mind or their day is full.",
    parameters: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "Service id", enum: serviceIds },
        dentist_id: { type: "string", description: "Optional: only this dentist", enum: dentistIds },
        from_date: { type: "string", description: "Optional start date, YYYY-MM-DD" },
      },
      required: ["service_id"],
    },
  },
  {
    name: "find_available_times",
    description: "Free start times for a service on one date. Never offer a time that this tool did not return.",
    parameters: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "Service id", enum: serviceIds },
        date: { type: "string", description: "YYYY-MM-DD" },
        dentist_id: { type: "string", description: "Optional: only this dentist", enum: dentistIds },
      },
      required: ["service_id", "date"],
    },
  },
  {
    name: "book_appointment",
    description:
      "Books an appointment. Only call after the patient has confirmed the service, date, time, their full name and phone number.",
    parameters: {
      type: "object",
      properties: {
        service_id: { type: "string", description: "Service id", enum: serviceIds },
        date: { type: "string", description: "YYYY-MM-DD" },
        time: { type: "string", description: "Start time HH:mm (24h), from find_available_times" },
        dentist_id: { type: "string", description: "Optional dentist id; leave out to use whoever is free", enum: dentistIds },
        patient_name: { type: "string", description: "Patient's full name" },
        phone: { type: "string", description: "Patient's phone number" },
      },
      required: ["service_id", "date", "time", "patient_name", "phone"],
    },
  },
  {
    name: "cancel_appointment",
    description: "Cancels a booking. Needs the booking code (like MD-AB2CD) and the phone number used to book.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Booking code" },
        phone: { type: "string", description: "Phone number used for the booking" },
      },
      required: ["code", "phone"],
    },
  },
  {
    name: "reschedule_appointment",
    description: "Moves a booking to a new date and time. Check the new time with find_available_times first.",
    parameters: {
      type: "object",
      properties: {
        code: { type: "string", description: "Booking code" },
        phone: { type: "string", description: "Phone number used for the booking" },
        date: { type: "string", description: "New date, YYYY-MM-DD" },
        time: { type: "string", description: "New start time HH:mm" },
        dentist_id: { type: "string", description: "Optional dentist id", enum: dentistIds },
      },
      required: ["code", "phone", "date", "time"],
    },
  },
];

const str = z.string().trim().min(1).max(80);
const opt = z.string().trim().max(80).optional();
const schemas = {
  get_clinic_info: z.object({}).passthrough(),
  find_open_days: z.object({ service_id: str, dentist_id: opt, from_date: opt }),
  find_available_times: z.object({ service_id: str, date: str, dentist_id: opt }),
  book_appointment: z.object({ service_id: str, date: str, time: str, dentist_id: opt, patient_name: str, phone: str }),
  cancel_appointment: z.object({ code: str, phone: str }),
  reschedule_appointment: z.object({ code: str, phone: str, date: str, time: str, dentist_id: opt }),
} as const;

export type ToolEvent = { type: "booked" | "cancelled" | "rescheduled"; booking: ReturnType<typeof publicBooking> };

/** Runs one tool call. Always returns JSON for the model; never throws on bad input. */
export async function runTool(name: string, rawArgs: unknown, events: ToolEvent[]): Promise<unknown> {
  const schema = schemas[name as keyof typeof schemas];
  if (!schema) return { ok: false, error: "unknown_tool" };
  const parsed = schema.safeParse(rawArgs ?? {});
  if (!parsed.success) return { ok: false, error: "invalid_arguments", details: parsed.error.issues.map((i) => i.path.join(".") + ": " + i.message) };
  const a = parsed.data as Record<string, string | undefined>;
  const dentist = a.dentist_id || undefined;

  switch (name) {
    case "get_clinic_info":
      return {
        clinic: CLINIC.name,
        phone: CLINIC.phone,
        address: CLINIC.address.en,
        opening_hours: Object.entries(OPENING_HOURS).map(([d, h]) => ({ day: DAY_NAMES[+d], hours: h ? `${h.open}-${h.close}` : "closed" })),
        services: SERVICES.map((s) => ({ id: s.id, name: s.name.en, minutes: s.duration, price_usd: s.priceUsd || "free" })),
        dentists: DENTISTS.map((d) => ({ id: d.id, name: d.name, role: d.role.en, services: d.services, works_on: d.days.map((x) => DAY_NAMES[x]) })),
        booking_window_days: CLINIC.bookingWindowDays,
      };

    case "find_open_days": {
      const r = await findOpenDays({ serviceId: a.service_id!, dentistId: dentist, from: a.from_date });
      return r.ok
        ? { ok: true, days: r.value.map((d) => ({ date: d.date, weekday: DAY_NAMES[new Date(d.date + "T12:00:00Z").getUTCDay()], free_slots: d.free })) }
        : r;
    }

    case "find_available_times": {
      const r = await findSlots({ serviceId: a.service_id!, date: a.date!, dentistId: dentist });
      if (!r.ok) return r;
      const times = r.value.map((s) => ({ time: s.start, dentists: s.dentistIds.map((id) => getDentist(id)!.name) }));
      // Keep the model's context small: a spread of options, plus the total.
      const pick = times.length <= 12 ? times : times.filter((_, i) => i % Math.ceil(times.length / 12) === 0);
      return { ok: true, date: a.date, total_free: times.length, times: pick };
    }

    case "book_appointment": {
      const r = await createBooking({
        serviceId: a.service_id!,
        date: a.date!,
        start: a.time!,
        dentistId: dentist,
        patientName: a.patient_name!,
        phone: a.phone!,
        source: "assistant",
      });
      if (!r.ok) return r;
      const b = publicBooking(r.value);
      events.push({ type: "booked", booking: b });
      return { ok: true, booking: b };
    }

    case "cancel_appointment": {
      const r = await cancelBooking({ code: a.code!, phone: a.phone! });
      if (!r.ok) return r;
      const b = publicBooking(r.value);
      events.push({ type: "cancelled", booking: b });
      return { ok: true, booking: b };
    }

    case "reschedule_appointment": {
      const r = await rescheduleBooking({ code: a.code!, phone: a.phone!, date: a.date!, start: a.time!, dentistId: dentist });
      if (!r.ok) return r;
      const b = publicBooking(r.value);
      events.push({ type: "rescheduled", booking: b });
      return { ok: true, booking: b };
    }
  }
  return { ok: false, error: "unknown_tool" };
}
