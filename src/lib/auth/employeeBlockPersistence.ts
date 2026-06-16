import { normalizeAuthEmail } from "@/lib/auth/employeeRole";

const BLOCKED_EMPLOYEE_EMAILS_KEY = "blockedEmployeeEmailsV1";

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readBlockedEmailSet(): Set<string> {
  if (!canUseLocalStorage()) return new Set();
  try {
    const raw = window.localStorage.getItem(BLOCKED_EMPLOYEE_EMAILS_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) return new Set();
    return new Set(parsed.filter((item): item is string => typeof item === "string").map(normalizeAuthEmail));
  } catch {
    return new Set();
  }
}

function writeBlockedEmailSet(emails: Set<string>): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(BLOCKED_EMPLOYEE_EMAILS_KEY, JSON.stringify(Array.from(emails)));
  } catch {
    // ignore quota errors
  }
}

export function isEmployeeBlocked(email: string | null | undefined): boolean {
  const key = normalizeAuthEmail(email);
  if (!key) return false;
  return readBlockedEmailSet().has(key);
}

export function blockEmployeeEmail(email: string | null | undefined): void {
  const key = normalizeAuthEmail(email);
  if (!key) return;
  const next = readBlockedEmailSet();
  next.add(key);
  writeBlockedEmailSet(next);
}

export function unblockEmployeeEmail(email: string | null | undefined): void {
  const key = normalizeAuthEmail(email);
  if (!key) return;
  const next = readBlockedEmailSet();
  next.delete(key);
  writeBlockedEmailSet(next);
}
