import { isEmployeeBlocked } from "@/lib/auth/employeeBlockPersistence";
import { pickBetterEmployeeFullName } from "@/lib/auth/employeeFullName";
import {
  normalizeAuthEmail,
  resolveEmployeeDisplayFullName,
  resolveEmployeeRoleFromEmail,
  ROLE_LABELS,
} from "@/lib/auth/employeeRole";
import { readStoredUserFullName } from "@/lib/auth/userFullName";

export type PendingEmployee = {
  id: string;
  email: string;
  fullName: string;
  registeredAt: string;
};

export type PendingEmployeeTableRow = {
  id: string;
  fullName: string;
  photo: string;
  role: string;
  status: "Ожидание доступа";
  lastActivity: string;
  email: string;
  pendingAccess: true;
};

const PENDING_EMPLOYEES_KEY = "pendingEmployeesAwaitingAccessV1";
export const PENDING_EMPLOYEES_UPDATED_EVENT = "pending-employees-updated";

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function formatRuDateTimeNow(date = new Date()): string {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

function notifyPendingEmployeesUpdated(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event(PENDING_EMPLOYEES_UPDATED_EVENT));
}

function normalizePendingEmployee(row: PendingEmployee): PendingEmployee {
  return {
    ...row,
    fullName: resolveEmployeeDisplayFullName(row.email, row.fullName, row.id),
  };
}

function readPendingEmployees(): PendingEmployee[] {
  if (!canUseLocalStorage()) return [];
  try {
    const raw = window.localStorage.getItem(PENDING_EMPLOYEES_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter(
        (item): item is PendingEmployee =>
          Boolean(item) &&
          typeof item === "object" &&
          typeof (item as PendingEmployee).id === "string" &&
          typeof (item as PendingEmployee).email === "string" &&
          typeof (item as PendingEmployee).fullName === "string" &&
          typeof (item as PendingEmployee).registeredAt === "string",
      )
      .map((row) => normalizePendingEmployee(row));
  } catch {
    return [];
  }
}

function writePendingEmployees(rows: PendingEmployee[]): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(PENDING_EMPLOYEES_KEY, JSON.stringify(rows.map((row) => normalizePendingEmployee(row))));
    notifyPendingEmployeesUpdated();
  } catch {
    // ignore quota errors
  }
}

export function loadPendingEmployees(): PendingEmployee[] {
  return readPendingEmployees();
}

/** Заменяет локальный список ожидающих (после загрузки с сервера). */
export function replacePendingEmployees(rows: PendingEmployee[]): void {
  writePendingEmployees(rows);
}

export function pendingEmployeeToTableRow(pending: PendingEmployee): PendingEmployeeTableRow {
  const normalized = normalizePendingEmployee(pending);
  return {
    id: normalized.id,
    fullName: normalized.fullName,
    photo: "",
    role: ROLE_LABELS.pending,
    status: "Ожидание доступа",
    lastActivity: normalized.registeredAt,
    email: normalized.email,
    pendingAccess: true,
  };
}

export function registerPendingEmployee(input: { email: string; fullName: string; registeredAt?: string }): void {
  const email = normalizeAuthEmail(input.email);
  const fullName = pickBetterEmployeeFullName(email, input.fullName, readStoredUserFullName(email));
  if (!email || !fullName) return;

  const rows = readPendingEmployees();
  const existing = rows.find((row) => normalizeAuthEmail(row.email) === email);
  if (existing) {
    const next = rows.map((row) =>
      normalizeAuthEmail(row.email) === email
        ? normalizePendingEmployee({
            ...row,
            fullName: pickBetterEmployeeFullName(email, fullName, row.fullName, readStoredUserFullName(email)),
            registeredAt: row.registeredAt || input.registeredAt || formatRuDateTimeNow(),
          })
        : row,
    );
    writePendingEmployees(next);
    return;
  }

  writePendingEmployees([
    normalizePendingEmployee({
      id: `pending-${email.replace(/[^a-z0-9]+/gi, "-")}`,
      email,
      fullName,
      registeredAt: input.registeredAt ?? formatRuDateTimeNow(),
    }),
    ...rows,
  ]);
}

export function removePendingEmployeeByEmail(email: string | null | undefined): void {
  const key = normalizeAuthEmail(email);
  if (!key) return;
  const next = readPendingEmployees().filter((row) => normalizeAuthEmail(row.email) !== key);
  writePendingEmployees(next);
}

export function removePendingEmployeeById(id: string): void {
  const next = readPendingEmployees().filter((row) => row.id !== id);
  writePendingEmployees(next);
}

export function syncPendingEmployeeFromAuth(email: string | null | undefined, fullName: string): void {
  const key = normalizeAuthEmail(email);
  if (!key || isEmployeeBlocked(key)) {
    if (key) removePendingEmployeeByEmail(key);
    return;
  }

  if (resolveEmployeeRoleFromEmail(key) !== "pending") {
    removePendingEmployeeByEmail(key);
    return;
  }

  registerPendingEmployee({
    email: key,
    fullName: pickBetterEmployeeFullName(key, fullName, readStoredUserFullName(key)),
  });
}
