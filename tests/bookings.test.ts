import { beforeEach, describe, expect, it } from "vitest";
import { MemoryStore, setStore } from "@/lib/store";
import { cancelBooking, createBooking, findOpenDays, findSlots, rescheduleBooking } from "@/lib/bookings";

// Monday 5 Oct 2026, 10:00 in the clinic.
const NOW = { date: "2026-10-05", minutes: 10 * 60, weekday: 1 };
const patient = { patientName: "Test Patient", phone: "+961 70 123 456", source: "website" as const };

beforeEach(() => setStore(new MemoryStore()));

describe("findSlots", () => {
  it("lists slots inside opening hours with the service duration", async () => {
    const r = await findSlots({ serviceId: "checkup", date: "2026-10-06" }, NOW);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.value[0].start).toBe("09:00");
    expect(r.value.at(-1)!.end <= "18:00").toBe(true);
    expect(r.value.at(-1)!.start).toBe("17:15"); // 45-minute service must end by 18:00
  });

  it("respects minimum notice today", async () => {
    const r = await findSlots({ serviceId: "checkup", date: NOW.date }, NOW);
    if (!r.ok) throw new Error(r.message);
    expect(r.value[0].start).toBe("11:00"); // 10:00 + 60 min notice
  });

  it("is empty on Sunday and rejects past dates", async () => {
    expect(await findSlots({ serviceId: "checkup", date: "2026-10-11" }, NOW)).toMatchObject({ ok: false, error: "closed" });
    expect(await findSlots({ serviceId: "checkup", date: "2026-10-01" }, NOW)).toMatchObject({ ok: false, error: "past_date" });
  });

  it("only uses dentists who work that day", async () => {
    // Karim (orthodontist) works Mon/Wed/Fri only.
    expect(await findSlots({ serviceId: "ortho-consult", date: "2026-10-06", dentistId: "karim" }, NOW)).toMatchObject({
      ok: false,
      error: "dentist_off",
    });
    const wed = await findSlots({ serviceId: "ortho-consult", date: "2026-10-07" }, NOW);
    expect(wed.ok && wed.value.every((s) => s.dentistIds.includes("karim"))).toBe(true);
  });

  it("removes taken times", async () => {
    await createBooking({ ...patient, serviceId: "root-canal", date: "2026-10-06", start: "09:00", dentistId: "rania" }, NOW);
    const r = await findSlots({ serviceId: "root-canal", date: "2026-10-06", dentistId: "rania" }, NOW);
    if (!r.ok) throw new Error(r.message);
    expect(r.value[0].start).toBe("10:30");
  });
});

describe("createBooking", () => {
  it("books and returns a code", async () => {
    const r = await createBooking({ ...patient, serviceId: "checkup", date: "2026-10-06", start: "10:00" }, NOW);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.code).toMatch(/^MD-[A-Z2-9]{5}$/);
      expect(r.value.end).toBe("10:45");
    }
  });

  it("never double-books a dentist, even for overlapping services", async () => {
    await createBooking({ ...patient, serviceId: "filling", date: "2026-10-06", start: "10:00", dentistId: "lea" }, NOW);
    const r = await createBooking({ ...patient, serviceId: "whitening", date: "2026-10-06", start: "10:30", dentistId: "lea" }, NOW);
    expect(r).toMatchObject({ ok: false, error: "slot_taken" });
  });

  it("falls back to another dentist when no dentist was chosen", async () => {
    await createBooking({ ...patient, serviceId: "filling", date: "2026-10-06", start: "10:00", dentistId: "lea" }, NOW);
    const r = await createBooking({ ...patient, serviceId: "filling", date: "2026-10-06", start: "10:00" }, NOW);
    expect(r.ok && r.value.dentistId).toBe("rania");
  });

  it("handles a burst of concurrent requests for one slot", async () => {
    const results = await Promise.all(
      Array.from({ length: 5 }, () => createBooking({ ...patient, serviceId: "whitening", date: "2026-10-06", start: "11:00", dentistId: "lea" }, NOW)),
    );
    expect(results.filter((r) => r.ok)).toHaveLength(1);
  });

  it.each([
    [{ start: "08:30" }, "outside_hours"],
    [{ start: "17:30" }, "outside_hours"], // 45 min would end 18:15
    [{ start: "10:10" }, "not_on_grid"],
    [{ date: "2026-10-11" }, "closed"],
    [{ date: "2026-12-01" }, "too_far"],
    [{ date: NOW.date, start: "10:30" }, "too_soon"],
    [{ phone: "123" }, "bad_phone"],
    [{ patientName: "1" }, "bad_name"],
    [{ serviceId: "nope" }, "unknown_service"],
  ])("rejects %o with %s", async (override, error) => {
    const r = await createBooking({ ...patient, serviceId: "checkup", date: "2026-10-06", start: "10:00", ...override }, NOW);
    expect(r).toMatchObject({ ok: false, error });
  });
});

describe("cancel & reschedule", () => {
  it("needs the matching phone number", async () => {
    const b = await createBooking({ ...patient, serviceId: "checkup", date: "2026-10-06", start: "10:00" }, NOW);
    if (!b.ok) throw new Error();
    expect(await cancelBooking({ code: b.value.code, phone: "+961 71 999 999" }, NOW)).toMatchObject({ error: "phone_mismatch" });
    expect(await cancelBooking({ code: b.value.code, phone: "70123456" }, NOW)).toMatchObject({ ok: true });
    expect(await cancelBooking({ code: b.value.code, phone: "70123456" }, NOW)).toMatchObject({ error: "already_cancelled" });
  });

  it("frees the slot after cancelling", async () => {
    const b = await createBooking({ ...patient, serviceId: "whitening", date: "2026-10-06", start: "09:00", dentistId: "lea" }, NOW);
    if (!b.ok) throw new Error();
    await cancelBooking({ code: b.value.code, phone: patient.phone }, NOW);
    const again = await createBooking({ ...patient, serviceId: "whitening", date: "2026-10-06", start: "09:00", dentistId: "lea" }, NOW);
    expect(again.ok).toBe(true);
  });

  it("moves a booking and checks the new time", async () => {
    const a = await createBooking({ ...patient, serviceId: "checkup", date: "2026-10-06", start: "09:00", dentistId: "lea" }, NOW);
    const b = await createBooking({ ...patient, serviceId: "checkup", date: "2026-10-06", start: "11:00", dentistId: "lea" }, NOW);
    if (!a.ok || !b.ok) throw new Error();
    expect(await rescheduleBooking({ code: a.value.code, phone: patient.phone, date: "2026-10-06", start: "11:15", dentistId: "lea" }, NOW)).toMatchObject({
      error: "slot_taken",
    });
    const moved = await rescheduleBooking({ code: a.value.code, phone: patient.phone, date: "2026-10-07", start: "12:00" }, NOW);
    expect(moved.ok && moved.value.date).toBe("2026-10-07");
  });
});

describe("findOpenDays", () => {
  it("skips closed days and days the dentist is off", async () => {
    const r = await findOpenDays({ serviceId: "ortho-consult", dentistId: "karim", days: 3 }, NOW);
    expect(r.ok && r.value.map((d) => d.date)).toEqual(["2026-10-05", "2026-10-07", "2026-10-09"]);
  });
});
