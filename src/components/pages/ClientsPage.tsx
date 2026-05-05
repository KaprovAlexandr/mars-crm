import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import { CURRENT_USER_ROLE } from "@/lib/session/currentUser";
import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import * as XLSX from "xlsx";
import { clientsData, type ClientRow } from "@/lib/mock/clients-page";

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

const PAGE_SIZE = 12;

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

export function ClientsPage() {
  const navigate = useNavigate();
  const isManager = CURRENT_USER_ROLE === "manager";
  const filterBarRef = useRef<HTMLDivElement>(null);
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [openFilter, setOpenFilter] = useState<ClientsFilterId | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [rows] = useState<ClientTableRow[]>(() => INITIAL_CLIENT_ROWS.map((r) => ({ ...r })));
  const [visitPresets, setVisitPresets] = useState<Set<VisitPreset>>(() => new Set(ALL_VISIT_PRESETS));
  const [ordersBrackets, setOrdersBrackets] = useState<Set<OrdersBracket>>(() => new Set(ALL_ORDERS_BRACKETS));
  const [revenueBrackets, setRevenueBrackets] = useState<Set<RevenueBracket>>(() => new Set(ALL_REVENUE_BRACKETS));
  const [newClientsOnly, setNewClientsOnly] = useState(false);
  const [notVisited3mQuick, setNotVisited3mQuick] = useState(false);
  const [topRevenueOnly, setTopRevenueOnly] = useState(false);
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [sortState, setSortState] = useState<{ key: SortKey; dir: SortDir } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);

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

    return rows.filter((row) => {
      if (qText) {
        const byName = row.fullName.toLowerCase().includes(qText);
        const byId = row.id.toLowerCase().includes(qText);
        const byPhone = qDigits.length > 0 && row.phone.replace(/\D/g, "").includes(qDigits);
        if (!byName && !byId && !byPhone) return false;
      }
      if (!rowMatchesVisitPresets(row, visitPresets, now)) return false;
      if (!rowMatchesOrdersBrackets(row, ordersBrackets)) return false;
      if (!rowMatchesRevenueBrackets(row, revenueBrackets)) return false;

      if (newClientsOnly) {
        const rd = parseRuDate(row.lastVisit);
        if (!rd) return false;
        const rd0 = startOfDay(rd);
        const since = startOfDay(addDays(now, -13));
        if (rd0 < since || rd0 > endOfDay(now)) return false;
      }
      if (notVisited3mQuick) {
        const rd = parseRuDate(row.lastVisit);
        if (!rd) return false;
        if (startOfDay(rd) >= startOfDay(addDays(now, -90))) return false;
      }
      if (topRevenueOnly && parseAmountRub(row.totalAmount) < 30_000) return false;

      return true;
    });
  }, [
    rows,
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
    for (const row of rows) {
      const rd = parseRuDate(row.lastVisit);
      if (rd) {
        const rd0 = startOfDay(rd);
        const since = startOfDay(addDays(now, -13));
        if (rd0 >= since && rd0 <= endOfDay(now)) newC += 1;
        if (rd0 < startOfDay(addDays(now, -90))) absent3m += 1;
      }
      if (parseAmountRub(row.totalAmount) >= 30_000) topR += 1;
    }
    return { newC, absent3m, topR };
  }, [rows]);

  const noActiveFilters =
    !searchQuery.trim() &&
    visitPresets.size === ALL_VISIT_PRESETS.length &&
    ordersBrackets.size === ALL_ORDERS_BRACKETS.length &&
    revenueBrackets.size === ALL_REVENUE_BRACKETS.length &&
    !newClientsOnly &&
    !notVisited3mQuick &&
    !topRevenueOnly;

  const totalClients = rows.length;

  const allPageRowsSelected = pagedRows.length > 0 && pagedRows.every((r) => selectedRowIds.has(r.id));

  function resetFilters() {
    setSearchQuery("");
    setOpenFilter(null);
    setVisitPresets(new Set(ALL_VISIT_PRESETS));
    setOrdersBrackets(new Set(ALL_ORDERS_BRACKETS));
    setRevenueBrackets(new Set(ALL_REVENUE_BRACKETS));
    setNewClientsOnly(false);
    setNotVisited3mQuick(false);
    setTopRevenueOnly(false);
    setSelectedRowIds(new Set());
  }

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
    <div className={`h-screen w-screen overflow-hidden ${isDarkTheme ? "bg-[#0C0F14]" : "bg-black"}`}>
      <div className="flex h-full w-full p-2">
        <div className={`flex h-full w-full rounded-[16px] p-2 shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)] ${isDarkTheme ? "bg-[#0C0F14]" : "bg-black"}`}>
          <aside className="mr-2 flex w-[100px] flex-col items-center rounded-[11px] bg-black">
            <button type="button" className="mb-2 grid h-[90px] w-full place-items-center rounded-[16px] bg-[#EC1C24] text-[18px] font-semibold text-white">Марс</button>
            <button type="button" onClick={() => navigate("/dashboard")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="home" /></button>
            <button type="button" onClick={() => navigate("/")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="cube" /></button>
            <button type="button" onClick={() => navigate("/journal")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="layers" /></button>
            <button type="button" onClick={() => navigate("/work-orders")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="chat" /></button>
            <button type="button" onClick={() => navigate("/clients")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] bg-white text-[#11131D]"><MarsShellSidebarIcon type="pie" /></button>
            <div className="mt-auto space-y-2">
              <button
                type="button"
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
              {!isManager ? <button type="button" className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="grid" /></button> : null}
              {!isManager ? <button type="button" className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="doc" /></button> : null}
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
              <button type="button" onClick={() => navigate("/profile")} className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="user" /></button>
            </div>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col">
            <header className={`mb-2 rounded-[16px] border px-5 py-5 ${isDarkTheme ? "border-[#232937] bg-[#131925]" : "border-[#DDE1E7] bg-white"}`}>
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-2">
                  <h1 className={`text-[36px] font-bold leading-[100%] tracking-[-0.04em] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}>База клиентов</h1>
                  <span className="text-[16px] font-medium tracking-[-0.04em] text-[#B4B4B6]">
                    {noActiveFilters ? `${totalClients} клиентов` : `${displayRows.length} из ${totalClients}`}
                  </span>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className={`h-12 w-[320px] rounded-[10px] border-[3px] px-3 text-[18px] font-medium tracking-[-0.04em] outline-none ${
                      isDarkTheme
                        ? "border-[#2B3345] bg-[#0E1420] text-[#C9D2E8] placeholder:text-[#7C879F]"
                        : "border-[#E4E5E7] bg-white text-[#111826] placeholder:text-[#B5B5B5]"
                    }`}
                    placeholder="Найти клиента..."
                  />
                  <button
                    type="button"
                    className="h-12 rounded-[10px] border-2 border-transparent bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out hover:border-[#EC1C24] hover:bg-white hover:text-[#EC1C24]"
                  >
                    Создать заявку
                  </button>
                  <button
                    type="button"
                    onClick={() => exportClientsToXlsx(noActiveFilters ? rows : sortedRows)}
                    className="h-12 shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-black px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out hover:border-black hover:bg-white hover:text-black"
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
                      <col className="w-[10%]" />
                      <col className="w-[20%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[11%]" />
                      <col className="w-[14%]" />
                      <col className="w-[4%]" />
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
                        <th className="px-4 py-2.5 align-middle font-medium">
                          <span className="inline-flex items-center gap-2 font-medium">
                            ID
                            <button type="button" onClick={() => toggleSort("id")} className="cursor-pointer">
                              <SortIcon />
                            </button>
                          </span>
                        </th>
                        <th className="px-4 py-2.5 align-middle font-medium">
                          <span className="inline-flex items-center gap-2 font-medium">
                            ФИО
                            <button type="button" onClick={() => toggleSort("fullName")} className="cursor-pointer">
                              <SortIcon />
                            </button>
                          </span>
                        </th>
                        <th className="px-4 py-2.5 align-middle font-medium">
                          <span className="inline-flex items-center gap-2 font-medium">
                            Телефон
                            <button type="button" onClick={() => toggleSort("phone")} className="cursor-pointer">
                              <SortIcon />
                            </button>
                          </span>
                        </th>
                        <th className="px-4 py-2.5 align-middle font-medium">
                          <span className="inline-flex items-center gap-2 font-medium">
                            Последний визит
                            <button type="button" onClick={() => toggleSort("lastVisit")} className="cursor-pointer">
                              <SortIcon />
                            </button>
                          </span>
                        </th>
                        <th className="min-w-0 px-4 py-2.5 align-middle font-medium">
                          <span className="inline-flex max-w-full flex-wrap items-center gap-2 font-medium">
                            <span className="min-w-0 leading-tight">Заказ-наряды</span>
                            <button type="button" onClick={() => toggleSort("requestsCount")} className="cursor-pointer shrink-0">
                              <SortIcon />
                            </button>
                          </span>
                        </th>
                        <th className="px-4 py-2.5 align-middle font-medium">
                          <span className="inline-flex items-center gap-2 font-medium">
                            Общая выручка
                            <button type="button" onClick={() => toggleSort("totalAmount")} className="cursor-pointer">
                              <SortIcon />
                            </button>
                          </span>
                        </th>
                        <th className="rounded-r-[5px] px-4 py-2.5 align-middle font-medium text-center">⋮</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row, index) => {
                        const isSelected = selectedRowIds.has(row.id);
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
                          <tr key={row.id} className={`border-[5px] transition ${borderCls} ${bgCls} ${hoverCls}`}>
                            <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                              <span
                                className="inline-flex cursor-pointer select-none items-center"
                                role="checkbox"
                                aria-checked={isSelected}
                                aria-label={`Выбрать клиента ${row.id}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  toggleRowSelection(row.id);
                                }}
                              >
                                <ClientsStyleCheckboxBox checked={isSelected} dark={isDarkTheme} />
                              </span>
                            </td>
                            <td
                              className={`cursor-pointer whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}
                              onClick={() => navigate(`/clients/${row.id}`)}
                            >
                              {row.id}
                            </td>
                            <td
                              className={`cursor-pointer whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}
                              onClick={() => navigate(`/clients/${row.id}`)}
                            >
                              {row.fullName}
                            </td>
                            <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>{row.phone}</td>
                            <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>{row.lastVisit}</td>
                            <td className={`whitespace-nowrap px-4 py-3 tabular-nums ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>{row.requestsCount}</td>
                            <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>{row.totalAmount}</td>
                            <td className="px-4 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                              <button
                                type="button"
                                aria-label={`Меню действий, клиент ${row.id}`}
                                className={`cursor-pointer rounded-md px-1.5 py-0.5 text-[16px] font-bold leading-none tracking-[-0.04em] text-[#A0A0A0] transition-colors hover:text-[#EC1C24] ${
                                  isDarkTheme ? "hover:bg-white/5" : "hover:bg-black/[0.04]"
                                }`}
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
                <button
                  type="button"
                  className={`rounded-[8px] px-2 py-1 text-[20px] font-bold tracking-[-0.04em] ${isDarkTheme ? "bg-[#1A2232] text-[#EDF2FF]" : "bg-white text-black"}`}
                >
                  {selectedRowIds.size} / клиентов
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
                    {sortedRows.length === 0 ? `0 из ${totalClients}` : `${pageStart + 1} — ${pageEnd} из ${sortedRows.length}`}
                  </span>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
