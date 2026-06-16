import { MarsAppShellSidebar } from "@/components/layout/MarsAppShellSidebar";
import { emitArchiveStyleToast } from "@/lib/notifications/inAppArchiveToastBus";
import { useEffect, useMemo, useRef, useState, type TransitionEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { clientsData, type ClientRow } from "@/lib/mock/clients-page";
import {
  insertClientStorageRow,
  isClientsRemoteEnabled,
  listClientsStorageRows,
  type ClientStorageRow,
} from "@/lib/data/clientsDataSource";
import { computeClientOrdersMetrics, formatRubAmount, type WorkOrderMetricsRow } from "@/lib/clients/clientOrdersMetrics";
import { fetchWorkOrdersForMetrics, getWorkOrdersForMetrics } from "@/lib/work-orders/workOrdersForMetrics";

type ClientTableRow = {
  id: string;
  fullName: string;
  phone: string;
  requestsCount: number;
  lastVisit: string;
  totalAmount: string;
};

type ClientsFilterId = "visit" | "orders" | "revenue";
type VisitPreset = "today" | "week" | "month" | "not3m" | "not6m";
type OrdersBracket = "r1_3" | "r3_10" | "r10p";
type RevenueBracket = "under10k" | "k10_50" | "over50k";

const ALL_VISIT_PRESETS: VisitPreset[] = ["today", "week", "month", "not3m", "not6m"];
const VISIT_PRESET_LABELS: Record<VisitPreset, string> = {
  today: "Сегодня",
  week: "За неделю",
  month: "За месяц",
  not3m: "Более 3 месяцев не был",
  not6m: "Более 6 месяцев не был",
};

const ALL_ORDERS_BRACKETS: OrdersBracket[] = ["r1_3", "r3_10", "r10p"];
const ORDERS_BRACKET_LABELS: Record<OrdersBracket, string> = {
  r1_3: "1–3",
  r3_10: "3–10",
  r10p: "10+",
};

const ALL_REVENUE_BRACKETS: RevenueBracket[] = ["under10k", "k10_50", "over50k"];
const REVENUE_BRACKET_LABELS: Record<RevenueBracket, string> = {
  under10k: "до 10 000",
  k10_50: "10 000 – 50 000",
  over50k: "50 000+",
};
type SortKey = "id" | "fullName" | "phone" | "requestsCount" | "lastVisit" | "totalAmount";
type SortDir = "asc" | "desc";
type ClientActionId = "open" | "call" | "createBooking" | "createWorkOrder";
type ClientType = "person" | "company" | "entrepreneur" | "";

type CreateClientDraft = {
  clientType: ClientType;
  fullName: string;
  orgName: string;
  inn: string;
  phone: string;
  email: string;
  car: string;
  plate: string;
};

const PAGE_SIZE = 12;

const EMPTY_CREATE_CLIENT_DRAFT: CreateClientDraft = {
  clientType: "",
  fullName: "",
  orgName: "",
  inn: "",
  phone: "",
  email: "",
  car: "",
  plate: "",
};

function mapClientRow(c: ClientRow): ClientTableRow {
  return {
    id: c.id,
    fullName: c.fullName,
    phone: c.phone,
    requestsCount: requestsCountForClient(c),
    lastVisit: c.lastVisit,
    totalAmount: c.totalAmount,
  };
}

function rowMatchesVisitPresets(row: ClientTableRow, presetFilter: Set<VisitPreset>, now: Date): boolean {
  if (presetFilter.size === ALL_VISIT_PRESETS.length) return true;
  const rd = parseRuDate(row.lastVisit);
  if (!rd) return false;
  const rd0 = startOfDay(rd);
  const today0 = startOfDay(now);
  const weekStart = startOfDay(addDays(now, -6));
  const monthStart = startOfDay(addDays(now, -29));
  const threeMAgo = startOfDay(addDays(now, -90));
  const sixMAgo = startOfDay(addDays(now, -180));

  if (presetFilter.has("today") && rd0.getTime() === today0.getTime()) return true;
  if (presetFilter.has("week") && rd0 >= weekStart && rd0 <= endOfDay(now)) return true;
  if (presetFilter.has("month") && rd0 >= monthStart && rd0 <= endOfDay(now)) return true;
  if (presetFilter.has("not3m") && rd0 < threeMAgo) return true;
  if (presetFilter.has("not6m") && rd0 < sixMAgo) return true;
  return false;
}

function rowMatchesOrdersBrackets(row: ClientTableRow, s: Set<OrdersBracket>): boolean {
  if (s.size === ALL_ORDERS_BRACKETS.length) return true;
  const c = row.requestsCount;
  if (s.has("r1_3") && c >= 1 && c <= 3) return true;
  if (s.has("r3_10") && c >= 3 && c <= 10) return true;
  if (s.has("r10p") && c >= 10) return true;
  return false;
}

function rowMatchesRevenueBrackets(row: ClientTableRow, s: Set<RevenueBracket>): boolean {
  if (s.size === ALL_REVENUE_BRACKETS.length) return true;
  const amount = parseAmountRub(row.totalAmount);
  if (s.has("under10k") && amount < 10_000) return true;
  if (s.has("k10_50") && amount >= 10_000 && amount <= 50_000) return true;
  if (s.has("over50k") && amount > 50_000) return true;
  return false;
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

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function endOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);
}

function addDays(d: Date, days: number): Date {
  const x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  x.setDate(x.getDate() + days);
  return x;
}

function parseAmountRub(s: string): number {
  const digits = s.replace(/\s/g, "").replace(/[₽р]/gi, "").replace(/[^\d]/g, "");
  return digits ? parseInt(digits, 10) : 0;
}

function maskRuPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  const hasEightPrefix = digits.startsWith("8");
  const normalized = hasEightPrefix ? digits.slice(1) : digits.startsWith("7") ? digits.slice(1) : digits;
  const national = normalized.slice(0, 10);
  if (!national) return "";
  const p1 = national.slice(0, 3);
  const p2 = national.slice(3, 6);
  const p3 = national.slice(6, 8);
  const p4 = national.slice(8, 10);
  let out = "+7";
  if (p1) out += ` (${p1}`;
  if (p1.length === 3) out += ")";
  if (p2) out += ` ${p2}`;
  if (p3) out += `-${p3}`;
  if (p4) out += `-${p4}`;
  return out;
}

function national10FromPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (digits.startsWith("8")) return digits.slice(1, 11);
  if (digits.startsWith("7")) return digits.slice(1, 11);
  return digits.slice(0, 10);
}

function formatDateRu(d: Date): string {
  const dd = String(d.getDate()).padStart(2, "0");
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const yyyy = d.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

/** Стабильное «рандомное» число 1…18 по id, если в данных нет корректного количества */
function requestsCountForClient(c: ClientRow): number {
  const raw = c.requestsCount;
  if (typeof raw === "number" && !Number.isNaN(raw) && raw >= 0) return Math.floor(raw);
  let h = 0;
  for (let i = 0; i < c.id.length; i++) h = (h * 31 + c.id.charCodeAt(i)) >>> 0;
  return 1 + (h % 18);
}

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

function toTelHref(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "tel:+7";
  if (digits.startsWith("8") && digits.length >= 11) return `tel:+7${digits.slice(1)}`;
  if (digits.startsWith("7") && digits.length >= 11) return `tel:+${digits}`;
  return `tel:+7${digits}`;
}

function ClientActionIcon({ type, className }: { type: ClientActionId; className?: string }) {
  if (type === "open") return <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden><path d="M9 5H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /><path d="M14 4h6v6M20 4l-9 9" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (type === "call") return <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden><path d="M7.2 5.5C7.5 5 8 4.8 8.6 4.9L10.9 5.3C11.5 5.4 11.9 5.8 12 6.4L12.4 8.5C12.5 9 12.3 9.5 11.9 9.9L10.8 11C11.5 12.3 12.6 13.4 13.9 14.2L15 13.1C15.4 12.7 15.9 12.5 16.4 12.6L18.5 13C19.1 13.1 19.5 13.5 19.6 14.1L20 16.4C20.1 17 19.9 17.5 19.4 17.8L17.8 18.9C17.2 19.3 16.5 19.4 15.8 19.2C13.4 18.5 11.2 17.2 9.4 15.4C7.6 13.6 6.3 11.4 5.6 9C5.4 8.3 5.5 7.6 5.9 7L7.2 5.5Z" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" /></svg>;
  if (type === "createBooking") return <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden><rect x="4" y="5" width="16" height="15" rx="2" stroke="currentColor" strokeWidth="1.9" /><path d="M8 3v4M16 3v4M4 10h16M12 13v4M10 15h4" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden><path d="M5 7h14M5 12h14M5 17h8" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /><path d="M17 16l3 3m0-3l-3 3" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" /></svg>;
}

function exportClientsToXlsx(clients: ClientTableRow[]) {
  const data = clients.map((r) => ({
    ID: r.id,
    ФИО: r.fullName,
    Телефон: r.phone,
    "Последний визит": r.lastVisit,
    "Заказ-наряды": r.requestsCount,
    "Общая выручка": r.totalAmount,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Клиенты");
  const stamp = new Date().toISOString().slice(0, 10);
  XLSX.writeFile(wb, `klienty_${stamp}.xlsx`);
}

const FILTER_KEYS: { id: ClientsFilterId; label: string }[] = [
  { id: "visit", label: "Последний визит" },
  { id: "orders", label: "Заказ-наряды" },
  { id: "revenue", label: "Общая выручка" },
];

const INITIAL_CLIENT_ROWS: ClientTableRow[] = clientsData.map(mapClientRow);

function mapClientStorageToUi(row: ClientStorageRow): ClientTableRow {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    requestsCount: Number.isFinite(Number(row.requests_count)) ? Number(row.requests_count) : 0,
    lastVisit: row.last_visit,
    totalAmount: row.total_amount,
  };
}

export function ClientsPage() {
  const navigate = useNavigate();
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [openFilter, setOpenFilter] = useState<ClientsFilterId | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rows, setRows] = useState<ClientTableRow[]>(() =>
    isClientsRemoteEnabled() ? [] : INITIAL_CLIENT_ROWS.map((r) => ({ ...r })),
  );
  const [visitPresets, setVisitPresets] = useState<Set<VisitPreset>>(() => new Set(ALL_VISIT_PRESETS));
  const [ordersBrackets, setOrdersBrackets] = useState<Set<OrdersBracket>>(() => new Set(ALL_ORDERS_BRACKETS));
  const [revenueBrackets, setRevenueBrackets] = useState<Set<RevenueBracket>>(() => new Set(ALL_REVENUE_BRACKETS));
  const [newClientsOnly, setNewClientsOnly] = useState(false);
  const [notVisited3mQuick, setNotVisited3mQuick] = useState(false);
  const [topRevenueOnly, setTopRevenueOnly] = useState(false);
  const [sortState, setSortState] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [clientActionsModal, setClientActionsModal] = useState<ClientTableRow | null>(null);
  const [createClientModalMounted, setCreateClientModalMounted] = useState(false);
  const [createClientModalActive, setCreateClientModalActive] = useState(false);
  const [createClientDraft, setCreateClientDraft] = useState<CreateClientDraft>(EMPTY_CREATE_CLIENT_DRAFT);
  const [workOrdersForMetrics, setWorkOrdersForMetrics] = useState<WorkOrderMetricsRow[]>(() => getWorkOrdersForMetrics());

  useEffect(() => {
    async function refreshWorkOrdersForMetrics() {
      try {
        setWorkOrdersForMetrics(await fetchWorkOrdersForMetrics());
      } catch {
        setWorkOrdersForMetrics(getWorkOrdersForMetrics());
      }
    }
    void refreshWorkOrdersForMetrics();
    window.addEventListener("focus", refreshWorkOrdersForMetrics);
    return () => window.removeEventListener("focus", refreshWorkOrdersForMetrics);
  }, []);

  const tableRows = useMemo(
    () =>
      rows.map((row) => {
        const metrics = computeClientOrdersMetrics(row.fullName, workOrdersForMetrics);
        return {
          ...row,
          requestsCount: metrics.totalOrders,
          totalAmount: formatRubAmount(metrics.totalAmount),
        };
      }),
    [rows, workOrdersForMetrics],
  );

  useEffect(() => {
    if (!isClientsRemoteEnabled()) return;
    let cancelled = false;
    async function loadClientsFromApi() {
      try {
        const data = await listClientsStorageRows();
        if (!cancelled && Array.isArray(data)) {
          setRows(data.map((row) => mapClientStorageToUi(row as ClientStorageRow)));
        }
      } catch (error) {
        console.warn("Failed to load clients from API.", error);
      }
    }
    void loadClientsFromApi();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    function onPointerDown(e: PointerEvent) {
      const el = filterBarRef.current;
      if (!el || !openFilter) return;
      if (e.target instanceof Node && !el.contains(e.target)) setOpenFilter(null);
    }
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [openFilter]);

  const displayRows = useMemo(() => {
    const qText = searchQuery.trim().toLowerCase();
    const qDigits = searchQuery.replace(/\D/g, "");
    const now = new Date();

    return tableRows.filter((row) => {
      if (qText) {
        const byName = row.fullName.toLowerCase().includes(qText);
        const byId = row.id.toLowerCase().includes(qText);
        const byPhone = qDigits.length > 0 && row.phone.replace(/\D/g, "").includes(qDigits);
        if (!byName && !byId && !byPhone) return false;
      }
      if (!rowMatchesVisitPresets(row, visitPresets, now)) return false;
      if (!rowMatchesOrdersBrackets(row, ordersBrackets)) return false;
      if (!rowMatchesRevenueBrackets(row, revenueBrackets)) return false;

      if (newClientsOnly && row.requestsCount > 1) return false;
      if (notVisited3mQuick) {
        const rd = parseRuDate(row.lastVisit);
        if (!rd) return false;
        if (startOfDay(rd) >= startOfDay(addDays(now, -90))) return false;
      }
      if (topRevenueOnly && parseAmountRub(row.totalAmount) < 30_000) return false;

      return true;
    });
  }, [
    tableRows,
    searchQuery,
    visitPresets,
    ordersBrackets,
    revenueBrackets,
    newClientsOnly,
    notVisited3mQuick,
    topRevenueOnly,
  ]);

  const sortedRows = useMemo(() => {
    if (!sortState) return displayRows;
    const arr = [...displayRows];
    const factor = sortState.dir === "asc" ? 1 : -1;
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortState.key === "id") cmp = parseInt(a.id, 10) - parseInt(b.id, 10);
      else if (sortState.key === "fullName") cmp = a.fullName.localeCompare(b.fullName, "ru");
      else if (sortState.key === "phone") cmp = a.phone.replace(/\D/g, "").localeCompare(b.phone.replace(/\D/g, ""));
      else if (sortState.key === "requestsCount") cmp = a.requestsCount - b.requestsCount;
      else if (sortState.key === "lastVisit") {
        const ad = parseRuDate(a.lastVisit)?.getTime() ?? 0;
        const bd = parseRuDate(b.lastVisit)?.getTime() ?? 0;
        cmp = ad - bd;
      } else if (sortState.key === "totalAmount") cmp = parseAmountRub(a.totalAmount) - parseAmountRub(b.totalAmount);
      if (cmp === 0) return a.id.localeCompare(b.id);
      return cmp * factor;
    });
    return arr;
  }, [displayRows, sortState]);

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageStart = (currentPageSafe - 1) * PAGE_SIZE;
  const pagedRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE);
  const pageEnd = Math.min(pageStart + pagedRows.length, sortedRows.length);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  const paginationItems: Array<number | "ellipsis"> =
    totalPages <= 7
      ? Array.from({ length: totalPages }, (_, i) => i + 1)
      : [1, 2, 3, "ellipsis", totalPages];

  const paginationActiveIndex =
    totalPages <= 7
      ? Math.max(0, Math.min(currentPageSafe - 1, paginationItems.length - 1))
      : currentPageSafe === totalPages
        ? 4
        : currentPageSafe >= 1 && currentPageSafe <= 3
          ? currentPageSafe - 1
          : 0;

  const quickCounts = useMemo(() => {
    const now = new Date();
    let newC = 0;
    let absent3m = 0;
    let topR = 0;
    for (const row of tableRows) {
      if (row.requestsCount <= 1) newC += 1;
      const rd = parseRuDate(row.lastVisit);
      if (rd) {
        const rd0 = startOfDay(rd);
        if (rd0 < startOfDay(addDays(now, -90))) absent3m += 1;
      }
      if (parseAmountRub(row.totalAmount) >= 30_000) topR += 1;
    }
    return { newC, absent3m, topR };
  }, [tableRows]);

  const noActiveFilters =
    !searchQuery.trim() &&
    visitPresets.size === ALL_VISIT_PRESETS.length &&
    ordersBrackets.size === ALL_ORDERS_BRACKETS.length &&
    revenueBrackets.size === ALL_REVENUE_BRACKETS.length &&
    !newClientsOnly &&
    !notVisited3mQuick &&
    !topRevenueOnly;

  const totalClients = rows.length;

  function resetFilters() {
    setSearchQuery("");
    setOpenFilter(null);
    setVisitPresets(new Set(ALL_VISIT_PRESETS));
    setOrdersBrackets(new Set(ALL_ORDERS_BRACKETS));
    setRevenueBrackets(new Set(ALL_REVENUE_BRACKETS));
    setNewClientsOnly(false);
    setNotVisited3mQuick(false);
    setTopRevenueOnly(false);
  }

  function toggleSort(key: SortKey) {
    setSortState((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  }

  function handleClientAction(actionId: ClientActionId) {
    if (!clientActionsModal) return;
    const row = clientActionsModal;
    if (actionId === "open") {
      setClientActionsModal(null);
      navigate(`/clients/${row.id}`);
      return;
    }
    if (actionId === "call") {
      const a = document.createElement("a");
      a.href = toTelHref(row.phone);
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setClientActionsModal(null);
      return;
    }
    if (actionId === "createBooking") {
      setClientActionsModal(null);
      navigate(
        `/journal?newBookingFromRequest=1&client=${encodeURIComponent(row.fullName)}&phone=${encodeURIComponent(row.phone)}&comment=${encodeURIComponent("")}`,
      );
      return;
    }
    setClientActionsModal(null);
    navigate(`/work-orders?client=${encodeURIComponent(row.fullName)}&phone=${encodeURIComponent(row.phone)}`);
  }

  function openCreateClientModal() {
    setCreateClientDraft(EMPTY_CREATE_CLIENT_DRAFT);
    setCreateClientModalMounted(true);
    requestAnimationFrame(() => setCreateClientModalActive(true));
  }

  function closeCreateClientModal() {
    setCreateClientModalActive(false);
  }

  async function handleCreateClientSubmit() {
    if (!createClientDraft.clientType) return;
    const fullName =
      createClientDraft.clientType === "company"
        ? createClientDraft.orgName.trim()
        : createClientDraft.fullName.trim();
    if (!fullName) return;

    const currentMaxId = rows.reduce((max, row) => {
      const n = Number.parseInt(row.id, 10);
      return Number.isFinite(n) ? Math.max(max, n) : max;
    }, 0);
    const nextId = String(currentMaxId + 1);

    const nextRow: ClientTableRow = {
      id: nextId,
      fullName,
      phone: maskRuPhoneInput(createClientDraft.phone),
      requestsCount: 0,
      lastVisit: formatDateRu(new Date()),
      totalAmount: "0 ₽",
    };

    const overviewBootstrap = {
      id: nextRow.id,
      fullName: nextRow.fullName,
      phone: nextRow.phone,
      lastVisit: nextRow.lastVisit,
      totalAmount: nextRow.totalAmount,
      email: createClientDraft.email.trim(),
      inn: createClientDraft.inn.trim(),
      clientType: createClientDraft.clientType,
      car: createClientDraft.car.trim(),
      plate: createClientDraft.plate.trim(),
    };

    if (isClientsRemoteEnabled()) {
      try {
        const payload: ClientStorageRow = {
          id: nextRow.id,
          full_name: nextRow.fullName,
          phone: nextRow.phone,
          requests_count: nextRow.requestsCount,
          last_visit: nextRow.lastVisit,
          total_amount: nextRow.totalAmount,
          email: overviewBootstrap.email || "",
          client_type: createClientDraft.clientType || "",
          inn: overviewBootstrap.inn || "",
          car: overviewBootstrap.car || "",
          plate: overviewBootstrap.plate || "",
        };
        const created = await insertClientStorageRow(payload);
        setRows((prev) => [mapClientStorageToUi(created), ...prev]);
        try {
          window.sessionStorage.setItem(
            `marsClientOverviewBootstrap:${created.id}`,
            JSON.stringify({ ...overviewBootstrap, id: created.id }),
          );
        } catch {
          // ignore
        }
      } catch (error) {
        console.warn("Failed to create client via API.", error);
        emitArchiveStyleToast({ line1: "Ошибка синхронизации", line2: "Не удалось добавить клиента" });
        return;
      }
    } else {
      setRows((prev) => [nextRow, ...prev]);
      try {
        window.sessionStorage.setItem(`marsClientOverviewBootstrap:${nextId}`, JSON.stringify(overviewBootstrap));
      } catch {
        // ignore quota / private mode
      }
    }
    closeCreateClientModal();
    emitArchiveStyleToast({ line1: "Клиент добавлен", line2: fullName });
  }

  function handleCreateClientDrawerTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    if (!createClientModalActive) {
      setCreateClientModalMounted(false);
      setCreateClientDraft(EMPTY_CREATE_CLIENT_DRAFT);
    }
  }

  function toggleVisitPreset(p: VisitPreset) {
    setVisitPresets((prev) => {
      const next = new Set(prev);
      if (next.has(p)) {
        next.delete(p);
        if (next.size === 0) return new Set(ALL_VISIT_PRESETS);
        return next;
      }
      next.add(p);
      return next;
    });
  }

  function toggleOrdersBracket(b: OrdersBracket) {
    setOrdersBrackets((prev) => {
      const next = new Set(prev);
      if (next.has(b)) {
        next.delete(b);
        if (next.size === 0) return new Set(ALL_ORDERS_BRACKETS);
        return next;
      }
      next.add(b);
      return next;
    });
  }

  function toggleRevenueBracket(b: RevenueBracket) {
    setRevenueBrackets((prev) => {
      const next = new Set(prev);
      if (next.has(b)) {
        next.delete(b);
        if (next.size === 0) return new Set(ALL_REVENUE_BRACKETS);
        return next;
      }
      next.add(b);
      return next;
    });
  }

  function filterChipActive(id: ClientsFilterId): boolean {
    if (openFilter === id) return true;
    if (id === "visit" && visitPresets.size < ALL_VISIT_PRESETS.length) return true;
    if (id === "orders" && ordersBrackets.size < ALL_ORDERS_BRACKETS.length) return true;
    if (id === "revenue" && revenueBrackets.size < ALL_REVENUE_BRACKETS.length) return true;
    return false;
  }

  const filterToggleRowClass = "flex cursor-pointer items-center gap-2 text-[16px] font-medium tracking-[-0.04em]";
  const filterToggleTitleClass = isDarkTheme ? "text-[#F4F7FF]" : "text-black";
  const filterToggleCountClass = isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]";

  const panelBase = `absolute left-0 top-full z-30 mt-2 min-w-[240px] rounded-[10px] border p-3 shadow-lg ${
    isDarkTheme ? "border-[#2B3345] bg-[#1B2331]" : "border-[#DDE1E7] bg-white"
  }`;
  const panelLabelClass = `mb-2 text-[14px] font-medium tracking-[-0.04em] ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]"}`;
  const panelOptionClass = `flex cursor-pointer items-center gap-2 py-1.5 text-[15px] font-medium tracking-[-0.04em] ${
    isDarkTheme ? "text-[#E8EDF8]" : "text-[#111111]"
  }`;

  return (
    <div
      className={`h-screen w-screen overflow-hidden max-lg:min-h-screen max-lg:h-auto max-lg:overflow-y-auto lg:h-screen lg:overflow-hidden ${isDarkTheme ? "bg-[#0C0F14]" : "bg-black"}`}
    >
      <div className="flex h-full w-full min-h-0 p-2 max-lg:h-auto lg:h-full">
        <div
          className={`flex h-full min-h-0 w-full max-lg:h-auto max-lg:flex-col rounded-[16px] p-2 shadow-none lg:flex-row lg:shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)] ${isDarkTheme ? "bg-[#0C0F14]" : "bg-black"}`}
        >
          <MarsAppShellSidebar mobileLayout="requests" />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:overflow-x-hidden">
            <header className={`mb-2 rounded-[16px] border px-4 py-4 lg:px-5 lg:py-5 ${isDarkTheme ? "border-[#232937] bg-[#131925]" : "border-[#DDE1E7] bg-white"}`}>
              <div className="flex max-lg:flex-col max-lg:items-stretch max-lg:gap-4 items-center gap-3 lg:flex-row lg:items-center lg:gap-3">
                <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
                  <h1 className={`text-[28px] font-bold leading-[100%] tracking-[-0.04em] max-lg:shrink-0 max-sm:text-[24px] lg:text-[32px] xl:text-[36px] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}>База клиентов</h1>
                  <span className={`text-[16px] font-bold tracking-[-0.04em] shrink-0 ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#888888]"}`}>({totalClients})</span>
                </div>
                <div className="ml-auto flex w-full min-w-0 max-lg:ml-0 max-lg:flex-col max-lg:gap-2 sm:max-lg:flex-row sm:max-lg:flex-wrap items-stretch sm:max-lg:items-center lg:ml-auto lg:w-auto lg:flex-row lg:items-center lg:gap-1 xl:gap-1.5">
                  <div className="relative w-full min-w-0 sm:max-lg:min-w-[200px] sm:max-lg:flex-1 lg:w-auto lg:flex-none">
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-12 w-full min-w-0 rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 pr-11 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5] [color-scheme:light] [&::-webkit-search-cancel-button]:hidden lg:w-[280px] xl:w-[320px]"
                      placeholder="Поиск по ФИО..."
                      aria-label="Поиск по ФИО..."
                    />
                    {searchQuery.trim() ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        aria-label="Очистить поиск"
                        className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[8px] text-black"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-[16px] w-[16px]" aria-hidden>
                          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={openCreateClientModal}
                    className="h-12 min-h-[48px] shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out max-lg:flex-1 sm:max-lg:flex-none lg:px-3 lg:text-[16px] xl:px-4 xl:text-[18px]"
                  >
                    Добавить клиента
                  </button>
                  <button
                    type="button"
                    onClick={() => exportClientsToXlsx(noActiveFilters ? tableRows : sortedRows)}
                    className="h-12 min-h-[48px] shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-black px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out max-lg:flex-1 sm:max-lg:flex-none lg:px-3 lg:text-[16px] xl:px-4 xl:text-[18px]"
                  >
                    Экспорт в Excel
                  </button>
                </div>
              </div>
            </header>

            <section
              className={`flex min-h-0 flex-1 flex-col gap-4 rounded-[16px] border px-4 py-4 max-lg:gap-4 lg:gap-5 lg:px-5 lg:py-5 ${isDarkTheme ? "border-[#232937] bg-[#131925]" : "border-[#DDE1E7] bg-white"}`}
            >
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <div ref={filterBarRef} className="flex min-w-0 flex-wrap items-center gap-[10px] gap-y-3">
                  {FILTER_KEYS.map(({ id, label }) => (
                    <div key={id} className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenFilter((prev) => (prev === id ? null : id))}
                        className={`cursor-pointer rounded-[10px] px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] ${
                          filterChipActive(id)
                            ? "bg-[#EC1C24] text-white"
                            : isDarkTheme
                              ? "bg-[#202838] text-[#D3D9E8]"
                              : "bg-[#ECECEF] text-[#111111]"
                        }`}
                      >
                        <span className="flex items-center justify-center gap-[12px]">
                          <span>{label}</span>
                          <svg viewBox="0 0 16 16" fill="none" className={`h-[16px] w-[16px] ${filterChipActive(id) ? "text-white" : isDarkTheme ? "text-[#D3D9E8]" : "text-[#111111]"}`}>
                            <path d="M3 6L8 11L13 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                      {openFilter === id && id === "visit" && (
                        <div className={panelBase} role="dialog" aria-label="Фильтр по последнему визиту">
                          <p className={panelLabelClass}>Последний визит</p>
                          {ALL_VISIT_PRESETS.map((p) => (
                            <span
                              key={p}
                              className={panelOptionClass}
                              onClick={() => toggleVisitPreset(p)}
                              role="checkbox"
                              aria-checked={visitPresets.has(p)}
                            >
                              <ClientsStyleCheckboxBox checked={visitPresets.has(p)} dark={isDarkTheme} />
                              {VISIT_PRESET_LABELS[p]}
                            </span>
                          ))}
                        </div>
                      )}
                      {openFilter === id && id === "orders" && (
                        <div className={panelBase} role="dialog" aria-label="Фильтр по заказ-нарядам">
                          <p className={panelLabelClass}>Заказ-наряды</p>
                          {ALL_ORDERS_BRACKETS.map((b) => (
                            <span
                              key={b}
                              className={panelOptionClass}
                              onClick={() => toggleOrdersBracket(b)}
                              role="checkbox"
                              aria-checked={ordersBrackets.has(b)}
                            >
                              <ClientsStyleCheckboxBox checked={ordersBrackets.has(b)} dark={isDarkTheme} />
                              {ORDERS_BRACKET_LABELS[b]}
                            </span>
                          ))}
                        </div>
                      )}
                      {openFilter === id && id === "revenue" && (
                        <div className={panelBase} role="dialog" aria-label="Фильтр по общей выручке">
                          <p className={panelLabelClass}>Общая выручка</p>
                          {ALL_REVENUE_BRACKETS.map((b) => (
                            <span
                              key={b}
                              className={panelOptionClass}
                              onClick={() => toggleRevenueBracket(b)}
                              role="checkbox"
                              aria-checked={revenueBrackets.has(b)}
                            >
                              <ClientsStyleCheckboxBox checked={revenueBrackets.has(b)} dark={isDarkTheme} />
                              {REVENUE_BRACKET_LABELS[b]}
                            </span>
                          ))}
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
                      onClick={() => setNewClientsOnly((v) => !v)}
                      role="checkbox"
                      aria-checked={newClientsOnly}
                    >
                      <ClientsStyleCheckboxBox checked={newClientsOnly} dark={isDarkTheme} />
                      <span className={filterToggleTitleClass}>Новые </span>
                      <span className={`tabular-nums ${filterToggleCountClass}`}>({quickCounts.newC})</span>
                    </span>
                    <span
                      className={`${filterToggleRowClass} shrink-0 cursor-pointer select-none`}
                      onClick={() => setNotVisited3mQuick((v) => !v)}
                      role="checkbox"
                      aria-checked={notVisited3mQuick}
                    >
                      <ClientsStyleCheckboxBox checked={notVisited3mQuick} dark={isDarkTheme} />
                      <span className={filterToggleTitleClass}>Не были 3+ мес </span>
                      <span className={`tabular-nums ${filterToggleCountClass}`}>({quickCounts.absent3m})</span>
                    </span>
                    <span
                      className={`${filterToggleRowClass} shrink-0 cursor-pointer select-none`}
                      onClick={() => setTopRevenueOnly((v) => !v)}
                      role="checkbox"
                      aria-checked={topRevenueOnly}
                    >
                      <ClientsStyleCheckboxBox checked={topRevenueOnly} dark={isDarkTheme} />
                      <span className={filterToggleTitleClass}>Топ по выручке </span>
                      <span className={`tabular-nums ${filterToggleCountClass}`}>({quickCounts.topR})</span>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-2 border-[#EC1C24] bg-white px-[16px] py-[12px] text-[16px] font-medium leading-none tracking-[-0.04em] text-[#EC1C24] box-border sm:w-auto sm:justify-start lg:w-auto"
                >
                  Сбросить фильтры
                </button>
              </div>

              <div
                className={`@container flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg max-lg:min-h-[240px] max-lg:flex-none lg:flex-1 ${isDarkTheme ? "bg-[#131925]" : "bg-white"}`}
              >
                <div className="journal-table-scroll relative min-h-0 min-w-0 flex-1 touch-pan-x touch-pan-y overflow-x-auto overflow-y-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] max-lg:max-h-[min(72vh,680px)] lg:max-h-[min(78vh,800px)] xl:max-h-none @[1280px]:max-h-none @[1280px]:overflow-y-hidden">
                  <table className="w-full min-w-[1200px] table-fixed border-separate border-spacing-0 text-[16px] font-medium tracking-[-0.015em] @[1280px]:min-w-0 @[1280px]:tracking-[-0.04em]">
                    <colgroup>
                      <col className="w-[10%]" />
                      <col className="w-[20%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[11%]" />
                      <col className="w-[14%]" />
                      <col className="w-[4%]" />
                    </colgroup>
                    <thead
                      className={`text-left text-[15px] font-medium leading-tight tracking-[-0.015em] whitespace-normal @[1280px]:text-[16px] @[1280px]:tracking-[-0.04em] @[1280px]:whitespace-nowrap ${isDarkTheme ? "bg-[#1B2331] text-[#9AA4BC]" : "bg-[#F3F3F5] text-[#7D7D7D]"}`}
                    >
                      <tr>
                        <th className="rounded-l-[5px] pl-4 pr-3 py-3 align-middle font-medium @[1280px]:pl-8 @[1280px]:pr-4 @[1280px]:py-2.5">
                          <span className="inline-flex items-center gap-2 font-medium">
                            ID
                            <button type="button" onClick={() => toggleSort("id")} className="cursor-pointer shrink-0">
                              <SortIcon />
                            </button>
                          </span>
                        </th>
                        <th className="px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5">
                          <span className="inline-flex items-center gap-2 font-medium">
                            ФИО
                            <button type="button" onClick={() => toggleSort("fullName")} className="cursor-pointer shrink-0">
                              <SortIcon />
                            </button>
                          </span>
                        </th>
                        <th className="px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5">
                          <span className="inline-flex items-center gap-2 font-medium">
                            Телефон
                            <button type="button" onClick={() => toggleSort("phone")} className="cursor-pointer shrink-0">
                              <SortIcon />
                            </button>
                          </span>
                        </th>
                        <th className="px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5">
                          <span className="inline-flex items-center gap-2 font-medium">
                            Последний визит
                            <button type="button" onClick={() => toggleSort("lastVisit")} className="cursor-pointer shrink-0">
                              <SortIcon />
                            </button>
                          </span>
                        </th>
                        <th className="min-w-0 px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5">
                          <span className="inline-flex max-w-full flex-wrap items-center gap-2 font-medium">
                            <span className="min-w-0 leading-tight">Заказ-наряды</span>
                            <button type="button" onClick={() => toggleSort("requestsCount")} className="cursor-pointer shrink-0">
                              <SortIcon />
                            </button>
                          </span>
                        </th>
                        <th className="px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5">
                          <span className="inline-flex items-center gap-2 font-medium">
                            Общая выручка
                            <button type="button" onClick={() => toggleSort("totalAmount")} className="cursor-pointer shrink-0">
                              <SortIcon />
                            </button>
                          </span>
                        </th>
                        <th className="rounded-r-[5px] px-3 py-3 text-center align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5">⋮</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row, index) => {
                        const borderCls = isDarkTheme ? "border-[#1A2130]" : "border-[#EEEDF0]";
                        const bgCls = isDarkTheme ? (index % 2 === 1 ? "bg-[#141C29]" : "bg-[#0F1622]") : index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white";
                        const hoverCls = "hover:bg-[rgba(224,9,25,0.10)]";
                        return (
                          <tr
                            key={row.id}
                            className={`cursor-pointer border-[5px] transition [&_td]:align-middle ${borderCls} ${bgCls} ${hoverCls}`}
                            onClick={() => navigate(`/clients/${row.id}`)}
                          >
                            <td
                              className={`pl-4 pr-3 py-3 text-[15px] leading-snug tracking-[-4%] tabular-nums @[1280px]:pl-8 @[1280px]:pr-4 @[1280px]:py-3 @[1280px]:text-[16px] @[1280px]:leading-normal @[1280px]:whitespace-nowrap ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}
                            >
                              {row.id}
                            </td>
                            <td
                              className={`px-3 py-3 text-[15px] leading-snug whitespace-normal break-words [overflow-wrap:anywhere] @[1280px]:px-4 @[1280px]:py-3 @[1280px]:text-[16px] @[1280px]:leading-normal @[1280px]:whitespace-nowrap @[1280px]:break-normal ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}
                            >
                              {row.fullName}
                            </td>
                            <td
                              className={`px-3 py-3 text-[15px] leading-normal whitespace-normal break-all [overflow-wrap:anywhere] @[1280px]:px-4 @[1280px]:py-3 @[1280px]:text-[16px] @[1280px]:whitespace-nowrap @[1280px]:break-normal ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}
                            >
                              {row.phone}
                            </td>
                            <td
                              className={`px-3 py-3 text-[15px] leading-normal @[1280px]:px-4 @[1280px]:py-3 @[1280px]:text-[16px] @[1280px]:whitespace-nowrap ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}
                            >
                              {row.lastVisit}
                            </td>
                            <td
                              className={`px-3 py-3 text-[15px] tabular-nums @[1280px]:px-4 @[1280px]:py-3 @[1280px]:text-[16px] @[1280px]:whitespace-nowrap ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}
                            >
                              {row.requestsCount}
                            </td>
                            <td
                              className={`px-3 py-3 text-[15px] leading-normal @[1280px]:px-4 @[1280px]:py-3 @[1280px]:text-[16px] @[1280px]:whitespace-nowrap ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}
                            >
                              {row.totalAmount}
                            </td>
                            <td className="px-3 py-3 text-center align-middle @[1280px]:px-4" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                aria-label={`Меню действий, клиент ${row.id}`}
                                className={`cursor-pointer rounded-md px-1.5 py-0.5 text-[16px] font-bold leading-none tracking-[-0.04em] text-[#A0A0A0] transition-colors hover:text-[#EC1C24] ${
                                  isDarkTheme ? "hover:bg-white/5" : "hover:bg-black/[0.04]"
                                }`}
                                onClick={() => setClientActionsModal(row)}
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
              </div>

              <div className="relative flex flex-col gap-4 max-lg:gap-5 max-lg:pt-1 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:pt-0">
                <div
                  className={`rounded-[8px] px-2 py-1 text-center text-[18px] font-bold tracking-[-0.04em] max-lg:w-full lg:w-auto lg:text-left lg:text-[20px] ${isDarkTheme ? "bg-[#1A2232] text-[#EDF2FF]" : "bg-white text-black"}`}
                >
                  {sortedRows.length} клиентов
                </div>
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 max-lg:relative max-lg:left-auto max-lg:top-auto max-lg:z-0 max-lg:translate-x-0 max-lg:translate-y-0 max-lg:pointer-events-auto max-lg:flex max-lg:w-full max-lg:justify-center lg:pointer-events-none lg:absolute lg:left-1/2 lg:top-1/2 lg:flex lg:w-auto lg:-translate-x-1/2 lg:-translate-y-1/2">
                  <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
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
                <div
                  className={`flex w-full shrink-0 justify-center gap-2 text-center text-[16px] font-bold tracking-[-0.04em] max-lg:order-last lg:w-auto lg:justify-end lg:text-right lg:text-[20px] ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}
                >
                  <span>
                    {sortedRows.length === 0 ? `0 из ${totalClients}` : `${pageStart + 1} — ${pageEnd} из ${sortedRows.length}`}
                  </span>
                </div>
              </div>
            </section>
          </main>
        </div>
        {clientActionsModal && typeof document !== "undefined"
          ? createPortal(
              <div
                className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
                role="presentation"
                onClick={() => setClientActionsModal(null)}
              >
                <div
                  role="dialog"
                  aria-modal="true"
                  aria-labelledby="client-actions-title"
                  className={`w-full max-w-[360px] overflow-hidden rounded-[14px] border shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)] ${
                    isDarkTheme ? "border-[#2B3345] bg-[#131925]" : "border-[#E4E5E7] bg-white"
                  }`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className={`border-b p-5 ${isDarkTheme ? "border-[#2B3345]" : "border-[#EEEDF0]"}`}>
                    <h2 id="client-actions-title" className={`text-[18px] font-semibold tracking-[-0.04em] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}>
                      Действия с клиентом
                    </h2>
                    <p className={`mt-1 truncate text-[14px] font-medium tracking-[-0.04em] ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]"}`}>
                      № {clientActionsModal.id} · {clientActionsModal.fullName}
                    </p>
                  </div>
                  <ul className="p-0">
                    {([
                      { id: "open", label: "Открыть карточку клиента" },
                      { id: "call", label: "Позвонить" },
                      { id: "createBooking", label: "Создать запись" },
                      { id: "createWorkOrder", label: "Создать заказ-наряд" },
                    ] as { id: ClientActionId; label: string }[]).map((action) => (
                      <li key={action.id}>
                        <button
                          type="button"
                          className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                            isDarkTheme ? "text-[#E8EDF8] hover:bg-white/[0.06]" : "text-[#111826] hover:bg-[#F3F3F5]"
                          }`}
                          onClick={() => handleClientAction(action.id)}
                        >
                          <ClientActionIcon
                            type={action.id}
                            className={isDarkTheme ? "h-[20px] w-[20px] text-[#B8C4DC]" : "h-[20px] w-[20px] text-[#4B5563]"}
                          />
                          {action.label}
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>,
              document.body,
            )
          : null}
        {createClientModalMounted && typeof document !== "undefined"
          ? createPortal(
              <div
                className={`fixed inset-0 z-[291] bg-black/35 transition-[opacity] ${createClientModalActive ? "opacity-100" : "opacity-0"}`}
                style={{ transitionDuration: "400ms", transitionTimingFunction: "cubic-bezier(0.45, 0, 0.55, 1)" }}
                role="presentation"
                onClick={closeCreateClientModal}
              >
                <div className="ml-auto flex h-full max-h-screen justify-end" onClick={(e) => e.stopPropagation()}>
                  <div
                    className="relative flex h-full shrink-0"
                    style={{
                      transform: createClientModalActive ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)",
                      transition: "transform 480ms cubic-bezier(0.45, 0, 0.55, 1)",
                      willChange: "transform",
                      backfaceVisibility: "hidden",
                      WebkitBackfaceVisibility: "hidden",
                    }}
                    onTransitionEnd={handleCreateClientDrawerTransitionEnd}
                  >
                    <button
                      type="button"
                      onClick={closeCreateClientModal}
                      className="absolute right-full top-8 z-10 mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#E8E8E8] bg-white text-[#111111] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.18)] transition hover:bg-[#F7F7F7]"
                      aria-label="Закрыть модалку добавления клиента"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                        <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                      </svg>
                    </button>
                    <aside
                      role="dialog"
                      aria-modal="true"
                      aria-labelledby="create-client-title"
                      className="flex h-full w-[min(900px,58vw)] min-w-[380px] max-w-[min(1040px,calc(100vw-48px))] flex-col border-l border-[#E6E6E6] bg-white tracking-[-0.04em] shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.2)]"
                    >
                      <div className="border-b border-[#EEEDF0] px-6 py-5">
                        <h2 id="create-client-title" className="text-[32px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">
                          Добавить клиента
                        </h2>
                      </div>
                      <div className="hide-scrollbar min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
                        <label className="block">
                          <span className="mb-2 block text-[14px] font-medium text-[#5A6472]">Тип клиента</span>
                          <div className="relative">
                            <select
                              value={createClientDraft.clientType}
                              onChange={(e) =>
                                setCreateClientDraft((prev) => ({
                                  ...prev,
                                  clientType: e.target.value as ClientType,
                                }))
                              }
                              className={`h-12 w-full appearance-none rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 pr-12 text-[18px] font-medium tracking-[-0.04em] outline-none ${
                                createClientDraft.clientType ? "text-black" : "text-[#B5B5B5]"
                              }`}
                            >
                              <option value="" disabled>
                                Выбрать тип клиента
                              </option>
                              <option value="person" className="text-black">
                                Физическое лицо
                              </option>
                              <option value="company" className="text-black">
                                Юридическое лицо
                              </option>
                              <option value="entrepreneur" className="text-black">
                                ИП
                              </option>
                            </select>
                            <svg viewBox="0 0 16 16" fill="none" className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#111111]" aria-hidden>
                              <path d="M3 6L8 11L13 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </div>
                        </label>

                        {createClientDraft.clientType === "person" ? (
                          <>
                            <input value={createClientDraft.fullName} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, fullName: e.target.value }))} placeholder="ФИО" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={maskRuPhoneInput(createClientDraft.phone)} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, phone: national10FromPhoneInput(e.target.value) }))} placeholder="Телефон" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={createClientDraft.email} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="E-mail" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={createClientDraft.car} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, car: e.target.value }))} placeholder="Автомобиль" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={createClientDraft.plate} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, plate: e.target.value }))} placeholder="Гос. номер" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                          </>
                        ) : null}

                        {createClientDraft.clientType === "company" ? (
                          <>
                            <input value={createClientDraft.orgName} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, orgName: e.target.value }))} placeholder="Наименование организации" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={createClientDraft.inn} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, inn: e.target.value }))} placeholder="ИНН" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={maskRuPhoneInput(createClientDraft.phone)} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, phone: national10FromPhoneInput(e.target.value) }))} placeholder="Телефон" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={createClientDraft.email} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="E-mail" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={createClientDraft.car} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, car: e.target.value }))} placeholder="Автомобиль" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={createClientDraft.plate} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, plate: e.target.value }))} placeholder="Гос. номер" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                          </>
                        ) : null}

                        {createClientDraft.clientType === "entrepreneur" ? (
                          <>
                            <input value={createClientDraft.fullName} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, fullName: e.target.value }))} placeholder="ИП ФИО" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={createClientDraft.inn} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, inn: e.target.value }))} placeholder="ИНН" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={maskRuPhoneInput(createClientDraft.phone)} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, phone: national10FromPhoneInput(e.target.value) }))} placeholder="Телефон" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={createClientDraft.email} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, email: e.target.value }))} placeholder="E-mail" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={createClientDraft.car} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, car: e.target.value }))} placeholder="Автомобиль" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                            <input value={createClientDraft.plate} onChange={(e) => setCreateClientDraft((prev) => ({ ...prev, plate: e.target.value }))} placeholder="Гос. номер" className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]" />
                          </>
                        ) : null}
                      </div>
                      <div className="flex items-center justify-between border-t border-[#EEEDF0] px-6 py-4">
                        <button
                          type="button"
                          onClick={closeCreateClientModal}
                          className="h-11 cursor-pointer rounded-[10px] bg-[#ECECEF] px-4 text-[15px] font-medium text-black"
                        >
                          Отмена
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateClientSubmit}
                          className="h-11 cursor-pointer rounded-[10px] bg-[#EC1C24] px-5 text-[15px] font-medium text-white"
                        >
                          Добавить клиента
                        </button>
                      </div>
                    </aside>
                  </div>
                </div>
              </div>,
              document.body,
            )
          : null}
      </div>
    </div>
  );
}
