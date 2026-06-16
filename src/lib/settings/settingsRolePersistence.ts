import type { RoleAccessPermissions } from "@/lib/settings/roleAccessSections";

export type PersistedRoleRow = {
  id: string;
  roleName: string;
  description: string;
  usersCount: number;
  createdOrUpdatedAt: string;
  access?: RoleAccessPermissions;
};

const SETTINGS_ROLE_ROWS_KEY = "settingsRoleRowsV1";

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isAccessObject(value: unknown): value is RoleAccessPermissions {
  if (!value || typeof value !== "object") return false;
  return Object.values(value).every((v) => typeof v === "boolean");
}

function isRoleRowArray(value: unknown): value is PersistedRoleRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.roleName === "string" &&
        typeof item.description === "string" &&
        typeof item.usersCount === "number" &&
        typeof item.createdOrUpdatedAt === "string" &&
        (item.access === undefined || isAccessObject(item.access)),
    )
  );
}

export function loadSettingsRoleRows<T extends PersistedRoleRow>(defaults: T[]): T[] {
  if (!canUseLocalStorage()) return defaults;
  try {
    const raw = window.localStorage.getItem(SETTINGS_ROLE_ROWS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!isRoleRowArray(parsed)) return defaults;

    const defaultById = new Map(defaults.map((row) => [row.id, row]));
    const parsedIds = new Set(parsed.map((row) => row.id));

    const merged = parsed.map((stored) => {
      const def = defaultById.get(stored.id);
      if (def) return { ...def, ...stored };
      return stored as T;
    });

    for (const def of defaults) {
      if (!parsedIds.has(def.id)) merged.push(def);
    }

    return merged;
  } catch {
    return defaults;
  }
}

export function persistSettingsRoleRows(rows: PersistedRoleRow[]): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(SETTINGS_ROLE_ROWS_KEY, JSON.stringify(rows));
  } catch {
    // ignore quota errors
  }
}
