import {
  clearActionLog,
  getActionLog,
  removeActionLogEntry,
  subscribeActionLog,
  type ActionLogEntry,
} from "@/lib/notifications/actionActivityLog";
import {
  clearInAppNotificationFeed,
  getInAppNotificationFeed,
  removeInAppNotificationById,
  subscribeInAppNotifications,
} from "@/lib/notifications/inAppNotificationFeed";
import { buildNotificationNavigatePath, inferNotificationDeepLink } from "@/lib/notifications/inferNotificationDeepLink";
import {
  applyPersistedReadToNotifications,
  persistNotificationMarkedRead,
  persistNotificationsMarkedRead,
  removePersistedNotificationRead,
} from "@/lib/notifications/notificationReadPersistence";
import type { NotificationItem, NotificationSection } from "@/lib/notifications/notificationTypes";
export type { NotificationDeepLink, NotificationItem, NotificationSection } from "@/lib/notifications/notificationTypes";
import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

const SECTION_LABEL: Record<NotificationSection, string> = {
  today: "Сегодня",
  yesterday: "Вчера",
};

const SECTION_ORDER: NotificationSection[] = ["today", "yesterday"];

const MOCK_NOTIFICATIONS: NotificationItem[] = [
  {
    id: "1",
    section: "today",
    title: "Скоро запись № b1",
    description: "за 30 мин до 09:00 · Иванов А.С. · Диагностика · BMW M5",
    time: "06 сентября, 08:30",
    unread: true,
    deepLink: { kind: "booking", bookingId: "b1" },
  },
  {
    id: "2",
    section: "today",
    title: "Новая заявка с сайта № 593423",
    description: "Поступила с сайта · Смирнова Н.В. · +7 (999) 000-00-00",
    time: "06 сентября, 11:40",
    unread: true,
    deepLink: { kind: "request", requestId: "593423" },
  },
  {
    id: "3",
    section: "today",
    title: "Назначена заявка № 294894",
    description: "Вам назначена заявка · Иванов Артём Сергеевич",
    time: "06 сентября, 14:05",
    unread: false,
    deepLink: { kind: "request", requestId: "294894" },
  },
  {
    id: "4",
    section: "yesterday",
    title: "Заказ-наряд ожидает оплату № 839022",
    description: 'ООО "Сад" · Lada Priora',
    time: "05 сентября, 15:22",
    unread: true,
    deepLink: { kind: "workOrder", workOrderId: "839022" },
  },
];

type TabId = "all" | "unread" | "read" | "logs";

type NotificationsModalProps = {
  open: boolean;
  onClose: () => void;
  items?: NotificationItem[];
};

function mergeFeedWithStaticItems(staticItems: NotificationItem[]): NotificationItem[] {
  const fromFeed = getInAppNotificationFeed();
  const merged = [...fromFeed, ...staticItems.map((x) => ({ ...x }))];
  const seen = new Set<string>();
  return merged.filter((n) => {
    if (seen.has(n.id)) return false;
    seen.add(n.id);
    return true;
  });
}

function buildNotificationList(staticItems: NotificationItem[]): NotificationItem[] {
  return applyPersistedReadToNotifications(mergeFeedWithStaticItems(staticItems));
}

/** Панель: плавный слайд справа через translate3d (выезд / заезд) */
const NOTIFICATIONS_DRAWER_MS = 480;
const NOTIFICATIONS_BACKDROP_MS = 400;
/** Симметричное ease-in-out — одинаково мягко наезжает и уезжает */
const NOTIFICATIONS_DRAWER_EASE = "cubic-bezier(0.45, 0, 0.55, 1)";
const NOTIFICATIONS_BACKDROP_EASE = "cubic-bezier(0.45, 0, 0.55, 1)";

function FilterSlidersIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path d="M4 6H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M7 12H17" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M10 18H14" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="9" cy="6" r="2" fill="white" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="15" cy="12" r="2" fill="white" stroke="currentColor" strokeWidth="1.8" />
      <circle cx="12" cy="18" r="2" fill="white" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

/** Как крестик очистки у `.journal-header-search` (14px графика в зоне 18px, чёрный stroke 2). */
function NotificationRowDismissIcon() {
  return (
    <svg viewBox="0 0 16 16" fill="none" className="h-[14px] w-[14px] shrink-0 text-inherit" aria-hidden>
      <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function ActionLogRowIcon({ className }: { className?: string }) {
  return (
    <span
      className={`inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#4B5563] text-white ${className ?? ""}`}
    >
      <svg viewBox="0 0 24 24" fill="none" className="h-[20px] w-[20px]" aria-hidden>
        <path
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          stroke="currentColor"
          strokeWidth="1.85"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M9 12h6M9 16h4" stroke="currentColor" strokeWidth="1.85" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function BellInCircleIcon({ className }: { className?: string }) {
  return (
    <span className={`inline-flex shrink-0 items-center justify-center rounded-full bg-[#5451CC] text-white ${className ?? ""}`}>
      <svg viewBox="0 0 24 24" fill="none" className="h-[20px] w-[20px]" aria-hidden>
        <path
          d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
          stroke="currentColor"
          strokeWidth="2.35"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="2.35" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

export function NotificationsModal({ open, onClose, items = MOCK_NOTIFICATIONS }: NotificationsModalProps) {
  const navigate = useNavigate();
  const [list, setList] = useState<NotificationItem[]>(() => buildNotificationList(items));
  const [logList, setLogList] = useState<ActionLogEntry[]>(() => getActionLog());
  const [tab, setTab] = useState<TabId>("all");
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const exitFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const exitingRef = useRef(false);

  useEffect(() => {
    if (open) {
      exitingRef.current = false;
      if (exitFallbackRef.current) {
        clearTimeout(exitFallbackRef.current);
        exitFallbackRef.current = null;
      }
      setMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setActive(true));
      });
      return () => cancelAnimationFrame(id);
    }
    exitingRef.current = true;
    setActive(false);
  }, [open]);

  useEffect(() => {
    if (open) {
      setList(buildNotificationList(items));
      setLogList(getActionLog());
      setTab("all");
    }
  }, [open, items]);

  useEffect(() => {
    return subscribeInAppNotifications(() => {
      setList((prev) => {
        const fromFeed = getInAppNotificationFeed();
        const prevIds = new Set(prev.map((p) => p.id));
        const fresh = fromFeed.filter((f) => !prevIds.has(f.id));
        if (fresh.length === 0) return prev;
        return applyPersistedReadToNotifications([...fresh, ...prev]);
      });
    });
  }, []);

  useEffect(() => {
    return subscribeActionLog(() => {
      setLogList(getActionLog());
    });
  }, []);

  useEffect(() => {
    if (!open || !mounted) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, mounted, onClose]);

  function finishExit() {
    setMounted(false);
    if (exitFallbackRef.current) {
      clearTimeout(exitFallbackRef.current);
      exitFallbackRef.current = null;
    }
  }

  function handleDrawerTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    if (e.target !== e.currentTarget) return;
    if (exitingRef.current) {
      exitingRef.current = false;
      finishExit();
    }
  }

  useEffect(() => {
    if (!open && mounted) {
      exitFallbackRef.current = setTimeout(finishExit, NOTIFICATIONS_DRAWER_MS + 220);
      return () => {
        if (exitFallbackRef.current) {
          clearTimeout(exitFallbackRef.current);
          exitFallbackRef.current = null;
        }
      };
    }
  }, [open, mounted]);

  const unreadCount = useMemo(() => list.filter((n) => n.unread).length, [list]);

  const filtered = useMemo(() => {
    if (tab === "logs") return [];
    if (tab === "unread") return list.filter((n) => n.unread);
    if (tab === "read") return list.filter((n) => !n.unread);
    return list;
  }, [list, tab]);

  const grouped = useMemo(() => {
    const map = new Map<NotificationSection, NotificationItem[]>();
    for (const s of SECTION_ORDER) map.set(s, []);
    for (const n of filtered) {
      const arr = map.get(n.section);
      if (arr) arr.push(n);
    }
    return map;
  }, [filtered]);

  function removeNotification(id: string) {
    removeInAppNotificationById(id);
    removePersistedNotificationRead(id);
    setList((prev) => prev.filter((n) => n.id !== id));
  }

  function removeLogEntry(id: string) {
    removeActionLogEntry(id);
    setLogList((prev) => prev.filter((e) => e.id !== id));
  }

  function handleNotificationRowClick(id: string) {
    setList((prev) =>
      prev.map((n) => {
        if (n.id !== id) return n;
        if (n.showOpenButton) {
          return { ...n, showOpenButton: false };
        }
        if (n.unread) {
          persistNotificationMarkedRead(id);
        }
        return { ...n, unread: false, showOpenButton: true };
      }),
    );
  }

  function handleOpenNotification(n: NotificationItem) {
    const link = inferNotificationDeepLink(n);
    if (!link) return;
    navigate(buildNotificationNavigatePath(link));
    onClose();
  }

  if (!mounted || typeof document === "undefined") return null;

  const backdropClass = `fixed inset-0 z-[280] bg-black/35 transition-[opacity] ${
    active ? "opacity-100" : "opacity-0"
  }`;

  return createPortal(
    <div
      className={backdropClass}
      style={{
        transitionDuration: `${NOTIFICATIONS_BACKDROP_MS}ms`,
        transitionTimingFunction: NOTIFICATIONS_BACKDROP_EASE,
        transitionProperty: "opacity",
      }}
      role="presentation"
      onClick={onClose}
    >
      <div className="ml-auto flex h-full max-h-screen justify-end" onClick={(e) => e.stopPropagation()}>
        <div
          className="relative flex h-full shrink-0"
          style={{
            transform: active ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)",
            transition: `transform ${NOTIFICATIONS_DRAWER_MS}ms ${NOTIFICATIONS_DRAWER_EASE}`,
            willChange: "transform",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
          onTransitionEnd={handleDrawerTransitionEnd}
        >
          <button
            type="button"
            onClick={onClose}
            className="absolute right-full top-8 z-10 mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#E8E8E8] bg-white text-[#111111] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.18)] transition hover:bg-[#F7F7F7]"
            aria-label="Закрыть уведомления"
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>

          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="notifications-modal-title"
            className="flex h-full w-[min(900px,58vw)] min-w-[380px] max-w-[min(1040px,calc(100vw-48px))] flex-col border-l border-[#E6E6E6] bg-white tracking-[-0.04em] shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.2)]"
          >
              <div className="shrink-0 border-b border-[#EFEFEF] px-5 pb-0 pt-5">
                <div className="mb-4 flex items-start justify-between gap-3">
                  <h2 id="notifications-modal-title" className="text-[22px] font-bold leading-tight text-[#111111]">
                    Уведомления
                  </h2>
                  {tab !== "logs" ? (
                    <button
                      type="button"
                      className="shrink-0 text-[14px] font-semibold text-[#5451CC] transition hover:underline"
                      onClick={() =>
                        setList((prev) => {
                          const ids = prev.filter((n) => n.unread).map((n) => n.id);
                          persistNotificationsMarkedRead(ids);
                          return prev.map((n) => ({ ...n, unread: false }));
                        })
                      }
                    >
                      Прочитать все
                    </button>
                  ) : (
                    <span className="shrink-0 text-[14px] font-medium text-[#B4B4B6]">История действий в системе</span>
                  )}
                </div>

                <div className="flex items-center gap-1 border-b border-transparent">
                  {(
                    [
                      { id: "all" as const, label: "Все" },
                      { id: "unread" as const, label: `Непрочитанные ${unreadCount}` },
                      { id: "read" as const, label: "Прочитанные" },
                      { id: "logs" as const, label: "Логи действий" },
                    ] as const
                  ).map(({ id, label }) => (
                    <button
                      key={id}
                      type="button"
                      onClick={() => setTab(id)}
                      className={`relative -mb-px px-3 pb-3 text-[14px] font-semibold transition ${
                        tab === id ? "text-[#111111]" : "text-[#8A8A8A] hover:text-[#444]"
                      }`}
                    >
                      {label}
                      {tab === id ? (
                        <span className="absolute bottom-0 left-2 right-2 h-[3px] rounded-full bg-[#EC1C24]" aria-hidden />
                      ) : null}
                    </button>
                  ))}
                  <div className="ml-auto flex pb-2">
                    <button
                      type="button"
                      className="flex h-9 w-9 items-center justify-center rounded-lg text-[#8A8A8A] transition hover:bg-[#F5F5F5] hover:text-[#444444]"
                      aria-label="Фильтр уведомлений"
                      title="Фильтр"
                    >
                      <FilterSlidersIcon className="h-[22px] w-[22px]" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 py-4 [scrollbar-gutter:stable]">
                {tab === "logs" ? (
                  logList.length === 0 ? (
                    <p className="py-12 text-center text-[14px] font-medium text-[#9CA3AF]">Пока нет записей в логе</p>
                  ) : (
                    <ul className="space-y-3">
                      {logList.map((entry) => (
                        <li
                          key={entry.id}
                          className="relative rounded-xl bg-[#F3F3F5] px-3 pb-9 pt-3 pr-10 transition-colors duration-200 hover:bg-[#EBEBED]"
                        >
                          <div className="flex gap-3">
                            <div className="flex w-2 shrink-0 flex-col items-center pt-1.5">
                              <span className="h-2 w-2 rounded-full bg-[#9CA3AF]" aria-hidden />
                            </div>
                            <ActionLogRowIcon className="shrink-0" />
                            <div className="min-w-0 flex-1">
                              <p className="text-[15px] font-bold leading-snug text-[#111111]">{entry.title}</p>
                              <p className="mt-1 text-[13px] font-medium leading-relaxed text-[#6B7280]">{entry.description}</p>
                            </div>
                          </div>
                          <time className="pointer-events-none absolute bottom-3 right-3 max-w-[calc(100%-2.5rem)] text-right text-[12px] font-medium leading-snug text-[#9CA3AF]">
                            {entry.time}
                          </time>
                          <button
                            type="button"
                            className="absolute right-2 top-2 flex h-[18px] w-[18px] items-center justify-center rounded-sm text-[#111111] transition hover:bg-black/[0.06]"
                            aria-label="Удалить запись лога"
                            onClick={(e) => {
                              e.stopPropagation();
                              removeLogEntry(entry.id);
                            }}
                          >
                            <NotificationRowDismissIcon />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                ) : (
                  <>
                    {SECTION_ORDER.map((section) => {
                      const rows = grouped.get(section) ?? [];
                      if (rows.length === 0) return null;
                      return (
                        <div key={section} className="mb-6 last:mb-0">
                          <p className="mb-3 text-[13px] font-semibold uppercase text-[#9CA3AF]">
                            {SECTION_LABEL[section]}
                          </p>
                          <ul className="space-y-3">
                            {rows.map((n) => (
                              <li
                                key={n.id}
                                onClick={() => handleNotificationRowClick(n.id)}
                                className={`relative cursor-pointer rounded-xl px-3 pt-3 pr-10 transition-[padding-bottom,background-color,color] duration-360 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                  n.unread
                                    ? "bg-[#F3F3F5] hover:bg-[#EBEBED]"
                                    : "bg-[#F6F7F9] hover:bg-[#ECEEF2]"
                                } ${n.showOpenButton ? "pb-[4.5rem]" : "pb-9"}`}
                              >
                                <div className="flex gap-3">
                                  <div className="flex w-2 shrink-0 flex-col items-center pt-1.5">
                                    {n.unread ? (
                                      <span className="h-2 w-2 rounded-full bg-[#2E78C9]" aria-hidden />
                                    ) : (
                                      <span className="h-2 w-2 rounded-full bg-[#D1D5DB]" aria-hidden />
                                    )}
                                  </div>
                                  <BellInCircleIcon
                                    className={`h-10 w-10 shrink-0 ${n.unread ? "" : "opacity-55 saturate-[0.85]"}`}
                                  />
                                  <div className="min-w-0 flex-1">
                                    <p
                                      className={`text-[15px] leading-snug ${
                                        n.unread ? "font-bold text-[#111111]" : "font-semibold text-[#6D7485]"
                                      }`}
                                    >
                                      {n.title}
                                    </p>
                                    <p
                                      className={`mt-1 text-[13px] font-medium leading-relaxed ${
                                        n.unread ? "text-[#6B7280]" : "text-[#9AA3B2]"
                                      }`}
                                    >
                                      {n.description}
                                    </p>
                                    <div
                                      className={`overflow-hidden transition-[max-height,opacity,margin-top,transform] duration-360 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                                        n.showOpenButton
                                          ? "pointer-events-auto max-h-[88px] translate-y-0 opacity-100 [margin-top:0.75rem]"
                                          : "pointer-events-none max-h-0 -translate-y-1 opacity-0 [margin-top:0]"
                                      }`}
                                    >
                                      <button
                                        type="button"
                                        disabled={!inferNotificationDeepLink(n)}
                                        className="rounded-lg bg-[#EC1C24] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#d41920] disabled:cursor-not-allowed disabled:opacity-40"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleOpenNotification(n);
                                        }}
                                      >
                                        Открыть
                                      </button>
                                    </div>
                                  </div>
                                </div>
                                <time
                                  className={`pointer-events-none absolute bottom-3 right-3 max-w-[calc(100%-2.5rem)] text-right text-[12px] font-medium leading-snug ${
                                    n.unread ? "text-[#9CA3AF]" : "text-[#B8C0CC]"
                                  }`}
                                >
                                  {n.time}
                                </time>
                                <button
                                  type="button"
                                  className={`absolute right-2 top-2 flex h-[18px] w-[18px] items-center justify-center rounded-sm transition hover:bg-black/[0.06] ${
                                    n.unread ? "text-black" : "text-[#A8B0BC]"
                                  }`}
                                  aria-label="Удалить уведомление"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    removeNotification(n.id);
                                  }}
                                >
                                  <NotificationRowDismissIcon />
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      );
                    })}

                    {filtered.length === 0 ? (
                      <p className="py-12 text-center text-[14px] font-medium text-[#9CA3AF]">Нет уведомлений</p>
                    ) : null}
                  </>
                )}
              </div>

              <div className="shrink-0 border-t border-[#EFEFEF] px-5 py-4">
                <button
                  type="button"
                  className="rounded-lg bg-[#F3F3F5] px-4 py-2.5 text-[14px] font-semibold text-[#4B5563] transition hover:bg-[#EBEBED]"
                  onClick={() => {
                    if (tab === "logs") {
                      clearActionLog();
                      setLogList([]);
                      return;
                    }
                    clearInAppNotificationFeed();
                    setList(buildNotificationList(items));
                  }}
                >
                  {tab === "logs" ? "Очистить логи" : "Очистить все"}
                </button>
              </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
