import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import { CURRENT_USER_ROLE } from "@/lib/session/currentUser";
import { appendJournalBookingSoonToFeed } from "@/lib/notifications/inAppNotificationFeed";
import { appendUserActionLog } from "@/lib/notifications/actionActivityLog";
import { emitArchiveStyleToast } from "@/lib/notifications/inAppArchiveToastBus";
import type { CSSProperties, KeyboardEvent, MouseEvent } from "react";
import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import type { Booking, Service, Slot } from "../../lib/booking-journal/getAvailableSlots";
import { getAvailableSlots, isSlotStillFree, slotKey } from "../../lib/booking-journal/getAvailableSlots";
import type { Car, Client } from "../../lib/booking-journal/bookingClientsSearch";
import { findClientsByNationalPhone, findClientsBySurname } from "../../lib/booking-journal/bookingClientsSearch";
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
  service: string;
  car: string;
  masterShortName: string;
  masterPhoto?: string;
  start: string;
  end: string;
  status?: BookingStatus;
  statusActor?: JournalStatusActor;
};

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
  "Клиент не приехал": "bg-[#FFF0F3]",
  Отменена: "bg-white",
};

/** Бейдж статуса (согласован с фоном слота). */
const JOURNAL_STATUS_CHIP: Record<BookingStatus, string> = {
  Подтверждена: "bg-[#BBF7D0] text-[#166534]",
  "Ожидает клиента": "bg-[#FEF3C7] text-[#854D0E]",
  "В работе": "bg-[#BFDBFE] text-[#1D4ED8]",
  Завершена: "bg-[#E5E7EB] text-[#374151]",
  "Клиент не приехал": "bg-[#FECACA] text-[#991B1B]",
  Отменена: "border border-[#991B1B] bg-white text-[#991B1B]",
};

/** Цвет плашки времени внутри карточки по статусу слота. */
const JOURNAL_STATUS_TIME_BADGE: Record<BookingStatus, string> = {
  Подтверждена: "bg-[#26B36A] text-white",
  "Ожидает клиента": "bg-[#D5A321] text-white",
  "В работе": "bg-[#2F7FEA] text-white",
  Завершена: "bg-[#7B8494] text-white",
  "Клиент не приехал": "bg-[#D95368] text-white",
  Отменена: "bg-[#991B1B] text-white",
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
  service: string;
  car: string;
  status?: BookingStatus;
  statusActor?: JournalStatusActor;
};

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

function rowsToBoxColumns(rows: JournalRow[], day: string): BoxColumn[] {
  const dayRows = rows.filter((r) => r.startTime.slice(0, 10) === day);
  return BOX_COLUMN_LAYOUT.map((col) => ({
    title: col.title,
    worker: col.worker,
    cards: dayRows
      .filter((r) => r.boxId === col.boxId)
      .sort((a, b) => a.startTime.localeCompare(b.startTime))
      .map((r) => ({
        id: r.id,
        title: toClientShortName(r.clientTitle),
        service: r.service,
        car: r.car,
        masterShortName: JOURNAL_MASTERS.find((m) => m.id === r.masterId)?.name ?? r.masterId,
        masterPhoto: JOURNAL_MASTERS.find((m) => m.id === defaultMasterIdForBox(r.boxId))?.photoUrl,
        start: r.startTime.slice(11, 16),
        end: r.endTime.slice(11, 16),
        status: r.status,
        statusActor: r.statusActor,
      })),
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

/** Как в карточках макета: «Toyota Camry  123ВС777». */
function formatCarLine(carModel: string, plateOrVin: string): string {
  const m = carModel.trim();
  const p = plateOrVin.trim();
  if (m && p) return `${m}  ${p}`;
  return m || p || "—";
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
const GENERAL_SERVICE_IDS = new Set([
  "exp1", "exp2", "exp3", "exp4",
  "std2", "std3", "std4",
  "cmp1", "cmp2", "cmp3", "cmp4",
]);

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
  const isManager = CURRENT_USER_ROLE === "manager";
  const [searchParams, setSearchParams] = useSearchParams();
  const bookingHighlightId = searchParams.get("booking");
  const bookingArticleRefs = useRef<Record<string, HTMLElement | null>>({});
  const bookingFocusResetFor = useRef<string | null>(null);
  const bookingScrollKey = useRef<string>("");
  const timelineHeight = timeSlots.length * 40;
  const [headerClock, setHeaderClock] = useState(formatHeaderClockNow);
  const [hoverLineY, setHoverLineY] = useState<number | null>(null);
  const [journalSearchQuery, setJournalSearchQuery] = useState("");
  const [journalRows, setJournalRows] = useState<JournalRow[]>(buildInitialRows);
  const [journalViewDate, setJournalViewDate] = useState<string>(() => journalTodayYmd());
  const [sidebarCalendarMonth, setSidebarCalendarMonth] = useState<{ year: number; month: number }>(() => {
    const { y, m } = parseYmdLocal(journalTodayYmd());
    return { year: y, month: m };
  });
  const [clients, setClients] = useState<Client[]>(MOCK_JOURNAL_CLIENTS);
  const [isNewBookingModalOpen, setIsNewBookingModalOpen] = useState(false);
  const [modalPrefill, setModalPrefill] = useState<ModalPrefill | null>(null);
  const [selectedService, setSelectedService] = useState<Service | null>(null);
  const [isServiceMenuOpen, setIsServiceMenuOpen] = useState(false);
  const [assignedMastersByDateBox, setAssignedMastersByDateBox] = useState<Record<string, string>>({});
  const [assignModalBoxId, setAssignModalBoxId] = useState<string | null>(null);
  const [assignModalSelectedMasterId, setAssignModalSelectedMasterId] = useState<string | null>(null);
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

  const callPhoneInputRef = useRef<HTMLInputElement>(null);
  const newClientPhoneInputRef = useRef<HTMLInputElement>(null);

  const displayColumns = useMemo(
    () => rowsToBoxColumns(journalRows, journalViewDate),
    [journalRows, journalViewDate],
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
  }, [searchParams, journalRows, journalViewDate, setSearchParams]);

  useLayoutEffect(() => {
    const bid = searchParams.get("booking");
    if (!bid) {
      bookingScrollKey.current = "";
      return;
    }
    const row = journalRows.find((r) => r.id === bid);
    if (!row) return;
    const day = row.startTime.slice(0, 10);
    if (journalViewDate !== day) return;
    const sk = `${bid}@${day}`;
    if (bookingScrollKey.current === sk) return;
    bookingScrollKey.current = sk;
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
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("booking");
          return next;
        },
        { replace: true },
      );
      bookingScrollKey.current = "";
      bookingFocusResetFor.current = null;
    }, 9000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(tid);
    };
  }, [searchParams, journalRows, journalViewDate, setSearchParams]);

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
        const hhmm = r.startTime.slice(11, 16);
        const line1 = `Скоро запись № ${r.id}`;
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

  function closeNewBookingModal() {
    setIsNewBookingModalOpen(false);
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
      setCurrentStep(1);
    }
  }

  function clickTimelineEmpty(e: MouseEvent, boxId: string, cards: BookingCard[]) {
    const t = e.target as HTMLElement;
    if (t.closest("article") || t.closest("button")) return;
    const el = e.currentTarget;
    const rect = el.getBoundingClientRect();
    const localY = e.clientY - rect.top;
    if (isLocalYInsideAnyCard(localY, cards)) return;
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
    openNewBookingModal({ boxId, startIso: `${journalViewDate}T${startLabel}:00`, gapEndMinute: gapEnd });
  }

  function confirmNewBooking() {
    if (currentStep !== 4 || !selectedService || !selectedSlot) return;

    let clientTitle = "";
    let carLine = "";

    if (selectedClient && selectedCar) {
      clientTitle = selectedClient.name;
      carLine = formatCarLine(selectedCar.model, selectedCar.plate);
    } else if (newClientName.trim() && newClientPhoneDigits.length === 10 && newClientCar.trim()) {
      const n = newClientName.trim();
      const ph = displayRuPhoneComplete(newClientPhoneDigits);
      const cm = newClientCar.trim();
      if (!n || !ph || !cm) {
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
    setJournalRows((prev) => [...prev, row]);
    closeNewBookingModal();
  }

  const boxName = selectedSlot ? JOURNAL_BOXES.find((b) => b.id === selectedSlot.boxId)?.name ?? "" : "";
  const masterName = selectedSlot ? JOURNAL_MASTERS.find((m) => m.id === selectedSlot.masterId)?.name ?? "" : "";
  const timeLabel = selectedSlot ? `${selectedSlot.startTime.slice(11, 16)} — ${selectedSlot.endTime.slice(11, 16)}` : "";
  const stepSlots = availableSlots;

  const stepLabels = ["Идентификация", "Тип обращения", "Время", "Подтверждение"] as const;

  return (
    <div className="h-screen w-screen overflow-hidden bg-black tracking-[-0.04em]">
      <div className="flex h-full w-full p-2">
        <div className="flex h-full w-full rounded-[16px] bg-black p-2 shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)]">
          <aside className="mr-2 flex w-[100px] flex-col items-center rounded-[11px] bg-black">
            <button className="mb-2 grid h-[90px] w-full place-items-center rounded-[16px] bg-[#EC1C24] text-[18px] font-semibold text-white">Марс</button>
            <button onClick={() => navigate("/dashboard")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="home" /></button>
            <button onClick={() => navigate("/")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="cube" /></button>
            <button onClick={() => navigate("/journal")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] bg-white text-[#11131D]"><MarsShellSidebarIcon type="layers" /></button>
            <button onClick={() => navigate("/work-orders")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="chat" /></button>
            <button onClick={() => navigate("/clients")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="pie" /></button>
            <div className="mt-auto space-y-2">
              {!isManager ? <button className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="grid" /></button> : null}
              {!isManager ? <button className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="doc" /></button> : null}
              <NavRailNotifications />
              {!isManager ? (
                <button
                  type="button"
                  className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5] hover:bg-white/10"
                  title="Настройки"
                  aria-label="Настройки"
                >
                  <MarsShellSidebarIcon type="settings" />
                </button>
              ) : null}
              <button onClick={() => navigate("/profile")} className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="user" /></button>
            </div>
          </aside>

          <main className="relative flex min-h-0 flex-1 flex-col">
            <header className="mb-2 h-[90px] rounded-[16px] border border-[#DDE1E7] bg-white px-5">
              <div className="flex h-full items-center gap-3">
                <h1 className="text-[36px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">Журнал записей</h1>
                <div className="ml-6 flex h-full min-h-0 items-center justify-center gap-[20px]">
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
                <div className="ml-auto flex min-w-0 items-center gap-1.5">
                  <input
                    type="search"
                    value={journalSearchQuery}
                    onChange={(e) => setJournalSearchQuery(e.target.value)}
                    className="journal-header-search h-12 w-[320px] rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-[#8A8A8A] outline-none placeholder:text-[#B5B5B5] [color-scheme:light]"
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

            <section className="min-h-0 flex h-full flex-1 gap-4 rounded-[16px] bg-white px-5 py-5">
        <section className="min-h-0 h-full min-w-0 flex-1">
        <div className="journal-table-scroll h-full min-w-0 overflow-auto">
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
                    {isAllSlotsFreeDay && !hasAssignedMasterForDateBox ? (
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
                      <div className="mx-auto inline-flex items-center justify-center gap-[12px]">
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
                          <p className="text-[20px] font-semibold leading-none">{column.worker}</p>
                          <p className="text-[13px] font-medium leading-none text-[#7D7D81]">{column.title}</p>
                        </div>
                      </div>
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
                                    openNewBookingModal({
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
                          bookingHighlightId === card.id
                            ? "z-[22] shadow-[0_0_0_3px_#EC1C24,0_8px_28px_-6px_rgba(236,28,36,0.35)]"
                            : ""
                        }`}
                        style={{ top: calcTop(card.start), height: calcCardHeightInclusive(card.start, card.end) }}
                      >
                        <div
                          className={`-mx-3 -mt-3 mb-1.5 flex h-6 w-[calc(100%+24px)] shrink-0 items-center px-3 text-[14px] font-semibold leading-none ${
                            card.status ? JOURNAL_STATUS_TIME_BADGE[card.status] : "bg-[#6B7688] text-white"
                          }`}
                        >
                          <span>{card.start}–{card.end}</span>
                        </div>
                        <p className="mt-1 shrink-0 truncate text-[17px] font-semibold leading-[1.28]">{card.title}</p>
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

          <section className="w-[310px] shrink-0">
          <aside className="w-[310px] self-start bg-white">
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
            <section className="absolute bottom-5 right-5 w-[310px] rounded-[10px] border border-[#ECEEF1] bg-white px-5 py-5 font-medium">
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
                            <div className="mt-4 space-y-3">
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
