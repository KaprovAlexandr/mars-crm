import { MarsAppShellSidebar } from "@/components/layout/MarsAppShellSidebar";
import { appendJournalBookingSoonToFeed } from "@/lib/notifications/inAppNotificationFeed";
import { appendUserActionLog } from "@/lib/notifications/actionActivityLog";
import { emitArchiveStyleToast } from "@/lib/notifications/inAppArchiveToastBus";
import { WORK_ORDER_LIST_FLASH_ARMED_KEY, BOOKING_LIST_FLASH_ARMED_KEY } from "@/lib/notifications/inferNotificationDeepLink";
import {
  deleteJournalStorageRow,
  insertJournalStorageRow,
  isJournalRemoteEnabled,
  listJournalStorageRows,
  updateJournalStorageRows,
  type JournalStorageRow,
} from "@/lib/data/journalDataSource";
import { isClientsRemoteEnabled, listClientsStorageRows } from "@/lib/data/clientsDataSource";
import { markRequestAsBooked } from "@/lib/data/requestsDataSource";
import {
  RequestActionIconEdit,
  RequestActionIconGetJob,
  RequestActionIconStatus,
  RequestActionIconTrash,
} from "../icons/RequestRowModalIcons";
import type { CSSProperties, KeyboardEvent, MouseEvent, TransitionEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Booking, Service, Slot } from "../../lib/booking-journal/getAvailableSlots";
import { getAvailableSlots, isSlotStillFree, slotKey } from "../../lib/booking-journal/getAvailableSlots";
import type { Car, Client } from "../../lib/booking-journal/bookingClientsSearch";
import { findClientsByNationalPhone, findClientsBySurname } from "../../lib/booking-journal/bookingClientsSearch";
import { mergeApiClientsIntoJournalClients, mergeJournalClientLists } from "../../lib/booking-journal/journalClientsDirectory";
import {
  displayRuPhoneComplete,
} from "../../lib/booking-journal/ruPhoneMask";
import {
  INITIAL_JOURNAL_BOOKINGS,
  INITIAL_JOURNAL_CARD_META,
  JOURNAL_BOXES,
  JOURNAL_MASTERS,
  JOURNAL_SERVICES,
  MOCK_JOURNAL_CLIENTS,
  type JournalBookingStatus,
  type JournalStatusActor,
} from "../../lib/booking-journal/mockJournalData";
import { workOrderRows } from "@/components/pages/WorkOrdersPage";
import {
  findNearestSlotByTime,
  getFreeIntervalsForBoxDay,
  getFreeWindowEndMinute,
  hhmmToMinutes,
  isLocalYInsideAnyCard,
  snapTimelineClickStartMinute,
  timelineLocalYToRowIndex,
  tryBuildPreferredSlot,
} from "../../lib/booking-journal/journalHoverAndSlots";

type BookingStatus = JournalBookingStatus;

type BookingCard = {
  id: string;
  title: string;
  phone?: string;
  service: string;
  car: string;
  masterShortName: string;
  masterPhoto?: string;
  start: string;
  end: string;
  status?: BookingStatus;
  statusActor?: JournalStatusActor;
};

type BookingCardActionId = "moveToWorkOrder" | "status" | "edit" | "delete";
type BoxHeaderActionId = "callMaster" | "openProfile" | "changeMaster" | "removeMaster";
type EditBookingDraft = {
  clientTitle: string;
  car: string;
};
const TRANSFER_TO_WORK_ORDER_DRAFT_KEY = "transferToWorkOrderDraft";

function bookingCardMatchesSearch(card: BookingCard, qNorm: string): boolean {
  if (!qNorm) return true;
  const blob = `${card.title} ${card.service} ${card.car} ${card.start} ${card.end} ${card.status ?? ""}`.toLowerCase();
  return blob.includes(qNorm);
}

/** Фон и обводка всего слота по статусу. */
const JOURNAL_STATUS_SLOT: Record<BookingStatus, string> = {
  Подтверждена: "bg-[#E8F7EE]",
  "Ожидает клиента": "bg-[#FFFCF0]",
  "В работе": "bg-[#ECF4FF]",
  Завершена: "bg-[#F3F4F6]",
  "Клиент не приехал": "bg-[#FCE6E8]",
  Отменена: "bg-[#ECECEF]",
};

/** Бейдж статуса (согласован с фоном слота). */
const JOURNAL_STATUS_CHIP: Record<BookingStatus, string> = {
  Подтверждена: "bg-[#BBF7D0] text-[#166534]",
  "Ожидает клиента": "bg-[#FEF3C7] text-[#854D0E]",
  "В работе": "bg-[#BFDBFE] text-[#1D4ED8]",
  Завершена: "bg-[#E5E7EB] text-[#374151]",
  "Клиент не приехал": "bg-[#EC1C24] text-white",
  Отменена: "bg-[#222222] text-white",
};

/** Цвет плашки времени внутри карточки по статусу слота. */
const JOURNAL_STATUS_TIME_BADGE: Record<BookingStatus, string> = {
  Подтверждена: "bg-[#26B36A] text-white",
  "Ожидает клиента": "bg-[#D5A321] text-white",
  "В работе": "bg-[#2F7FEA] text-white",
  Завершена: "bg-[#7B8494] text-white",
  "Клиент не приехал": "bg-[#EC1C24] text-white",
  Отменена: "bg-[#222222] text-white",
};

const JOURNAL_STATUS_DOT_COLOR: Record<BookingStatus, string> = {
  Подтверждена: "#26B36A",
  "Ожидает клиента": "#D5A321",
  "В работе": "#2F7FEA",
  Завершена: "#7B8494",
  "Клиент не приехал": "#EC1C24",
  Отменена: "#222222",
};

type BoxColumn = {
  title: string;
  worker: string;
  cards: BookingCard[];
};

const timeSlots = [
  "08:00", "08:20", "08:40", "09:00", "09:20", "09:40", "10:00", "10:20", "10:40", "11:00", "11:20", "11:40",
  "12:00", "12:20", "12:40", "13:00", "13:20", "13:40", "14:00", "14:20", "14:40", "15:00", "15:20", "15:40",
  "16:00", "16:20", "16:40", "17:00", "17:20", "17:40", "18:00", "18:20", "18:40", "19:00", "19:20", "19:40",
];

/** Диагональная штриховка для свободных окон (белый + #F3F3F5 ~45°). */
const JOURNAL_FREE_SLOT_STRIPE_BG: CSSProperties = {
  backgroundColor: "#ffffff",
  backgroundImage:
    "repeating-linear-gradient(45deg, #ffffff 0px, #ffffff 5px, #F3F3F5 5px, #F3F3F5 10px)",
};

/** День с демо-записями в моках (3 мая 2026); боковой календарь открывается на этот месяц. */
const JOURNAL_SEED_DAY = "2026-05-03";

const RU_MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
] as const;

function parseYmdLocal(ymd: string): { y: number; m: number; d: number } {
  const [ys, ms, ds] = ymd.split("-");
  return { y: Number(ys), m: Number(ms), d: Number(ds) };
}

function formatYmdLocal(y: number, m: number, d: number): string {
  return `${y}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function journalTodayYmd(): string {
  const n = new Date();
  return formatYmdLocal(n.getFullYear(), n.getMonth() + 1, n.getDate());
}

/** Сдвиг календарного дня в локальной зоне (YYYY-MM-DD). */
function addCalendarDays(ymd: string, deltaDays: number): string {
  const { y, m, d } = parseYmdLocal(ymd);
  const dt = new Date(y, m - 1, d + deltaDays);
  return formatYmdLocal(dt.getFullYear(), dt.getMonth() + 1, dt.getDate());
}

function formatJournalDayTitleRu(ymd: string): string {
  const { y, m, d } = parseYmdLocal(ymd);
  const month = RU_MONTHS_GENITIVE[m - 1] ?? "";
  return `${d} ${month} ${y}`;
}

function formatHeaderClockNow(): string {
  const d = new Date();
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

const RU_MONTHS_NOMINATIVE = [
  "Январь",
  "Февраль",
  "Март",
  "Апрель",
  "Май",
  "Июнь",
  "Июль",
  "Август",
  "Сентябрь",
  "Октябрь",
  "Ноябрь",
  "Декабрь",
] as const;

function formatSidebarMonthYearRu(year: number, month1: number): string {
  const name = RU_MONTHS_NOMINATIVE[month1 - 1] ?? "";
  return `${name} ${year}`;
}

function shiftCalendarMonthYm(year: number, month1: number, delta: number): { year: number; month: number } {
  const d = new Date(year, month1 - 1 + delta, 1);
  return { year: d.getFullYear(), month: d.getMonth() + 1 };
}

/** 6×7: понедельник — первый столбец, ячейки с полной датой YYYY-MM-DD. */
function buildSidebarCalendarCells(year: number, month1: number): { dateIso: string; dayNum: number; inMonth: boolean }[] {
  const firstOfMonth = new Date(year, month1 - 1, 1);
  const mondayOffset = (firstOfMonth.getDay() + 6) % 7;
  const gridStart = new Date(year, month1 - 1, 1 - mondayOffset);
  const cells: { dateIso: string; dayNum: number; inMonth: boolean }[] = [];
  for (let i = 0; i < 42; i++) {
    const d = new Date(gridStart);
    d.setDate(gridStart.getDate() + i);
    const y = d.getFullYear();
    const m = d.getMonth() + 1;
    const day = d.getDate();
    cells.push({
      dateIso: formatYmdLocal(y, m, day),
      dayNum: day,
      inMonth: y === year && m === month1,
    });
  }
  return cells;
}

/**
 * Для любого дня, кроме демо 03.05.2026, если в колонке нет записей — два окна «свободно»
 * (8:00–13:40 и 14:00–19:40), 4 колонки × 2 = 8 блоков.
 * Иначе — обычные интервалы из расчёта буферов.
 */
function getJournalFreeGapsForBoxDay(
  date: string,
  boxId: string,
  bookings: Booking[],
): { startMin: number; endMin: number }[] {
  const hasBookings = bookings.some((b) => b.boxId === boxId && b.startTime.slice(0, 10) === date);
  if (date !== JOURNAL_SEED_DAY && !hasBookings) {
    return [
      { startMin: 8 * 60, endMin: 13 * 60 + 40 },
      { startMin: 14 * 60, endMin: 19 * 60 + 40 },
    ];
  }
  return getFreeIntervalsForBoxDay(date, boxId, bookings);
}

type JournalRow = Booking & {
  clientTitle: string;
  clientPhone?: string;
  service: string;
  car: string;
  status?: BookingStatus;
  statusActor?: JournalStatusActor;
};
function mapStorageJournalRowToUi(row: JournalStorageRow): JournalRow {
  const normalizeDateTime = (value: string): string => {
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return value;
    const yyyy = parsed.getFullYear();
    const mm = String(parsed.getMonth() + 1).padStart(2, "0");
    const dd = String(parsed.getDate()).padStart(2, "0");
    const hh = String(parsed.getHours()).padStart(2, "0");
    const mi = String(parsed.getMinutes()).padStart(2, "0");
    const ss = String(parsed.getSeconds()).padStart(2, "0");
    return `${yyyy}-${mm}-${dd}T${hh}:${mi}:${ss}`;
  };
  return {
    id: row.id,
    boxId: row.box_id,
    masterId: row.master_id,
    startTime: normalizeDateTime(row.start_time),
    endTime: normalizeDateTime(row.end_time),
    clientTitle: row.client_title,
    clientPhone: row.client_phone ?? "",
    service: row.service,
    car: row.car,
    status: row.status ?? "Подтверждена",
    statusActor: row.status_actor ?? "manager",
  };
}

const BOX_COLUMN_LAYOUT = [
  { boxId: "1", title: "Бокс №1", worker: "Журавлев М." },
  { boxId: "2", title: "Бокс №2", worker: "Кузнецов Е." },
  { boxId: "3", title: "Бокс №3", worker: "Алексеев Д." },
  { boxId: "4", title: "Шиномонтаж", worker: "Воробьев С." },
] as const;

type ModalPrefill = { boxId: string; startIso: string; gapEndMinute: number };

type HoverFreeHint = ModalPrefill & { from: string; to: string };

type WizardStep = 1 | 2 | 3 | 4;

type Step1ClientMode = "phone" | "link_surname" | "new_form";

function defaultMasterIdForBox(boxId: string): string {
  const i = BOX_COLUMN_LAYOUT.findIndex((b) => b.boxId === boxId);
  return JOURNAL_MASTERS[Math.max(0, i)]?.id ?? "m1";
}

function assignmentKey(date: string, boxId: string): string {
  return `${date}|${boxId}`;
}

function isMasterWorkingOnDate(master: (typeof JOURNAL_MASTERS)[number], date: string): boolean {
  const [y, m, d] = date.split("-").map(Number);
  const weekday = new Date(y, m - 1, d).getDay();
  if (master.workWeekdays && master.workWeekdays.length > 0 && !master.workWeekdays.includes(weekday)) {
    return false;
  }
  const status = master.dayStatusByDate?.[date] ?? "available";
  return status === "available";
}

function buildInitialRows(): JournalRow[] {
  const day = journalTodayYmd();
  return INITIAL_JOURNAL_BOOKINGS.map((b) => ({
    ...b,
    startTime: day + b.startTime.slice(10),
    endTime: day + b.endTime.slice(10),
    ...INITIAL_JOURNAL_CARD_META[b.id]!,
  }));
}

function toBookings(rows: JournalRow[]): Booking[] {
  return rows.map(({ id, boxId, masterId, startTime, endTime }) => ({ id, boxId, masterId, startTime, endTime }));
}

function rowsToBoxColumns(rows: JournalRow[], day: string, clients: Client[]): BoxColumn[] {
  const dayRows = rows.filter((r) => r.startTime.slice(0, 10) === day);
  return BOX_COLUMN_LAYOUT.map((col) => ({
    title: col.title,
    worker: col.worker,
    cards: dayRows
      .filter((r) => r.boxId === col.boxId)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((r) => {
        const baseCar = carTitleOnly(r.car);
        const matchedClient = findClientByJournalTitle(clients, r.clientTitle);
        const resolvedTitle = matchedClient?.name ?? r.clientTitle;
        const resolvedPhone = matchedClient?.phone ?? r.clientPhone ?? "";
        const resolvedCarModel = matchedClient?.cars?.[0]?.model?.trim() || baseCar;
        return {
          id: r.id,
          title: resolvedTitle,
          phone: resolvedPhone,
          service: r.service,
          car: resolvedCarModel,
          masterShortName: JOURNAL_MASTERS.find((m) => m.id === r.masterId)?.name ?? r.masterId,
          masterPhoto: JOURNAL_MASTERS.find((m) => m.id === defaultMasterIdForBox(r.boxId))?.photoUrl,
          start: r.startTime.slice(11, 16),
          end: r.endTime.slice(11, 16),
          status: r.status,
          statusActor: r.statusActor,
        };
      }),
  }));
}

function formatSlotLabel(slot: Slot): string {
  const t = slot.startTime.slice(11, 16);
  const box = JOURNAL_BOXES.find((b) => b.id === slot.boxId)?.name ?? slot.boxId;
  const master = JOURNAL_MASTERS.find((m) => m.id === slot.masterId)?.name ?? slot.masterId;
  return `${t} · ${box} · ${master}`;
}

function toClientShortName(fullName: string): string {
  const parts = fullName.trim().split(/\s+/).filter(Boolean);
  if (parts.length <= 1) return fullName.trim();
  const surname = parts[0] ?? "";
  const firstInitial = parts[1]?.[0];
  return firstInitial ? `${surname} ${firstInitial}.` : surname;
}

function findClientByJournalTitle(clients: Client[], title: string): Client | null {
  const normalizedTitle = title.trim().toLowerCase();
  if (!normalizedTitle) return null;
  return (
    clients.find((c) => c.name.trim().toLowerCase() === normalizedTitle) ??
    clients.find((c) => toClientShortName(c.name).trim().toLowerCase() === normalizedTitle) ??
    null
  );
}

function clampClientPhoneTooltipPos(
  clientX: number,
  clientY: number,
  fullText: string,
): { x: number; y: number; maxWidth: number } {
  if (typeof window === "undefined") return { x: clientX + 14, y: clientY + 14, maxWidth: 360 };
  const gap = 14;
  const preferredMaxW = 360;
  const tooltipMaxH = Math.min(280, window.innerHeight - 24);
  const charsPerLine = 40;
  const lineH = 22;
  const verticalPad = 22;
  const lines = Math.max(1, Math.ceil(fullText.length / charsPerLine));
  const estH = Math.min(tooltipMaxH, lines * lineH + verticalPad);

  const x = Math.max(8, clientX + gap);
  const maxWidth = Math.min(preferredMaxW, Math.max(80, window.innerWidth - x - 8));

  let y = clientY + gap;
  if (y + estH > window.innerHeight - 8) {
    y = clientY - estH - gap;
  }
  y = Math.max(8, Math.min(y, window.innerHeight - estH - 8));
  return { x, y, maxWidth };
}

function formatPhoneForCardTooltip(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  const national10 = digits.startsWith("7") && digits.length >= 11 ? digits.slice(1, 11) : digits.slice(0, 10);
  if (national10.length !== 10) return phone;
  return `+7 (${national10.slice(0, 3)}) ${national10.slice(3, 6)}-${national10.slice(6, 8)}-${national10.slice(8, 10)}`;
}

/** Как в карточках макета: «Toyota Camry  123ВС777». */
function formatCarLine(carModel: string, plateOrVin: string): string {
  const m = carModel.trim();
  const p = plateOrVin.trim();
  if (m && p) return `${m}  ${p}`;
  return m || p || "—";
}

function extractWorkOrderIdFromCardText(text: string): string | null {
  const m = text.match(/Заказ-наряд\s*№\s*(\d+)/i);
  return m?.[1] ?? null;
}

function parseRuDate(s: string): Date | null {
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s.trim());
  if (!m) return null;
  const d = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const y = Number(m[3]);
  const dt = new Date(y, mo, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
  return dt;
}

function normalizeRuNameForCompare(s: string): string {
  return s.trim().toLowerCase().replaceAll("ё", "е");
}

function toTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "tel:+7";
  if (digits.startsWith("8") && digits.length >= 11) return `tel:+7${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length >= 11) return `tel:+${digits}`;
  return `tel:+7${digits}`;
}

function BoxHeaderActionIcon({ type, className }: { type: "call" | "profile" | "switch" | "remove"; className?: string }) {
  if (type === "call") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path
          d="M7.2 5.5C7.5 5 8 4.8 8.6 4.9L10.9 5.3C11.5 5.4 11.9 5.8 12 6.4L12.4 8.5C12.5 9 12.3 9.5 11.9 9.9L10.8 11C11.5 12.3 12.6 13.4 13.9 14.2L15 13.1C15.4 12.7 15.9 12.5 16.4 12.6L18.5 13C19.1 13.1 19.5 13.5 19.6 14.1L20 16.4C20.1 17 19.9 17.5 19.4 17.8L17.8 18.9C17.2 19.3 16.5 19.4 15.8 19.2C13.4 18.5 11.2 17.2 9.4 15.4C7.6 13.6 6.3 11.4 5.6 9C5.4 8.3 5.5 7.6 5.9 7L7.2 5.5Z"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  if (type === "profile") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <circle cx="12" cy="8" r="3.25" stroke="currentColor" strokeWidth="1.9" />
        <path d="M5 19.2C5.9 15.9 8.4 14.5 12 14.5C15.6 14.5 18.1 15.9 19 19.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "switch") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
        <path d="M7 7H18M18 7L15.2 4.2M18 7L15.2 9.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M17 17H6M6 17L8.8 14.2M6 17L8.8 19.8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M6 7H18M9 7V5.8C9 4.8 9.8 4 10.8 4H13.2C14.2 4 15 4.8 15 5.8V7" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M8 9L8.7 18.1C8.8 19.1 9.6 19.9 10.6 19.9H13.4C14.4 19.9 15.2 19.1 15.3 18.1L16 9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M10.5 11.2V16.2M13.5 11.2V16.2" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
    </svg>
  );
}

function carTitleOnly(carLine: string): string {
  const [model] = carLine.split(/\s{2,}/);
  return (model ?? carLine).trim() || "—";
}

function toMinutes(time: string) {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + m;
}

function calcTop(start: string) {
  return ((toMinutes(start) - toMinutes("08:00")) / 20) * 40;
}

/** Конец рабочей сетки по меткам: последняя строка с подписью 19:40 (интервал 19:40–20:00). */
const JOURNAL_GRID_LAST_SLOT_START_MIN = 19 * 60 + 40;
const JOURNAL_WORK_END_MIN = 20 * 60;
const JOURNAL_MIN_SERVICE_DURATION_MIN = 30;
const TIRE_BOX_ID = "4";
const TIRE_SERVICE_IDS = new Set(["tire1", "tire2", "tire3", "tire4", "tire5"]);
const TIRE_ONLY_SERVICE_NAMES = new Set([
  "Замена 2-х колес",
  "Сезонная смена шин",
  "Балансировка колес",
  "Ремонт / подкачка колес",
  "Проверка сход-развала",
]);
const GENERAL_SERVICE_IDS = new Set([
  "exp1", "exp2", "exp3", "exp4",
  "std2", "std3", "std4",
  "cmp1", "cmp2", "cmp3", "cmp4",
]);
const JOURNAL_SOON_REMINDER_DEDUPE_STORAGE_KEY = "journalSoonReminderDedupeKeys";
export const JOURNAL_ROWS_ACTIVITY_STORAGE_KEY = "journalRowsActivitySnapshot";
const JOURNAL_ROWS_PERSIST_KEY = "journalRowsPersistedV1";
const JOURNAL_CLIENTS_PERSIST_KEY = "journalClientsPersistedV1";
const JOURNAL_ASSIGNED_PERSIST_KEY = "journalAssignedMastersPersistedV1";
const INITIAL_ASSIGNED_MASTERS_BY_DATE_BOX: Record<string, string> = {
  "2026-05-08|1": "m1",
  "2026-05-08|2": "m2",
  "2026-05-08|3": "m3",
  "2026-05-08|4": "m4",
};

/** Хвост дня в данных — до 20:00; в подписи показываем «до 19:40», как на сетке. */
function formatFreeGapEndLabelForUi(endMin: number): string {
  if (endMin >= JOURNAL_WORK_END_MIN) return toTimeLabel(JOURNAL_GRID_LAST_SLOT_START_MIN);
  return toTimeLabel(endMin);
}

function calcHeight(start: string, end: string) {
  return ((toMinutes(end) - toMinutes(start)) / 20) * 40;
}

/**
 * Высота полосы «свободно» по сетке 40px/20 мин:
 * — если в endMin начинается запись или конец дня: низ = верх строки с меткой end (не заходим на строку записи);
 * — иначе низ = верх следующей строки после end (8:00–8:40 → до линии 9:00 = три полные строки 8:00, 8:20, 8:40).
 */
function calcFreeStripeHeightPx(
  gap: { startMin: number; endMin: number },
  boxId: string,
  day: string,
  rows: Booking[],
): number {
  const startHHmm = toTimeLabel(gap.startMin);
  const top = calcTop(startHHmm);
  const workEndMin = JOURNAL_WORK_END_MIN;
  const slotStepMin = 20;
  const bookingStartsAtGapEnd = rows.some(
    (r) =>
      r.boxId === boxId &&
      r.startTime.slice(0, 10) === day &&
      hhmmToMinutes(r.startTime.slice(11, 16)) === gap.endMin,
  );
  const bottomMin =
    gap.endMin >= workEndMin || bookingStartsAtGapEnd
      ? gap.endMin
      : gap.endMin + slotStepMin;
  return calcTop(toTimeLabel(bottomMin)) - top;
}

function calcCardHeightInclusive(start: string, end: string) {
  return (((toMinutes(end) - toMinutes(start)) / 20) + 1) * 40;
}

function toTimeLabel(minutes: number) {
  const hh = String(Math.floor(minutes / 60)).padStart(2, "0");
  const mm = String(minutes % 60).padStart(2, "0");
  return `${hh}:${mm}`;
}

function filterSlotsByPrefillWindow(slots: Slot[], prefill: ModalPrefill | null): Slot[] {
  if (!prefill) return slots;
  const fromMin = hhmmToMinutes(prefill.startIso.slice(11, 16));
  const toMin = prefill.gapEndMinute;
  return slots.filter((slot) => {
    if (slot.boxId !== prefill.boxId) return false;
    const slotStartMin = hhmmToMinutes(slot.startTime.slice(11, 16));
    const slotEndMin = hhmmToMinutes(slot.endTime.slice(11, 16));
    return slotStartMin >= fromMin && slotEndMin <= toMin;
  });
}

function gapUiEndMinute(endMin: number): number {
  return endMin >= JOURNAL_WORK_END_MIN ? JOURNAL_GRID_LAST_SLOT_START_MIN : endMin;
}

function slotFitsVisibleFreeWindow(date: string, slot: Slot, bookings: Booking[]): boolean {
  const slotStartMin = hhmmToMinutes(slot.startTime.slice(11, 16));
  const slotEndMin = hhmmToMinutes(slot.endTime.slice(11, 16));
  const gaps = getJournalFreeGapsForBoxDay(date, slot.boxId, bookings);
  return gaps.some((gap) => {
    const uiEndMin = gapUiEndMinute(gap.endMin);
    return slotStartMin >= gap.startMin && slotEndMin <= uiEndMin;
  });
}

/** Поле поиска на странице «Заявки», светлая тема (без переключения dark). */
const REQUESTS_SEARCH_INPUT_LIGHT_CLASS =
  "h-12 w-full min-w-0 rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-[#8A8A8A] outline-none placeholder:text-[#B5B5B5]";

/** Как поле поиска в «Заявках» по рамке/высоте/шрифту; текст значения чёрный (шаг Услуга / Дата). */
const JOURNAL_MODAL_REQUESTS_LIKE_FIELD_CLASS =
  "h-12 w-full min-w-0 rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none";

const JOURNAL_MODAL_REQUESTS_LIKE_SELECT_CLASS = `${JOURNAL_MODAL_REQUESTS_LIKE_FIELD_CLASS} appearance-none cursor-pointer pr-12`;

/** Как у стрелки в модалке «Редактировать заявку». */
const EDIT_MODAL_DROPDOWN_STROKE = 2.2;

/** Стрелка как в модалке «Редактировать заявку» (RequestsListPage). */
function EditRequestModalSelectChevron() {
  return (
    <span
      className="pointer-events-none absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#111111]"
      aria-hidden
    >
      <svg viewBox="0 0 16 16" fill="none" className="h-[16px] w-[16px]">
        <path
          d="M3 6L8 11L13 6"
          stroke="currentColor"
          strokeWidth={EDIT_MODAL_DROPDOWN_STROKE}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

/** Календарь для «Дата»: та же толщина штриха, что у стрелки; разделитель внутри рамки, без двойного контура сверху. */
function JournalModalDateCalendarIcon() {
  const sw = EDIT_MODAL_DROPDOWN_STROKE;
  return (
    <span
      className="pointer-events-none absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-[#111111]"
      aria-hidden
    >
      <svg viewBox="0 0 16 16" fill="none" className="h-[16px] w-[16px]">
        <path d="M5.25 2.25V6.5M10.75 2.25V6.5" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
        <rect x="2.25" y="6.5" width="11.5" height="7.35" rx="1.35" stroke="currentColor" strokeWidth={sw} />
        <path d="M2.4 8.35h11.2" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" />
      </svg>
    </span>
  );
}

function maskRuPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.startsWith("8") ? `7${digits.slice(1)}` : digits.startsWith("7") ? digits : `7${digits}`;
  const body = normalized.slice(1, 11);
  const p1 = body.slice(0, 3);
  const p2 = body.slice(3, 6);
  const p3 = body.slice(6, 8);
  const p4 = body.slice(8, 10);
  if (body.length <= 3) return `+7${p1 ? ` (${p1}` : ""}`;
  if (body.length <= 6) return `+7 (${p1}) ${p2}`;
  if (body.length <= 8) return `+7 (${p1}) ${p2}-${p3}`;
  return `+7 (${p1}) ${p2}-${p3}-${p4}`;
}

function national10FromPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.startsWith("8") ? `7${digits.slice(1)}` : digits.startsWith("7") ? digits : `7${digits}`;
  return normalized.slice(1, 11);
}

type JournalSoonNotice = { line1: string; line2: string };

const JOURNAL_NO_REMINDER_STATUSES = new Set<JournalBookingStatus>([
  "Отменена",
  "Завершена",
  "Клиент не приехал",
]);

export function BookingJournalPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const bookingHighlightId = searchParams.get("booking");
  const [flashBookingId, setFlashBookingId] = useState<string | null>(null);
  const [flashBookingDay, setFlashBookingDay] = useState<string | null>(null);
  const bookingArticleRefs = useRef<Record<string, HTMLElement | null>>({});
  const bookingFocusResetFor = useRef<string | null>(null);
  const bookingScrollKey = useRef<string>("");
  const timelineHeight = timeSlots.length * 40;
  const [headerClock, setHeaderClock] = useState(formatHeaderClockNow);
  const [hoverLineY, setHoverLineY] = useState<number | null>(null);
  const [journalSearchQuery, setJournalSearchQuery] = useState("");
  const [journalRows, setJournalRows] = useState<JournalRow[]>(() => {
    if (typeof window === "undefined") return buildInitialRows();
    if (isJournalRemoteEnabled()) return [];
    try {
      const raw = window.sessionStorage.getItem(JOURNAL_ROWS_PERSIST_KEY);
      if (!raw) return buildInitialRows();
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? (parsed as JournalRow[]) : buildInitialRows();
    } catch {
      return buildInitialRows();
    }
  });
  const [journalRowsRemoteSettled, setJournalRowsRemoteSettled] = useState(() => !isJournalRemoteEnabled());
  const [journalViewDate, setJournalViewDate] = useState<string>(() => journalTodayYmd());
  const [sidebarCalendarMonth, setSidebarCalendarMonth] = useState<{ year: number; month: number }>(() => {
    const { y, m } = parseYmdLocal(journalTodayYmd());
    return { year: y, month: m };
  });
  const [clients, setClients] = useState<Client[]>(() => {
    if (typeof window === "undefined") return MOCK_JOURNAL_CLIENTS;
    try {
      const raw = window.sessionStorage.getItem(JOURNAL_CLIENTS_PERSIST_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return mergeJournalClientLists(parsed as Client[], MOCK_JOURNAL_CLIENTS);
        }
      }
    } catch {
      // fall through to mock list
    }
    return MOCK_JOURNAL_CLIENTS;
  });

  useEffect(() => {
    if (!isJournalRemoteEnabled()) return;
    let cancelled = false;
    async function loadJournalRowsFromSupabase() {
      try {
        const data = await listJournalStorageRows();
        if (!cancelled && Array.isArray(data)) {
          const hydratedRows = data.map((item) => mapStorageJournalRowToUi(item as JournalStorageRow));
          setJournalRows(hydratedRows);
        }
      } catch (error) {
        console.warn("Failed to load journal bookings from Supabase, fallback to session rows.", error);
      } finally {
        if (!cancelled) {
          setJournalRowsRemoteSettled(true);
        }
      }
    }
    void loadJournalRowsFromSupabase();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!isClientsRemoteEnabled()) return;
    let cancelled = false;
    async function loadJournalClientsFromApi() {
      try {
        const rows = await listClientsStorageRows();
        if (!cancelled) {
          setClients((prev) => mergeApiClientsIntoJournalClients(prev, rows));
        }
      } catch (error) {
        console.warn("Failed to load clients for journal from API.", error);
      }
    }
    void loadJournalClientsFromApi();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const snapshot = journalRows.map((row) => ({
      id: row.id,
      clientTitle: row.clientTitle,
      startTime: row.startTime,
      car: row.car,
    }));
    window.sessionStorage.setItem(JOURNAL_ROWS_ACTIVITY_STORAGE_KEY, JSON.stringify(snapshot));
    try {
      window.sessionStorage.setItem(JOURNAL_ROWS_PERSIST_KEY, JSON.stringify(journalRows));
    } catch {
      // ignore storage errors
    }
  }, [journalRows]);
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(JOURNAL_CLIENTS_PERSIST_KEY, JSON.stringify(clients));
    } catch {
      // ignore storage errors
    }
  }, [clients]);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<ModalPrefill | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false);
  const [assignedMastersByDateBox, setAssignedMastersByDateBox] = useState<Record<string, string>>(() => {
    if (typeof window === "undefined") return INITIAL_ASSIGNED_MASTERS_BY_DATE_BOX;
    try {
      const raw = window.sessionStorage.getItem(JOURNAL_ASSIGNED_PERSIST_KEY);
      if (!raw) return INITIAL_ASSIGNED_MASTERS_BY_DATE_BOX;
      const parsed = JSON.parse(raw);
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) return INITIAL_ASSIGNED_MASTERS_BY_DATE_BOX;
      return parsed as Record<string, string>;
    } catch {
      return INITIAL_ASSIGNED_MASTERS_BY_DATE_BOX;
    }
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.sessionStorage.setItem(JOURNAL_ASSIGNED_PERSIST_KEY, JSON.stringify(assignedMastersByDateBox));
    } catch {
      // ignore storage errors
    }
  }, [assignedMastersByDateBox]);
  const [assignModalBoxId, setAssignModalBoxId] = useState<string | null>(null);
  const [assignModalSelectedMasterId, setAssignModalSelectedMasterId] = useState<string | null>(null);
  const [boxHeaderActionsModal, setBoxHeaderActionsModal] = useState<{ boxId: string; boxTitle: string; masterName: string; masterId: string } | null>(null);
  const [employeeProfileModal, setEmployeeProfileModal] = useState<{ masterId: string } | null>(null);
  const [employeeProfileSnapshot, setEmployeeProfileSnapshot] = useState<{ masterId: string } | null>(null);
  const [employeeProfileMounted, setEmployeeProfileMounted] = useState(false);
  const [employeeProfileActive, setEmployeeProfileActive] = useState(false);
  const [employeeProfileTab, setEmployeeProfileTab] = useState<"main" | "kpi" | "orders">("main");
  const [employeeOrdersSection, setEmployeeOrdersSection] = useState<"active" | "recentlyDone">("active");
  const profileExitFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileExitingRef = useRef(false);
  const openProfileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [selectedDate, setSelectedDate] = useState<string>(() => journalTodayYmd());
  const [availableSlots, setAvailableSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [bookingSoonNotice, setBookingSoonNotice] = useState<JournalSoonNotice | null>(null);
  const [bookingSoonPhase, setBookingSoonPhase] = useState<"enter" | "leave">("enter");

  const journalRowsRef = useRef(journalRows);
  journalRowsRef.current = journalRows;
  const firedJournalSoonReminders = useRef(new Set<string>());

  const [currentStep, setCurrentStep] = useState<WizardStep>(1);
  const [skippedSlotStep, setSkippedSlotStep] = useState(false);

  const [step1ClientMode, setStep1ClientMode] = useState<Step1ClientMode>("phone");
  const [callNationalDigits, setCallNationalDigits] = useState("");
  const [linkSurnameQuery, setLinkSurnameQuery] = useState("");
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [newClientName, setNewClientName] = useState("");
  const [newClientPhoneDigits, setNewClientPhoneDigits] = useState("");
  const [newClientCar, setNewClientCar] = useState("");
  const [isRequestBookingFlow, setIsRequestBookingFlow] = useState(false);
  const [requestBookingComment, setRequestBookingComment] = useState("");
  const [requestBookingRequestId, setRequestBookingRequestId] = useState("");
  const requestBookingLaunchKeyRef = useRef<string>("");
  const [bookingCardActionsModal, setBookingCardActionsModal] = useState<BookingCard | null>(null);
  const [bookingStatusPickerForId, setBookingStatusPickerForId] = useState<string | null>(null);
  const [editBookingId, setEditBookingId] = useState<string | null>(null);
  const [editBookingDraft, setEditBookingDraft] = useState<EditBookingDraft | null>(null);
  const [clientPhoneTooltip, setClientPhoneTooltip] = useState<{ text: string; x: number; y: number; maxWidth: number } | null>(null);
  const [missingMasterPrompt, setMissingMasterPrompt] = useState<{ boxId: string; boxTitle: string } | null>(null);

  const callPhoneInputRef = useRef<HTMLInputElement>(null);
  const newClientPhoneInputRef = useRef<HTMLInputElement>(null);

  const displayColumns = useMemo(
    () => rowsToBoxColumns(journalRows, journalViewDate, clients),
    [journalRows, journalViewDate, clients],
  );
  const dayBookingsCount = useMemo(
    () => journalRows.filter((r) => r.startTime.slice(0, 10) === journalViewDate).length,
    [journalRows, journalViewDate],
  );
  const isAllSlotsFreeDay = dayBookingsCount === 0;
  const assignedMasterIdForBoxDate = useCallback(
    (date: string, boxId: string) => assignedMastersByDateBox[assignmentKey(date, boxId)] ?? defaultMasterIdForBox(boxId),
    [assignedMastersByDateBox],
  );
  const availableMastersForViewDate = useMemo(
    () => JOURNAL_MASTERS.filter((master) => isMasterWorkingOnDate(master, journalViewDate)),
    [journalViewDate],
  );
  const assignedMasterIdsForViewDate = useMemo(() => {
    const prefix = `${journalViewDate}|`;
    return new Set(
      Object.entries(assignedMastersByDateBox)
        .filter(([key]) => key.startsWith(prefix))
        .map(([, masterId]) => masterId),
    );
  }, [assignedMastersByDateBox, journalViewDate]);
  const assignModalBoxTitle = assignModalBoxId
    ? (BOX_COLUMN_LAYOUT.find((b) => b.boxId === assignModalBoxId)?.title ?? `Бокс №${assignModalBoxId}`)
    : "";
  const profileMaster = employeeProfileSnapshot
    ? JOURNAL_MASTERS.find((m) => m.id === employeeProfileSnapshot.masterId) ?? null
    : null;
  const profileMasterShortName = profileMaster?.name ?? "";
  const masterActiveOrderItems = useMemo(() => {
    if (!profileMasterShortName) return [];
    const masterNorm = normalizeRuNameForCompare(profileMasterShortName);
    return workOrderRows
      .filter((row) => {
        if (normalizeRuNameForCompare(row.master) !== masterNorm) return false;
        return row.status === "Новый" || row.status === "В работе" || row.status === "Ожидание запчастей";
      })
      .map((row) => ({
        text: `Заказ-наряд №${row.id} · ${row.car}`,
        icon: "/group87.svg",
      }));
  }, [profileMasterShortName]);
  const masterCompletedOrderItems = useMemo(() => {
    if (!profileMasterShortName) return [];
    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    const masterNorm = normalizeRuNameForCompare(profileMasterShortName);
    return workOrderRows
      .filter((row) => {
        if (normalizeRuNameForCompare(row.master) !== masterNorm) return false;
        if (row.status !== "Готово" && row.status !== "Закрыт") return false;
        const acceptedAt = parseRuDate(row.dueDate);
        if (!acceptedAt) return false;
        const diffMs = now.getTime() - acceptedAt.getTime();
        return diffMs >= 0 && diffMs <= sevenDaysMs;
      })
      .map((row) => ({
        text: `Заказ-наряд №${row.id} · ${row.car}`,
        icon: "/group87.svg",
      }));
  }, [profileMasterShortName]);
  const profileMasterFullName = profileMaster?.fullName ?? profileMaster?.name ?? "Мастер";
  const profileMasterPhoto = profileMaster?.photoUrl ?? "https://i.pravatar.cc/80?img=12";
  const profileMasterPhotoLarge = profileMasterPhoto.replace("/80?", "/160?");
  const profileMasterNameParts = profileMasterFullName.split(" ");
  const profileMasterFirstLine = profileMasterNameParts.slice(0, 2).join(" ");
  const profileMasterSecondLine = profileMasterNameParts.slice(2).join(" ");
  const profileMasterMeta = {
    birthDate: "24.02.1992",
    gender: "Мужской",
    citizenship: "Российская Федерация",
    phone: "+7 (911) 123-45-67",
    email: "zhuravlev.m@mars-auto.ru",
    role: "Мастер",
    schedule: "5/2, 8:00 - 20:00",
    status: "В отпуске",
  };
  const employeeKpiCards = [
    { title: "Выручка сотрудника", value: "4 196₽ за месяц", note: "↑ 1f(7%) за неделю" },
    { title: "Выработка (нормо-часы)", value: "76 ч / 160 ч", note: "↑ 6ч за неделю" },
    { title: "Загрузка (%)", value: "48%", note: "↑ +3% за неделю" },
    { title: "Кол-во заказов", value: "16 заказов", note: "↑ 13а неделю" },
    { title: "Средний чек", value: "2 623 ₽", note: "↑ 300 ₽ за неделю" },
    { title: "Зарплата (расчёт)", value: "113 784 ₽", note: "включая доп. продажи 62 966 ₽" },
  ];
  const dayFreeWindowsCount = useMemo(() => {
    const bookings = toBookings(journalRows);
    return BOX_COLUMN_LAYOUT.reduce(
      (acc, col) => acc + getJournalFreeGapsForBoxDay(journalViewDate, col.boxId, bookings).length,
      0,
    );
  }, [journalRows, journalViewDate]);

  useLayoutEffect(() => {
    const bid = searchParams.get("booking");
    if (!bid) {
      bookingFocusResetFor.current = null;
      return;
    }
    const row = journalRows.find((r) => r.id === bid);
    if (!row) {
      if (isJournalRemoteEnabled() && !journalRowsRemoteSettled) {
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("booking");
          return next;
        },
        { replace: true },
      );
      bookingFocusResetFor.current = null;
      return;
    }
    if (bookingFocusResetFor.current !== bid) {
      bookingFocusResetFor.current = bid;
      setJournalSearchQuery("");
    }
    const day = row.startTime.slice(0, 10);
    if (journalViewDate !== day) {
      setJournalViewDate(day);
      setSelectedDate(day);
      const { y, m } = parseYmdLocal(day);
      setSidebarCalendarMonth({ year: y, month: m });
    }
  }, [searchParams, journalRows, journalViewDate, journalRowsRemoteSettled, setSearchParams]);

  useLayoutEffect(() => {
    const bid = searchParams.get("booking");
    if (!bid) {
      bookingScrollKey.current = "";
      return;
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(BOOKING_LIST_FLASH_ARMED_KEY);
    }
    const row = journalRows.find((r) => r.id === bid);
    if (!row) {
      if (isJournalRemoteEnabled() && !journalRowsRemoteSettled) {
        return;
      }
      return;
    }
    const day = row.startTime.slice(0, 10);
    if (journalViewDate !== day) return;
    const sk = `${bid}@${day}`;
    if (bookingScrollKey.current === sk) return;
    bookingScrollKey.current = sk;
    setFlashBookingId(bid);
    setFlashBookingDay(day);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("booking");
        return next;
      },
      { replace: true },
    );
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        bookingArticleRefs.current[bid]?.scrollIntoView({
          behavior: "smooth",
          block: "center",
          inline: "nearest",
        });
      });
    });
    const tid = window.setTimeout(() => {
      bookingScrollKey.current = "";
      bookingFocusResetFor.current = null;
    }, 1200);
    const clearFlashTid = window.setTimeout(() => {
      setFlashBookingId((prev) => (prev === bid ? null : prev));
      setFlashBookingDay((prev) => (prev === day ? null : prev));
    }, 4200);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(tid);
      window.clearTimeout(clearFlashTid);
    };
  }, [searchParams, journalRows, journalViewDate, journalRowsRemoteSettled, setSearchParams]);

  useEffect(() => {
    if (!flashBookingId || !flashBookingDay) return;
    if (journalViewDate !== flashBookingDay) {
      setFlashBookingId(null);
      setFlashBookingDay(null);
    }
  }, [journalViewDate, flashBookingId, flashBookingDay]);

  const sidebarCalendarCells = useMemo(
    () => buildSidebarCalendarCells(sidebarCalendarMonth.year, sidebarCalendarMonth.month),
    [sidebarCalendarMonth.year, sidebarCalendarMonth.month],
  );
  const matchedByPhone = useMemo(
    () => findClientsByNationalPhone(clients, callNationalDigits),
    [clients, callNationalDigits],
  );
  const matchedBySurname = useMemo(
    () => findClientsBySurname(clients, linkSurnameQuery),
    [clients, linkSurnameQuery],
  );
  const phoneCompleteNoMatch =
    callNationalDigits.length === 10 && matchedByPhone.length === 0 && step1ClientMode === "phone";

  const step1Complete = useMemo(() => {
    if (step1ClientMode === "phone") {
      return matchedByPhone.length > 0 && selectedClient !== null && selectedCar !== null;
    }
    if (step1ClientMode === "link_surname") {
      return selectedClient !== null && selectedCar !== null;
    }
    return Boolean(
      newClientName.trim() && newClientPhoneDigits.length === 10 && newClientCar.trim(),
    );
  }, [
    step1ClientMode,
    matchedByPhone.length,
    selectedClient,
    selectedCar,
    newClientName,
    newClientPhoneDigits,
    newClientCar,
  ]);
  const prefillMaxDurationMin = modalPrefill
    ? Math.max(0, modalPrefill.gapEndMinute - hhmmToMinutes(modalPrefill.startIso.slice(11, 16)))
    : null;
  const step2BaseServices = modalPrefill?.boxId === TIRE_BOX_ID
    ? JOURNAL_SERVICES.filter((s) => TIRE_SERVICE_IDS.has(s.id))
    : modalPrefill
      ? JOURNAL_SERVICES.filter((s) => GENERAL_SERVICE_IDS.has(s.id))
      : JOURNAL_SERVICES;
  const step2DurationScopedServices = prefillMaxDurationMin === null
    ? step2BaseServices
    : step2BaseServices.filter((s) => s.duration <= prefillMaxDurationMin);
  const step2ScopedServices = (modalPrefill?.boxId === TIRE_BOX_ID
    ? step2DurationScopedServices.filter((s) => TIRE_SERVICE_IDS.has(s.id))
    : step2DurationScopedServices);

  useEffect(() => {
    const id = window.setInterval(() => setHeaderClock(formatHeaderClockNow()), 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (employeeProfileModal) setEmployeeProfileSnapshot(employeeProfileModal);
  }, [employeeProfileModal]);

  useEffect(() => {
    if (employeeProfileModal) {
      profileExitingRef.current = false;
      if (profileExitFallbackRef.current) {
        clearTimeout(profileExitFallbackRef.current);
        profileExitFallbackRef.current = null;
      }
      setEmployeeProfileActive(false);
      setEmployeeProfileMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEmployeeProfileActive(true));
      });
      return () => cancelAnimationFrame(id);
    }
    profileExitingRef.current = true;
    setEmployeeProfileActive(false);
  }, [employeeProfileModal]);

  function finishProfileExit() {
    setEmployeeProfileMounted(false);
    setEmployeeProfileSnapshot(null);
    if (profileExitFallbackRef.current) {
      clearTimeout(profileExitFallbackRef.current);
      profileExitFallbackRef.current = null;
    }
  }

  function handleProfileDrawerTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    if (e.target !== e.currentTarget) return;
    if (profileExitingRef.current) {
      profileExitingRef.current = false;
      finishProfileExit();
    }
  }

  useEffect(() => {
    if (!employeeProfileModal && employeeProfileMounted) {
      profileExitFallbackRef.current = setTimeout(finishProfileExit, 700);
      return () => {
        if (profileExitFallbackRef.current) {
          clearTimeout(profileExitFallbackRef.current);
          profileExitFallbackRef.current = null;
        }
      };
    }
  }, [employeeProfileModal, employeeProfileMounted]);

  useEffect(() => {
    if (!bookingSoonNotice) return;
    setBookingSoonPhase("enter");
    const leaveTimer = window.setTimeout(() => setBookingSoonPhase("leave"), 1900);
    const clearTimer = window.setTimeout(() => setBookingSoonNotice(null), 2350);
    return () => {
      window.clearTimeout(leaveTimer);
      window.clearTimeout(clearTimer);
    };
  }, [bookingSoonNotice]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const raw = window.sessionStorage.getItem(JOURNAL_SOON_REMINDER_DEDUPE_STORAGE_KEY);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as string[];
      if (!Array.isArray(parsed)) return;
      firedJournalSoonReminders.current = new Set(parsed.filter((v): v is string => typeof v === "string"));
    } catch {
      firedJournalSoonReminders.current = new Set();
    }
  }, []);

  useEffect(() => {
    const REMINDER_LEAD_MS = 30 * 60 * 1000;
    const TICK_MS = 15_000;

    function checkUpcomingBookings() {
      const now = Date.now();
      for (const r of journalRowsRef.current) {
        if (r.status && JOURNAL_NO_REMINDER_STATUSES.has(r.status)) continue;
        const startMs = new Date(r.startTime).getTime();
        if (!Number.isFinite(startMs)) continue;
        if (now >= startMs) continue;
        const remindFrom = startMs - REMINDER_LEAD_MS;
        if (now < remindFrom) continue;
        const dedupeKey = `soon:${r.id}:${r.startTime}`;
        if (firedJournalSoonReminders.current.has(dedupeKey)) continue;
        firedJournalSoonReminders.current.add(dedupeKey);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(
            JOURNAL_SOON_REMINDER_DEDUPE_STORAGE_KEY,
            JSON.stringify(Array.from(firedJournalSoonReminders.current)),
          );
        }
        const hhmm = r.startTime.slice(11, 16);
        const line1 = "Скоро запись";
        const line2 = `за 30 мин до ${hhmm} · ${r.clientTitle} · ${r.service} · ${r.car}`;
        setBookingSoonNotice({ line1, line2 });
        appendJournalBookingSoonToFeed({
          bookingId: r.id,
          startHHmm: hhmm,
          clientTitle: r.clientTitle,
          service: r.service,
          car: r.car,
        });
      }
    }

    checkUpcomingBookings();
    const intervalId = window.setInterval(checkUpcomingBookings, TICK_MS);
    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    const { y, m } = parseYmdLocal(journalViewDate);
    setSidebarCalendarMonth({ year: y, month: m });
  }, [journalViewDate]);

  useEffect(() => {
    if (currentStep !== 1 || step1ClientMode !== "phone") return;
    setSelectedClient(null);
    setSelectedCar(null);
  }, [callNationalDigits, currentStep, step1ClientMode]);

  useEffect(() => {
    if (currentStep !== 1 || step1ClientMode !== "link_surname") return;
    setSelectedClient(null);
    setSelectedCar(null);
  }, [linkSurnameQuery, currentStep, step1ClientMode]);

  useEffect(() => {
    if (!isNewBookingModalOpen || currentStep !== 1) return;
    const id = requestAnimationFrame(() => {
      if (step1ClientMode === "phone") callPhoneInputRef.current?.focus({ preventScroll: true });
      else if (step1ClientMode === "new_form") newClientPhoneInputRef.current?.focus({ preventScroll: true });
    });
    return () => cancelAnimationFrame(id);
  }, [isNewBookingModalOpen, currentStep, step1ClientMode]);

  useEffect(() => {
    if (currentStep !== 2) setIsServiceMenuOpen(false);
  }, [currentStep]);

  useEffect(() => {
    if (!selectedService) return;
    if (step2ScopedServices.some((s) => s.id === selectedService.id)) return;
    setSelectedService(null);
  }, [selectedService, step2ScopedServices]);

  function wizardNextFromStep1() {
    if (!step1Complete) {
      if (step1ClientMode === "phone") {
        if (callNationalDigits.length < 10) setConfirmError("Введите полный номер телефона (10 цифр).");
        else if (matchedByPhone.length > 0) setConfirmError("Выберите автомобиль.");
        else setConfirmError("Номер не найден. Выберите действие ниже.");
      } else if (step1ClientMode === "link_surname") {
        setConfirmError("Выберите клиента и автомобиль из списка.");
      } else {
        setConfirmError("Заполните имя, телефон и автомобиль.");
      }
      return;
    }
    setConfirmError(null);
    setCurrentStep(2);
  }

  function wizardNextFromStep2() {
    if (!selectedService || !selectedDate) {
      setConfirmError("Выберите тип обращения и дату.");
      return;
    }
    if (step2ScopedServices.length === 0) {
      setConfirmError("Сейчас нет доступных типов обращения.");
      return;
    }
    if (prefillMaxDurationMin !== null && selectedService.duration > prefillMaxDurationMin) {
      setConfirmError(`Для этого свободного окна доступны услуги до ${prefillMaxDurationMin} мин.`);
      return;
    }
    const bookingsSlice = toBookings(journalRows);
    const all = getAvailableSlots({
      date: selectedDate,
      serviceDuration: selectedService.duration,
      boxes: JOURNAL_BOXES,
      masters: JOURNAL_MASTERS,
      bookings: bookingsSlice,
      assignedMasterByBox: Object.fromEntries(
        BOX_COLUMN_LAYOUT.map((col) => [col.boxId, assignedMasterIdForBoxDate(selectedDate, col.boxId)]),
      ),
    });
    const slotsInsideVisibleWindows = all
      .filter((slot) => slotFitsVisibleFreeWindow(selectedDate, slot, bookingsSlice))
      .filter((slot) => {
        if (!modalPrefill) {
          if (TIRE_ONLY_SERVICE_NAMES.has(selectedService.name)) return slot.boxId === TIRE_BOX_ID;
          return slot.boxId !== TIRE_BOX_ID;
        }
        if (TIRE_SERVICE_IDS.has(selectedService.id)) return slot.boxId === TIRE_BOX_ID;
        if (GENERAL_SERVICE_IDS.has(selectedService.id)) return slot.boxId !== TIRE_BOX_ID;
        return true;
      });
    const scopedSlots = filterSlotsByPrefillWindow(slotsInsideVisibleWindows, modalPrefill);
    setAvailableSlots(scopedSlots);
    setConfirmError(null);

    if (modalPrefill) {
      const startMin = hhmmToMinutes(modalPrefill.startIso.slice(11, 16));
      const preferred = tryBuildPreferredSlot({
        date: selectedDate,
        boxId: modalPrefill.boxId,
        startMinute: startMin,
        durationMin: selectedService.duration,
        gapEndMinute: modalPrefill.gapEndMinute,
        defaultMasterId: assignedMasterIdForBoxDate(selectedDate, modalPrefill.boxId),
        bookings: bookingsSlice,
      });
      const slot = preferred ?? findNearestSlotByTime(modalPrefill.startIso, scopedSlots);
      setSelectedSlot(slot);
    } else {
      setSelectedSlot(null);
    }
    setSkippedSlotStep(false);
    setCurrentStep(3);
  }

  function wizardNextFromStep3() {
    if (!selectedSlot) {
      setConfirmError("Выберите слот.");
      return;
    }
    if (!availableSlots.some((s) => slotKey(s) === slotKey(selectedSlot))) {
      setConfirmError("Выбранный слот недоступен. Выберите другой.");
      return;
    }
    setConfirmError(null);
    setCurrentStep(4);
  }

  function resetClientFields() {
    setStep1ClientMode("phone");
    setCallNationalDigits("");
    setLinkSurnameQuery("");
    setSelectedClient(null);
    setSelectedCar(null);
    setNewClientName("");
    setNewClientPhoneDigits("");
    setNewClientCar("");
  }

  function openNewBookingModal(prefill: HoverFreeHint | ModalPrefill | null = null) {
    setCurrentStep(1);
    setSkippedSlotStep(false);
    setSelectedService(null);
    setIsServiceMenuOpen(false);
    setSelectedDate(prefill?.startIso.slice(0, 10) ?? journalViewDate);
    setSelectedSlot(null);
    setAvailableSlots([]);
    setConfirmError(null);
    resetClientFields();
    setModalPrefill(prefill ? { boxId: prefill.boxId, startIso: prefill.startIso, gapEndMinute: prefill.gapEndMinute } : null);
    setIsNewBookingModalOpen(true);
  }

  function tryOpenNewBookingModal(prefill: HoverFreeHint | ModalPrefill | null = null): boolean {
    const boxId = prefill?.boxId ?? null;
    if (boxId) {
      const assignedKey = assignmentKey(journalViewDate, boxId);
      if (!assignedMastersByDateBox[assignedKey]) {
        const boxTitle = BOX_COLUMN_LAYOUT.find((b) => b.boxId === boxId)?.title ?? `Бокс №${boxId}`;
        setMissingMasterPrompt({ boxId, boxTitle });
        return false;
      }
    }
    openNewBookingModal(prefill);
    return true;
  }

  function closeNewBookingModal() {
    setIsNewBookingModalOpen(false);
    setIsRequestBookingFlow(false);
    setRequestBookingComment("");
    setRequestBookingRequestId("");
    setCurrentStep(1);
    setSkippedSlotStep(false);
    setModalPrefill(null);
    setSelectedService(null);
    setIsServiceMenuOpen(false);
    setSelectedDate(journalViewDate);
    setSelectedSlot(null);
    setAvailableSlots([]);
    setConfirmError(null);
    resetClientFields();
  }

  function wizardBack() {
    setConfirmError(null);
    if (currentStep === 1) {
      if (step1ClientMode === "link_surname") {
        setStep1ClientMode("phone");
        setLinkSurnameQuery("");
        setSelectedClient(null);
        setSelectedCar(null);
        return;
      }
      if (step1ClientMode === "new_form") {
        setStep1ClientMode("phone");
        setNewClientName("");
        setNewClientCar("");
        setSelectedClient(null);
        setSelectedCar(null);
        return;
      }
      return;
    }
    if (currentStep === 4) {
      setCurrentStep(skippedSlotStep ? 2 : 3);
      return;
    }
    if (currentStep === 3) {
      setCurrentStep(2);
      return;
    }
    if (currentStep === 2) {
      if (isRequestBookingFlow) {
        closeNewBookingModal();
        return;
      }
      setCurrentStep(1);
    }
  }

  useEffect(() => {
    if (searchParams.get("newBookingFromRequest") !== "1") {
      requestBookingLaunchKeyRef.current = "";
      return;
    }
    const client = (searchParams.get("client") ?? "").trim();
    const phone = searchParams.get("phone") ?? "";
    const comment = (searchParams.get("comment") ?? "").trim();
    const requestId = (searchParams.get("requestId") ?? "").trim();
    const launchKey = `${requestId}|${client}|${phone}`;
    if (!client || requestBookingLaunchKeyRef.current === launchKey) return;
    requestBookingLaunchKeyRef.current = launchKey;

    openNewBookingModal(null);
    setIsRequestBookingFlow(true);
    setRequestBookingRequestId(requestId);
    setStep1ClientMode("new_form");
    setNewClientName(client);
    setNewClientPhoneDigits(national10FromPhoneInput(phone));
    setRequestBookingComment(comment);
    setSelectedClient(null);
    setSelectedCar(null);
    setCurrentStep(2);

    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("newBookingFromRequest");
        next.delete("requestId");
        next.delete("client");
        next.delete("phone");
        next.delete("comment");
        return next;
      },
      { replace: true },
    );
  }, [searchParams, setSearchParams]);

  function clickTimelineEmpty(e: MouseEvent, boxId: string, cards: BookingCard[]) {
    const t = e.target as HTMLElement;
    if (t.closest("article") || t.closest("button")) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const localY = e.clientY - rect.top;
    if (isLocalYInsideAnyCard(localY, cards)) return;
    const assignedKey = assignmentKey(journalViewDate, boxId);
    if (!assignedMastersByDateBox[assignedKey]) {
      const boxTitle = BOX_COLUMN_LAYOUT.find((b) => b.boxId === boxId)?.title ?? `Бокс №${boxId}`;
      setMissingMasterPrompt({ boxId, boxTitle });
      return;
    }
    const row = timelineLocalYToRowIndex(localY, 40, timeSlots.length - 1);
    const startHHmm = timeSlots[row];
    if (!startHHmm) return;
    const proposedMin = hhmmToMinutes(startHHmm);
    const startMin = snapTimelineClickStartMinute(journalViewDate, boxId, proposedMin, toBookings(journalRows));
    const rawGapEnd = getFreeWindowEndMinute(journalViewDate, boxId, startMin, toBookings(journalRows));
    const gapEnd = rawGapEnd >= JOURNAL_WORK_END_MIN ? JOURNAL_GRID_LAST_SLOT_START_MIN : rawGapEnd;
    if (gapEnd <= startMin) return;
    if (gapEnd - startMin < JOURNAL_MIN_SERVICE_DURATION_MIN) return;
    const startLabel = toTimeLabel(startMin);
    tryOpenNewBookingModal({ boxId, startIso: `${journalViewDate}T${startLabel}:00`, gapEndMinute: gapEnd });
  }

  async function confirmNewBooking() {
    if (currentStep !== 4 || !selectedService || !selectedSlot) return;

    let clientTitle = "";
    let clientPhone = "";
    let carLine = "";

    if (selectedClient && selectedCar) {
      clientTitle = selectedClient.name;
      clientPhone = selectedClient.phone;
      carLine = formatCarLine(selectedCar.model, selectedCar.plate);
    } else if (
      newClientName.trim() &&
      newClientPhoneDigits.length === 10 &&
      (newClientCar.trim() || isRequestBookingFlow)
    ) {
      const n = newClientName.trim();
      const ph = displayRuPhoneComplete(newClientPhoneDigits);
      const cm = newClientCar.trim() || "—";
      if (!n || !ph || (!newClientCar.trim() && !isRequestBookingFlow)) {
        setConfirmError("Заполните имя, телефон и автомобиль.");
        return;
      }
      const cid =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `jc-${Date.now()}`;
      const carid =
        typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `car-${Date.now()}`;
      const newClient: Client = {
        id: cid,
        name: n,
        phone: ph,
        cars: [{ id: carid, model: cm, plate: "" }],
      };
      setClients((prev) => [...prev, newClient]);
      clientTitle = n;
      clientPhone = ph;
      carLine = formatCarLine(cm, "");
    } else {
      setConfirmError("Заполните данные клиента на шаге 1.");
      return;
    }

    const listed = availableSlots.some((s) => slotKey(s) === slotKey(selectedSlot));
    if (!listed || !isSlotStillFree(selectedSlot, toBookings(journalRows))) {
      setConfirmError("Этот слот уже занят. Выберите другой или смените услугу.");
      return;
    }
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `b-${Date.now()}`;
    const row: JournalRow = {
      id,
      boxId: selectedSlot.boxId,
      masterId: selectedSlot.masterId,
      startTime: selectedSlot.startTime,
      endTime: selectedSlot.endTime,
      clientTitle,
      clientPhone,
      service: selectedService.name,
      car: carLine,
      status: "Подтверждена",
      statusActor: "manager",
    };
    const timeRange = `${selectedSlot.startTime.slice(11, 16)} — ${selectedSlot.endTime.slice(11, 16)}`;
    appendUserActionLog({
      title: "Создал запись в Журнале записей",
      description: `№ ${id} · ${clientTitle} · ${timeRange} · ${selectedService.name}`,
    });

    if (isJournalRemoteEnabled()) {
      try {
        const payload: JournalStorageRow = {
          id: row.id,
          box_id: row.boxId,
          master_id: row.masterId,
          start_time: row.startTime,
          end_time: row.endTime,
          client_title: row.clientTitle,
          client_phone: row.clientPhone ?? "",
          service: row.service,
          car: row.car,
          status: row.status ?? "Подтверждена",
          status_actor: row.statusActor ?? "manager",
        };
        const data = await insertJournalStorageRow(payload);
        if (data) {
          setJournalRows((prev) => [...prev, mapStorageJournalRowToUi(data as JournalStorageRow)]);
        } else {
          setJournalRows((prev) => [...prev, row]);
        }
      } catch (error) {
        console.warn("Failed to create booking in remote storage, keep local create.", error);
        setJournalRows((prev) => [...prev, row]);
      }
    } else {
      setJournalRows((prev) => [...prev, row]);
    }

    if (isRequestBookingFlow && requestBookingRequestId) {
      try {
        await markRequestAsBooked(requestBookingRequestId);
        appendUserActionLog({
          title: "Заявка перенесена в запись",
          description: `№ ${requestBookingRequestId} · ${clientTitle}`,
        });
      } catch (error) {
        console.warn("Failed to update request status after booking.", error);
      }
    }

    emitArchiveStyleToast({
      line1: `Запись ${clientTitle}`,
      line2: "добавлена в журнал записей",
      navigateTo: `/journal?booking=${encodeURIComponent(id)}`,
    });
    closeNewBookingModal();
  }

  const boxName = selectedSlot ? JOURNAL_BOXES.find((b) => b.id === selectedSlot.boxId)?.name ?? "" : "";
  const masterName = selectedSlot ? JOURNAL_MASTERS.find((m) => m.id === selectedSlot.masterId)?.name ?? "" : "";
  const timeLabel = selectedSlot ? `${selectedSlot.startTime.slice(11, 16)} — ${selectedSlot.endTime.slice(11, 16)}` : "";
  const stepSlots = availableSlots;
  const bookingStatusPickerRow = bookingStatusPickerForId
    ? journalRows.find((r) => r.id === bookingStatusPickerForId) ?? null
    : null;

  const stepLabels = ["Идентификация", "Тип обращения", "Время", "Подтверждение"] as const;

  const bookingCardModalActions: Array<{
    id: BookingCardActionId;
    label: string;
    Icon: ({ className }: { className?: string }) => JSX.Element;
    danger?: boolean;
  }> = [
    { id: "moveToWorkOrder", label: "Переместить в заказ-наряд", Icon: RequestActionIconGetJob },
    { id: "status", label: "Изменить статус", Icon: RequestActionIconStatus },
    { id: "edit", label: "Редактировать", Icon: RequestActionIconEdit },
    { id: "delete", label: "Удалить запись", Icon: RequestActionIconTrash, danger: true },
  ];

  async function handleBookingCardAction(actionId: BookingCardActionId) {
    if (!bookingCardActionsModal) return;
    if (actionId === "moveToWorkOrder") {
      const row = journalRows.find((r) => r.id === bookingCardActionsModal.id);
      const client = row?.clientTitle?.trim() || bookingCardActionsModal.title.trim() || "";
      const matchedClient = findClientByJournalTitle(clients, client);
      const phone = row?.clientPhone?.trim() || matchedClient?.phone?.trim() || "";
      const car = (row ? carTitleOnly(row.car) : "").trim() || carTitleOnly(bookingCardActionsModal.car).trim() || "";
      const plate = row?.car.split(/\s{2,}/)[1]?.trim() ?? "";
      const transferToken = `${Date.now()}-${bookingCardActionsModal.id}`;
      if (typeof window !== "undefined") {
        window.sessionStorage.setItem(
          TRANSFER_TO_WORK_ORDER_DRAFT_KEY,
          JSON.stringify({ client, phone, car, plate, token: transferToken }),
        );
      }
      setBookingCardActionsModal(null);
      navigate(
        `/work-orders?newWorkOrderFromBooking=1&transferToken=${encodeURIComponent(transferToken)}&client=${encodeURIComponent(client)}&phone=${encodeURIComponent(phone)}&car=${encodeURIComponent(car)}&plate=${encodeURIComponent(plate)}`,
        {
          state: { transferToWorkOrder: { client, phone, car, plate, token: transferToken } },
        },
      );
      return;
    }
    if (actionId === "status") {
      setBookingStatusPickerForId(bookingCardActionsModal.id);
      setBookingCardActionsModal(null);
      return;
    }
    if (actionId === "edit") {
      const row = journalRows.find((r) => r.id === bookingCardActionsModal.id);
      if (!row) {
        setBookingCardActionsModal(null);
        return;
      }
      setEditBookingId(row.id);
      setEditBookingDraft({
        clientTitle: row.clientTitle,
        car: carTitleOnly(row.car),
      });
      setBookingCardActionsModal(null);
      return;
    }
    if (actionId === "delete") {
      const removed = bookingCardActionsModal;
      if (isJournalRemoteEnabled()) {
        try {
          await deleteJournalStorageRow(removed.id);
        } catch (error) {
          console.warn("Failed to delete journal booking in remote storage.", error);
          emitArchiveStyleToast({
            line1: "Не удалось удалить запись",
            line2: "Проверьте подключение к базе и policy update/delete",
          });
          setBookingCardActionsModal(null);
          return;
        }
      }
      setJournalRows((prev) => prev.filter((row) => row.id !== removed.id));
      setBookingCardActionsModal(null);
      emitArchiveStyleToast({
        line1: `Запись ${removed.title}`,
        line2: "удалена из журнала записей",
      });
      return;
    }
    setBookingCardActionsModal(null);
  }

  async function commitBookingStatus(status: BookingStatus) {
    if (!bookingStatusPickerForId) return;
    const targetId = bookingStatusPickerForId;
    if (isJournalRemoteEnabled()) {
      try {
        await updateJournalStorageRows([targetId], { status, status_actor: "manager" as const });
      } catch (error) {
        console.warn("Failed to update journal booking status in remote storage.", error);
        emitArchiveStyleToast({
          line1: "Не удалось изменить статус",
          line2: "Проверьте подключение к базе и policy update",
        });
        setBookingStatusPickerForId(null);
        return;
      }
    }
    setJournalRows((prev) =>
      prev.map((row) =>
        row.id === targetId
          ? { ...row, status, statusActor: "manager" as const }
          : row,
      ),
    );
    setBookingStatusPickerForId(null);
  }

  async function commitBookingEdit() {
    if (!editBookingId || !editBookingDraft) return;
    const targetId = editBookingId;
    const normalizedClient = editBookingDraft.clientTitle.trim();
    const normalizedCar = editBookingDraft.car.trim();
    if (!normalizedClient || !normalizedCar) return;
    if (isJournalRemoteEnabled()) {
      try {
        await updateJournalStorageRows([targetId], {
          client_title: normalizedClient,
          car: normalizedCar,
        });
      } catch (error) {
        console.warn("Failed to edit journal booking in remote storage.", error);
        emitArchiveStyleToast({
          line1: "Не удалось сохранить изменения",
          line2: "Проверьте подключение к базе и policy update",
        });
        setEditBookingId(null);
        setEditBookingDraft(null);
        return;
      }
    }
    setJournalRows((prev) =>
      prev.map((row) =>
        row.id === targetId
          ? {
              ...row,
              clientTitle: normalizedClient,
              car: normalizedCar,
            }
          : row,
      ),
    );
    setEditBookingId(null);
    setEditBookingDraft(null);
  }

  function handleBoxHeaderAction(actionId: BoxHeaderActionId) {
    if (!boxHeaderActionsModal) return;
    if (actionId === "callMaster") {
      const phoneByMasterId: Record<string, string> = {
        m1: "+7 (911) 123-45-67",
        m2: "+7 (911) 166-77-88",
        m3: "+7 (911) 101-20-30",
        m4: "+7 (911) 111-22-33",
      };
      const phone = phoneByMasterId[boxHeaderActionsModal.masterId] ?? "+7 (911) 123-45-67";
      const callLink = document.createElement("a");
      callLink.href = toTelHref(phone);
      document.body.appendChild(callLink);
      callLink.click();
      document.body.removeChild(callLink);
      setBoxHeaderActionsModal(null);
      return;
    }
    if (actionId === "changeMaster") {
      setAssignModalBoxId(boxHeaderActionsModal.boxId);
      setAssignModalSelectedMasterId(boxHeaderActionsModal.masterId);
      setBoxHeaderActionsModal(null);
      return;
    }
    if (actionId === "removeMaster") {
      setAssignedMastersByDateBox((prev) => {
        const key = assignmentKey(journalViewDate, boxHeaderActionsModal.boxId);
        if (!(key in prev)) return prev;
        const next = { ...prev };
        delete next[key];
        return next;
      });
      setBoxHeaderActionsModal(null);
    }
  }

  function navigateToWorkOrderFromCard(text: string) {
    const workOrderId = extractWorkOrderIdFromCardText(text);
    if (!workOrderId) return;
    if (typeof window !== "undefined") {
      window.sessionStorage.setItem(WORK_ORDER_LIST_FLASH_ARMED_KEY, workOrderId);
    }
    navigate(`/work-orders?workOrder=${workOrderId}`);
  }

  return (
    <div className="h-screen w-screen overflow-hidden tracking-[-0.04em] bg-black max-lg:min-h-screen max-lg:h-auto max-lg:overflow-y-auto lg:h-screen lg:overflow-hidden">
      <div className="flex h-full min-h-0 w-full p-2 max-lg:h-auto lg:h-full">
        <div className="flex h-full min-h-0 w-full max-lg:h-auto max-lg:flex-col rounded-[16px] bg-black p-2 shadow-none lg:flex-row lg:shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)]">
          <MarsAppShellSidebar mobileLayout="requests" />

          <main className="relative flex min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden">
            <header className="mb-2 rounded-[16px] border border-[#DDE1E7] bg-white px-4 py-4 lg:px-5 lg:py-5">
              <div className="flex flex-col gap-4 lg:hidden">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-x-6 sm:gap-y-2">
                  <h1 className="shrink-0 text-[28px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">Журнал записей</h1>
                  <div className="flex items-center justify-center gap-[20px] sm:justify-start">
                    <button
                      type="button"
                      aria-label="Предыдущий день"
                      onClick={() => setJournalViewDate((d) => addCalendarDays(d, -1))}
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-0 text-[28px] font-bold leading-none tracking-[-0.02em] text-black transition-colors hover:bg-black/5"
                    >
                      ‹
                    </button>
                    <span
                      className="inline-flex shrink-0 items-center justify-center whitespace-nowrap text-center text-[20px] font-bold leading-none tracking-[-0.04em] text-[#F31624]"
                      title={formatJournalDayTitleRu(journalViewDate)}
                    >
                      {formatJournalDayTitleRu(journalViewDate)}
                    </span>
                    <button
                      type="button"
                      aria-label="Следующий день"
                      onClick={() => setJournalViewDate((d) => addCalendarDays(d, 1))}
                      className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-0 text-[28px] font-bold leading-none tracking-[-0.02em] text-black transition-colors hover:bg-black/5"
                    >
                      ›
                    </button>
                  </div>
                  <span
                    className="shrink-0 text-center text-[20px] font-bold leading-none tracking-[-0.04em] text-black tabular-nums sm:text-left"
                    aria-live="polite"
                    aria-atomic
                  >
                    {headerClock}
                  </span>
                </div>
                <div className="flex w-full min-w-0 flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center">
                  <input
                    type="search"
                    value={journalSearchQuery}
                    onChange={(e) => setJournalSearchQuery(e.target.value)}
                    className="journal-header-search h-12 w-full min-w-0 rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5] [color-scheme:light] sm:min-w-[200px] sm:flex-1"
                    placeholder="Найти заявку..."
                    aria-label="Найти заявку"
                  />
                  <button
                    type="button"
                    onClick={() => openNewBookingModal(null)}
                    className="h-12 min-h-[48px] w-full shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white sm:w-auto"
                  >
                    Новая запись
                  </button>
                </div>
              </div>

              <div className="hidden min-w-0 w-full max-w-full items-center gap-3 lg:flex">
                <h1 className="shrink-0 text-[28px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826] lg:text-[36px]">Журнал записей</h1>
                <div className="ml-6 flex shrink-0 items-center justify-center gap-[20px]">
                  <button
                    type="button"
                    aria-label="Предыдущий день"
                    onClick={() => setJournalViewDate((d) => addCalendarDays(d, -1))}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-0 text-[28px] font-bold leading-none tracking-[-0.02em] text-black transition-colors hover:bg-black/5"
                  >
                    ‹
                  </button>
                  <span
                    className="inline-flex shrink-0 items-center justify-center whitespace-nowrap text-center text-[20px] font-bold leading-none tracking-[-0.04em] text-[#F31624]"
                    title={formatJournalDayTitleRu(journalViewDate)}
                  >
                    {formatJournalDayTitleRu(journalViewDate)}
                  </span>
                  <button
                    type="button"
                    aria-label="Следующий день"
                    onClick={() => setJournalViewDate((d) => addCalendarDays(d, 1))}
                    className="inline-flex h-12 w-12 shrink-0 items-center justify-center rounded-full p-0 text-[28px] font-bold leading-none tracking-[-0.02em] text-black transition-colors hover:bg-black/5"
                  >
                    ›
                  </button>
                </div>
                <span
                  className="ml-4 shrink-0 text-[20px] font-bold leading-none tracking-[-0.04em] text-black tabular-nums"
                  aria-live="polite"
                  aria-atomic
                >
                  {headerClock}
                </span>
                <div className="ml-auto flex min-w-0 shrink items-center gap-1.5">
                  <input
                    type="search"
                    value={journalSearchQuery}
                    onChange={(e) => setJournalSearchQuery(e.target.value)}
                    className="journal-header-search box-border h-12 w-[320px] max-w-full min-w-[10rem] shrink rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5] [color-scheme:light]"
                    placeholder="Найти заявку..."
                    aria-label="Найти заявку"
                  />
                  <button
                    type="button"
                    onClick={() => openNewBookingModal(null)}
                    className="h-12 shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white"
                  >
                    Новая запись
                  </button>
                </div>
              </div>
            </header>

            <section className="relative flex min-h-0 min-w-0 flex-1 flex-col gap-4 rounded-[16px] bg-white px-4 py-4 lg:min-h-0 lg:px-5 lg:py-5 lg:flex-row lg:gap-4">
        <section className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:min-h-[min(480px,55vh)] lg:h-full lg:min-h-0">
        <div className="journal-table-scroll h-full min-h-0 min-w-0 flex-1 overflow-auto">
          <div
            className="relative grid min-h-full min-w-[1090px] grid-cols-[72px_1fr] overflow-hidden rounded-[12px] border border-[#ECEEF1]"
            onMouseLeave={() => setHoverLineY(null)}
            onMouseMove={(event) => {
              const rect = event.currentTarget.getBoundingClientRect();
              const x = event.clientX - rect.left;
              const y = event.clientY - rect.top;
              if (x >= 72 && y >= 56 && y <= timelineHeight + 56) {
                setHoverLineY(y);
              } else {
                setHoverLineY(null);
              }
            }}
          >
            {hoverLineY !== null ? (
              <div className="pointer-events-none absolute left-[72px] right-0 z-30">
                <div className="absolute left-0 right-0 border-t-2 border-[#EB3B3B]" style={{ top: hoverLineY }} />
                <span className="absolute h-4 w-4 -translate-y-1/2 rounded-full border border-[#E5A1A1] bg-[#E63030]" style={{ top: hoverLineY, left: 0 }} />
              </div>
            ) : null}

            <div className="border-r border-[#ECEEF1] bg-white">
              <div className="flex h-[68px] items-center justify-center border-b border-[#ECEEF1] p-3 text-[13px] font-medium text-[#616B79]">Время</div>
              <div>
                {timeSlots.map((time) => (
                  <div key={time} className="flex h-10 items-center justify-center border-b border-dashed border-[#EFF1F4] text-[12px] font-medium text-[#9099A8]">
                    {time}
                  </div>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-4">
              {displayColumns.map((column, colIndex) => {
                const boxId = BOX_COLUMN_LAYOUT[colIndex]?.boxId ?? String(colIndex + 1);
                const columnMasterId = assignedMasterIdForBoxDate(journalViewDate, boxId);
                const columnMaster = JOURNAL_MASTERS.find((m) => m.id === columnMasterId) ?? JOURNAL_MASTERS[colIndex];
                const hasAssignedMasterForDateBox = Boolean(
                  assignedMastersByDateBox[assignmentKey(journalViewDate, boxId)],
                );
                const searchNorm = journalSearchQuery.trim().toLowerCase();
                return (
                <div key={column.title} className="relative border-r border-[#ECEEF1] last:border-r-0">
                  <div className="flex h-[68px] items-center justify-center border-b border-[#ECEEF1] px-4 py-2">
                    {!hasAssignedMasterForDateBox ? (
                      <button
                        type="button"
                        onClick={() => {
                          setAssignModalBoxId(boxId);
                          setAssignModalSelectedMasterId(null);
                        }}
                        className="h-12 shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-black px-4 text-[18px] font-medium tracking-[-0.04em] text-white"
                      >
                        Назначить на {column.title}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => {
                          setBoxHeaderActionsModal({
                            boxId,
                            boxTitle: column.title,
                            masterName: columnMaster?.name ?? column.worker,
                            masterId: columnMasterId,
                          });
                        }}
                        className="mx-auto inline-flex cursor-pointer items-center justify-center gap-[12px] rounded-[10px] px-2 py-1"
                        aria-haspopup="dialog"
                        aria-expanded={Boolean(boxHeaderActionsModal && boxHeaderActionsModal.boxId === boxId)}
                        aria-label={`Действия для ${column.title}`}
                      >
                        <span className="inline-flex h-[37px] w-[37px] shrink-0 items-center justify-center self-center overflow-hidden rounded-full bg-[#F3F3F5]">
                          {columnMaster?.photoUrl ? (
                            <img
                              src={columnMaster.photoUrl}
                              alt={columnMaster.name}
                              className="h-[37px] w-[37px] object-cover"
                            />
                          ) : (
                            <span className="text-[11px] font-semibold text-[#6D788A]">М</span>
                          )}
                        </span>
                        <div className="inline-flex flex-col items-start justify-center gap-1">
                          <p className="text-[20px] font-semibold leading-none">{columnMaster?.name ?? column.worker}</p>
                          <p className="text-[13px] font-medium leading-none text-[#7D7D81]">{column.title}</p>
                        </div>
                      </button>
                    )}
                  </div>

                  <div
                    className="relative cursor-default bg-white"
                    style={{ height: timelineHeight }}
                    onClick={(e) => clickTimelineEmpty(e, boxId, column.cards)}
                  >
                    {timeSlots.map((time) => (
                      <div key={`${column.title}-${time}`} className="h-10 border-b border-dashed border-[#EFF1F4]" />
                    ))}

                    {getJournalFreeGapsForBoxDay(journalViewDate, boxId, toBookings(journalRows)).map((gap, gi) => {
                      const startHHmm = toTimeLabel(gap.startMin);
                      const endHHmmForLabel = formatFreeGapEndLabelForUi(gap.endMin);
                      const topPx = calcTop(startHHmm);
                      const hPx = calcFreeStripeHeightPx(gap, boxId, journalViewDate, toBookings(journalRows));
                      const uiEndMin = gap.endMin >= JOURNAL_WORK_END_MIN ? JOURNAL_GRID_LAST_SLOT_START_MIN : gap.endMin;
                      const isTooShortGap = uiEndMin - gap.startMin < JOURNAL_MIN_SERVICE_DURATION_MIN;
                      return (
                        <div
                          key={`free-${boxId}-${gi}-${gap.startMin}`}
                          className="pointer-events-none absolute left-2 right-2 z-[5] overflow-hidden rounded-lg"
                          style={{
                            top: topPx,
                            height: hPx,
                            ...(isTooShortGap
                              ? { backgroundColor: "#ffffff" }
                              : JOURNAL_FREE_SLOT_STRIPE_BG),
                          }}
                        >
                          {!isTooShortGap ? (
                            <div className="pointer-events-none absolute inset-0 flex min-h-0 items-center justify-center p-2">
                              <div className="flex max-h-full min-w-0 flex-col items-center gap-2 text-center">
                                <p className="pointer-events-none shrink-0 text-[12px] font-medium leading-snug text-[#5A6472]">
                                  Свободная заявка с {startHHmm} до {endHHmmForLabel}
                                </p>
                                <button
                                  type="button"
                                  className="pointer-events-auto shrink-0 cursor-pointer rounded-lg bg-[#EC1C24] px-4 py-2 text-[13px] font-medium text-white shadow-sm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    tryOpenNewBookingModal({
                                      boxId,
                                      startIso: `${journalViewDate}T${startHHmm}:00`,
                                      gapEndMinute: uiEndMin,
                                    });
                                  }}
                                >
                                  Новая запись
                                </button>
                              </div>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}

                    {column.cards.map((card) => {
                      const hit = bookingCardMatchesSearch(card, searchNorm);
                      const dimmed = Boolean(searchNorm) && !hit;
                      const highlighted = Boolean(searchNorm) && hit;
                      return (
                      <article
                        key={card.id}
                        ref={(el) => {
                          bookingArticleRefs.current[card.id] = el;
                        }}
                        className={`absolute left-2 right-2 flex flex-col overflow-hidden rounded-lg p-3 pb-8 transition-[opacity,filter,box-shadow] duration-200 ${
                          card.status ? JOURNAL_STATUS_SLOT[card.status] : "bg-[#FAFBFC]"
                        } ${
                          dimmed
                            ? "pointer-events-none z-[8] opacity-[0.22] grayscale"
                            : "z-10"
                        } ${highlighted ? "z-[12] shadow-[0_0_0_2px_#F31624]" : ""} ${
                          flashBookingId === card.id ? "z-[22] animate-[bookingCardHighlightBorder_4s_ease-out]" : ""
                        }`}
                        style={{ top: calcTop(card.start), height: calcCardHeightInclusive(card.start, card.end) }}
                      >
                        <div
                          className={`-mx-3 -mt-3 mb-1.5 flex h-6 w-[calc(100%+24px)] shrink-0 items-center px-3 text-[14px] font-semibold leading-none ${
                            card.status ? JOURNAL_STATUS_TIME_BADGE[card.status] : "bg-[#6B7688] text-white"
                          }`}
                        >
                          <span>{card.start}–{card.end}</span>
                          <button
                            type="button"
                            className="ml-auto inline-flex cursor-pointer items-center justify-center text-current transition-colors hover:text-black"
                            aria-label={`Действия для записи ${card.id}`}
                            onClick={(e) => {
                              e.stopPropagation();
                              setBookingCardActionsModal(card);
                            }}
                          >
                            <svg viewBox="0 0 20 16" fill="none" className="h-[20px] w-[24px]">
                              <circle cx="4.5" cy="8" r="1.9" fill="currentColor" />
                              <circle cx="10" cy="8" r="1.9" fill="currentColor" />
                              <circle cx="15.5" cy="8" r="1.9" fill="currentColor" />
                            </svg>
                          </button>
                        </div>
                        <div className="mt-1 flex w-full items-center gap-2">
                          <p
                            className={`min-w-0 truncate text-[17px] font-semibold leading-[1.28] ${card.phone ? "cursor-default" : ""}`}
                            onMouseEnter={(e) => {
                              if (!card.phone) return;
                              const p = clampClientPhoneTooltipPos(e.clientX, e.clientY, card.phone);
                              setClientPhoneTooltip({ text: formatPhoneForCardTooltip(card.phone), x: p.x, y: p.y, maxWidth: p.maxWidth });
                            }}
                            onMouseMove={(e) => {
                              if (!card.phone) return;
                              const p = clampClientPhoneTooltipPos(e.clientX, e.clientY, card.phone);
                              setClientPhoneTooltip({ text: formatPhoneForCardTooltip(card.phone), x: p.x, y: p.y, maxWidth: p.maxWidth });
                            }}
                            onMouseLeave={() => setClientPhoneTooltip(null)}
                          >
                            {card.title}
                          </p>
                        </div>
                        <p className="mt-0.5 shrink-0 truncate text-[13px] font-medium leading-[1.3] text-[#2E3642]">{carTitleOnly(card.car)}</p>
                        <p className="mt-0.5 shrink-0 truncate text-[13px] font-medium leading-[1.3] text-[#2E3642]">{card.service}</p>
                        {card.status ? (
                          <div className="absolute bottom-2 right-3">
                            <span
                              className={`inline-block shrink-0 rounded-full px-2 py-1 text-right text-[11px] font-semibold leading-snug ${JOURNAL_STATUS_CHIP[card.status]}`}
                            >
                              {card.status}
                            </span>
                          </div>
                        ) : null}
                      </article>
                    );
                    })}
                  </div>
                </div>
                );
              })}
            </div>
          </div>
        </div>
        </section>

          <section className="w-full shrink-0 self-start lg:min-h-0 lg:w-[310px] lg:shrink-0 lg:self-stretch">
          <aside className="w-full min-h-0 bg-white lg:h-full lg:min-h-0 lg:w-[310px] lg:overflow-y-auto">
            <section className="rounded-[10px] border border-[#ECEEF1] px-5 py-5 font-medium">
              <div>
                <div className="mb-4 flex items-center justify-between text-[18px] font-semibold">
                  <button
                    type="button"
                    aria-label="Предыдущий месяц"
                    onClick={() =>
                      setSidebarCalendarMonth((prev) => shiftCalendarMonthYm(prev.year, prev.month, -1))
                    }
                    className="cursor-pointer rounded-lg px-1.5 py-1 text-[#8A93A3] transition-colors hover:bg-black/5 hover:text-[#5A6472]"
                  >
                    ‹
                  </button>
                  <span className="font-medium text-black">
                    {formatSidebarMonthYearRu(sidebarCalendarMonth.year, sidebarCalendarMonth.month)}
                  </span>
                  <button
                    type="button"
                    aria-label="Следующий месяц"
                    onClick={() =>
                      setSidebarCalendarMonth((prev) => shiftCalendarMonthYm(prev.year, prev.month, 1))
                    }
                    className="cursor-pointer rounded-lg px-1.5 py-1 text-[#8A93A3] transition-colors hover:bg-black/5 hover:text-[#5A6472]"
                  >
                    ›
                  </button>
                </div>
                <div className="grid grid-cols-7 gap-y-2 text-center text-[14px] font-medium">
                  {["пн", "вт", "ср", "чт", "пт", "сб", "вс"].map((d) => (
                    <span key={d} className="text-[#888888]">
                      {d}
                    </span>
                  ))}
                  {sidebarCalendarCells.map((cell) => {
                    const selected = cell.dateIso === journalViewDate;
                    const muted = !cell.inMonth;
                    const label = formatJournalDayTitleRu(cell.dateIso);
                    return (
                      <button
                        key={cell.dateIso}
                        type="button"
                        aria-label={label}
                        title={label}
                        onClick={() => setJournalViewDate(cell.dateIso)}
                        className={`mx-auto grid h-8 w-8 cursor-pointer place-items-center rounded-full text-[14px] font-medium transition-colors ${
                          selected
                            ? "bg-[#E3262E] text-white shadow-sm hover:bg-[#c91f26]"
                            : muted
                              ? "text-[#BDBDBD] hover:bg-black/5 hover:text-[#6D788A]"
                              : "text-[#3E4858] hover:bg-black/5"
                        }`}
                      >
                        {cell.dayNum}
                      </button>
                    );
                  })}
                </div>
              </div>
            </section>

          </aside>
          </section>
            </section>
            <section className="z-[5] mt-4 w-full rounded-[10px] border border-[#ECEEF1] bg-white px-5 py-5 font-medium lg:absolute lg:bottom-5 lg:right-5 lg:mt-0 lg:w-[310px]">
              <h3 className="text-[20px] font-semibold text-black">Статистика за день</h3>
              <div className="mt-3 space-y-2 text-[14px]">
                <div className="flex justify-between">
                  <span className="text-[#6E7788]">Всего записей</span>
                  <span className="font-semibold">{dayBookingsCount}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-[#6E7788]">Свободных окон</span>
                  <span className="font-semibold">{dayFreeWindowsCount}</span>
                </div>
              </div>
            </section>

            {isNewBookingModalOpen ? (
              <div
                className="fixed inset-0 z-[100] flex items-center justify-center bg-black/45 p-4"
                role="presentation"
                onClick={closeNewBookingModal}
              >
                <div
                  role="dialog"
                  aria-labelledby="new-booking-title"
                  className="w-full max-w-[440px] overflow-visible rounded-[14px] border border-[#E4E5E7] bg-white p-6 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.35)]"
                  onClick={(e) => e.stopPropagation()}
                  onKeyDownCapture={(e: KeyboardEvent<HTMLDivElement>) => {
                    if (currentStep !== 1) return;
                    if (step1ClientMode === "link_surname") return;
                    if (!/^[0-9]$/.test(e.key)) return;
                    const phoneRef =
                      step1ClientMode === "phone" ? callPhoneInputRef : newClientPhoneInputRef;
                    if (document.activeElement === phoneRef.current) return;
                    if (document.activeElement instanceof HTMLInputElement) return;
                    if (document.activeElement instanceof HTMLTextAreaElement) return;
                    if (document.activeElement instanceof HTMLSelectElement) return;
                    e.preventDefault();
                    e.stopPropagation();
                    if (step1ClientMode === "phone") {
                      setCallNationalDigits((prev) => (prev.length >= 10 ? prev : prev + e.key));
                    } else {
                      setNewClientPhoneDigits((prev) => (prev.length >= 10 ? prev : prev + e.key));
                    }
                    setConfirmError(null);
                    queueMicrotask(() => phoneRef.current?.focus({ preventScroll: true }));
                  }}
                >
                  <h2 id="new-booking-title" className="text-[20px] font-bold tracking-[-0.04em] text-[#111826]">
                    Новая запись
                  </h2>

                  <p className="mt-3 flex flex-wrap items-center justify-start gap-x-1.5 text-left text-[12px] font-medium text-[#B0B6C1]">
                    {stepLabels.map((label, idx) => (
                      <span key={label} className="inline-flex items-center gap-x-1.5">
                        <span
                          className={
                            currentStep === idx + 1
                              ? "font-semibold text-[#111826]"
                              : currentStep > idx + 1
                                ? "text-[#5A6472]"
                                : ""
                          }
                        >
                          {label}
                        </span>
                        {idx < stepLabels.length - 1 ? <span className="text-[#DDE1E7]">→</span> : null}
                      </span>
                    ))}
                  </p>

                  {currentStep === 1 ? (
                    <>
                      {step1ClientMode === "phone" ? (
                        <>
                          <label htmlFor="new-booking-call-phone" className="mt-5 block text-[14px] font-medium text-[#5A6472]">
                            Телефон
                          </label>
                          <input
                            ref={callPhoneInputRef}
                            id="new-booking-call-phone"
                            type="tel"
                            autoComplete="tel"
                            inputMode="numeric"
                            value={maskRuPhoneInput(callNationalDigits)}
                            onChange={(e) => {
                              setCallNationalDigits(national10FromPhoneInput(e.target.value));
                              setConfirmError(null);
                            }}
                            className={`mt-1.5 ${JOURNAL_MODAL_REQUESTS_LIKE_FIELD_CLASS} placeholder:text-[#B5B5B5]`}
                            placeholder="+7 (999) 000-00-00"
                          />

                          {matchedByPhone.length > 0 ? (
                            <div className="mt-4 space-y-3">
                              {matchedByPhone.map((c) => (
                                <div key={c.id} className="rounded-[10px] bg-[#ECECEF] p-3">
                                  <p className="text-[15px] font-semibold text-[#111826]">{c.name}</p>
                                  <p className="mt-0.5 text-[14px] text-[#5A6472]">{c.phone}</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {c.cars.map((car) => {
                                      const picked = selectedClient?.id === c.id && selectedCar?.id === car.id;
                                      return (
                                        <button
                                          key={car.id}
                                          type="button"
                                          onClick={() => {
                                            setSelectedClient(c);
                                            setSelectedCar(car);
                                            setConfirmError(null);
                                          }}
                                          className={`rounded-lg px-3 py-2 text-left text-[13px] font-medium ${
                                            picked
                                              ? "bg-[#EC1C24] text-white"
                                              : "bg-white text-[#3B4656]"
                                          }`}
                                        >
                                          {car.model}
                                          <span className={`block text-[12px] font-normal ${picked ? "text-white/90" : "text-[#6D788A]"}`}>
                                            {car.plate || "—"}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : null}

                          {phoneCompleteNoMatch ? (
                            <div className="mt-5 flex flex-col gap-2">
                              <p className="text-[14px] text-[#5A6472]">Номер не найден в базе. Звонок с другого телефона?</p>
                              <button
                                type="button"
                                onClick={() => {
                                  setStep1ClientMode("link_surname");
                                  setLinkSurnameQuery("");
                                  setSelectedClient(null);
                                  setSelectedCar(null);
                                  setConfirmError(null);
                                }}
                                className="rounded-[10px] border border-[#E4E5E7] bg-white px-4 py-2.5 text-[14px] font-medium text-[#111826] hover:border-[#DDE1E7]"
                              >
                                Привязать к существующему
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setStep1ClientMode("new_form");
                                  setNewClientPhoneDigits(callNationalDigits);
                                  setNewClientName("");
                                  setNewClientCar("");
                                  setSelectedClient(null);
                                  setSelectedCar(null);
                                  setConfirmError(null);
                                }}
                                className="rounded-[10px] bg-[#EC1C24] px-4 py-2.5 text-[14px] font-medium text-white"
                              >
                                Новый клиент
                              </button>
                            </div>
                          ) : null}
                        </>
                      ) : null}

                      {step1ClientMode === "link_surname" ? (
                        <>
                          <label htmlFor="new-booking-link-surname" className="mt-5 block text-[14px] font-medium text-[#5A6472]">
                            Фамилия
                          </label>
                          <input
                            id="new-booking-link-surname"
                            type="text"
                            autoComplete="family-name"
                            className={`mt-1.5 ${REQUESTS_SEARCH_INPUT_LIGHT_CLASS} text-black`}
                            placeholder="Введите фамилию..."
                            value={linkSurnameQuery}
                            onChange={(e) => {
                              setLinkSurnameQuery(e.target.value);
                              setConfirmError(null);
                            }}
                          />
                          {matchedBySurname.length > 0 ? (
                            <div className="mt-4 max-h-[276px] space-y-3 overflow-y-auto pr-1">
                              {matchedBySurname.map((c) => (
                                <div key={c.id} className="rounded-[10px] bg-[#ECECEF] p-3">
                                  <p className="text-[15px] font-semibold text-[#111826]">{c.name}</p>
                                  <p className="mt-0.5 text-[14px] text-[#5A6472]">{c.phone}</p>
                                  <div className="mt-3 flex flex-wrap gap-2">
                                    {c.cars.map((car) => {
                                      const picked = selectedClient?.id === c.id && selectedCar?.id === car.id;
                                      return (
                                        <button
                                          key={car.id}
                                          type="button"
                                          onClick={() => {
                                            setSelectedClient(c);
                                            setSelectedCar(car);
                                            setConfirmError(null);
                                          }}
                                          className={`rounded-lg px-3 py-2 text-left text-[13px] font-medium ${
                                            picked
                                              ? "bg-[#EC1C24] text-white"
                                              : "bg-white text-[#3B4656]"
                                          }`}
                                        >
                                          {car.model}
                                          <span className={`block text-[12px] font-normal ${picked ? "text-white/90" : "text-[#6D788A]"}`}>
                                            {car.plate || "—"}
                                          </span>
                                        </button>
                                      );
                                    })}
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : linkSurnameQuery.trim() ? (
                            <p className="mt-4 text-[14px] text-[#6D788A]">Клиенты не найдены.</p>
                          ) : null}
                        </>
                      ) : null}

                      {step1ClientMode === "new_form" ? (
                        <div className="mt-5 space-y-3">
                          <p className="text-[14px] font-semibold text-[#111826]">Новый клиент</p>
                          <input
                            type="text"
                            className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                            placeholder="ФИО"
                            value={newClientName}
                            onChange={(e) => {
                              setNewClientName(e.target.value);
                              setConfirmError(null);
                            }}
                          />
                          <input
                            ref={newClientPhoneInputRef}
                            id="new-booking-new-client-phone"
                            type="tel"
                            autoComplete="tel"
                            inputMode="numeric"
                            value={maskRuPhoneInput(newClientPhoneDigits)}
                            onChange={(e) => {
                              setNewClientPhoneDigits(national10FromPhoneInput(e.target.value));
                              setConfirmError(null);
                            }}
                            className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                            placeholder="+7 (999) 000-00-00"
                          />
                          <input
                            type="text"
                            className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                            placeholder="Автомобиль"
                            value={newClientCar}
                            onChange={(e) => {
                              setNewClientCar(e.target.value);
                              setConfirmError(null);
                            }}
                          />
                        </div>
                      ) : null}
                    </>
                  ) : null}

                  {currentStep === 2 ? (
                    <>
                      {isRequestBookingFlow && requestBookingComment ? (
                        <>
                          <label className="mt-5 block text-[14px] font-medium text-[#5A6472]">Комментарий клиента</label>
                          <div className="mt-1.5 rounded-[10px] border-[3px] border-[#E4E5E7] bg-[#F8F8FA] px-3 py-3 text-[16px] font-medium tracking-[-0.04em] text-[#2E3642]">
                            {requestBookingComment}
                          </div>
                        </>
                      ) : null}
                      <label className="mt-5 block text-[14px] font-medium text-[#5A6472]">Тип обращения</label>
                      <div className="relative mt-1.5">
                        <button
                          type="button"
                          className={`${JOURNAL_MODAL_REQUESTS_LIKE_SELECT_CLASS} text-left ${selectedService ? "text-black" : "text-[#9CA3AF]"}`}
                          onClick={() => setIsServiceMenuOpen((v) => !v)}
                        >
                          <span className="block truncate">
                            {selectedService ? `${selectedService.name} (${selectedService.duration} мин.)` : "Выберите тип обращения"}
                          </span>
                        </button>
                        <EditRequestModalSelectChevron />
                        {isServiceMenuOpen ? (
                          <div className="absolute left-0 right-0 top-[calc(100%+6px)] z-[25] overflow-hidden rounded-[10px] border border-[#E4E5E7] bg-white shadow-[0_12px_24px_-12px_rgba(0,0,0,0.3)]">
                            <ul className="service-menu-scroll max-h-[336px] overflow-y-auto py-1">
                              <li>
                                <button
                                  type="button"
                                  className="h-12 w-full cursor-default px-3 text-left text-[18px] font-medium tracking-[-0.04em] text-[#9CA3AF]"
                                  disabled
                                >
                                  Выберите тип обращения
                                </button>
                              </li>
                              {step2ScopedServices.map((s) => {
                                const active = selectedService?.id === s.id;
                                return (
                                  <li key={s.id}>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedService(s);
                                        setConfirmError(null);
                                        setIsServiceMenuOpen(false);
                                      }}
                                      className={`h-12 w-full px-3 text-left text-[18px] font-medium tracking-[-0.04em] ${
                                        active ? "bg-[#FCE6E8] text-[#111826]" : "text-[#2E3642] hover:bg-[#F3F4F6]"
                                      }`}
                                    >
                                      {s.name} ({s.duration} мин.)
                                    </button>
                                  </li>
                                );
                              })}
                            </ul>
                          </div>
                        ) : null}
                      </div>
                      {step2ScopedServices.length === 0 ? (
                        <p className="mt-2 text-[13px] text-[#6D788A]">Сейчас нет доступных типов обращения.</p>
                      ) : null}

                      <label className="mt-4 block text-[14px] font-medium text-[#5A6472]">Дата</label>
                      <div className="relative mt-1.5">
                        <input
                          type="date"
                          className={`${JOURNAL_MODAL_REQUESTS_LIKE_FIELD_CLASS} cursor-pointer pr-12 [color-scheme:light] [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:right-0 [&::-webkit-calendar-picker-indicator]:top-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-10 [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:opacity-0`}
                          value={selectedDate}
                          onChange={(e) => {
                            const v = e.target.value;
                            setSelectedDate(v);
                            if (modalPrefill && v !== modalPrefill.startIso.slice(0, 10)) setModalPrefill(null);
                            setConfirmError(null);
                          }}
                        />
                        <JournalModalDateCalendarIcon />
                      </div>
                    </>
                  ) : null}

                  {currentStep === 3 ? (
                    <>
                      <p className="mt-5 text-[14px] font-semibold text-[#111826]">Свободные слоты</p>
                      {stepSlots.length === 0 ? (
                        <p className="mt-2 text-[14px] text-[#6D788A]">Нет доступных слотов на выбранную дату.</p>
                      ) : (
                        <ul className="mt-2 max-h-[220px] space-y-1.5 overflow-y-auto">
                          {stepSlots.map((slot) => {
                            const active = selectedSlot !== null && slotKey(selectedSlot) === slotKey(slot);
                            return (
                              <li key={slotKey(slot)}>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedSlot(slot);
                                    setConfirmError(null);
                                  }}
                                  className={`w-full rounded-[10px] border px-3 py-2.5 text-left text-[14px] font-medium transition-colors ${
                                    active
                                      ? "border-[#EC1C24] bg-[#FCE6E8] text-[#111826]"
                                      : "border-[#ECEEF1] bg-white text-[#3B4656] hover:border-[#DDE1E7]"
                                  }`}
                                >
                                  {formatSlotLabel(slot)}
                                </button>
                              </li>
                            );
                          })}
                        </ul>
                      )}
                    </>
                  ) : null}

                  {currentStep === 4 ? (
                    <div className="mt-5 space-y-3 rounded-[10px] bg-[#ECECEF] p-4 text-[14px]">
                      <div>
                        <span className="text-[12px] font-medium text-[#6D788A]">Клиент</span>
                        <p className="text-[16px] font-semibold text-[#111826]">
                          {(selectedClient?.name || newClientName.trim()) || "—"}
                        </p>
                      </div>
                      <div>
                        <span className="text-[12px] font-medium text-[#6D788A]">Телефон</span>
                        <p className="text-[16px] font-semibold text-[#111826]">
                          {selectedClient?.phone ??
                            (newClientPhoneDigits.length === 10
                              ? displayRuPhoneComplete(newClientPhoneDigits)
                              : "—")}
                        </p>
                      </div>
                      <div>
                        <span className="text-[12px] font-medium text-[#6D788A]">Автомобиль</span>
                        <p className="text-[16px] font-semibold text-[#111826]">
                          {selectedCar
                            ? formatCarLine(selectedCar.model, selectedCar.plate)
                            : formatCarLine(newClientCar, "")}
                        </p>
                      </div>
                      <div>
                        <span className="text-[12px] font-medium text-[#6D788A]">Услуга</span>
                        <p className="text-[16px] font-semibold text-[#111826]">{selectedService?.name ?? "—"}</p>
                      </div>
                      <div>
                        <span className="text-[12px] font-medium text-[#6D788A]">Время</span>
                        <p className="text-[16px] font-semibold text-[#111826]">{timeLabel || "—"}</p>
                      </div>
                      <div>
                        <span className="text-[12px] font-medium text-[#6D788A]">Бокс</span>
                        <p className="text-[16px] font-semibold text-[#111826]">{boxName || "—"}</p>
                      </div>
                      <div>
                        <span className="text-[12px] font-medium text-[#6D788A]">Мастер</span>
                        <p className="text-[16px] font-semibold text-[#111826]">{masterName || "—"}</p>
                      </div>
                    </div>
                  ) : null}

                  {confirmError ? <p className="mt-3 text-[14px] font-medium text-[#E00919]">{confirmError}</p> : null}

                  <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
                    <button
                      type="button"
                      onClick={closeNewBookingModal}
                      className="rounded-[10px] bg-[#ECECEF] px-4 py-2.5 text-[14px] font-medium text-black"
                    >
                      Отмена
                    </button>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <button
                        type="button"
                        disabled={currentStep === 1 && step1ClientMode === "phone"}
                        onClick={wizardBack}
                        className="rounded-[10px] bg-[#ECECEF] px-4 py-2.5 text-[14px] font-medium text-black disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Назад
                      </button>
                      {currentStep === 1 ? (
                        <button
                          type="button"
                          disabled={!step1Complete}
                          onClick={wizardNextFromStep1}
                          className="rounded-[10px] bg-[#EC1C24] px-4 py-2.5 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Далее
                        </button>
                      ) : null}
                      {currentStep === 2 ? (
                        <button
                          type="button"
                          disabled={!selectedService || !selectedDate || step2ScopedServices.length === 0}
                          onClick={wizardNextFromStep2}
                          className="rounded-[10px] bg-[#EC1C24] px-4 py-2.5 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Далее
                        </button>
                      ) : null}
                      {currentStep === 3 ? (
                        <button
                          type="button"
                          disabled={!selectedSlot || stepSlots.length === 0}
                          onClick={wizardNextFromStep3}
                          className="rounded-[10px] bg-[#EC1C24] px-4 py-2.5 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Далее
                        </button>
                      ) : null}
                      {currentStep === 4 ? (
                        <button
                          type="button"
                          disabled={!selectedService || !selectedSlot}
                          onClick={confirmNewBooking}
                          className="rounded-[10px] bg-[#EC1C24] px-4 py-2.5 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          Создать запись
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              </div>
            ) : null}
          </main>
        </div>
      </div>
      {bookingCardActionsModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setBookingCardActionsModal(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="booking-actions-title"
                className="w-full max-w-[360px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="booking-actions-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Действия с записью
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    {bookingCardActionsModal.title}
                  </p>
                </div>
                <ul className="p-0">
                  {bookingCardModalActions.map(({ id, label, Icon, danger }) => {
                    const iconTone = danger ? "text-[#EC1C24]" : "text-[#4B5563]";
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                            danger ? "text-[#EC1C24] hover:bg-[#EC1C24]/10" : "text-[#111826] hover:bg-[#F3F3F5]"
                          }`}
                          onClick={() => handleBookingCardAction(id)}
                        >
                          <Icon className={iconTone} />
                          {label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
      {bookingStatusPickerRow && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[265] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setBookingStatusPickerForId(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="booking-status-title"
                className="w-full max-w-[360px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="booking-status-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Изменить статус записи
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    № {bookingStatusPickerRow.id} · {bookingStatusPickerRow.clientTitle}
                  </p>
                </div>
                <ul className="p-0">
                  {(["Подтверждена", "Ожидает клиента", "В работе", "Завершена", "Клиент не приехал", "Отменена"] as const).map((status) => (
                    <li key={status}>
                      <button
                        type="button"
                        className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                          bookingStatusPickerRow.status === status
                            ? "bg-[#F8F8FA] text-[#111826]"
                            : "text-[#111826] hover:bg-[#F3F3F5]"
                        }`}
                        onClick={() => commitBookingStatus(status)}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: JOURNAL_STATUS_DOT_COLOR[status] }} />
                        <span className="min-w-0 flex-1">{status}</span>
                        {bookingStatusPickerRow.status === status ? (
                          <span className="shrink-0 text-[13px] font-medium text-[#7D7D7D]">Сейчас</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[#EEEDF0] p-5">
                  <button
                    type="button"
                    onClick={() => setBookingStatusPickerForId(null)}
                    className="w-full cursor-pointer rounded-[10px] bg-[#ECECEF] p-4 text-center text-[16px] font-medium tracking-[-0.04em] text-[#111111] transition-colors hover:bg-[#E0E0E4]"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {editBookingId && editBookingDraft && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[263] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => {
                setEditBookingId(null);
                setEditBookingDraft(null);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-booking-title"
                className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="edit-booking-title" className="text-[20px] font-bold tracking-[-0.04em] text-[#111826]">
                    Редактировать запись
                  </h2>
                </div>
                <div className="flex flex-col gap-3 p-5">
                  <input
                    value={editBookingDraft.clientTitle}
                    onChange={(e) =>
                      setEditBookingDraft((prev) => (prev ? { ...prev, clientTitle: e.target.value } : prev))
                    }
                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                    placeholder="ФИО"
                  />
                  <input
                    value={editBookingDraft.car}
                    onChange={(e) =>
                      setEditBookingDraft((prev) => (prev ? { ...prev, car: e.target.value } : prev))
                    }
                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Автомобиль"
                  />
                </div>
                <div className="flex gap-2 border-t border-[#EEEDF0] p-5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditBookingId(null);
                      setEditBookingDraft(null);
                    }}
                    className="flex-1 h-11 rounded-[10px] bg-[#ECECEF] px-4 text-center text-[15px] font-medium tracking-[-0.04em] text-black"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={commitBookingEdit}
                    className="flex-1 h-11 rounded-[10px] border-2 border-[#EC1C24] bg-[#EC1C24] px-5 text-center text-[15px] font-medium tracking-[-0.04em] text-white"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {bookingSoonNotice && typeof document !== "undefined"
        ? createPortal(
            <div className="pointer-events-none fixed bottom-4 right-4 z-[500]">
              <div
                className={`flex h-[84px] w-[560px] items-center justify-between gap-3 rounded-[12px] bg-white px-4 py-3 text-[16px] font-medium tracking-[-0.04em] text-[#111111] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.35)] ${
                  bookingSoonPhase === "leave"
                    ? "animate-[archiveToastOut_420ms_ease_forwards]"
                    : "animate-[archiveToastIn_420ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
                }`}
              >
                <div className="flex min-w-0 flex-1 items-center gap-3">
                  <img src="/notification.svg" alt="" className="h-[25px] w-[25px] shrink-0" />
                  <span className="min-w-0 leading-[1.2]">
                    <span className="block truncate">{bookingSoonNotice.line1}</span>
                    <span className="block truncate">{bookingSoonNotice.line2}</span>
                  </span>
                </div>
                <span className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EC1C24] text-white">
                  <img src="/go_to.svg" alt="" className="h-[17px] w-5" />
                </span>
              </div>
            </div>,
            document.body,
          )
        : null}
      {clientPhoneTooltip && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              className="pointer-events-none fixed z-[200] max-h-[min(280px,calc(100vh-16px))] w-max min-w-0 overflow-y-auto rounded-xl border border-[#E4E5E7] bg-white px-3 py-2.5 text-left text-[14px] font-medium leading-relaxed whitespace-pre-wrap break-words text-[#111826] shadow-[0_12px_40px_-8px_rgba(0,0,0,0.35)]"
              style={{ left: clientPhoneTooltip.x, top: clientPhoneTooltip.y, maxWidth: clientPhoneTooltip.maxWidth }}
            >
              {clientPhoneTooltip.text}
            </div>,
            document.body,
          )
        : null}
      {boxHeaderActionsModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[258] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setBoxHeaderActionsModal(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="box-header-actions-title"
                className="w-full max-w-[360px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="box-header-actions-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Действия с боксом
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    {boxHeaderActionsModal.masterName} · {boxHeaderActionsModal.boxTitle}
                  </p>
                </div>
                <ul className="p-0">
                  <li>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] text-[#111826] transition-colors hover:bg-[#F3F3F5]"
                      onClick={() => {
                        const snap = boxHeaderActionsModal;
                        setBoxHeaderActionsModal(null);
                        if (!snap) return;
                        if (openProfileTimerRef.current) {
                          clearTimeout(openProfileTimerRef.current);
                          openProfileTimerRef.current = null;
                        }
                        openProfileTimerRef.current = setTimeout(() => {
                          setEmployeeProfileSnapshot({ masterId: snap.masterId });
                          setEmployeeProfileModal({ masterId: snap.masterId });
                          setEmployeeProfileTab("main");
                          setEmployeeOrdersSection("active");
                          openProfileTimerRef.current = null;
                        }, 140);
                      }}
                    >
                      <BoxHeaderActionIcon type="profile" className="h-5 w-5 shrink-0 text-[#4B5563]" />
                      Открыть профиль
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] text-[#111826] transition-colors hover:bg-[#F3F3F5]"
                      onClick={() => handleBoxHeaderAction("callMaster")}
                    >
                      <BoxHeaderActionIcon type="call" className="h-5 w-5 shrink-0 text-[#4B5563]" />
                      Позвонить мастеру
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] text-[#111826] transition-colors hover:bg-[#F3F3F5]"
                      onClick={() => handleBoxHeaderAction("changeMaster")}
                    >
                      <BoxHeaderActionIcon type="switch" className="h-5 w-5 shrink-0 text-[#4B5563]" />
                      Сменить мастера
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="flex w-full cursor-pointer items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] text-[#EC1C24] transition-colors hover:bg-[#EC1C24]/10"
                      onClick={() => handleBoxHeaderAction("removeMaster")}
                    >
                      <BoxHeaderActionIcon type="remove" className="h-5 w-5 shrink-0 text-[#EC1C24]" />
                      Снять мастера
                    </button>
                  </li>
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
      {employeeProfileMounted && employeeProfileSnapshot && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`fixed inset-0 z-[285] bg-black/35 transition-[opacity] ${employeeProfileActive ? "opacity-100" : "opacity-0"}`}
              style={{ transitionDuration: "400ms", transitionTimingFunction: "cubic-bezier(0.45, 0, 0.55, 1)" }}
              role="presentation"
              onClick={() => setEmployeeProfileModal(null)}
            >
              <div className="ml-auto flex h-full max-h-screen justify-end" onClick={(e) => e.stopPropagation()}>
                <div
                  className="relative flex h-full shrink-0"
                  style={{
                    transform: employeeProfileActive ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)",
                    transition: "transform 480ms cubic-bezier(0.45, 0, 0.55, 1)",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                  onTransitionEnd={handleProfileDrawerTransitionEnd}
                >
                  <button
                    type="button"
                    onClick={() => setEmployeeProfileModal(null)}
                    className="absolute right-full top-8 z-10 mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#E8E8E8] bg-white text-[#111111] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.18)] transition hover:bg-[#F7F7F7]"
                    aria-label="Закрыть профиль сотрудника"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <aside
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="employee-profile-title"
                    className="flex h-full w-[min(900px,58vw)] min-w-[380px] max-w-[min(1040px,calc(100vw-48px))] flex-col border-l border-[#E6E6E6] bg-white tracking-[-0.04em] shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.2)]"
                  >
                    <div className="flex items-center gap-3 border-b border-[#EFEFEF] px-5 py-4">
                      <h2 id="employee-profile-title" className="text-[36px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">
                        Профиль мастера
                      </h2>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth p-5">
                      {employeeProfileTab === "main" ? (
                        <section className="relative min-h-0 rounded-[16px] bg-white">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h1 className="max-w-[420px] text-[52px] font-semibold leading-[0.98] tracking-[-0.03em] text-[#202636]">
                                <span className="block whitespace-nowrap">{profileMasterFirstLine}</span>
                                <span className="block">{profileMasterSecondLine || "\u00A0"}</span>
                              </h1>
                            </div>
                            <img src={profileMasterPhotoLarge} alt={`Фото профиля: ${profileMasterFullName}`} className="h-[72px] w-[72px] rounded-full object-cover" />
                          </div>
                          <div className="mt-[50px]">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                              {[
                                { label: "Дата рождения", value: profileMasterMeta.birthDate },
                                { label: "Пол", value: profileMasterMeta.gender },
                                { label: "Гражданство", value: profileMasterMeta.citizenship },
                                { label: "Телефон", value: profileMasterMeta.phone },
                                { label: "E-mail", value: profileMasterMeta.email },
                                { label: "Должность", value: profileMasterMeta.role },
                                { label: "График работы", value: profileMasterMeta.schedule },
                                { label: "Статус", value: profileMasterMeta.status },
                              ].map((field) => (
                                <div key={field.label} className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3">
                                  <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">{field.label}</p>
                                  <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">{field.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </section>
                      ) : employeeProfileTab === "kpi" ? (
                        <section className="min-h-0 rounded-[16px] bg-white">
                          <div className="grid grid-cols-2 gap-3">
                            {employeeKpiCards.map((card) => (
                              <article key={card.title} className="flex h-[128px] flex-col rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                <p className="text-[16px] font-medium leading-none tracking-[-0.04em] text-[#1D2330]">{card.title}</p>
                                <div className="mt-auto">
                                  <p className="text-[32px] font-medium leading-none tracking-[-0.04em] text-[#E00919]">{card.value}</p>
                                  <p className="mt-1 text-[13px] font-medium tracking-[-0.04em] text-[#6F7785]">{card.note}</p>
                                </div>
                              </article>
                            ))}
                          </div>
                        </section>
                      ) : (
                        <section className="rounded-[16px] bg-white">
                          <div className="inline-flex w-fit items-center gap-1 rounded-full p-1">
                            {[
                              { id: "active" as const, label: "Активные" },
                              { id: "recentlyDone" as const, label: "Недавно завершенные" },
                            ].map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setEmployeeOrdersSection(tab.id)}
                                className={`rounded-full px-4 py-2 text-[14px] font-medium tracking-[-0.02em] text-black ${employeeOrdersSection === tab.id ? "bg-[#F8F8FA]" : "bg-transparent"}`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                          {employeeOrdersSection === "active" ? (
                            <div className="mt-4 space-y-4">
                              {masterActiveOrderItems.length > 0 ? (
                                masterActiveOrderItems.map((item) => {
                                  const [titlePart, ...restParts] = item.text.split(" · ");
                                  const detailsPart = restParts.join(" · ");
                                  return (
                                    <article key={item.text} className="flex items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                                        <img src={item.icon} alt="" className="h-5 w-5" />
                                      </span>
                                      <p className="text-[20px] font-medium leading-[1.1] tracking-[-0.02em] text-[#7D7D7D]">
                                        <span className="text-[#111826]">{titlePart}</span>
                                        {detailsPart ? ` · ${detailsPart}` : ""}
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => navigateToWorkOrderFromCard(item.text)}
                                        className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#EC1C24] text-white"
                                      >
                                        <img src="/go_to.svg" alt="" className="h-[17px] w-5" />
                                      </button>
                                    </article>
                                  );
                                })
                              ) : (
                                <div className="rounded-[12px] bg-[#F3F3F5] px-4 py-3 text-[15px] font-medium tracking-[-0.04em] text-[#6F7785]">
                                  Активных заказ-нарядов нет.
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-4 space-y-4">
                              {masterCompletedOrderItems.length > 0 ? (
                                masterCompletedOrderItems.map((item) => {
                                  const [titlePart, ...restParts] = item.text.split(" · ");
                                  const detailsPart = restParts.join(" · ");
                                  return (
                                    <article key={item.text} className="flex items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                                        <img src={item.icon} alt="" className="h-5 w-5" />
                                      </span>
                                      <p className="text-[20px] font-medium leading-[1.1] tracking-[-0.02em] text-[#7D7D7D]">
                                        <span className="text-[#111826]">{titlePart}</span>
                                        {detailsPart ? ` · ${detailsPart}` : ""}
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => navigateToWorkOrderFromCard(item.text)}
                                        className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#EC1C24] text-white"
                                      >
                                        <img src="/go_to.svg" alt="" className="h-[17px] w-5" />
                                      </button>
                                    </article>
                                  );
                                })
                              ) : (
                                <div className="rounded-[12px] bg-[#F3F3F5] px-4 py-3 text-[15px] font-medium tracking-[-0.04em] text-[#6F7785]">
                                  Недавно завершенных заказ-нарядов нет.
                                </div>
                              )}
                            </div>
                          )}
                        </section>
                      )}
                    </div>
                    <div className="shrink-0 px-5 pb-5">
                      <div className="flex justify-center">
                        <div className="relative inline-grid grid-cols-3 rounded-full bg-[#11131D] p-1 text-[12px] shadow-[0_8px_24px_-14px_rgba(0,0,0,0.8)]">
                          <span
                            className={`absolute left-1 top-1 bottom-1 z-0 w-[136px] rounded-full bg-[#EC1C24] shadow-[0_6px_14px_-8px_rgba(236,28,36,0.85)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                              employeeProfileTab === "main" ? "translate-x-0" : employeeProfileTab === "kpi" ? "translate-x-[136px]" : "translate-x-[272px]"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setEmployeeProfileTab("main")}
                            className={`relative z-10 w-[136px] whitespace-nowrap rounded-full px-4 py-2 text-center text-[15px] font-bold tracking-[-0.02em] transition-colors duration-300 ${
                              employeeProfileTab === "main" ? "text-white" : "text-white/80 hover:text-white"
                            }`}
                          >
                            Основное
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmployeeProfileTab("kpi")}
                            className={`relative z-10 w-[136px] whitespace-nowrap rounded-full px-4 py-2 text-center text-[15px] font-bold tracking-[-0.02em] transition-colors duration-300 ${
                              employeeProfileTab === "kpi" ? "text-white" : "text-white/80 hover:text-white"
                            }`}
                          >
                            KPI
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmployeeProfileTab("orders")}
                            className={`relative z-10 w-[136px] whitespace-nowrap rounded-full px-4 py-2 text-center text-[15px] font-bold tracking-[-0.02em] transition-colors duration-300 ${
                              employeeProfileTab === "orders" ? "text-white" : "text-white/80 hover:text-white"
                            }`}
                          >
                            Заказ-наряды
                          </button>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {missingMasterPrompt && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[259] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setMissingMasterPrompt(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="missing-master-title"
                className="w-full max-w-[420px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="missing-master-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Назначьте мастера на бокс
                  </h2>
                  <p className="mt-1 text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    Для создания записи назначьте мастера на {missingMasterPrompt.boxTitle}.
                  </p>
                </div>
                <div className="flex gap-2 p-5">
                  <button
                    type="button"
                    onClick={() => setMissingMasterPrompt(null)}
                    className="h-11 flex-1 cursor-pointer rounded-[10px] bg-[#ECECEF] px-4 text-center text-[15px] font-medium tracking-[-0.04em] text-black"
                  >
                    Закрыть
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setAssignModalBoxId(missingMasterPrompt.boxId);
                      setAssignModalSelectedMasterId(null);
                      setMissingMasterPrompt(null);
                    }}
                    className="h-11 flex-1 cursor-pointer rounded-[10px] border-2 border-[#EC1C24] bg-[#EC1C24] px-4 text-center text-[15px] font-medium tracking-[-0.04em] text-white"
                  >
                    Назначить мастера
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {assignModalBoxId && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[120] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => {
                setAssignModalBoxId(null);
                setAssignModalSelectedMasterId(null);
              }}
            >
              <div
                role="dialog"
                aria-label={`Назначить мастера на ${assignModalBoxTitle}`}
                className="w-full max-w-[440px] rounded-[14px] border border-[#E4E5E7] bg-white p-6 shadow-[0_24px_60px_-16px_rgba(0,0,0,0.35)]"
                onClick={(e) => e.stopPropagation()}
              >
                <h3 className="text-[20px] font-bold tracking-[-0.04em] text-[#111826]">Назначение мастера</h3>
                <p className="mt-2 text-[14px] text-[#5A6472]">
                  {assignModalBoxTitle} · {journalViewDate}
                </p>
                <div className="mt-4 max-h-[260px] space-y-2 overflow-y-auto">
                  {availableMastersForViewDate.map((master) => {
                    const active = assignModalSelectedMasterId === master.id;
                    const takenByOtherBox = assignModalBoxId !== null
                      && Object.entries(assignedMastersByDateBox).some(([key, assignedId]) => {
                        if (!key.startsWith(`${journalViewDate}|`)) return false;
                        const [, boxId] = key.split("|");
                        return boxId !== assignModalBoxId && assignedId === master.id;
                      });
                    return (
                      <button
                        key={master.id}
                        type="button"
                        disabled={takenByOtherBox}
                        onClick={() => {
                          if (takenByOtherBox) return;
                          setAssignModalSelectedMasterId(master.id);
                        }}
                        className={`flex w-full items-center gap-3 rounded-[10px] px-3 py-2.5 text-left text-[14px] font-medium ${
                          active
                            ? "bg-[#EC1C24] text-white"
                            : takenByOtherBox
                              ? "cursor-not-allowed bg-[#F3F3F5] text-black/40"
                              : "bg-[#ECECEF] text-black"
                        }`}
                      >
                        <span className={`inline-flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#F3F3F5] ${takenByOtherBox ? "opacity-40" : ""}`}>
                          {master.photoUrl ? (
                            <img src={master.photoUrl} alt={master.name} className="h-9 w-9 object-cover" />
                          ) : (
                            <span className="text-[11px] font-semibold text-[#6D788A]">М</span>
                          )}
                        </span>
                        <span className="min-w-0 truncate">{master.name}</span>
                      </button>
                    );
                  })}
                  {availableMastersForViewDate.length === 0 ? (
                    <p className="text-[14px] text-[#6D788A]">На эту дату нет мастеров по графику.</p>
                  ) : null}
                </div>
                <div className="mt-6 flex items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignModalBoxId(null);
                      setAssignModalSelectedMasterId(null);
                    }}
                    className="rounded-[10px] bg-[#ECECEF] px-4 py-2.5 text-[14px] font-medium text-black"
                  >
                    Закрыть
                  </button>
                  <div className="ml-auto">
                    <button
                      type="button"
                      disabled={!assignModalBoxId || !assignModalSelectedMasterId}
                      onClick={() => {
                        if (!assignModalBoxId || !assignModalSelectedMasterId) return;
                      const takenByOtherBox = Object.entries(assignedMastersByDateBox).some(([key, assignedId]) => {
                        if (!key.startsWith(`${journalViewDate}|`)) return false;
                        const [, boxId] = key.split("|");
                        return boxId !== assignModalBoxId && assignedId === assignModalSelectedMasterId;
                      });
                      if (takenByOtherBox) return;
                        setAssignedMastersByDateBox((prev) => ({
                          ...prev,
                          [assignmentKey(journalViewDate, assignModalBoxId)]: assignModalSelectedMasterId,
                        }));
                        setAssignModalBoxId(null);
                        setAssignModalSelectedMasterId(null);
                      }}
                    className="rounded-[10px] bg-[#EC1C24] px-4 py-2.5 text-[14px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      Назначить
                    </button>
                  </div>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <style>
        {`
          @keyframes archiveToastIn {
            0% {
              opacity: 0;
              transform: translateY(12px) scale(0.98);
            }
            100% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
          }
          @keyframes archiveToastOut {
            0% {
              opacity: 1;
              transform: translateY(0) scale(1);
            }
            100% {
              opacity: 0;
              transform: translateY(8px) scale(0.98);
            }
          }
          @keyframes bookingCardHighlightBorder {
            0% {
              box-shadow: 0 0 0 0 rgba(236, 28, 36, 0), 0 8px 28px -6px rgba(236, 28, 36, 0);
            }
            20% {
              box-shadow: 0 0 0 3px #EC1C24, 0 8px 28px -6px rgba(236, 28, 36, 0.35);
            }
            70% {
              box-shadow: 0 0 0 3px #EC1C24, 0 8px 28px -6px rgba(236, 28, 36, 0.2);
            }
            100% {
              box-shadow: 0 0 0 0 rgba(236, 28, 36, 0), 0 8px 28px -6px rgba(236, 28, 36, 0);
            }
          }
          .service-menu-scroll {
            scrollbar-width: none;
            -ms-overflow-style: none;
          }
          .service-menu-scroll::-webkit-scrollbar {
            width: 0;
            height: 0;
            display: none;
          }
        `}
      </style>
    </div>
  );
}
