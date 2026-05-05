const STORAGE_KEY = "diplom-crm-notification-read-ids";

function parseIds(raw: string | null): Set<string> {
  if (!raw) return new Set();
  try {
    const data = JSON.parse(raw) as unknown;
    if (!Array.isArray(data)) return new Set();
    return new Set(data.filter((x): x is string => typeof x === "string"));
  } catch {
    return new Set();
  }
}

export function loadReadNotificationIds(): Set<string> {
  if (typeof window === "undefined") return new Set();
  return parseIds(window.localStorage.getItem(STORAGE_KEY));
}

function saveReadNotificationIds(ids: Set<string>): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...ids]));
}

export function applyPersistedReadToNotifications<T extends { id: string; unread: boolean }>(notifications: T[]): T[] {
  const readIds = loadReadNotificationIds();
  if (readIds.size === 0) return notifications;
  return notifications.map((n) => (readIds.has(n.id) ? { ...n, unread: false } : n));
}

export function persistNotificationMarkedRead(id: string): void {
  const ids = loadReadNotificationIds();
  ids.add(id);
  saveReadNotificationIds(ids);
}

export function persistNotificationsMarkedRead(ids: readonly string[]): void {
  if (ids.length === 0) return;
  const set = loadReadNotificationIds();
  for (const id of ids) set.add(id);
  saveReadNotificationIds(set);
}

/** Удалить из набора «прочитано» (например при удалении строки из списка). */
export function removePersistedNotificationRead(id: string): void {
  const set = loadReadNotificationIds();
  if (!set.delete(id)) return;
  saveReadNotificationIds(set);
}
