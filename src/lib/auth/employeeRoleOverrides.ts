import { normalizeAuthEmail, type EmployeeRole } from "@/lib/auth/employeeRole";

const EMPLOYEE_ROLE_OVERRIDES_KEY = "employeeRoleOverrideByEmailV1";

export type StoredEmployeeRole = Exclude<EmployeeRole, "pending">;

type StoredRole = StoredEmployeeRole;

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readOverrides(): Record<string, StoredRole> {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(EMPLOYEE_ROLE_OVERRIDES_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== "object") return {};
    return parsed as Record<string, StoredRole>;
  } catch {
    return {};
  }
}

function writeOverrides(overrides: Record<string, StoredRole>): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(EMPLOYEE_ROLE_OVERRIDES_KEY, JSON.stringify(overrides));
  } catch {
    // ignore quota errors
  }
}

export function getEmployeeRoleOverride(email: string | null | undefined): StoredRole | null {
  const key = normalizeAuthEmail(email);
  if (!key) return null;
  return readOverrides()[key] ?? null;
}

export function setEmployeeRoleOverride(email: string | null | undefined, role: StoredRole): void {
  const key = normalizeAuthEmail(email);
  if (!key) return;
  const next = readOverrides();
  next[key] = role;
  writeOverrides(next);
}

export function mapEmployeeRoleLabelToRole(label: string): StoredRole | null {
  switch (label) {
    case "Руководитель":
      return "head";
    case "Администратор":
      return "administrator";
    case "Менеджер":
      return "manager";
    case "Мастер":
      return "master";
    default:
      return null;
  }
}
