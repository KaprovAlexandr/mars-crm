type PersistedEmployeeRow = {
  id: string;
  fullName: string;
  photo: string;
  role: string;
  status: "Активен" | "В отпуске" | "Заблокирован" | "Не в сети";
  lastActivity: string;
  email?: string;
};

const SETTINGS_EMPLOYEE_ROWS_KEY = "settingsEmployeeRowsV1";

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function isEmployeeRowArray(value: unknown): value is PersistedEmployeeRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.fullName === "string" &&
        typeof item.role === "string" &&
        typeof item.status === "string" &&
        typeof item.lastActivity === "string",
    )
  );
}

export function loadSettingsEmployeeRows<T extends PersistedEmployeeRow>(defaults: T[]): T[] {
  if (!canUseLocalStorage()) return defaults;
  try {
    const raw = window.localStorage.getItem(SETTINGS_EMPLOYEE_ROWS_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as unknown;
    if (!isEmployeeRowArray(parsed)) return defaults;
    const byId = new Map(parsed.map((row) => [row.id, row]));
    const defaultIds = new Set(defaults.map((row) => row.id));
    const mergedDefaults = defaults.map((row) => {
      const stored = byId.get(row.id);
      if (!stored) return row;
      return { ...row, ...stored };
    });
    const extras = parsed.filter((row) => !defaultIds.has(row.id)).map((row) => row as T);
    return [...extras, ...mergedDefaults];
  } catch {
    return defaults;
  }
}

export function persistSettingsEmployeeRows(rows: PersistedEmployeeRow[]): void {
  if (!canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(SETTINGS_EMPLOYEE_ROWS_KEY, JSON.stringify(rows));
  } catch {
    // ignore quota errors
  }
}

export function buildEmployeeRowFromPending(
  pending: { id: string; email: string; fullName: string; registeredAt: string },
  role: string,
): PersistedEmployeeRow & { email: string } {
  const emailSlug = pending.email.replace(/[^a-z0-9]+/gi, "-");
  return {
    id: pending.id.startsWith("pending-") ? `e-${emailSlug}` : pending.id,
    fullName: pending.fullName,
    photo: "",
    role,
    status: "Активен",
    lastActivity: pending.registeredAt || "—",
    email: pending.email,
  };
}

export function upsertEmployeeRow<T extends PersistedEmployeeRow>(rows: T[], nextRow: T): T[] {
  const emailKey = nextRow.email?.trim().toLowerCase();
  const index = rows.findIndex(
    (row) => row.id === nextRow.id || (emailKey && row.email?.trim().toLowerCase() === emailKey),
  );
  if (index >= 0) {
    return rows.map((row, i) => (i === index ? { ...row, ...nextRow, id: row.id } : row));
  }
  return [nextRow, ...rows];
}
