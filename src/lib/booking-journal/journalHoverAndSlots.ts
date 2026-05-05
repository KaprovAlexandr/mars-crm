import type { Booking, Slot } from "./getAvailableSlots";
import {
  earliestFreeMinuteAfterBookingEnd,
  isSlotStillFree,
  parseLocalIsoToMs,
  toLocalSlotIso,
} from "./getAvailableSlots";

const WORK_START_MIN = 8 * 60;
const WORK_END_MIN = 20 * 60;

/** 20 мин между концом «свободно» и началом записи / между блоками (сетка 20 мин, без лишних пустых строк). */
const BUFFER_BEFORE_BOOKING_MIN = 20;

/** Верх карточки в px от начала шкалы 08:00 (шаг 20 мин, 40px). */
export function timelineTopPxFromStartHHmm(startHHmm: string): number {
  const [h, m] = startHHmm.split(":").map(Number);
  const mins = h * 60 + m;
  return ((mins - WORK_START_MIN) / 20) * 40;
}

/** Высота карточки в px, включительно по сетке как в журнале. */
export function timelineCardHeightPx(startHHmm: string, endHHmm: string): number {
  const [h1, m1] = startHHmm.split(":").map(Number);
  const [h2, m2] = endHHmm.split(":").map(Number);
  const a = h1 * 60 + m1;
  const b = h2 * 60 + m2;
  return (((b - a) / 20) + 1) * 40;
}

/** Y внутри таймлайна → индекс строки (h-10 = 40px). */
export function timelineLocalYToRowIndex(localY: number, rowHeightPx: number, maxRow: number): number {
  const r = Math.floor(localY / rowHeightPx);
  return Math.max(0, Math.min(maxRow, r));
}

/** Попадает ли вертикальная координата внутрь любой карточки колонки. */
export function isLocalYInsideAnyCard(
  localY: number,
  cards: readonly { start: string; end: string }[],
): boolean {
  for (const c of cards) {
    const top = timelineTopPxFromStartHHmm(c.start);
    const h = timelineCardHeightPx(c.start, c.end);
    if (localY >= top && localY < top + h) return true;
  }
  return false;
}

function bookingToMinutesOnDay(b: Booking): { start: number; end: number } {
  const t = b.startTime.slice(11, 16);
  const t2 = b.endTime.slice(11, 16);
  const [h1, m1] = t.split(":").map(Number);
  const [h2, m2] = t2.split(":").map(Number);
  return { start: h1 * 60 + m1, end: h2 * 60 + m2 };
}

/**
 * Конец непрерывного свободного окна бокса от startMinute (минута дня):
 * до ближайшего начала следующей записи или до конца рабочего дня.
 */
export function getFreeWindowEndMinute(
  date: string,
  boxId: string,
  startMinute: number,
  bookings: Booking[],
  workEndMin: number = WORK_END_MIN,
): number {
  const dayBookings = bookings
    .filter((b) => b.startTime.slice(0, 10) === date && b.boxId === boxId)
    .map((b) => bookingToMinutesOnDay(b))
    .sort((a, b) => a.start - b.start);

  for (const seg of dayBookings) {
    if (startMinute >= seg.start && startMinute < seg.end) return startMinute;
  }

  let gapEnd = workEndMin;
  for (const seg of dayBookings) {
    if (seg.start > startMinute) gapEnd = Math.min(gapEnd, seg.start);
  }
  return gapEnd;
}

/**
 * Конец отображаемого «свободно» перед следующей записью: обычно start−20 мин;
 * запись до конца смены (end ≥ конец дня) — свободно до её start (напр. до 19:40).
 */
function gapEndMinuteBeforeNextBooking(
  nextSeg: { start: number; end: number },
  workEndMin: number,
): number {
  if (nextSeg.end >= workEndMin) return nextSeg.start;
  return nextSeg.start - BUFFER_BEFORE_BOOKING_MIN;
}

/** Клик по сетке в буфере +20 мин после записи — сдвиг на допустимое начало. */
export function snapTimelineClickStartMinute(
  date: string,
  boxId: string,
  proposedStartMin: number,
  bookings: Booking[],
  workStartMin: number = WORK_START_MIN,
): number {
  const segs = bookings
    .filter((b) => b.startTime.slice(0, 10) === date && b.boxId === boxId)
    .map((b) => bookingToMinutesOnDay(b))
    .sort((a, b) => a.start - b.start);
  let adjusted = proposedStartMin;
  if (segs.length > 0) {
    const first = segs[0]!;
    const firstFreeEnd = first.start - BUFFER_BEFORE_BOOKING_MIN;
    if (proposedStartMin >= firstFreeEnd && proposedStartMin < first.start) {
      adjusted = Math.max(adjusted, first.start);
    }
  }
  for (const seg of segs) {
    const afterBuf = earliestFreeMinuteAfterBookingEnd(seg.end, workStartMin);
    if (proposedStartMin >= seg.end && proposedStartMin < afterBuf) {
      adjusted = Math.max(adjusted, afterBuf);
    }
  }
  return adjusted;
}

function minutesToHHmm(total: number): string {
  const h = Math.floor(total / 60);
  const m = total % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

/** «09:00» → минуты от полуночи. */
export function hhmmToMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(":").map(Number);
  return h * 60 + m;
}

export function tryBuildPreferredSlot(args: {
  date: string;
  boxId: string;
  startMinute: number;
  durationMin: number;
  gapEndMinute: number;
  defaultMasterId: string;
  bookings: Booking[];
}): Slot | null {
  const endMin = args.startMinute + args.durationMin;
  if (endMin > args.gapEndMinute || endMin > WORK_END_MIN) return null;
  const startTime = toLocalSlotIso(args.date, args.startMinute);
  const endTime = toLocalSlotIso(args.date, endMin);
  const slot: Slot = {
    startTime,
    endTime,
    boxId: args.boxId,
    masterId: args.defaultMasterId,
  };
  if (!isSlotStillFree(slot, args.bookings)) return null;
  return slot;
}

/** Ближайший по времени начала слот к желаемому ISO. */
export function findNearestSlotByTime(preferredStartIso: string, slots: Slot[]): Slot | null {
  if (slots.length === 0) return null;
  const pref = parseLocalIsoToMs(preferredStartIso);
  let best = slots[0]!;
  let bestD = Math.abs(parseLocalIsoToMs(best.startTime) - pref);
  for (let i = 1; i < slots.length; i++) {
    const s = slots[i]!;
    const d = Math.abs(parseLocalIsoToMs(s.startTime) - pref);
    if (d < bestD) {
      best = s;
      bestD = d;
    }
  }
  return best;
}

export function formatHoverRange(fromHHmm: string, gapEndMinute: number): { from: string; to: string } {
  return { from: fromHHmm, to: minutesToHHmm(gapEndMinute) };
}

/**
 * Свободные окна (минуты от полуночи): после занятости +20 мин (сетка);
 * до любой следующей записи — «свободно» до её start − 20 мин (8:00–8:40, затем запись с 9:00);
 * хвост до конца смены — см. gapEndMinuteBeforeNextBooking.
 */
export function getFreeIntervalsForBoxDay(
  date: string,
  boxId: string,
  bookings: Booking[],
  workStartMin: number = WORK_START_MIN,
  workEndMin: number = WORK_END_MIN,
): { startMin: number; endMin: number }[] {
  const segs = bookings
    .filter((b) => b.startTime.slice(0, 10) === date && b.boxId === boxId)
    .map((b) => bookingToMinutesOnDay(b))
    .sort((a, b) => a.start - b.start);

  if (segs.length === 0) {
    return [{ startMin: workStartMin, endMin: workEndMin }];
  }

  const gaps: { startMin: number; endMin: number }[] = [];
  const firstFreeEnd = segs[0].start - BUFFER_BEFORE_BOOKING_MIN;
  if (firstFreeEnd > workStartMin) {
    gaps.push({ startMin: workStartMin, endMin: firstFreeEnd });
  }

  for (let i = 0; i < segs.length - 1; i++) {
    const freeStart = earliestFreeMinuteAfterBookingEnd(segs[i].end, workStartMin);
    const freeEnd = gapEndMinuteBeforeNextBooking(segs[i + 1], workEndMin);
    if (freeEnd > freeStart) gaps.push({ startMin: freeStart, endMin: freeEnd });
  }

  const last = segs[segs.length - 1]!;
  if (last.end < workEndMin) {
    const freeStart = earliestFreeMinuteAfterBookingEnd(last.end, workStartMin);
    if (freeStart < workEndMin) gaps.push({ startMin: freeStart, endMin: workEndMin });
  }

  return gaps.filter((g) => g.endMin > g.startMin);
}
