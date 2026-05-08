import type { NotificationItem } from "@/lib/notifications/notificationTypes";

const listeners = new Set<() => void>();
const IN_APP_NOTIFICATIONS_STORAGE_KEY = "inAppNotificationsFeed";

function sanitizeNotificationItem(raw: unknown): NotificationItem | null {
  if (!raw || typeof raw !== "object") return null;
  const candidate = raw as Partial<NotificationItem>;
  if (
    typeof candidate.id !== "string" ||
    (candidate.section !== "today" && candidate.section !== "yesterday") ||
    typeof candidate.title !== "string" ||
    typeof candidate.description !== "string" ||
    typeof candidate.time !== "string" ||
    typeof candidate.unread !== "boolean"
  ) {
    return null;
  }
  return {
    id: candidate.id,
    section: candidate.section,
    title: candidate.title,
    description: candidate.description,
    time: candidate.time,
    unread: candidate.unread,
    showOpenButton: Boolean(candidate.showOpenButton),
    deepLink: candidate.deepLink,
  };
}

function loadPersistedFeed(): NotificationItem[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(IN_APP_NOTIFICATIONS_STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.map((item) => sanitizeNotificationItem(item)).filter((item): item is NotificationItem => item !== null);
  } catch {
    return [];
  }
}

function persistFeed(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(IN_APP_NOTIFICATIONS_STORAGE_KEY, JSON.stringify(feed));
  } catch {
    // Ignore persistence failures to avoid breaking UI notifications.
  }
}

let feed: NotificationItem[] = loadPersistedFeed();

function notify() {
  listeners.forEach((cb) => cb());
}

export function subscribeInAppNotifications(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function getInAppNotificationFeed(): NotificationItem[] {
  return feed.map((x) => ({ ...x }));
}

function formatFeedTime(d: Date): string {
  return d.toLocaleString("ru-RU", {
    day: "numeric",
    month: "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Напоминание за 30 мин до начала записи в журнале. */
export function appendJournalBookingSoonToFeed(p: {
  bookingId: string;
  startHHmm: string;
  clientTitle: string;
  service: string;
  car: string;
}): void {
  const title = "Скоро запись";
  const description = `за 30 мин до ${p.startHHmm} · ${p.clientTitle} · ${p.service} · ${p.car}`;
  const item: NotificationItem = {
    id: `inapp-soon-${p.bookingId}-${p.startHHmm.replace(":", "")}-${Date.now()}`,
    section: "today",
    title,
    description,
    time: formatFeedTime(new Date()),
    unread: true,
    deepLink: { kind: "booking", bookingId: p.bookingId },
  };
  feed = [item, ...feed];
  persistFeed();
  notify();
}

/** Только заявки, реально поступившие с сайта (источник «Сайт»). */
export function appendNewRequestFromSiteToFeed(p: { requestId: string; client: string; phone: string }): void {
  const item: NotificationItem = {
    id: `inapp-new-site-req-${p.requestId}-${Date.now()}`,
    section: "today",
    title: `Новая заявка с сайта № ${p.requestId}`,
    description: `Поступила с сайта · ${p.client} · ${p.phone}`,
    time: formatFeedTime(new Date()),
    unread: true,
    deepLink: { kind: "request", requestId: p.requestId },
  };
  feed = [item, ...feed];
  persistFeed();
  notify();
}

/** Назначение руководителем (не «Взять в работу» самостоятельно). */
export function appendRequestAssignedByLeadToFeed(p: { requestId: string; client: string }): void {
  const item: NotificationItem = {
    id: `inapp-assign-lead-${p.requestId}-${Date.now()}`,
    section: "today",
    title: `Назначена заявка № ${p.requestId}`,
    description: `Вам назначена заявка · ${p.client}`,
    time: formatFeedTime(new Date()),
    unread: true,
    deepLink: { kind: "request", requestId: p.requestId },
  };
  feed = [item, ...feed];
  persistFeed();
  notify();
}

export function appendWorkOrderAwaitingPaymentToFeed(p: { workOrderId: string; fullName: string; car: string }): void {
  const item: NotificationItem = {
    id: `inapp-wo-pay-${p.workOrderId}-${Date.now()}`,
    section: "today",
    title: `Заказ-наряд ожидает оплату № ${p.workOrderId}`,
    description: `${p.fullName} · ${p.car}`,
    time: formatFeedTime(new Date()),
    unread: true,
    deepLink: { kind: "workOrder", workOrderId: p.workOrderId },
  };
  feed = [item, ...feed];
  persistFeed();
  notify();
}

export function removeInAppNotificationById(id: string): void {
  if (!feed.some((x) => x.id === id)) return;
  feed = feed.filter((x) => x.id !== id);
  persistFeed();
  notify();
}

export function clearInAppNotificationFeed(): void {
  feed = [];
  persistFeed();
  notify();
}
