export type ActionLogEntry = {
  id: string;
  title: string;
  description: string;
  time: string;
};

const listeners = new Set<() => void>();
let entries: ActionLogEntry[] = [];
const MAX_ENTRIES = 200;

function notify() {
  listeners.forEach((cb) => cb());
}

function formatLogTime(d: Date): string {
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function subscribeActionLog(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getActionLog(): ActionLogEntry[] {
  return entries.map((e) => ({ ...e }));
}

/** Сообщения в разделе «Логи действий» панели уведомлений. */
export function appendUserActionLog(p: { title: string; description: string }): void {
  const item: ActionLogEntry = {
    id: `act-${Date.now()}-${Math.random().toString(16).slice(2, 10)}`,
    title: p.title,
    description: p.description,
    time: formatLogTime(new Date()),
  };
  entries = [item, ...entries].slice(0, MAX_ENTRIES);
  notify();
}

export function removeActionLogEntry(id: string): void {
  if (!entries.some((e) => e.id === id)) return;
  entries = entries.filter((e) => e.id !== id);
  notify();
}

export function clearActionLog(): void {
  entries = [];
  notify();
}
