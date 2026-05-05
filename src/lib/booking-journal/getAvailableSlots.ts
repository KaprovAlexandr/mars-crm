export type Box = {
  id: string;
  name: string;
};

export type Master = {
  id: string;
  name: string;
};

export type Service = {
  id: string;
  name: string;
  duration: number;
};

export type Booking = {
  id: string;
  boxId: string;
  masterId: string;
  startTime: string;
  endTime: string;
};

export type Slot = {
  startTime: string;
  endTime: string;
  boxId: string;
  masterId: string;
};

function overlaps(aStart: number, aEnd: number, bStart: number, bEnd: number): boolean {
  return aStart < bEnd && aEnd > bStart;
}

const DEFAULT_WORK_START_MIN = 8 * 60;
const SLOT_GRID_MIN = 20;
const TURNAROUND_MIN = 20;

/**
 * После конца записи следующее окно не раньше чем конец + 20 мин, вверх на шаг сетки 20 мин от 08:00
 * (занятость 9:00–10:00 → следующее с 10:20).
 */
export function earliestFreeMinuteAfterBookingEnd(
  bookingEndMin: number,
  workStartMin: number = DEFAULT_WORK_START_MIN,
): number {
  const raw = bookingEndMin + TURNAROUND_MIN;
  const rel = raw - workStartMin;
  return Math.ceil(rel / SLOT_GRID_MIN) * SLOT_GRID_MIN + workStartMin;
}

function bookingDayMinutes(b: Booking): { start: number; end: number } {
  const t = b.startTime.slice(11, 16);
  const t2 = b.endTime.slice(11, 16);
  const [h1, m1] = t.split(":").map(Number);
  const [h2, m2] = t2.split(":").map(Number);
  return { start: h1 * 60 + m1, end: h2 * 60 + m2 };
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

/** Локальная метка вида YYYY-MM-DDTHH:mm:00 (без смещения часового пояса). */
export function toLocalSlotIso(date: string, totalMinutesFromMidnight: number): string {
  const [y, m, d] = date.split("-").map(Number);
  const h = Math.floor(totalMinutesFromMidnight / 60);
  const min = totalMinutesFromMidnight % 60;
  return `${y}-${pad2(m)}-${pad2(d)}T${pad2(h)}:${pad2(min)}:00`;
}

export function parseLocalIsoToMs(iso: string): number {
  const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})$/.exec(iso);
  if (!m) return new Date(iso).getTime();
  const [, ys, ms, ds, hs, mins, ss] = m;
  return new Date(
    Number(ys),
    Number(ms) - 1,
    Number(ds),
    Number(hs),
    Number(mins),
    Number(ss),
    0,
  ).getTime();
}

export function getAvailableSlots({
  date,
  serviceDuration,
  boxes,
  masters,
  bookings,
}: {
  date: string;
  serviceDuration: number;
  boxes: Box[];
  masters: Master[];
  bookings: Booking[];
}): Slot[] {
  const dayBookings = bookings.filter((b) => b.startTime.slice(0, 10) === date);
  const slots: Slot[] = [];

  const workStartMin = DEFAULT_WORK_START_MIN;
  const workEndMin = 20 * 60;

  for (let startMin = workStartMin; startMin < workEndMin; startMin += SLOT_GRID_MIN) {
    const endMin = startMin + serviceDuration;
    if (endMin > workEndMin) continue;

    const startTime = toLocalSlotIso(date, startMin);
    const endTime = toLocalSlotIso(date, endMin);
    const newStart = parseLocalIsoToMs(startTime);
    const newEnd = parseLocalIsoToMs(endTime);

    for (const box of boxes) {
      const boxBusy = dayBookings.some((b) => {
        if (b.boxId !== box.id) return false;
        const { end: be } = bookingDayMinutes(b);
        const blockedUntilMin = earliestFreeMinuteAfterBookingEnd(be, workStartMin);
        const bStart = parseLocalIsoToMs(b.startTime);
        const bEndMs = parseLocalIsoToMs(toLocalSlotIso(date, blockedUntilMin));
        return overlaps(newStart, newEnd, bStart, bEndMs);
      });
      if (boxBusy) continue;

      for (const master of masters) {
        const masterBusy = dayBookings.some((b) => {
          if (b.masterId !== master.id) return false;
          const { end: be } = bookingDayMinutes(b);
          const blockedUntilMin = earliestFreeMinuteAfterBookingEnd(be, workStartMin);
          const bStart = parseLocalIsoToMs(b.startTime);
          const bEndMs = parseLocalIsoToMs(toLocalSlotIso(date, blockedUntilMin));
          return overlaps(newStart, newEnd, bStart, bEndMs);
        });
        if (masterBusy) continue;

        slots.push({ startTime, endTime, boxId: box.id, masterId: master.id });
      }
    }
  }

  return slots;
}

export function slotKey(s: Slot): string {
  return `${s.startTime}|${s.boxId}|${s.masterId}`;
}

/** Перед сохранением: слот не пересекается ни по боксу, ни по мастеру с существующими записями на этот день. */
export function isSlotStillFree(slot: Slot, bookings: Booking[]): boolean {
  const date = slot.startTime.slice(0, 10);
  const dayBookings = bookings.filter((b) => b.startTime.slice(0, 10) === date);
  const newStart = parseLocalIsoToMs(slot.startTime);
  const newEnd = parseLocalIsoToMs(slot.endTime);
  const workStartMin = DEFAULT_WORK_START_MIN;
  for (const b of dayBookings) {
    const { end: be } = bookingDayMinutes(b);
    const blockedUntilMin = earliestFreeMinuteAfterBookingEnd(be, workStartMin);
    const bStart = parseLocalIsoToMs(b.startTime);
    const bEndMs = parseLocalIsoToMs(toLocalSlotIso(date, blockedUntilMin));
    if (b.boxId === slot.boxId && overlaps(newStart, newEnd, bStart, bEndMs)) return false;
    if (b.masterId === slot.masterId && overlaps(newStart, newEnd, bStart, bEndMs)) return false;
  }
  return true;
}
