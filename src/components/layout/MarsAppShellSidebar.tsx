import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import { NotificationsModal } from "@/components/layout/NotificationsModal";
import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import { useEmployeeRole } from "@/lib/auth/AuthRoleContext";
import { primaryDashboardPath } from "@/lib/auth/employeeRole";
import { useEffect, useState, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate } from "react-router-dom";

/** Родитель — кнопка `h-11 w-11 overflow-visible`; линии при раскрытии не режутся скруглением кнопки. */
function BurgerGlyph({ open, className, style }: { open: boolean; className?: string; style?: CSSProperties }) {
  return (
    <span
      className={`relative flex h-[22px] w-[26px] flex-col justify-center overflow-visible ${className ?? ""}`}
      style={style}
      aria-hidden
    >
      <span
        className={`block h-0.5 w-full shrink-0 rounded-full bg-current transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? "translate-y-[6.5px] rotate-45" : ""
        }`}
      />
      <span
        className={`my-[5px] block h-0.5 w-full shrink-0 rounded-full bg-current transition-opacity duration-200 ${open ? "opacity-0" : "opacity-100"}`}
      />
      <span
        className={`block h-0.5 w-full shrink-0 rounded-full bg-current transition-transform duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] ${
          open ? "-translate-y-[6.5px] -rotate-45" : ""
        }`}
      />
    </span>
  );
}

function DrawerBellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const burgerIconBtnClass =
  "inline-flex h-11 w-11 shrink-0 items-center justify-center overflow-visible rounded-[12px] text-white outline-none ring-white/40 transition-colors hover:bg-white/10 focus-visible:ring-2";

export type MarsAppShellSidebarMobileLayout = "default" | "requests";

export type MarsAppShellSidebarProps = {
  /** default: бургер &lt; lg. requests: бургер &lt; md, планшет md–lg — горизонтальная полоса сверху, десктоп lg+ — вертикальный рейл. */
  mobileLayout?: MarsAppShellSidebarMobileLayout;
};

type NavKey = "requests" | "journal" | "workOrders" | "clients" | "dashboard" | "documents" | "settings" | "profile";

function activeNavKey(pathname: string): NavKey | null {
  if (pathname === "/" || pathname.startsWith("/requests")) return "requests";
  if (pathname.startsWith("/journal")) return "journal";
  if (pathname.startsWith("/work-orders")) return "workOrders";
  if (pathname.startsWith("/clients")) return "clients";
  if (pathname.startsWith("/dashboard-owner")) return "dashboard";
  if (pathname === "/dashboard" || pathname.startsWith("/dashboard/")) return "dashboard";
  if (pathname.startsWith("/documents")) return "documents";
  if (pathname.startsWith("/settings")) return "settings";
  if (pathname.startsWith("/profile")) return "profile";
  return null;
}

function iconTileClass(active: boolean): string {
  if (active) {
    return "bg-white text-[#11131D] transition hover:bg-[#EBEBEE] hover:text-[#11131D]";
  }
  /** Как кнопка «Уведомления» в `NavRailNotifications` (rail). */
  return "text-[#8C93A5] transition hover:bg-white/10 hover:text-[#B8C0D0]";
}

/** Чип иконки в пункте drawer: hover по всей строке (`group` на `<button>`). */
function drawerIconChipClass(active: boolean): string {
  const base = "grid h-11 w-11 shrink-0 place-items-center rounded-[10px] transition";
  if (active) {
    return `${base} bg-white text-[#11131D] group-hover:bg-[#EBEBEE] group-hover:text-[#11131D]`;
  }
  return `${base} text-[#8C93A5] group-hover:bg-white/10 group-hover:text-[#B8C0D0]`;
}

/**
 * Чёрный рейл Марс: на десктопе колонка иконок, на мобиле — бургер + выезжающая панель (порог задаётся `mobileLayout`).
 */
export function MarsAppShellSidebar({ mobileLayout = "default" }: MarsAppShellSidebarProps) {
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const { access, role } = useEmployeeRole();
  const dashboardPath = primaryDashboardPath(role, access);
  const showDashboardNav = Boolean(dashboardPath);
  const showDocumentsNav = access.documents;
  const showSettingsNav = access.settings;
  const showRequestsNav = access.requests;
  const showJournalNav = access.journal;
  const showWorkOrdersNav = access.workOrders;
  const showClientsNav = access.clients;
  const showProfileNav = access.profile;
  const isHead = role === "head";
  const useHeadNavLayout = isHead || role === "administrator";
  /** В сайдбаре у руководителя первая иконка — дашборд руководителя. */
  const headOwnerDashboardPath = "/dashboard-owner";
  const showHeadOwnerDash = isHead && access.dashboardOwner;
  const active = activeNavKey(pathname);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const narrowMobile = mobileLayout === "requests";
  const drawerBp = narrowMobile ? "md:hidden" : "lg:hidden";
  /** Вертикальный рейл только от lg; на планшете (md–lg) для requests — горизонтальная полоса выше. */
  const railBp = "hidden lg:flex";
  const tabletHorizontalBp = "hidden md:flex lg:hidden";
  const mobileBarBp = narrowMobile ? "flex md:hidden" : "flex lg:hidden";

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen || typeof document === "undefined") return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setMobileOpen(false);
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [mobileOpen]);

  const go = (to: string) => {
    navigate(to);
    setMobileOpen(false);
  };

  const drawer =
    typeof document !== "undefined"
      ? createPortal(
          <>
            <button
              type="button"
              aria-label={mobileOpen ? "Закрыть меню" : ""}
              className={`fixed inset-0 z-[280] bg-black/55 backdrop-blur-[2px] transition-opacity duration-300 ease-out ${drawerBp} ${
                mobileOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0"
              }`}
              onClick={() => setMobileOpen(false)}
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-label="Меню разделов"
              className={`fixed inset-y-0 right-0 z-[290] flex w-[min(300px,calc(100vw-40px))] max-w-full flex-col rounded-l-[16px] border-l border-white/10 bg-[#0a0c10] transition-[transform,box-shadow] duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] will-change-transform ${drawerBp} ${
                mobileOpen
                  ? "translate-x-0 shadow-[-12px_0_40px_-12px_rgba(0,0,0,0.85)]"
                  : "translate-x-full shadow-none"
              }`}
            >
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
                <span className="text-[17px] font-semibold tracking-[-0.04em] text-white">Марс</span>
                <button
                  type="button"
                  aria-label="Закрыть меню"
                  className={`${burgerIconBtnClass} hover:bg-white/10`}
                  onClick={() => setMobileOpen(false)}
                >
                  <BurgerGlyph open />
                </button>
              </div>

              <nav className="min-h-0 flex-1 overflow-y-auto px-3 py-4">
                <ul className="flex flex-col gap-1">
                  {useHeadNavLayout ? (
                    <>
                      {showHeadOwnerDash ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => go(headOwnerDashboardPath)}
                            className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                              active === "dashboard" ? "bg-white/15" : ""
                            }`}
                          >
                            <span
                              className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "dashboard")}`}
                            >
                              <MarsShellSidebarIcon type="grid" />
                            </span>
                            Дашборд руководителя
                          </button>
                        </li>
                      ) : null}
                      <li>
                        <button
                          type="button"
                          onClick={() => go("/")}
                          className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                            active === "requests" ? "bg-white/15" : ""
                          }`}
                        >
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "requests")}`}>
                            <MarsShellSidebarIcon type="cube" />
                          </span>
                          Заявки
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => go("/journal")}
                          className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                            active === "journal" ? "bg-white/15" : ""
                          }`}
                        >
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "journal")}`}>
                            <MarsShellSidebarIcon type="layers" />
                          </span>
                          Журнал записей
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => go("/work-orders")}
                          className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                            active === "workOrders" ? "bg-white/15" : ""
                          }`}
                        >
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "workOrders")}`}>
                            <MarsShellSidebarIcon type="chat" />
                          </span>
                          Заказ-наряды
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => go("/clients")}
                          className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                            active === "clients" ? "bg-white/15" : ""
                          }`}
                        >
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "clients")}`}>
                            <MarsShellSidebarIcon type="pie" />
                          </span>
                          Клиенты
                        </button>
                      </li>
                      {showDocumentsNav ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => go("/documents")}
                            className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                              active === "documents" ? "bg-white/15" : ""
                            }`}
                          >
                            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "documents")}`}>
                              <MarsShellSidebarIcon type="doc" />
                            </span>
                            Документы
                          </button>
                        </li>
                      ) : null}
                      {showSettingsNav ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => go("/settings")}
                            className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                              active === "settings" ? "bg-white/15" : ""
                            }`}
                          >
                            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "settings")}`}>
                              <MarsShellSidebarIcon type="settings" />
                            </span>
                            Настройки
                          </button>
                        </li>
                      ) : null}
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileOpen(false);
                            setNotificationsOpen(true);
                          }}
                          className="group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10"
                        >
                          <span className={drawerIconChipClass(false)}>
                            <DrawerBellIcon className="h-[28px] w-[28px]" />
                          </span>
                          <span className="text-[15px] font-medium tracking-[-0.04em] text-white">Уведомления</span>
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          onClick={() => go("/profile")}
                          className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                            active === "profile" ? "bg-white/15" : ""
                          }`}
                        >
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "profile")}`}>
                            <MarsShellSidebarIcon type="user" />
                          </span>
                          Профиль
                        </button>
                      </li>
                    </>
                  ) : (
                    <>
                      {showRequestsNav ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => go("/")}
                          className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                            active === "requests" ? "bg-white/15" : ""
                          }`}
                        >
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "requests")}`}>
                            <MarsShellSidebarIcon type="cube" />
                          </span>
                          Заявки
                        </button>
                      </li>
                      ) : null}
                      {showJournalNav ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => go("/journal")}
                          className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                            active === "journal" ? "bg-white/15" : ""
                          }`}
                        >
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "journal")}`}>
                            <MarsShellSidebarIcon type="layers" />
                          </span>
                          Журнал записей
                        </button>
                      </li>
                      ) : null}
                      {showWorkOrdersNav ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => go("/work-orders")}
                          className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                            active === "workOrders" ? "bg-white/15" : ""
                          }`}
                        >
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "workOrders")}`}>
                            <MarsShellSidebarIcon type="chat" />
                          </span>
                          Заказ-наряды
                        </button>
                      </li>
                      ) : null}
                      {showClientsNav ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => go("/clients")}
                          className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                            active === "clients" ? "bg-white/15" : ""
                          }`}
                        >
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "clients")}`}>
                            <MarsShellSidebarIcon type="pie" />
                          </span>
                          Клиенты
                        </button>
                      </li>
                      ) : null}
                      {showDashboardNav && dashboardPath ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => go(dashboardPath)}
                            className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                              active === "dashboard" ? "bg-white/15" : ""
                            }`}
                          >
                            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "dashboard")}`}>
                              <MarsShellSidebarIcon type="grid" />
                            </span>
                            Дашборд
                          </button>
                        </li>
                      ) : null}
                      {showDocumentsNav ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => go("/documents")}
                            className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                              active === "documents" ? "bg-white/15" : ""
                            }`}
                          >
                            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "documents")}`}>
                              <MarsShellSidebarIcon type="doc" />
                            </span>
                            Документы
                          </button>
                        </li>
                      ) : null}
                      <li>
                        <button
                          type="button"
                          onClick={() => {
                            setMobileOpen(false);
                            setNotificationsOpen(true);
                          }}
                          className="group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10"
                        >
                          <span className={drawerIconChipClass(false)}>
                            <DrawerBellIcon className="h-[28px] w-[28px]" />
                          </span>
                          <span className="text-[15px] font-medium tracking-[-0.04em] text-white">Уведомления</span>
                        </button>
                      </li>
                      {showSettingsNav ? (
                        <li>
                          <button
                            type="button"
                            onClick={() => go("/settings")}
                            className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                              active === "settings" ? "bg-white/15" : ""
                            }`}
                          >
                            <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "settings")}`}>
                              <MarsShellSidebarIcon type="settings" />
                            </span>
                            Настройки
                          </button>
                        </li>
                      ) : null}
                      {showProfileNav ? (
                      <li>
                        <button
                          type="button"
                          onClick={() => go("/profile")}
                          className={`group flex w-full items-center gap-3 rounded-[12px] px-3 py-3 text-left text-[15px] font-medium tracking-[-0.04em] text-white hover:bg-white/10 ${
                            active === "profile" ? "bg-white/15" : ""
                          }`}
                        >
                          <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-[10px] ${drawerIconChipClass(active === "profile")}`}>
                            <MarsShellSidebarIcon type="user" />
                          </span>
                          Профиль
                        </button>
                      </li>
                      ) : null}
                    </>
                  )}
                </ul>
              </nav>
            </div>
          </>,
          document.body,
        )
      : null;

  const mobileBarOuterClass = narrowMobile ? "rounded-[11px] bg-black px-2 py-2.5" : "rounded-[11px] bg-black px-3 py-2.5";

  return (
    <>
      <div
        className={`${mobileBarOuterClass} mb-2 w-full shrink-0 items-center ${narrowMobile ? "justify-between" : ""} ${mobileBarBp}`}
      >
        {narrowMobile ? (
          <>
            <button
              type="button"
              className="grid min-h-[44px] min-w-[72px] shrink-0 place-items-center rounded-[16px] bg-[#EC1C24] px-3 text-[17px] font-semibold tracking-[-0.04em] text-white"
              aria-label="Марс"
            >
              Марс
            </button>
            <button
              type="button"
              className={`${burgerIconBtnClass} ${mobileOpen ? "bg-white/15" : ""}`}
              aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((o) => !o)}
            >
              <BurgerGlyph open={mobileOpen} />
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              className={`${burgerIconBtnClass} ${mobileOpen ? "bg-white/15" : ""}`}
              aria-label={mobileOpen ? "Закрыть меню" : "Открыть меню"}
              aria-expanded={mobileOpen}
              onClick={() => setMobileOpen((o) => !o)}
            >
              <BurgerGlyph open={mobileOpen} />
            </button>
            <span className="mr-auto pl-3 text-[16px] font-semibold tracking-[-0.04em] text-white">Марс</span>
          </>
        )}
      </div>

      {narrowMobile ? (
        <nav
          aria-label="Основная навигация"
          className={`${tabletHorizontalBp} mb-2 w-full min-w-0 shrink-0 flex-row items-stretch gap-2 rounded-[11px] bg-black px-2 py-2`}
        >
          <div className="flex min-h-12 min-w-0 flex-1 flex-row items-center gap-1 overflow-x-auto">
            <button
              type="button"
              className="grid h-12 shrink-0 place-items-center rounded-[16px] bg-[#EC1C24] px-3 text-[16px] font-semibold tracking-[-0.04em] text-white"
              aria-label="Марс"
            >
              Марс
            </button>
            {useHeadNavLayout ? (
              <>
                {showHeadOwnerDash ? (
                  <button
                    type="button"
                    onClick={() => navigate(headOwnerDashboardPath)}
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "dashboard")}`}
                    title="Дашборд руководителя"
                    aria-label="Дашборд руководителя"
                  >
                    <MarsShellSidebarIcon type="grid" />
                  </button>
                ) : null}
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "requests")}`}
                  title="Заявки"
                  aria-label="Заявки"
                >
                  <MarsShellSidebarIcon type="cube" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/journal")}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "journal")}`}
                  title="Журнал записей"
                  aria-label="Журнал записей"
                >
                  <MarsShellSidebarIcon type="layers" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/work-orders")}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "workOrders")}`}
                  title="Заказ-наряды"
                  aria-label="Заказ-наряды"
                >
                  <MarsShellSidebarIcon type="chat" />
                </button>
                <button
                  type="button"
                  onClick={() => navigate("/clients")}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "clients")}`}
                  title="Клиенты"
                  aria-label="Клиенты"
                >
                  <MarsShellSidebarIcon type="pie" />
                </button>
                {showDocumentsNav ? (
                  <button
                    type="button"
                    onClick={() => navigate("/documents")}
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "documents")}`}
                    title="Документы"
                    aria-label="Документы"
                  >
                    <MarsShellSidebarIcon type="doc" />
                  </button>
                ) : null}
                {showSettingsNav ? (
                  <button
                    type="button"
                    onClick={() => navigate("/settings")}
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "settings")}`}
                    title="Настройки"
                    aria-label="Настройки"
                  >
                    <MarsShellSidebarIcon type="settings" />
                  </button>
                ) : null}
              </>
            ) : (
              <>
                {showRequestsNav ? (
                <button
                  type="button"
                  onClick={() => navigate("/")}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "requests")}`}
                  title="Заявки"
                  aria-label="Заявки"
                >
                  <MarsShellSidebarIcon type="cube" />
                </button>
                ) : null}
                {showJournalNav ? (
                <button
                  type="button"
                  onClick={() => navigate("/journal")}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "journal")}`}
                  title="Журнал записей"
                  aria-label="Журнал записей"
                >
                  <MarsShellSidebarIcon type="layers" />
                </button>
                ) : null}
                {showWorkOrdersNav ? (
                <button
                  type="button"
                  onClick={() => navigate("/work-orders")}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "workOrders")}`}
                  title="Заказ-наряды"
                  aria-label="Заказ-наряды"
                >
                  <MarsShellSidebarIcon type="chat" />
                </button>
                ) : null}
                {showClientsNav ? (
                <button
                  type="button"
                  onClick={() => navigate("/clients")}
                  className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "clients")}`}
                  title="Клиенты"
                  aria-label="Клиенты"
                >
                  <MarsShellSidebarIcon type="pie" />
                </button>
                ) : null}
                {showDashboardNav && dashboardPath ? (
                  <button
                    type="button"
                    onClick={() => navigate(dashboardPath)}
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "dashboard")}`}
                    title="Дашборд"
                    aria-label="Дашборд"
                  >
                    <MarsShellSidebarIcon type="grid" />
                  </button>
                ) : null}
                {showDocumentsNav ? (
                  <button
                    type="button"
                    onClick={() => navigate("/documents")}
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "documents")}`}
                    title="Документы"
                    aria-label="Документы"
                  >
                    <MarsShellSidebarIcon type="doc" />
                  </button>
                ) : null}
                {showSettingsNav ? (
                  <button
                    type="button"
                    onClick={() => navigate("/settings")}
                    className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "settings")}`}
                    title="Настройки"
                    aria-label="Настройки"
                  >
                    <MarsShellSidebarIcon type="settings" />
                  </button>
                ) : null}
              </>
            )}
          </div>
          <div className="flex shrink-0 flex-row items-center gap-1">
            <NavRailNotifications />
            {showProfileNav ? (
            <button
              type="button"
              onClick={() => navigate("/profile")}
              className={`grid h-12 w-12 shrink-0 place-items-center rounded-[10px] ${iconTileClass(active === "profile")}`}
              title="Профиль"
              aria-label="Профиль"
            >
              <MarsShellSidebarIcon type="user" />
            </button>
            ) : null}
          </div>
        </nav>
      ) : null}

      <aside className={`mr-2 w-[100px] shrink-0 flex-col items-center rounded-[11px] bg-black ${railBp}`}>
        <button type="button" className="mb-2 grid h-[90px] w-full place-items-center rounded-[16px] bg-[#EC1C24] text-[18px] font-semibold text-white">
          Марс
        </button>
        {useHeadNavLayout ? (
          <>
            {showHeadOwnerDash ? (
              <button
                type="button"
                onClick={() => navigate(headOwnerDashboardPath)}
                className={`mb-2 grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "dashboard")}`}
                title="Дашборд руководителя"
                aria-label="Дашборд руководителя"
              >
                <MarsShellSidebarIcon type="grid" />
              </button>
            ) : null}
            <button type="button" onClick={() => navigate("/")} className={`mb-2 grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "requests")}`}>
              <MarsShellSidebarIcon type="cube" />
            </button>
            <button type="button" onClick={() => navigate("/journal")} className={`mb-2 grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "journal")}`}>
              <MarsShellSidebarIcon type="layers" />
            </button>
            <button type="button" onClick={() => navigate("/work-orders")} className={`mb-2 grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "workOrders")}`}>
              <MarsShellSidebarIcon type="chat" />
            </button>
            <button type="button" onClick={() => navigate("/clients")} className={`mb-2 grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "clients")}`}>
              <MarsShellSidebarIcon type="pie" />
            </button>
            {showDocumentsNav ? (
              <button
                type="button"
                onClick={() => navigate("/documents")}
                className={`mb-2 grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "documents")}`}
                title="Документы"
                aria-label="Документы"
              >
                <MarsShellSidebarIcon type="doc" />
              </button>
            ) : null}
            {showSettingsNav ? (
              <button
                type="button"
                onClick={() => navigate("/settings")}
                className={`mb-2 grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "settings")}`}
                title="Настройки"
                aria-label="Настройки"
              >
                <MarsShellSidebarIcon type="settings" />
              </button>
            ) : null}
            <div className="mt-auto flex flex-col gap-2">
              <NavRailNotifications />
              <button type="button" onClick={() => navigate("/profile")} className={`grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "profile")}`}>
                <MarsShellSidebarIcon type="user" />
              </button>
            </div>
          </>
        ) : (
          <>
            {showRequestsNav ? (
            <button type="button" onClick={() => navigate("/")} className={`mb-2 grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "requests")}`}>
              <MarsShellSidebarIcon type="cube" />
            </button>
            ) : null}
            {showJournalNav ? (
            <button type="button" onClick={() => navigate("/journal")} className={`mb-2 grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "journal")}`}>
              <MarsShellSidebarIcon type="layers" />
            </button>
            ) : null}
            {showWorkOrdersNav ? (
            <button type="button" onClick={() => navigate("/work-orders")} className={`mb-2 grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "workOrders")}`}>
              <MarsShellSidebarIcon type="chat" />
            </button>
            ) : null}
            {showClientsNav ? (
            <button type="button" onClick={() => navigate("/clients")} className={`mb-2 grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "clients")}`}>
              <MarsShellSidebarIcon type="pie" />
            </button>
            ) : null}
            <div className="mt-auto flex flex-col gap-2">
              {showDashboardNav && dashboardPath ? (
                <button
                  type="button"
                  onClick={() => navigate(dashboardPath)}
                  className={`grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "dashboard")}`}
                  title="Дашборд"
                  aria-label="Дашборд"
                >
                  <MarsShellSidebarIcon type="grid" />
                </button>
              ) : null}
              {showDocumentsNav ? (
                <button
                  type="button"
                  onClick={() => navigate("/documents")}
                  className={`grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "documents")}`}
                  title="Документы"
                  aria-label="Документы"
                >
                  <MarsShellSidebarIcon type="doc" />
                </button>
              ) : null}
              <NavRailNotifications />
              {showSettingsNav ? (
                <button
                  type="button"
                  onClick={() => navigate("/settings")}
                  className={`grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "settings")}`}
                  title="Настройки"
                  aria-label="Настройки"
                >
                  <MarsShellSidebarIcon type="settings" />
                </button>
              ) : null}
              {showProfileNav ? (
              <button type="button" onClick={() => navigate("/profile")} className={`grid h-12 w-12 place-items-center rounded-[10px] ${iconTileClass(active === "profile")}`}>
                <MarsShellSidebarIcon type="user" />
              </button>
              ) : null}
            </div>
          </>
        )}
      </aside>

      {drawer}
      <NotificationsModal open={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </>
  );
}
