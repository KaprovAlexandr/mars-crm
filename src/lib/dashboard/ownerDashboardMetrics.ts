import type { JournalStorageRow } from "@/lib/data/journalDataSource";
import type { RequestsStorageRow } from "@/lib/data/requestsDataSource";
import type { WorkOrderStorageRow } from "@/lib/data/workOrdersDataSource";

export type OwnerPeriodMode = "month" | "quarter" | "year";

export type OwnerChartBucket = {
  id: string;
  label: string;
  start: Date;
  end: Date;
  revenue: number;
};

export type OwnerKpiCard = {
  label: string;
  value: string;
  delta: string;
};

export type OwnerServiceSlice = {
  label: string;
  count: number;
  percent: string;
  color: string;
};

const SERVICE_COLORS = ["#3A8DDE", "#48BFD2", "#31A56E", "#8D5BCF", "#D19237", "#D2D5DC"];

const MONTH_SHORT = ["янв", "фев", "мар", "апр", "май", "июн", "июл", "авг", "сен", "окт", "ноя", "дек"];

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

export function parseAmountRub(amount: string | null | undefined): number {
  if (!amount) return 0;
  const digits = amount.replace(/[^\d]/g, "");
  if (!digits) return 0;
  const n = Number(digits);
  return Number.isFinite(n) ? n : 0;
}

export function parseFlexibleDate(value: string | null | undefined): Date | null {
  if (!value || !String(value).trim()) return null;
  const s = String(value).trim();
  const iso = new Date(s);
  if (!Number.isNaN(iso.getTime())) return iso;
  const m = s.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})/);
  if (m) {
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const y = Number(m[3]);
    const dt = new Date(y, mo, d, 12, 0, 0, 0);
    if (!Number.isNaN(dt.getTime())) return dt;
  }
  return null;
}

function startOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}

function endOfDay(d: Date): Date {
  const x = new Date(d);
  x.setHours(23, 59, 59, 999);
  return x;
}

function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

function addMonths(d: Date, n: number): Date {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}

function startOfMonth(d: Date): Date {
  return startOfDay(new Date(d.getFullYear(), d.getMonth(), 1));
}

function endOfMonth(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), d.getMonth() + 1, 0));
}

function startOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return startOfDay(new Date(d.getFullYear(), q * 3, 1));
}

function endOfQuarter(d: Date): Date {
  const q = Math.floor(d.getMonth() / 3);
  return endOfDay(new Date(d.getFullYear(), q * 3 + 3, 0));
}

function startOfYear(d: Date): Date {
  return startOfDay(new Date(d.getFullYear(), 0, 1));
}

function endOfYear(d: Date): Date {
  return endOfDay(new Date(d.getFullYear(), 11, 31));
}

export function getCurrentPeriodBounds(mode: OwnerPeriodMode, now: Date): { start: Date; end: Date } {
  if (mode === "month") return { start: startOfMonth(now), end: endOfMonth(now) };
  if (mode === "quarter") return { start: startOfQuarter(now), end: endOfQuarter(now) };
  return { start: startOfYear(now), end: endOfYear(now) };
}

export function getPreviousPeriodBounds(mode: OwnerPeriodMode, now: Date): { start: Date; end: Date } {
  if (mode === "month") {
    const prev = addMonths(now, -1);
    return { start: startOfMonth(prev), end: endOfMonth(prev) };
  }
  if (mode === "quarter") {
    const prev = addMonths(now, -3);
    return { start: startOfQuarter(prev), end: endOfQuarter(prev) };
  }
  const prev = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
  return { start: startOfYear(prev), end: endOfYear(prev) };
}

function inRange(d: Date, start: Date, end: Date): boolean {
  return d.getTime() >= start.getTime() && d.getTime() <= end.getTime();
}

export function formatRub(n: number): string {
  if (!Number.isFinite(n) || n <= 0) return "0 ₽";
  return `${Math.round(n).toLocaleString("ru-RU")} ₽`;
}

function formatInt(n: number): string {
  return Math.round(n).toLocaleString("ru-RU");
}

function formatDelta(curr: number, prev: number, unit: "count" | "rub" | "pct"): string {
  if (!Number.isFinite(prev) || prev === 0) {
    if (curr === 0) return "Нет данных за прошлый период";
    return "↑ к пред. периоду: нет базы";
  }
  const diff = curr - prev;
  const pct = (diff / prev) * 100;
  const sign = diff >= 0 ? "↑" : "↓";
  if (unit === "rub") {
    return `${sign} ${formatRub(Math.abs(diff))} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%) к пред. периоду`;
  }
  if (unit === "pct") {
    const pp = diff;
    return `${sign} ${Math.abs(pp).toFixed(1)} п.п. к пред. периоду`;
  }
  return `${sign} ${formatInt(Math.abs(diff))} (${pct >= 0 ? "+" : ""}${pct.toFixed(1)}%) к пред. периоду`;
}

function isArchivedWo(row: WorkOrderStorageRow): boolean {
  return Boolean(row.archived);
}

function revenueStatuses(status: WorkOrderStorageRow["status"]): boolean {
  return status === "Готово" || status === "Закрыт";
}

function closedStatus(status: WorkOrderStorageRow["status"]): boolean {
  return status === "Закрыт";
}

function calendarDaysInPeriod(start: Date, end: Date): number {
  const a = startOfDay(start);
  const b = startOfDay(end);
  return Math.max(1, Math.floor((b.getTime() - a.getTime()) / 86400000) + 1);
}

function daysInclusive(start: Date, end: Date): number {
  return calendarDaysInPeriod(start, end);
}

function buildBuckets(mode: OwnerPeriodMode, start: Date, end: Date): OwnerChartBucket[] {
  const buckets: OwnerChartBucket[] = [];
  if (mode === "month") {
    const t0 = startOfDay(start).getTime();
    const t1 = endOfDay(end).getTime();
    for (let t = t0; t <= t1; t += 86400000) {
      const d = new Date(t);
      const dayStart = startOfDay(d);
      const dayEnd = endOfDay(d);
      const label = `${pad2(d.getDate())}.${pad2(d.getMonth() + 1)}`;
      buckets.push({
        id: `d-${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`,
        label,
        start: dayStart,
        end: dayEnd,
        revenue: 0,
      });
    }
    return buckets;
  }
  if (mode === "quarter") {
    let cursor = startOfDay(start);
    let idx = 0;
    while (cursor <= end) {
      const weekEnd = endOfDay(addDays(cursor, 6));
      const sliceEnd = weekEnd.getTime() > end.getTime() ? end : weekEnd;
      const a = cursor;
      const b = sliceEnd;
      const label =
        a.getMonth() === b.getMonth()
          ? `${a.getDate()}–${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`
          : `${a.getDate()} ${MONTH_SHORT[a.getMonth()]} – ${b.getDate()} ${MONTH_SHORT[b.getMonth()]}`;
      buckets.push({
        id: `w-${idx}`,
        label,
        start: a,
        end: b,
        revenue: 0,
      });
      cursor = startOfDay(addDays(sliceEnd, 1));
      idx += 1;
    }
    return buckets;
  }
  for (let m = 0; m < 12; m++) {
    const monthStart = startOfDay(new Date(start.getFullYear(), m, 1));
    const monthEnd = endOfMonth(monthStart);
    if (monthStart > end) break;
    const clipStart = monthStart < start ? start : monthStart;
    const clipEnd = monthEnd > end ? end : monthEnd;
    buckets.push({
      id: `m-${start.getFullYear()}-${m}`,
      label: MONTH_SHORT[m],
      start: clipStart,
      end: clipEnd,
      revenue: 0,
    });
  }
  return buckets;
}

function assignRevenueToBuckets(buckets: OwnerChartBucket[], orders: WorkOrderStorageRow[]): void {
  for (const row of orders) {
    if (isArchivedWo(row) || !revenueStatuses(row.status)) continue;
    const dt = parseFlexibleDate(row.due_date);
    if (!dt) continue;
    const amt = parseAmountRub(row.amount);
    for (const b of buckets) {
      if (inRange(dt, b.start, b.end)) {
        b.revenue += amt;
        break;
      }
    }
  }
}

function countInRange<T>(rows: T[], getDate: (row: T) => Date | null, start: Date, end: Date): number {
  let n = 0;
  for (const row of rows) {
    const d = getDate(row);
    if (d && inRange(d, start, end)) n += 1;
  }
  return n;
}

function sumRevenueInRange(orders: WorkOrderStorageRow[], start: Date, end: Date): number {
  let s = 0;
  for (const row of orders) {
    if (isArchivedWo(row) || !revenueStatuses(row.status)) continue;
    const dt = parseFlexibleDate(row.due_date);
    if (!dt || !inRange(dt, start, end)) continue;
    s += parseAmountRub(row.amount);
  }
  return s;
}

function countWoInRange(orders: WorkOrderStorageRow[], start: Date, end: Date): number {
  let n = 0;
  for (const row of orders) {
    if (isArchivedWo(row)) continue;
    const dt = parseFlexibleDate(row.due_date);
    if (dt && inRange(dt, start, end)) n += 1;
  }
  return n;
}

function countClosedInRange(orders: WorkOrderStorageRow[], start: Date, end: Date): number {
  let n = 0;
  for (const row of orders) {
    if (isArchivedWo(row) || !closedStatus(row.status)) continue;
    const dt = parseFlexibleDate(row.due_date);
    if (dt && inRange(dt, start, end)) n += 1;
  }
  return n;
}

function countRequestsInRange(rows: RequestsStorageRow[], start: Date, end: Date): number {
  let n = 0;
  for (const row of rows) {
    if (row.archived) continue;
    const d = parseFlexibleDate(row.created_at);
    if (d && inRange(d, start, end)) n += 1;
  }
  return n;
}

function aggregateServices(journal: JournalStorageRow[], start: Date, end: Date): OwnerServiceSlice[] {
  const map = new Map<string, number>();
  for (const row of journal) {
    const d = parseFlexibleDate(row.start_time);
    if (!d || !inRange(d, start, end)) continue;
    const raw = (row.service ?? "").trim() || "Без названия";
    const key = raw.length > 42 ? `${raw.slice(0, 40)}…` : raw;
    map.set(key, (map.get(key) ?? 0) + 1);
  }
  const entries = [...map.entries()].sort((a, b) => b[1] - a[1]);
  const top = entries.slice(0, 6);
  const rest = entries.slice(6).reduce((s, [, c]) => s + c, 0);
  if (rest > 0) top.push(["Прочее", rest]);
  const total = top.reduce((s, [, c]) => s + c, 0) || 1;
  return top.map(([label, count], i) => ({
    label,
    count,
    percent: `${((count / total) * 100).toFixed(0)}%`,
    color: SERVICE_COLORS[i % SERVICE_COLORS.length],
  }));
}

export type OwnerDashboardSnapshot = {
  buckets: OwnerChartBucket[];
  kpis: OwnerKpiCard[];
  serviceSlices: OwnerServiceSlice[];
  requestsTotal: number;
  maxChartRevenue: number;
};

const MARGIN_RATE = 0.25;

export function buildOwnerDashboardSnapshot(
  mode: OwnerPeriodMode,
  now: Date,
  workOrders: WorkOrderStorageRow[],
  journal: JournalStorageRow[],
  requests: RequestsStorageRow[],
): OwnerDashboardSnapshot {
  const cur = getCurrentPeriodBounds(mode, now);
  const prev = getPreviousPeriodBounds(mode, now);

  const buckets = buildBuckets(mode, cur.start, cur.end);
  assignRevenueToBuckets(buckets, workOrders);
  const maxChartRevenue = Math.max(1, ...buckets.map((b) => b.revenue), 1);

  const journalCur = countInRange(journal, (j) => parseFlexibleDate(j.start_time), cur.start, cur.end);
  const journalPrev = countInRange(journal, (j) => parseFlexibleDate(j.start_time), prev.start, prev.end);

  const woCur = countWoInRange(workOrders, cur.start, cur.end);
  const woPrev = countWoInRange(workOrders, prev.start, prev.end);

  const days = daysInclusive(cur.start, cur.end);
  const journalPerDay = journalCur / days;
  const journalPerDayPrev = journalPrev / Math.max(1, daysInclusive(prev.start, prev.end));

  const revCur = sumRevenueInRange(workOrders, cur.start, cur.end);
  const revPrev = sumRevenueInRange(workOrders, prev.start, prev.end);

  const completedForAvg = workOrders.filter((o) => {
    if (isArchivedWo(o) || !revenueStatuses(o.status)) return false;
    const d = parseFlexibleDate(o.due_date);
    return d && inRange(d, cur.start, cur.end);
  });
  const avgCheck = completedForAvg.length ? revCur / completedForAvg.length : 0;
  const completedPrev = workOrders.filter((o) => {
    if (isArchivedWo(o) || !revenueStatuses(o.status)) return false;
    const d = parseFlexibleDate(o.due_date);
    return d && inRange(d, prev.start, prev.end);
  });
  const revPrevCount = completedPrev.length;
  const avgPrev = revPrevCount ? revPrev / revPrevCount : 0;

  const closedCur = countClosedInRange(workOrders, cur.start, cur.end);
  const closedPrev = countClosedInRange(workOrders, prev.start, prev.end);

  const reqCur = countRequestsInRange(requests, cur.start, cur.end);
  const reqPrev = countRequestsInRange(requests, prev.start, prev.end);

  const closeRateCur = woCur > 0 ? (closedCur / woCur) * 100 : 0;
  const closeRatePrev = woPrev > 0 ? (closedPrev / woPrev) * 100 : 0;

  const marginCur = revCur * MARGIN_RATE;
  const marginPrev = revPrev * MARGIN_RATE;
  const rentCur = revCur > 0 ? (marginCur / revCur) * 100 : 0;
  const rentPrev = revPrev > 0 ? (marginPrev / revPrev) * 100 : 0;

  const kpis: OwnerKpiCard[] = [
    { label: "Записей в журнале", value: formatInt(journalCur), delta: formatDelta(journalCur, journalPrev, "count") },
    { label: "Заказ-нарядов", value: formatInt(woCur), delta: formatDelta(woCur, woPrev, "count") },
    { label: "Записей / день", value: journalPerDay.toFixed(1), delta: formatDelta(journalPerDay, journalPerDayPrev, "count") },
    { label: "Выручка по ЗН", value: formatRub(revCur), delta: formatDelta(revCur, revPrev, "rub") },
    { label: "Средний чек ЗН", value: formatRub(avgCheck), delta: formatDelta(avgCheck, avgPrev, "rub") },
    {
      label: "Оценка валовой (25%)",
      value: formatRub(marginCur),
      delta: formatDelta(marginCur, marginPrev, "rub"),
    },
    { label: "Рентабельность", value: `${rentCur.toFixed(1)}%`, delta: formatDelta(rentCur, rentPrev, "pct") },
    { label: "Доля закрытых ЗН", value: `${closeRateCur.toFixed(1)}%`, delta: formatDelta(closeRateCur, closeRatePrev, "pct") },
  ];

  const serviceSlices = aggregateServices(journal, cur.start, cur.end);
  const requestsTotal = countRequestsInRange(requests, cur.start, cur.end);

  return { buckets, kpis, serviceSlices, requestsTotal, maxChartRevenue };
}
