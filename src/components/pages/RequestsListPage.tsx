import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import {
  appendNewRequestFromSiteToFeed,
  appendRequestAssignedByLeadToFeed,
} from "@/lib/notifications/inAppNotificationFeed";
import { appendUserActionLog } from "@/lib/notifications/actionActivityLog";
import { emitArchiveStyleToast } from "@/lib/notifications/inAppArchiveToastBus";
import { CURRENT_USER_DISPLAY_NAME as KAPROV, CURRENT_USER_ROLE } from "@/lib/session/currentUser";
import type { ComponentType } from "react";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";
import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import {
  RequestActionIconAssignLead,
  RequestActionIconEdit,
  RequestActionIconGetJob,
  RequestActionIconPhone,
  RequestActionIconStatus,
  RequestActionIconTrash,
  RequestActionIconZapis,
} from "../icons/RequestRowModalIcons";

type RequestStatus = "Новая" | "В запись" | "В обработке" | "Отказ";

type RequestStatusFilter = RequestStatus;

type DateCreationPreset = "today" | "yesterday" | "last7" | "last30" | "custom";

type RequestTableRow = {
  id: string;
  status: RequestStatus;
  client: string;
  phone: string;
  manager: string | null;
  managerPhoto: string | null;
  source: "Сайт" | "Звонок" | "Визит";
  createdAt: string;
  lastActivityAt: string;
  archived?: boolean;
  comment: string;
};

type RequestSource = RequestTableRow["source"];

const TOTAL_REQUESTS_SHOWN = 127;
const PAGE_SIZE = 12;
const PAGINATION_TOTAL_PAGES = 7;
const REQUEST_STATUS_FILTERS: RequestStatusFilter[] = ["Новая", "В запись", "В обработке", "Отказ"];
const ALL_SOURCES: RequestSource[] = ["Сайт", "Звонок", "Визит"];

function formatRuDateFromDate(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yy = d.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

function boundsForDatePreset(preset: DateCreationPreset): { from: string; to: string } {
  const now = new Date();
  const today0 = startOfDay(now);
  if (preset === "today") {
    const s = formatRuDateFromDate(today0);
    return { from: s, to: s };
  }
  if (preset === "yesterday") {
    const y = new Date(today0);
    y.setDate(y.getDate() - 1);
    const s = formatRuDateFromDate(y);
    return { from: s, to: s };
  }
  if (preset === "last7") {
    const start = new Date(today0);
    start.setDate(start.getDate() - 6);
    return { from: formatRuDateFromDate(start), to: formatRuDateFromDate(today0) };
  }
  if (preset === "last30") {
    const start = new Date(today0);
    start.setDate(start.getDate() - 29);
    return { from: formatRuDateFromDate(start), to: formatRuDateFromDate(today0) };
  }
  return { from: "", to: "" };
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

function maskRuDateInput(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function maskRuPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, "");
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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

/** Одна строка превью: обрезка + пробел + «...» */
function previewComment(text: string, maxChars = 22): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars).trimEnd()} ...`;
}

/** Подсказка всегда справа от курсора; по вертикали — как раньше; maxWidth ужимается у правого края окна. */
/** Внешний вид как на странице «База клиентов»: пустой квадрат / красный с галочкой */
function ClientsStyleCheckboxBox({ checked, dark }: { checked: boolean; dark: boolean }) {
  if (checked) {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-[#d51a21] text-white">
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <path d="M3 8L6.2 11L13 4.5" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-[2px] ${dark ? "border-[#6B758A]" : "border-[#D8DBDE]"}`}
    />
  );
}

function clampCommentTooltipPos(
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

const requestStatusColorMap: Record<RequestStatus, string> = {
  Новая: "#00B515",
  "В запись": "#2E78C9",
  Отказ: "#E00919",
  "В обработке": "#F39D00",
};

const KAPROV_PHOTO = "https://i.pravatar.cc/80?img=15";

const initialRequestRows: RequestTableRow[] = [
  { id: "294894", status: "Новая", client: "Иванов Артём Сергеевич", phone: "+7 (999) 111-22-33", manager: null, managerPhoto: null, source: "Сайт", createdAt: "04.04.2026", lastActivityAt: "04.04.2026", comment: "Стучит подвеска, нужна диагностика ходовой." },
  { id: "593423", status: "В запись", client: "Смирнова Наталья Викторовна", phone: "+7 (999) 222-33-44", manager: KAPROV, managerPhoto: KAPROV_PHOTO, source: "Сайт", createdAt: "07.04.2026", lastActivityAt: "08.04.2026", comment: "Просит записать на замену масла и фильтров." },
  { id: "839022", status: "Отказ", client: 'ООО "Сад"', phone: "+7 (999) 333-44-55", manager: KAPROV, managerPhoto: KAPROV_PHOTO, source: "Сайт", createdAt: "10.04.2026", lastActivityAt: "10.04.2026", comment: "Проблема с кондиционером, не охлаждает." },
  { id: "847952", status: "Отказ", client: "ИП Лебедев Максим Олегович", phone: "+7 (999) 444-55-66", manager: KAPROV, managerPhoto: KAPROV_PHOTO, source: "Сайт", createdAt: "14.04.2026", lastActivityAt: "14.04.2026", comment: "Горит чек двигателя, нужна диагностика." },
  { id: "495783", status: "В обработке", client: 'ООО "ЭкоМобил"', phone: "+7 (999) 555-66-77", manager: KAPROV, managerPhoto: KAPROV_PHOTO, source: "Сайт", createdAt: "16.04.2026", lastActivityAt: "18.04.2026", comment: "Интересуется стоимостью ремонта тормозной системы." },
  { id: "987384", status: "Новая", client: "Белов Алексей Игоревич", phone: "+7 (999) 666-77-88", manager: null, managerPhoto: null, source: "Звонок", createdAt: "19.04.2026", lastActivityAt: "19.04.2026", comment: "Звонил, интересуется ремонтом коробки, сказал “подумаю”." },
  { id: "284750", status: "Отказ", client: "Фролова Алина Андреевна", phone: "+7 (999) 777-88-99", manager: "Романова Лилия", managerPhoto: "https://i.pravatar.cc/80?img=5", source: "Звонок", createdAt: "21.04.2026", lastActivityAt: "21.04.2026", comment: "Обсудили ТО, попросил перезвонить позже." },
  { id: "847597", status: "В обработке", client: "Журавлёв Михаил Дмитриевич", phone: "+7 (999) 888-99-00", manager: "Журавлёв Михаил", managerPhoto: "https://i.pravatar.cc/80?img=41", source: "Звонок", createdAt: "23.04.2026", lastActivityAt: "24.04.2026", comment: "Уточнил цену ремонта подвески, взял время на решение." },
  { id: "658472", status: "В запись", client: 'ООО "ГрузСервис"', phone: "+7 (999) 000-11-22", manager: KAPROV, managerPhoto: KAPROV_PHOTO, source: "Звонок", createdAt: "25.04.2026", lastActivityAt: "26.04.2026", comment: "Интересовался диагностикой двигателя, пока не готов записаться." },
  { id: "309845", status: "Отказ", client: 'ООО "ТехноТрак"', phone: "+7 (999) 101-22-33", manager: KAPROV, managerPhoto: KAPROV_PHOTO, source: "Звонок", createdAt: "27.04.2026", lastActivityAt: "27.04.2026", comment: "Сказал, что сравнит цены с другими сервисами." },
  { id: "208476", status: "Новая", client: "Гаврилова Ирина Михайловна", phone: "+7 (999) 202-33-44", manager: null, managerPhoto: null, source: "Визит", createdAt: "29.04.2026", lastActivityAt: "29.04.2026", comment: "Заезжал лично, интересовался ремонтом тормозов, ушёл подумать." },
  { id: "989923", status: "Отказ", client: 'ООО "ЭкспрессТранс"', phone: "+7 (999) 303-44-55", manager: "Алексеев Дмитрий", managerPhoto: "https://i.pravatar.cc/80?img=12", source: "Визит", createdAt: "01.05.2026", lastActivityAt: "01.05.2026", comment: "Приехал на консультацию, цену услышал, записываться не стал." },
  { id: "923117", status: "В запись", client: "Кузнецов Павел Андреевич", phone: "+7 (999) 404-55-66", manager: "Алексеев Дмитрий", managerPhoto: "https://i.pravatar.cc/80?img=12", source: "Визит", createdAt: "03.05.2026", lastActivityAt: "03.05.2026", comment: "Был в сервисе, осмотрели визуально, клиент взял паузу." },
  { id: "731550", status: "В обработке", client: 'ООО "Магистраль"', phone: "+7 (999) 505-66-77", manager: "Семёнова Елена", managerPhoto: "https://i.pravatar.cc/80?img=32", source: "Звонок", createdAt: "04.05.2026", lastActivityAt: "04.05.2026", comment: "Постоянный клиент, уточнил стоимость доп. работ, пока без записи." },
  { id: "615004", status: "Отказ", client: "Орлова Анна Вячеславовна", phone: "+7 (999) 606-77-88", manager: KAPROV, managerPhoto: KAPROV_PHOTO, source: "Сайт", createdAt: "05.05.2026", lastActivityAt: "05.05.2026", comment: "Обратился по рекомендации, интересуется диагностикой, решение не принял." },
];

function SortIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] shrink-0 text-current" aria-hidden>
      <path
        d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

type FilterPanelId = "status" | "date";
const FILTER_KEYS: { id: FilterPanelId; label: string }[] = [
  { id: "status", label: "Статус" },
  { id: "date", label: "Дата создания" },
];

type RequestActionId = "call" | "booking" | "takeWork" | "assignByLead" | "status" | "edit" | "delete";

type RequestActionEntry = {
  id: RequestActionId;
  label: string;
  Icon: ComponentType<{ className?: string }>;
  danger?: boolean;
};

type EditRequestDraft = {
  client: string;
  phone: string;
  source: RequestSource;
  comment: string;
};

type CreateRequestDraft = {
  client: string;
  phone: string;
  comment: string;
};

type SortKey = "client" | "phone" | "status" | "manager" | "comment" | "createdAt";
type SortDir = "asc" | "desc";

const STATUS_SORT_RANK: Record<RequestStatus, number> = {
  Новая: 1,
  "В запись": 2,
  "В обработке": 3,
  Отказ: 4,
};

function phoneToTelHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  if (digits.startsWith("+")) return `tel:${digits}`;
  if (digits.startsWith("8") && digits.length >= 11) return `tel:+7${digits.slice(1)}`;
  if (digits.startsWith("7")) return `tel:+${digits}`;
  return `tel:${digits}`;
}

function exportRequestsToXlsx(requests: RequestTableRow[]) {
  const data = requests.map((r) => ({
    "№ заявки": r.id,
    Статус: r.status,
    Клиент: r.client,
    Телефон: r.phone,
    Менеджер: r.manager ?? "",
    "Дата создания": r.createdAt,
    Комментарий: r.comment,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Заявки");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `zayavki_${stamp}.xlsx`);
}

function formatRuDateToday(): string {
  return formatRuDateFromDate(new Date());
}

export function RequestsListPage() {
  const navigate = useNavigate();
  const isManager = CURRENT_USER_ROLE === "manager";
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightRequestId = searchParams.get("request");
  const requestRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const focusRequestFiltersResetFor = useRef<string | null>(null);
  const focusRequestScrollKey = useRef<string>("");
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [unassignedOnly, setUnassignedOnly] = useState(false);
  const [mineOnly, setMineOnly] = useState(false);
  const [overdueOnly, setOverdueOnly] = useState(false);
  const [archiveOnly, setArchiveOnly] = useState(false);
  const [commentTooltip, setCommentTooltip] = useState<{ text: string; x: number; y: number; maxWidth: number } | null>(null);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [openFilter, setOpenFilter] = useState<FilterPanelId | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<RequestStatusFilter>>(() => new Set(REQUEST_STATUS_FILTERS));
  const [datePreset, setDatePreset] = useState<DateCreationPreset | null>(null);
  const [dateFromInput, setDateFromInput] = useState("");
  const [dateToInput, setDateToInput] = useState("");
  const [requestActionsModal, setRequestActionsModal] = useState<RequestTableRow | null>(null);
  const [statusPickerForId, setStatusPickerForId] = useState<string | null>(null);
  const [bulkStatusPickerIds, setBulkStatusPickerIds] = useState<string[] | null>(null);
  const [editRequestId, setEditRequestId] = useState<string | null>(null);
  const [editRequestDraft, setEditRequestDraft] = useState<EditRequestDraft | null>(null);
  const [createRequestDraft, setCreateRequestDraft] = useState<CreateRequestDraft | null>(null);
  const [archivingRowId, setArchivingRowId] = useState<string | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationWindowStart, setPaginationWindowStart] = useState<1 | 4>(1);
  const [sortState, setSortState] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [rows, setRows] = useState<RequestTableRow[]>(() => initialRequestRows.map((r) => ({ ...r })));
  const rowsNotifyPrevRef = useRef(rows);
  const selfTakeWorkRequestIdsRef = useRef(new Set<string>());
  const manuallyCreatedRequestIdsRef = useRef(new Set<string>());

  const unassignedCount = useMemo(() => rows.filter((r) => r.status === "Новая" && r.manager === null).length, [rows]);
  const mineCount = useMemo(() => rows.filter((r) => r.manager === KAPROV).length, [rows]);
  const overdueCount = useMemo(
    () =>
      rows.filter((r) => {
        if (r.status === "Новая") {
          const createdAtTs = parseRuDate(r.createdAt)?.getTime();
          return r.manager === null && createdAtTs !== undefined && createdAtTs !== null && Date.now() - createdAtTs > 24 * 60 * 60 * 1000;
        }
        if (r.status === "В обработке") {
          const lastActivityTs = parseRuDate(r.lastActivityAt)?.getTime();
          return r.manager !== null && lastActivityTs !== undefined && lastActivityTs !== null && Date.now() - lastActivityTs > 24 * 60 * 60 * 1000;
        }
        return false;
      }).length,
    [rows],
  );
  const archiveCount = useMemo(() => rows.filter((r) => Boolean(r.archived)).length, [rows]);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = filterBarRef.current;
      if (!el || !openFilter) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpenFilter(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openFilter]);

  useEffect(() => {
    if (!requestActionsModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setRequestActionsModal(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [requestActionsModal]);

  useEffect(() => {
    if (!statusPickerForId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setStatusPickerForId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [statusPickerForId]);

  useEffect(() => {
    if (statusPickerForId && !rows.some((r) => r.id === statusPickerForId)) setStatusPickerForId(null);
  }, [rows, statusPickerForId]);

  useEffect(() => {
    if (editRequestId && !rows.some((r) => r.id === editRequestId)) {
      setEditRequestId(null);
      setEditRequestDraft(null);
    }
  }, [rows, editRequestId]);

  useEffect(() => {
    const prev = rowsNotifyPrevRef.current;
    if (!Object.is(prev, rows)) {
      const prevById = new Map(prev.map((r) => [r.id, r.manager]));
      const prevIds = new Set(prev.map((r) => r.id));
      for (const r of rows) {
        if (!prevIds.has(r.id)) {
          if (manuallyCreatedRequestIdsRef.current.has(r.id)) {
            manuallyCreatedRequestIdsRef.current.delete(r.id);
            emitArchiveStyleToast({
              line1: `Создана заявка № ${r.id}`,
              line2: `${r.client} · ${r.phone}`,
            });
            appendUserActionLog({
              title: "Создать заявку",
              description: `Заявка № ${r.id} · ${r.client}`,
            });
            continue;
          }
          if (r.source === "Сайт") {
            appendNewRequestFromSiteToFeed({ requestId: r.id, client: r.client, phone: r.phone });
            emitArchiveStyleToast({
              line1: `Новая заявка с сайта № ${r.id} (${r.client})`,
              line2: `${r.phone} · поступила с сайта`,
            });
          }
          continue;
        }
        const oldM = prevById.get(r.id);
        if (oldM !== r.manager && r.manager === KAPROV) {
          if (selfTakeWorkRequestIdsRef.current.has(r.id)) {
            selfTakeWorkRequestIdsRef.current.delete(r.id);
            continue;
          }
          appendRequestAssignedByLeadToFeed({ requestId: r.id, client: r.client });
          emitArchiveStyleToast({
            line1: `Назначена заявка № ${r.id}`,
            line2: r.client,
          });
        }
      }
    }
    rowsNotifyPrevRef.current = rows;
  }, [rows]);

  const displayRows = useMemo(() => {
    const qText = searchQuery.trim().toLowerCase();
    const qDigits = searchQuery.replace(/\D/g, "");
    const fromD = parseRuDate(dateFromInput);
    const toD = parseRuDate(dateToInput);
    const fromBound = fromD ? startOfDay(fromD) : null;
    const toBound = toD ? endOfDay(toD) : null;

    return rows.filter((row) => {
      if (qText) {
        const byClient = row.client.toLowerCase().includes(qText);
        const byPhone = qDigits.length > 0 && row.phone.replace(/\D/g, "").includes(qDigits);
        if (!byClient && !byPhone) return false;
      }
      if (unassignedOnly && (row.status !== "Новая" || row.manager !== null)) return false;
      if (mineOnly && row.manager !== KAPROV) return false;
      if (overdueOnly) {
        const nowTs = Date.now();
        if (row.status === "Новая") {
          const createdAtTs = parseRuDate(row.createdAt)?.getTime();
          if (!(row.manager === null && createdAtTs !== undefined && createdAtTs !== null && nowTs - createdAtTs > 24 * 60 * 60 * 1000)) return false;
        } else if (row.status === "В обработке") {
          const lastActivityTs = parseRuDate(row.lastActivityAt)?.getTime();
          if (!(row.manager !== null && lastActivityTs !== undefined && lastActivityTs !== null && nowTs - lastActivityTs > 24 * 60 * 60 * 1000)) return false;
        } else {
          return false;
        }
      }
      if (archiveOnly) {
        if (!row.archived) return false;
      } else {
        if (row.archived) return false;
        if (!statusFilter.has(row.status)) return false;
      }
      const rowDate = parseRuDate(row.createdAt);
      if (fromBound && (!rowDate || rowDate < fromBound)) return false;
      if (toBound && (!rowDate || rowDate > toBound)) return false;

      return true;
    });
  }, [rows, searchQuery, unassignedOnly, mineOnly, overdueOnly, archiveOnly, statusFilter, dateFromInput, dateToInput]);

  const sortedRows = useMemo(() => {
    if (!sortState) return displayRows;
    const arr = [...displayRows];
    const factor = sortState.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortState.key === "client") cmp = a.client.localeCompare(b.client, "ru");
      else if (sortState.key === "phone") cmp = a.phone.replace(/\D/g, "").localeCompare(b.phone.replace(/\D/g, ""));
      else if (sortState.key === "status") cmp = STATUS_SORT_RANK[a.status] - STATUS_SORT_RANK[b.status];
      else if (sortState.key === "manager") cmp = (a.manager ?? "").localeCompare(b.manager ?? "", "ru");
      else if (sortState.key === "comment") cmp = a.comment.localeCompare(b.comment, "ru");
      else if (sortState.key === "createdAt") {
        const ad = parseRuDate(a.createdAt)?.getTime() ?? 0;
        const bd = parseRuDate(b.createdAt)?.getTime() ?? 0;
        cmp = ad - bd;
      }
      if (cmp === 0) return a.id.localeCompare(b.id);
      return cmp * factor;
    });
    return arr;
  }, [displayRows, sortState]);

  useLayoutEffect(() => {
    const rid = searchParams.get("request");
    if (!rid) {
      focusRequestFiltersResetFor.current = null;
      return;
    }
    if (!rows.some((r) => r.id === rid)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("request");
          return next;
        },
        { replace: true },
      );
      focusRequestFiltersResetFor.current = null;
      return;
    }
    if (focusRequestFiltersResetFor.current === rid) return;
    focusRequestFiltersResetFor.current = rid;
    setSearchQuery("");
    setUnassignedOnly(false);
    setMineOnly(false);
    setOverdueOnly(false);
    setArchiveOnly(false);
    setOpenFilter(null);
    setSelectedRowIds(new Set());
    setStatusFilter(new Set(REQUEST_STATUS_FILTERS));
    setDatePreset(null);
    setDateFromInput("");
    setDateToInput("");
    setSortState(null);
  }, [searchParams, rows, setSearchParams]);

  useLayoutEffect(() => {
    const rid = searchParams.get("request");
    if (!rid) {
      focusRequestScrollKey.current = "";
      return;
    }
    const idx = sortedRows.findIndex((r) => r.id === rid);
    if (idx === -1) return;
    const scrollKey = `${rid}@${idx}`;
    if (focusRequestScrollKey.current === scrollKey) return;
    focusRequestScrollKey.current = scrollKey;
    setCurrentPage(Math.floor(idx / PAGE_SIZE) + 1);
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        requestRowRefs.current[rid]?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
    const tid = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("request");
          return next;
        },
        { replace: true },
      );
      focusRequestScrollKey.current = "";
      focusRequestFiltersResetFor.current = null;
    }, 9000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(tid);
    };
  }, [searchParams, sortedRows, setSearchParams]);

  const totalPages = PAGINATION_TOTAL_PAGES;
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageStart = (currentPageSafe - 1) * PAGE_SIZE;
  const pagedRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE);
  const pageEnd = Math.min(pageStart + pagedRows.length, sortedRows.length);
  const paginationItems: Array<number | "ellipsis"> = [
    paginationWindowStart,
    paginationWindowStart + 1,
    paginationWindowStart + 2,
    "ellipsis",
    totalPages,
  ];
  const paginationActiveIndex =
    currentPageSafe === totalPages
      ? 4
      : currentPageSafe >= paginationWindowStart && currentPageSafe <= paginationWindowStart + 2
        ? currentPageSafe - paginationWindowStart
        : 0;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setPaginationWindowStart(currentPageSafe >= 4 ? 4 : 1);
  }, [currentPageSafe]);

  const requestModalActions = useMemo((): RequestActionEntry[] => {
    if (!requestActionsModal) return [];
    if (selectedRowIds.size > 1) {
      return [
        { id: "takeWork", label: "Взять в работу", Icon: RequestActionIconGetJob },
        { id: "status", label: "Изменить статус", Icon: RequestActionIconStatus },
        { id: "delete", label: "Переместить в архив", Icon: RequestActionIconTrash, danger: true },
      ];
    }
    const row = rows.find((r) => r.id === requestActionsModal.id) ?? requestActionsModal;
    const list: RequestActionEntry[] = [
      { id: "call", label: "Позвонить", Icon: RequestActionIconPhone },
      { id: "booking", label: "Перенести в запись", Icon: RequestActionIconZapis },
    ];
    if (row.manager === null) {
      list.push({ id: "takeWork", label: "Взять в работу", Icon: RequestActionIconGetJob });
      if (!isManager) {
        list.push({
          id: "assignByLead",
          label: "Назначить ответственным (руководитель)",
          Icon: RequestActionIconAssignLead,
        });
      }
    }
    list.push(
      { id: "status", label: "Изменить статус", Icon: RequestActionIconStatus },
      { id: "edit", label: "Редактировать заявку", Icon: RequestActionIconEdit },
      { id: "delete", label: "Переместить в архив", Icon: RequestActionIconTrash, danger: true },
    );
    return list;
  }, [requestActionsModal, rows, isManager, selectedRowIds]);

  function handleRequestModalAction(actionId: RequestActionId) {
    if (!requestActionsModal) return;
    const id = requestActionsModal.id;
    const isBulkAction = selectedRowIds.size > 1;
    const targetIds = isBulkAction ? Array.from(selectedRowIds) : [id];

    if (actionId === "call") {
      window.location.href = phoneToTelHref(requestActionsModal.phone);
      setRequestActionsModal(null);
      return;
    }

    if (actionId === "delete") {
      const firstArchived = rows.find((r) => r.id === targetIds[0]) ?? requestActionsModal;
      setRequestActionsModal(null);
      if (!isBulkAction) setArchivingRowId(id);
      window.setTimeout(
        () => {
          setRows((prev) => prev.map((r) => (targetIds.includes(r.id) ? { ...r, archived: true } : r)));
          setSelectedRowIds((prev) => {
            const next = new Set(prev);
            targetIds.forEach((tid) => next.delete(tid));
            return next;
          });
          setStatusPickerForId((openId) => (openId && targetIds.includes(openId) ? null : openId));
          setBulkStatusPickerIds(null);
          setArchivingRowId((current) => (current && targetIds.includes(current) ? null : current));
          emitArchiveStyleToast({
            line1: isBulkAction ? `${targetIds.length} заявок перемещены в архив` : `Заявка № ${firstArchived.id} (${firstArchived.client})`,
            line2: isBulkAction ? "без изменения статуса" : "перемещена в архив",
          });
          appendUserActionLog({
            title: "Переместить в архив",
            description: isBulkAction
              ? `Групповое действие · ${targetIds.length} заявок`
              : `Заявка № ${firstArchived.id} · ${firstArchived.client}`,
          });
        },
        isBulkAction ? 0 : 260,
      );
      return;
    }

    if (actionId === "takeWork") {
      targetIds.forEach((tid) => selfTakeWorkRequestIdsRef.current.add(tid));
      setRows((prev) =>
        prev.map((r) => (targetIds.includes(r.id) ? { ...r, manager: KAPROV, managerPhoto: KAPROV_PHOTO } : r)),
      );
      if (isBulkAction) setSelectedRowIds(new Set());
      setRequestActionsModal(null);
      return;
    }

    if (actionId === "assignByLead") {
      setRows((prev) =>
        prev.map((r) => (r.id === id ? { ...r, manager: KAPROV, managerPhoto: KAPROV_PHOTO } : r)),
      );
      setRequestActionsModal(null);
      return;
    }

    if (actionId === "status") {
      setRequestActionsModal(null);
      if (isBulkAction) {
        setBulkStatusPickerIds(targetIds);
      } else {
        setStatusPickerForId(id);
      }
      return;
    }

    if (actionId === "edit") {
      const row = rows.find((r) => r.id === id) ?? requestActionsModal;
      setRequestActionsModal(null);
      setEditRequestId(id);
      setEditRequestDraft({
        client: row.client,
        phone: row.phone,
        source: row.source,
        comment: row.comment,
      });
      return;
    }

    setRequestActionsModal(null);
  }

  function commitRequestStatus(status: RequestStatus, requestIds?: string[]) {
    const ids = requestIds ?? (statusPickerForId ? [statusPickerForId] : []);
    if (ids.length === 0) return;
    setRows((prev) =>
      prev.map((r) =>
        ids.includes(r.id)
          ? {
              ...r,
              status,
              lastActivityAt: formatRuDateToday(),
              manager: status === "Отказ" ? (r.manager ?? KAPROV) : r.manager,
              managerPhoto: status === "Отказ" ? (r.managerPhoto ?? KAPROV_PHOTO) : r.managerPhoto,
            }
          : r,
      ),
    );
    setStatusPickerForId(null);
    setBulkStatusPickerIds(null);
    setSelectedRowIds((prev) => {
      if (prev.size === 0) return prev;
      const next = new Set(prev);
      ids.forEach((tid) => next.delete(tid));
      return next;
    });
  }

  function commitRequestEdit() {
    if (!editRequestId || !editRequestDraft) return;
    const normalizedClient = editRequestDraft.client.trim();
    const normalizedPhone = editRequestDraft.phone.trim();
    const normalizedComment = editRequestDraft.comment.trim();
    if (!normalizedClient || !normalizedPhone || !normalizedComment) return;

    setRows((prev) =>
      prev.map((r) =>
        r.id === editRequestId
          ? {
              ...r,
              client: normalizedClient,
              phone: normalizedPhone,
              source: editRequestDraft.source,
              comment: normalizedComment,
            }
          : r,
      ),
    );
    setEditRequestId(null);
    setEditRequestDraft(null);
  }

  const noActiveFilters =
    !searchQuery.trim() &&
    statusFilter.size === REQUEST_STATUS_FILTERS.length &&
    datePreset === null &&
    !dateFromInput.trim() &&
    !dateToInput.trim() &&
    !unassignedOnly &&
    !mineOnly &&
    !overdueOnly &&
    !archiveOnly;

  const allPageRowsSelected = pagedRows.length > 0 && pagedRows.every((r) => selectedRowIds.has(r.id));

  function toggleSort(key: SortKey) {
    setSortState((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function toggleRowSelection(id: string) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedRowIds((prev) => {
      if (pagedRows.length === 0) return prev;
      const all = pagedRows.every((r) => prev.has(r.id));
      if (all) {
        const next = new Set(prev);
        pagedRows.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      pagedRows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  const filterToggleRowClass = "flex cursor-pointer items-center gap-2 text-[16px] font-medium tracking-[-0.04em]";
  const filterToggleTitleClass = isDarkTheme ? "text-[#F4F7FF]" : "text-black";
  const filterToggleCountClass = isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]";

  function resetFilters() {
    setSearchQuery("");
    setUnassignedOnly(false);
    setMineOnly(false);
    setOverdueOnly(false);
    setArchiveOnly(false);
    setSelectedRowIds(new Set());
    setOpenFilter(null);
    setStatusFilter(new Set(REQUEST_STATUS_FILTERS));
    setDatePreset(null);
    setDateFromInput("");
    setDateToInput("");
  }

  function toggleQuickFilter(filter: "overdue" | "unassigned" | "mine" | "archive") {
    if (filter === "overdue") {
      const next = !overdueOnly;
      setOverdueOnly(next);
      setUnassignedOnly(false);
      setMineOnly(false);
      setArchiveOnly(false);
      return;
    }
    if (filter === "unassigned") {
      const next = !unassignedOnly;
      setUnassignedOnly(next);
      setOverdueOnly(false);
      setMineOnly(false);
      setArchiveOnly(false);
      return;
    }
    if (filter === "mine") {
      const next = !mineOnly;
      setMineOnly(next);
      setOverdueOnly(false);
      setUnassignedOnly(false);
      setArchiveOnly(false);
      return;
    }
    const next = !archiveOnly;
    setArchiveOnly(next);
    setOverdueOnly(false);
    setUnassignedOnly(false);
    setMineOnly(false);
  }

  function toggleStatus(s: RequestStatusFilter) {
    setStatusFilter((prev) => {
      const next = new Set(prev);
      if (next.has(s)) {
        next.delete(s);
        if (next.size === 0) return new Set(REQUEST_STATUS_FILTERS);
        return next;
      }
      next.add(s);
      return next;
    });
  }

  function applyPresetToDateInputs(preset: Exclude<DateCreationPreset, "custom">) {
    const b = boundsForDatePreset(preset);
    setDatePreset(preset);
    setDateFromInput(b.from);
    setDateToInput(b.to);
  }

  function filterChipActive(id: FilterPanelId): boolean {
    if (openFilter === id) return true;
    if (id === "status" && statusFilter.size < REQUEST_STATUS_FILTERS.length) return true;
    if (id === "date" && (datePreset !== null || dateFromInput.trim() !== "" || dateToInput.trim() !== "")) return true;
    return false;
  }

  const panelBase = `absolute left-0 top-full z-30 mt-2 min-w-[240px] rounded-[10px] border p-3 shadow-lg ${
    isDarkTheme ? "border-[#2B3345] bg-[#1B2331]" : "border-[#DDE1E7] bg-white"
  }`;
  const panelOptionClass = `flex cursor-pointer items-center gap-2 py-1.5 text-[15px] font-medium tracking-[-0.04em] ${
    isDarkTheme ? "text-[#E8EDF8]" : "text-[#111111]"
  }`;

  const statusPickerRow = statusPickerForId ? rows.find((r) => r.id === statusPickerForId) ?? null : null;
  const isBulkStatusPicker = Boolean(bulkStatusPickerIds && bulkStatusPickerIds.length > 0);
  const editRequestRow = editRequestId ? rows.find((r) => r.id === editRequestId) ?? null : null;

  function commitCreateRequest() {
    if (!createRequestDraft) return;
    const normalizedClient = createRequestDraft.client.trim();
    const normalizedPhone = createRequestDraft.phone.trim();
    const normalizedComment = createRequestDraft.comment.trim();
    if (!normalizedClient || !normalizedPhone || !normalizedComment) return;
    const id = String(Math.floor(100000 + Math.random() * 900000));
    const createdAt = formatRuDateToday();
    const newRow: RequestTableRow = {
      id,
      status: "Новая",
      client: normalizedClient,
      phone: normalizedPhone,
      manager: KAPROV,
      managerPhoto: KAPROV_PHOTO,
      source: "Сайт",
      createdAt,
      lastActivityAt: createdAt,
      comment: normalizedComment,
    };
    manuallyCreatedRequestIdsRef.current.add(id);
    setRows((prev) => [newRow, ...prev]);
    setCreateRequestDraft(null);
  }

  return (
    <div className={`h-screen w-screen overflow-hidden ${isDarkTheme ? "bg-[#0C0F14]" : "bg-black"}`}>
      <div className="flex h-full w-full p-2">
        <div className={`flex h-full w-full rounded-[16px] p-2 shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)] ${isDarkTheme ? "bg-[#0C0F14]" : "bg-black"}`}>
          <aside className="mr-2 flex w-[100px] flex-col items-center rounded-[11px] bg-black">
            <button className="mb-2 grid h-[90px] w-full place-items-center rounded-[16px] bg-[#EC1C24] text-[18px] font-semibold text-white">Марс</button>
            <button onClick={() => navigate("/dashboard")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="home" /></button>
            <button onClick={() => navigate("/")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] bg-white text-[#11131D]"><MarsShellSidebarIcon type="cube" /></button>
            <button onClick={() => navigate("/journal")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="layers" /></button>
            <button onClick={() => navigate("/work-orders")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="chat" /></button>
            <button onClick={() => navigate("/clients")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="pie" /></button>
            <div className="mt-auto space-y-2">
              <button
                onClick={() => setIsDarkTheme((prev) => !prev)}
                className={`grid h-12 w-12 place-items-center rounded-[10px] transition ${
                  isDarkTheme ? "bg-white text-[#11131D]" : "text-[#8C93A5] hover:bg-white/10"
                }`}
                title="Переключить тему"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-[24px] w-[24px]">
                  {isDarkTheme ? (
                    <>
                      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
                      <path d="M12 2.8V5.1M12 18.9V21.2M2.8 12H5.1M18.9 12H21.2M5.2 5.2L6.9 6.9M17.1 17.1L18.8 18.8M18.8 5.2L17.1 6.9M6.9 17.1L5.2 18.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    </>
                  ) : (
                    <path d="M15.8 3.6C13.8 3.9 11.9 5 10.8 6.7C9.7 8.4 9.5 10.6 10.2 12.5C10.9 14.4 12.3 15.9 14.2 16.7C16.2 17.5 18.4 17.4 20.2 16.4C19.4 18 18.1 19.4 16.5 20.3C14.8 21.2 12.9 21.5 11 21.1C9 20.7 7.2 19.6 5.9 18C4.6 16.4 3.9 14.4 4 12.3C4.1 10.3 4.9 8.3 6.3 6.9C7.7 5.4 9.6 4.5 11.6 4.2C13 3.9 14.4 3.8 15.8 3.6Z" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                  )}
                </svg>
              </button>
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

          <main className="flex min-h-0 flex-1 flex-col">
            <header className={`mb-2 rounded-[16px] border px-5 py-5 ${isDarkTheme ? "border-[#232937] bg-[#131925]" : "border-[#DDE1E7] bg-white"}`}>
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-2">
                  <h1 className={`text-[36px] font-bold leading-[100%] tracking-[-0.04em] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}>Заявки</h1>
                  <span className="text-[16px] font-medium tracking-[-0.04em] text-[#B4B4B6]">
                    {noActiveFilters ? `${TOTAL_REQUESTS_SHOWN} заявок` : `${displayRows.length} из ${TOTAL_REQUESTS_SHOWN}`}
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`h-12 w-[320px] rounded-[10px] border-[3px] px-3 text-[18px] font-medium tracking-[-0.04em] outline-none ${
                      isDarkTheme
                        ? "border-[#2B3345] bg-[#0E1420] text-[#C9D2E8] placeholder:text-[#7C879F]"
                        : "border-[#E4E5E7] bg-white text-[#8A8A8A] placeholder:text-[#B5B5B5]"
                    }`}
                    placeholder="Поиск по телефону или ФИО..."
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setCreateRequestDraft({
                        client: "",
                        phone: "",
                        comment: "",
                      })
                    }
                    className="h-12 cursor-pointer rounded-[10px] border-2 border-transparent bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out"
                  >
                    Создать заявку
                  </button>
                  <button
                    type="button"
                    onClick={() => exportRequestsToXlsx(noActiveFilters ? rows : sortedRows)}
                    className="h-12 shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-black px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out"
                  >
                    Экспорт в Excel
                  </button>
                </div>
              </div>
            </header>

            <section className={`flex min-h-0 flex-1 flex-col gap-5 rounded-[16px] border px-5 py-5 ${isDarkTheme ? "border-[#232937] bg-[#131925]" : "border-[#DDE1E7] bg-white"}`}>
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <div ref={filterBarRef} className="flex min-w-0 flex-wrap items-center gap-[10px] gap-y-3">
                  {FILTER_KEYS.map(({ id, label }) => (
                    <div key={id} className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenFilter((prev) => (prev === id ? null : id))}
                        className={`cursor-pointer rounded-[10px] px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] ${
                          filterChipActive(id)
                            ? isDarkTheme
                              ? "bg-[#EC1C24] text-white"
                              : "bg-[#EC1C24] text-white"
                            : isDarkTheme
                              ? "bg-[#202838] text-[#D3D9E8]"
                              : "bg-[#ECECEF] text-[#111111]"
                        }`}
                      >
                        <span className="flex items-center justify-center gap-[12px]">
                          <span>{label}</span>
                          <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            className={`h-[16px] w-[16px] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                              filterChipActive(id) ? "text-white" : isDarkTheme ? "text-[#D3D9E8]" : "text-[#111111]"
                            } ${openFilter === id ? "rotate-180" : "rotate-0"}`}
                          >
                            <path d="M3 6L8 11L13 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                      {openFilter === id && id === "status" && (
                        <div className={panelBase} role="dialog" aria-label="Фильтр по статусу">
                          {REQUEST_STATUS_FILTERS.map((s) => (
                            <span
                              key={s}
                              className={panelOptionClass}
                              onClick={() => toggleStatus(s)}
                              role="checkbox"
                              aria-checked={statusFilter.has(s)}
                            >
                              <ClientsStyleCheckboxBox checked={statusFilter.has(s)} dark={isDarkTheme} />
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {openFilter === id && id === "date" && (
                        <div className={panelBase} role="dialog" aria-label="Фильтр по дате создания">
                          <div className="flex flex-col gap-0.5">
                            {(
                              [
                                ["today", "Сегодня"],
                                ["yesterday", "Вчера"],
                                ["last7", "Последние 7 дней"],
                                ["last30", "Последние 30 дней"],
                              ] as const
                            ).map(([preset, label]) => (
                              <span
                                key={preset}
                                className={`${panelOptionClass} w-full rounded-[8px] ${datePreset === preset ? "bg-white text-[#111111]" : ""}`}
                                onClick={() => applyPresetToDateInputs(preset)}
                                role="checkbox"
                                aria-checked={datePreset === preset}
                              >
                                <ClientsStyleCheckboxBox checked={datePreset === preset} dark={isDarkTheme} />
                                {label}
                              </span>
                            ))}
                            <span
                              className={`${panelOptionClass} w-full rounded-[8px] ${datePreset === "custom" ? "bg-white text-[#111111]" : ""}`}
                              onClick={() => {
                                setDatePreset("custom");
                                setDateFromInput("");
                                setDateToInput("");
                              }}
                              role="checkbox"
                              aria-checked={datePreset === "custom"}
                            >
                              <ClientsStyleCheckboxBox checked={datePreset === "custom"} dark={isDarkTheme} />
                              Свой диапазон
                            </span>
                          </div>
                          {datePreset === "custom" ? (
                            <div className={`mt-3 flex flex-col gap-2 border-t pt-3 ${isDarkTheme ? "border-[#2B3345]" : "border-[#DDE1E7]"}`}>
                              <label className={`text-[13px] ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]"}`}>С</label>
                              <input
                                value={dateFromInput}
                                onChange={(e) => {
                                  setDateFromInput(maskRuDateInput(e.target.value));
                                  setDatePreset("custom");
                                }}
                                className={`h-10 rounded-[8px] border px-2 text-[15px] outline-none ${
                                  isDarkTheme ? "border-[#2B3345] bg-[#0E1420] text-[#E8EDF8] placeholder:text-[#7C879F]" : "border-[#E4E5E7] bg-white text-[#111111] placeholder:text-[#B5B5B5]"
                                }`}
                                placeholder="дд.мм.гггг"
                              />
                              <label className={`text-[13px] ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]"}`}>По</label>
                              <input
                                value={dateToInput}
                                onChange={(e) => {
                                  setDateToInput(maskRuDateInput(e.target.value));
                                  setDatePreset("custom");
                                }}
                                className={`h-10 rounded-[8px] border px-2 text-[15px] outline-none ${
                                  isDarkTheme ? "border-[#2B3345] bg-[#0E1420] text-[#E8EDF8] placeholder:text-[#7C879F]" : "border-[#E4E5E7] bg-white text-[#111111] placeholder:text-[#B5B5B5]"
                                }`}
                                placeholder="дд.мм.гггг"
                              />
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}
                  <div
                    className="flex flex-wrap items-center gap-6 pl-1 sm:pl-3"
                    onClick={(e) => e.stopPropagation()}
                    onMouseDown={(e) => e.stopPropagation()}
                  >
                    <span
                      className={`${filterToggleRowClass} shrink-0 cursor-pointer select-none`}
                      onClick={() => toggleQuickFilter("overdue")}
                      role="checkbox"
                      aria-checked={overdueOnly}
                    >
                      <ClientsStyleCheckboxBox checked={overdueOnly} dark={isDarkTheme} />
                      <span className={filterToggleTitleClass}>Просроченные заявки </span>
                      <span className={`tabular-nums ${filterToggleCountClass}`}>({overdueCount})</span>
                    </span>
                    <span
                      className={`${filterToggleRowClass} shrink-0 cursor-pointer select-none`}
                      onClick={() => toggleQuickFilter("unassigned")}
                      role="checkbox"
                      aria-checked={unassignedOnly}
                    >
                      <ClientsStyleCheckboxBox checked={unassignedOnly} dark={isDarkTheme} />
                      <span className={filterToggleTitleClass}>Свободные заявки </span>
                      <span className={`tabular-nums ${filterToggleCountClass}`}>({unassignedCount})</span>
                    </span>
                    <span
                      className={`${filterToggleRowClass} shrink-0 cursor-pointer select-none`}
                      onClick={() => toggleQuickFilter("mine")}
                      role="checkbox"
                      aria-checked={mineOnly}
                    >
                      <ClientsStyleCheckboxBox checked={mineOnly} dark={isDarkTheme} />
                      <span className={filterToggleTitleClass}>Мои заявки </span>
                      <span className={`tabular-nums ${filterToggleCountClass}`}>({mineCount})</span>
                    </span>
                    <span
                      className={`${filterToggleRowClass} shrink-0 cursor-pointer select-none`}
                      onClick={() => toggleQuickFilter("archive")}
                      role="checkbox"
                      aria-checked={archiveOnly}
                    >
                      <ClientsStyleCheckboxBox checked={archiveOnly} dark={isDarkTheme} />
                      <span className={filterToggleTitleClass}>Архив </span>
                      <span className={`tabular-nums ${filterToggleCountClass}`}>({archiveCount})</span>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex shrink-0 cursor-pointer items-center rounded-[10px] border-2 border-[#EC1C24] bg-white px-[16px] py-[12px] text-[16px] font-medium leading-none tracking-[-0.04em] text-[#EC1C24] box-border"
                >
                  Сбросить фильтры
                </button>
              </div>

              <div className={`min-h-0 flex-1 overflow-hidden rounded-lg ${isDarkTheme ? "bg-[#131925]" : "bg-white"}`}>
                <div className="h-full overflow-x-hidden overflow-y-hidden">
                  <table className="w-full table-fixed border-separate border-spacing-0 text-[16px] font-medium tracking-[-0.04em]">
                    <colgroup>
                      <col className="w-[5%]" />
                      <col className="w-[17%]" />
                      <col className="w-[12%]" />
                      <col className="w-[11%]" />
                      <col className="w-[13%]" />
                      <col className="w-[22%]" />
                      <col className="w-[10%]" />
                      <col className="w-[10%]" />
                    </colgroup>
                    <thead className={`text-left text-[16px] font-medium tracking-[-0.04em] ${isDarkTheme ? "bg-[#1B2331] text-[#9AA4BC]" : "bg-[#F3F3F5] text-[#7D7D7D]"}`}>
                      <tr>
                        <th className="rounded-l-[5px] px-4 py-2.5 align-middle font-medium">
                          <span
                            className="inline-flex cursor-pointer select-none items-center"
                            role="checkbox"
                            aria-checked={allPageRowsSelected}
                            aria-label="Выбрать все строки на странице"
                            onClick={(e) => {
                              e.stopPropagation();
                              toggleSelectAllOnPage();
                            }}
                          >
                            <ClientsStyleCheckboxBox checked={allPageRowsSelected} dark={isDarkTheme} />
                          </span>
                        </th>
                        <th className="px-4 py-2.5 align-middle font-medium"><span className="inline-flex items-center gap-2 font-medium">ФИО<button type="button" onClick={() => toggleSort("client")} className="cursor-pointer"><SortIcon /></button></span></th>
                        <th className="px-4 py-2.5 align-middle font-medium"><span className="inline-flex items-center gap-2 font-medium">Телефон<button type="button" onClick={() => toggleSort("phone")} className="cursor-pointer"><SortIcon /></button></span></th>
                        <th className="px-4 py-2.5 align-middle font-medium"><span className="inline-flex items-center gap-2 font-medium">Статус<button type="button" onClick={() => toggleSort("status")} className="cursor-pointer"><SortIcon /></button></span></th>
                        <th className="px-4 py-2.5 align-middle font-medium"><span className="inline-flex items-center gap-2 font-medium">Менеджер<button type="button" onClick={() => toggleSort("manager")} className="cursor-pointer"><SortIcon /></button></span></th>
                        <th className="px-4 py-2.5 align-middle font-medium"><span className="inline-flex items-center gap-2 font-medium">Комментарий<button type="button" onClick={() => toggleSort("comment")} className="cursor-pointer"><SortIcon /></button></span></th>
                        <th className="px-4 py-2.5 align-middle font-medium"><span className="inline-flex items-center gap-2 font-medium">Дата создания<button type="button" onClick={() => toggleSort("createdAt")} className="cursor-pointer"><SortIcon /></button></span></th>
                        <th className="rounded-r-[5px] px-4 py-2.5 align-middle font-medium text-center">⋮</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row, index) => {
                        const isSelected = selectedRowIds.has(row.id);
                        const isArchiving = archivingRowId === row.id;
                        const borderCls = isDarkTheme ? "border-[#1A2130]" : "border-[#EEEDF0]";
                        let bgCls: string;
                        if (isSelected) {
                          bgCls = "bg-[#FCE6E8]";
                        } else if (isDarkTheme) {
                          bgCls = index % 2 === 1 ? "bg-[#141C29]" : "bg-[#0F1622]";
                        } else {
                          bgCls = index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white";
                        }
                        const hoverCls = isSelected ? "" : "hover:bg-[rgba(224,9,25,0.10)]";
                        return (
                        <tr
                          key={`${row.id}-${row.client}-${row.createdAt}`}
                          ref={(el) => {
                            requestRowRefs.current[row.id] = el;
                          }}
                          className={`border-[5px] transition ${borderCls} ${bgCls} ${hoverCls} ${
                            isArchiving ? "pointer-events-none animate-[archiveRowOut_260ms_ease_forwards]" : ""
                          } ${highlightRequestId === row.id ? "relative z-[2] shadow-[inset_0_0_0_2px_#EC1C24] ring-2 ring-[#EC1C24]/90" : ""}`}
                        >
                          <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                            <span
                              className="inline-flex cursor-pointer select-none items-center"
                              role="checkbox"
                              aria-checked={isSelected}
                              aria-label={`Выбрать заявку ${row.id}`}
                              onClick={(e) => {
                                e.stopPropagation();
                                toggleRowSelection(row.id);
                              }}
                            >
                              <ClientsStyleCheckboxBox checked={isSelected} dark={isDarkTheme} />
                            </span>
                          </td>
                          <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>{row.client}</td>
                          <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>{row.phone}</td>
                          <td className="whitespace-nowrap px-4 py-3 font-medium">
                            <span className={`inline-flex items-center gap-2 font-medium ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: requestStatusColorMap[row.status] }} />
                              <span className={`font-medium ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>{row.status}</span>
                            </span>
                          </td>
                          <td
                            className={`whitespace-nowrap px-4 py-3 text-[16px] leading-normal ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}
                          >
                            {row.manager ? (
                              <span className="inline-flex max-w-full items-center gap-1.5">
                                {row.managerPhoto ? (
                                  <img
                                    src={row.managerPhoto}
                                    alt=""
                                    className={`h-[1em] w-[1em] shrink-0 rounded-full object-cover ring-1 ${isDarkTheme ? "ring-white/15" : "ring-black/10"}`}
                                  />
                                ) : (
                                  <span
                                    className={`grid h-[1em] w-[1em] shrink-0 place-items-center rounded-full text-[10px] font-medium leading-none ring-1 ring-inset ${
                                      isDarkTheme ? "bg-[#2B3345] text-[#9AA4BC] ring-white/10" : "bg-[#ECECEF] text-[#7D7D7D] ring-black/10"
                                    }`}
                                  >
                                    ?
                                  </span>
                                )}
                                <span className="min-w-0 truncate">{row.manager}</span>
                              </span>
                            ) : (
                              <span className={isDarkTheme ? "text-[#7C879F]" : "text-[#A0A0A0]"}>—</span>
                            )}
                          </td>
                          <td className={`max-w-0 min-w-0 px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>
                            <span
                              className="inline-block max-w-full cursor-default overflow-hidden text-ellipsis whitespace-nowrap align-top"
                              onMouseEnter={(e) => {
                                const p = clampCommentTooltipPos(e.clientX, e.clientY, row.comment);
                                setCommentTooltip({ text: row.comment, x: p.x, y: p.y, maxWidth: p.maxWidth });
                              }}
                              onMouseMove={(e) => {
                                const p = clampCommentTooltipPos(e.clientX, e.clientY, row.comment);
                                setCommentTooltip({ text: row.comment, x: p.x, y: p.y, maxWidth: p.maxWidth });
                              }}
                              onMouseLeave={() => setCommentTooltip(null)}
                            >
                              {previewComment(row.comment)}
                            </span>
                          </td>
                          <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>{row.createdAt}</td>
                          <td className="px-4 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              aria-haspopup="dialog"
                              aria-expanded={requestActionsModal?.id === row.id}
                              aria-label={`Меню действий, заявка ${row.id}`}
                              className={`cursor-pointer rounded-md px-1.5 py-0.5 text-[16px] font-bold leading-none tracking-[-0.04em] text-[#A0A0A0] transition-colors hover:text-[#EC1C24] ${
                                isDarkTheme ? "hover:bg-white/5" : "hover:bg-black/[0.04]"
                              }`}
                              onClick={() => {
                                setCommentTooltip(null);
                                setRequestActionsModal(row);
                              }}
                            >
                              ...
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 pb-1 pt-2">
                  <div className={`h-1 rounded-full ${isDarkTheme ? "bg-[#242D3F]" : "bg-[#EEEDF0]"}`} />
                </div>
              </div>

              <div className="relative flex items-center justify-between">
                <button className={`rounded-[8px] px-2 py-1 text-[20px] font-bold tracking-[-0.04em] ${isDarkTheme ? "bg-[#1A2232] text-[#EDF2FF]" : "bg-white text-black"}`}>
                  {selectedRowIds.size} / заявок
                </button>
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="pointer-events-auto flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className={`inline-flex h-[48px] w-[48px] items-center justify-center rounded-full text-[30px] font-bold leading-none tracking-[-0.02em] ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}
                    >
                      ‹
                    </button>
                    <div className="relative flex h-[48px] items-center gap-1 overflow-hidden rounded-full bg-[#11131D] p-1 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.8)]">
                    <span
                      className="absolute left-1 top-1 z-0 h-[40px] w-[48px] rounded-full bg-[#EC1C24] shadow-[0_6px_14px_-8px_rgba(236,28,36,0.85)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                      style={{ transform: `translateX(${paginationActiveIndex * 52}px)` }}
                    />
                      {paginationItems.map((item, idx) =>
                        item === "ellipsis" ? (
                          <button
                            key={`ellipsis-${idx}`}
                            type="button"
                            onClick={() => {
                              if (paginationWindowStart === 1) {
                                setPaginationWindowStart(4);
                                setCurrentPage(4);
                              }
                            }}
                            className="relative z-10 inline-flex h-[40px] w-[48px] items-center justify-center text-[16px] font-bold tracking-[-0.02em] text-white/90 transition-colors hover:text-white"
                          >
                            ...
                          </button>
                        ) : (
                          <button
                            key={item}
                            type="button"
                            onClick={() => setCurrentPage(item)}
                            className={`relative z-10 inline-flex h-[40px] w-[48px] items-center justify-center rounded-full text-[16px] font-bold tracking-[-0.02em] transition-colors duration-300 ${
                              item === currentPageSafe ? "text-white" : "text-white/80 hover:text-white"
                            }`}
                          >
                            {item}
                          </button>
                        ),
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className={`inline-flex h-[48px] w-[48px] items-center justify-center rounded-full text-[30px] font-bold leading-none tracking-[-0.02em] ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className={`flex items-center gap-2 text-[20px] font-bold tracking-[-0.04em] ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>
                  <span>
                    {sortedRows.length === 0 ? `0 из ${TOTAL_REQUESTS_SHOWN}` : `${pageStart + 1} — ${pageEnd} из ${TOTAL_REQUESTS_SHOWN}`}
                  </span>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
      {commentTooltip && typeof document !== "undefined"
        ? createPortal(
            <div
              role="tooltip"
              className={`pointer-events-none fixed z-[200] max-h-[min(280px,calc(100vh-16px))] w-max min-w-0 overflow-y-auto rounded-xl border px-3 py-2.5 text-left text-[14px] font-medium leading-relaxed whitespace-pre-wrap break-words shadow-[0_12px_40px_-8px_rgba(0,0,0,0.35)] ${
                isDarkTheme ? "border-[#2B3345] bg-[#1B2331] text-[#EDF2FF]" : "border-[#E4E5E7] bg-white text-[#111826]"
              }`}
              style={{ left: commentTooltip.x, top: commentTooltip.y, maxWidth: commentTooltip.maxWidth }}
            >
              {commentTooltip.text}
            </div>,
            document.body,
          )
        : null}
      {requestActionsModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setRequestActionsModal(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="request-actions-title"
                className={`w-full max-w-[360px] overflow-hidden rounded-[14px] border shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)] ${
                  isDarkTheme ? "border-[#2B3345] bg-[#131925]" : "border-[#E4E5E7] bg-white"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`border-b p-5 ${isDarkTheme ? "border-[#2B3345]" : "border-[#EEEDF0]"}`}>
                  <h2 id="request-actions-title" className={`text-[18px] font-semibold tracking-[-0.04em] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}>
                    {selectedRowIds.size > 1 ? "Действия с заявками" : "Действия с заявкой"}
                  </h2>
                  <p className={`mt-1 truncate text-[14px] font-medium tracking-[-0.04em] ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]"}`}>
                    {selectedRowIds.size > 1
                      ? `${selectedRowIds.size} выбрано`
                      : `№ ${requestActionsModal.id} · ${requestActionsModal.client}`}
                  </p>
                </div>
                <ul className="p-0">
                  {requestModalActions.map(({ id: actionId, label, Icon, danger }) => {
                    const iconTone = danger
                      ? "text-[#EC1C24]"
                      : isDarkTheme
                        ? "text-[#B8C4DC]"
                        : "text-[#4B5563]";
                    return (
                      <li key={actionId}>
                        <button
                          type="button"
                          className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                            danger
                              ? "text-[#EC1C24] hover:bg-[#EC1C24]/10"
                              : isDarkTheme
                                ? "text-[#E8EDF8] hover:bg-white/[0.06]"
                                : "text-[#111826] hover:bg-[#F3F3F5]"
                          }`}
                          onClick={() => handleRequestModalAction(actionId)}
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
      <style>
        {`
          @keyframes archiveRowOut {
            0% {
              opacity: 1;
            }
            100% {
              opacity: 0;
            }
          }
        `}
      </style>
      {createRequestDraft && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[262] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setCreateRequestDraft(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="create-request-title"
                className={`w-full max-w-[520px] overflow-hidden rounded-[14px] border shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)] ${
                  isDarkTheme ? "border-[#2B3345] bg-[#131925]" : "border-[#E4E5E7] bg-white"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`border-b p-5 ${isDarkTheme ? "border-[#2B3345]" : "border-[#EEEDF0]"}`}>
                  <h2 id="create-request-title" className={`text-[18px] font-semibold tracking-[-0.04em] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}>
                    Создать заявку
                  </h2>
                </div>
                <div className="grid gap-3 p-5">
                  <input
                    value={createRequestDraft.client}
                    onChange={(e) => setCreateRequestDraft((prev) => (prev ? { ...prev, client: e.target.value } : prev))}
                    className={`h-12 w-full cursor-pointer rounded-[10px] border-[3px] px-3 text-[18px] font-medium tracking-[-0.04em] outline-none ${
                      isDarkTheme
                        ? "border-[#2B3345] bg-[#0E1420] text-black placeholder:text-[#7C879F]"
                        : "border-[#E4E5E7] bg-white text-black placeholder:text-[#B5B5B5]"
                    }`}
                    placeholder="ФИО"
                  />
                  <input
                    value={createRequestDraft.phone}
                    onChange={(e) =>
                      setCreateRequestDraft((prev) =>
                        prev
                          ? {
                              ...prev,
                              phone: maskRuPhoneInput(e.target.value),
                            }
                          : prev,
                      )
                    }
                    className={`h-12 w-full cursor-pointer rounded-[10px] border-[3px] px-3 text-[18px] font-medium tracking-[-0.04em] outline-none ${
                      isDarkTheme
                        ? "border-[#2B3345] bg-[#0E1420] text-black placeholder:text-[#7C879F]"
                        : "border-[#E4E5E7] bg-white text-black placeholder:text-[#B5B5B5]"
                    }`}
                    placeholder="Телефон"
                  />
                  <textarea
                    value={createRequestDraft.comment}
                    onChange={(e) => setCreateRequestDraft((prev) => (prev ? { ...prev, comment: e.target.value } : prev))}
                    className={`min-h-[120px] w-full cursor-pointer rounded-[10px] border-[3px] px-3 py-3 text-[18px] font-medium tracking-[-0.04em] outline-none resize-none ${
                      isDarkTheme
                        ? "border-[#2B3345] bg-[#0E1420] text-black placeholder:text-[#7C879F]"
                        : "border-[#E4E5E7] bg-white text-black placeholder:text-[#B5B5B5]"
                    }`}
                    placeholder="Комментарий"
                  />
                </div>
                <div className={`flex gap-2 border-t p-5 ${isDarkTheme ? "border-[#2B3345]" : "border-[#EEEDF0]"}`}>
                  <button
                    type="button"
                    onClick={() => setCreateRequestDraft(null)}
                    className={`h-12 flex-1 cursor-pointer rounded-[10px] px-4 text-center text-[18px] font-medium tracking-[-0.04em] ${
                      isDarkTheme ? "bg-[#202838] text-[#D3D9E8]" : "bg-[#ECECEF] text-[#111111]"
                    }`}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={commitCreateRequest}
                    className="h-12 flex-1 cursor-pointer rounded-[10px] border-2 border-[#EC1C24] bg-[#EC1C24] px-4 text-center text-[18px] font-medium tracking-[-0.04em] text-white"
                  >
                    Создать
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {editRequestRow && editRequestDraft && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[263] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => {
                setEditRequestId(null);
                setEditRequestDraft(null);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-request-title"
                className={`w-full max-w-[520px] overflow-hidden rounded-[14px] border shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)] ${
                  isDarkTheme ? "border-[#2B3345] bg-[#131925]" : "border-[#E4E5E7] bg-white"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`border-b p-5 ${isDarkTheme ? "border-[#2B3345]" : "border-[#EEEDF0]"}`}>
                  <h2 id="edit-request-title" className={`text-[18px] font-semibold tracking-[-0.04em] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}>
                    Редактировать заявку
                  </h2>
                  <p className={`mt-1 truncate text-[14px] font-medium tracking-[-0.04em] ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]"}`}>
                    № {editRequestRow.id} · {editRequestRow.client}
                  </p>
                </div>
                <div className="grid gap-3 p-5">
                  <input
                    value={editRequestDraft.client}
                    onChange={(e) => setEditRequestDraft((prev) => (prev ? { ...prev, client: e.target.value } : prev))}
                    className={`h-11 rounded-[10px] border px-3 text-[15px] font-medium outline-none ${
                      isDarkTheme ? "border-[#2B3345] bg-[#0E1420] text-[#EDF2FF]" : "border-[#E4E5E7] bg-white text-[#111826]"
                    }`}
                    placeholder="Клиент"
                  />
                  <input
                    value={editRequestDraft.phone}
                    onChange={(e) => setEditRequestDraft((prev) => (prev ? { ...prev, phone: e.target.value } : prev))}
                    className={`h-11 rounded-[10px] border px-3 text-[15px] font-medium outline-none ${
                      isDarkTheme ? "border-[#2B3345] bg-[#0E1420] text-[#EDF2FF]" : "border-[#E4E5E7] bg-white text-[#111826]"
                    }`}
                    placeholder="Телефон"
                  />
                  <div className="relative">
                    <select
                      value={editRequestDraft.source}
                      onChange={(e) => setEditRequestDraft((prev) => (prev ? { ...prev, source: e.target.value as RequestSource } : prev))}
                      className={`h-11 w-full appearance-none rounded-[10px] border px-3 pr-12 text-[15px] font-medium outline-none ${
                        isDarkTheme ? "border-[#2B3345] bg-[#0E1420] text-[#EDF2FF]" : "border-[#E4E5E7] bg-white text-[#111826]"
                      }`}
                    >
                      {ALL_SOURCES.map((source) => (
                        <option key={source} value={source}>
                          {source}
                        </option>
                      ))}
                    </select>
                    <span
                      className={`pointer-events-none absolute right-1.5 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] ${
                        isDarkTheme ? "text-[#D3D9E8]" : "text-[#111111]"
                      }`}
                    >
                      <svg viewBox="0 0 16 16" fill="none" className="h-[16px] w-[16px]">
                        <path d="M3 6L8 11L13 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </div>
                  <textarea
                    value={editRequestDraft.comment}
                    onChange={(e) => setEditRequestDraft((prev) => (prev ? { ...prev, comment: e.target.value } : prev))}
                    className={`min-h-[96px] rounded-[10px] border px-3 py-2.5 text-[15px] font-medium outline-none ${
                      isDarkTheme ? "border-[#2B3345] bg-[#0E1420] text-[#EDF2FF]" : "border-[#E4E5E7] bg-white text-[#111826]"
                    }`}
                    placeholder="Комментарий"
                  />
                </div>
                <div className={`flex gap-2 border-t p-5 ${isDarkTheme ? "border-[#2B3345]" : "border-[#EEEDF0]"}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setEditRequestId(null);
                      setEditRequestDraft(null);
                    }}
                    className={`flex-1 cursor-pointer rounded-[10px] p-4 text-center text-[16px] font-medium tracking-[-0.04em] ${
                      isDarkTheme ? "bg-[#202838] text-[#D3D9E8]" : "bg-[#ECECEF] text-[#111111]"
                    }`}
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={commitRequestEdit}
                    className="flex-1 cursor-pointer rounded-[10px] border-2 border-[#EC1C24] bg-[#EC1C24] p-4 text-center text-[16px] font-medium tracking-[-0.04em] text-white"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {(statusPickerRow || isBulkStatusPicker) && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[265] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => {
                setStatusPickerForId(null);
                setBulkStatusPickerIds(null);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="status-picker-title"
                className={`w-full max-w-[360px] overflow-hidden rounded-[14px] border shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)] ${
                  isDarkTheme ? "border-[#2B3345] bg-[#131925]" : "border-[#E4E5E7] bg-white"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`border-b p-5 ${isDarkTheme ? "border-[#2B3345]" : "border-[#EEEDF0]"}`}>
                  <h2 id="status-picker-title" className={`text-[18px] font-semibold tracking-[-0.04em] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}>
                    Изменить статус
                  </h2>
                  <p className={`mt-1 truncate text-[14px] font-medium tracking-[-0.04em] ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]"}`}>
                    {isBulkStatusPicker ? `${bulkStatusPickerIds?.length ?? 0} выбрано` : `№ ${statusPickerRow?.id} · ${statusPickerRow?.client}`}
                  </p>
                </div>
                <ul className="p-0">
                  {REQUEST_STATUS_FILTERS.map((status) => {
                    const isCurrent = isBulkStatusPicker
                      ? false
                      : statusPickerRow
                        ? statusPickerRow.status === status
                        : false;
                    return (
                      <li key={status}>
                        <button
                          type="button"
                          onClick={() => commitRequestStatus(status, bulkStatusPickerIds ?? undefined)}
                          className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                            isCurrent
                              ? isDarkTheme
                                ? "bg-white/[0.08] text-[#F4F7FF]"
                                : "bg-[#F8F8FA] text-[#111826]"
                              : isDarkTheme
                                ? "text-[#E8EDF8] hover:bg-white/[0.06]"
                                : "text-[#111826] hover:bg-[#F3F3F5]"
                          }`}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: requestStatusColorMap[status] }} />
                          <span className="min-w-0 flex-1">{status}</span>
                          {isCurrent && !isBulkStatusPicker ? (
                            <span className={`shrink-0 text-[13px] font-medium ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]"}`}>Сейчас</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className={`border-t p-5 ${isDarkTheme ? "border-[#2B3345]" : "border-[#EEEDF0]"}`}>
                  <button
                    type="button"
                    onClick={() => {
                      setStatusPickerForId(null);
                      setBulkStatusPickerIds(null);
                    }}
                    className={`w-full cursor-pointer rounded-[10px] p-4 text-center text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                      isDarkTheme ? "bg-[#202838] text-[#D3D9E8] hover:bg-[#2a3145]" : "bg-[#ECECEF] text-[#111111] hover:bg-[#E0E0E4]"
                    }`}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}
