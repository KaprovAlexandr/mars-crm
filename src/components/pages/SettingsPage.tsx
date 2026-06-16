import { AddRoleDrawer } from "@/components/pages/AddRoleDrawer";
import { clampCommentTooltipPos, previewComment } from "@/lib/ui/commentPreview";
import { MarsAppShellSidebar } from "@/components/layout/MarsAppShellSidebar";
import { ProfilePhotoFace } from "@/components/ui/ProfilePhotoFace";
import { blockEmployeeEmail, isEmployeeBlocked } from "@/lib/auth/employeeBlockPersistence";
import { resolveEmployeeEmailByFullName } from "@/lib/auth/employeeRole";
import { useEmployeeRole } from "@/lib/auth/AuthRoleContext";
import { mapEmployeeRoleLabelToRole, setEmployeeRoleOverride } from "@/lib/auth/employeeRoleOverrides";
import { emitArchiveStyleToast } from "@/lib/notifications/inAppArchiveToastBus";
import { loadSettingsEmployeeRows, persistSettingsEmployeeRows, buildEmployeeRowFromPending, upsertEmployeeRow } from "@/lib/settings/settingsEmployeePersistence";
import { loadSettingsRoleRows, persistSettingsRoleRows } from "@/lib/settings/settingsRolePersistence";
import {
  loadPendingEmployees,
  PENDING_EMPLOYEES_UPDATED_EVENT,
  pendingEmployeeToTableRow,
  removePendingEmployeeById,
} from "@/lib/settings/pendingEmployeesPersistence";
import {
  fetchPendingEmployeesFromApi,
  hydrateEmployeeRoleOverridesFromApi,
  persistEmployeeRoleOverrideToApi,
} from "@/lib/settings/pendingEmployeesApi";
import type { RoleAccessPermissions } from "@/lib/settings/roleAccessSections";
import { resolveRoleAccess } from "@/lib/settings/roleAccessSections";
import * as XLSX from "xlsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

type SettingsSectionId = "employees" | "roles";

/** Как на странице «Заявки» (`RequestsListPage`). */
function ClientsStyleCheckboxBox({ checked, dark }: { checked: boolean; dark: boolean }) {
  if (checked) {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-[#d51a21] text-white">
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <path d="M3 8L6.2 11L13 4.5" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return (
    <span
      className={`inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-[2px] ${dark ? "border-[#6B758A]" : "border-[#D8DBDE]"}`}
    />
  );
}

function SortIcon() {
  return (
    <svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] shrink-0 text-current" aria-hidden>
      <path
        d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

const SETTINGS_SECTIONS: { id: SettingsSectionId; label: string }[] = [
  { id: "employees", label: "Сотрудники" },
  { id: "roles", label: "Роли и доступ" },
];

/** Полоса переключения разделов в стиле чипов-фильтров страницы «Заявки» (без выпадающих фильтров). */
function SettingsSectionChipBar({
  active,
  onChange,
  isDarkTheme,
}: {
  active: SettingsSectionId;
  onChange: (id: SettingsSectionId) => void;
  isDarkTheme: boolean;
}) {
  return (
    <div className="inline-flex w-fit max-w-full items-center gap-1 overflow-x-auto rounded-full p-1 [-webkit-overflow-scrolling:touch]">
      {SETTINGS_SECTIONS.map((tab) => {
        const isActive = active === tab.id;
        return (
          <button
            key={tab.id}
            type="button"
            onClick={() => onChange(tab.id)}
            className={`cursor-pointer rounded-full px-4 py-2 text-[14px] font-medium tracking-[-0.02em] transition-colors ${
              isActive
                ? "bg-[#EC1C24] text-white"
                : isDarkTheme
                  ? "bg-[#222B3B] text-[#EDF2FF]"
                  : "bg-[#F8F8FA] text-black"
            }`}
          >
            {tab.label}
          </button>
        );
      })}
    </div>
  );
}

function SettingsFieldCard({
  label,
  value,
  isDarkTheme,
}: {
  label: string;
  value: string;
  isDarkTheme: boolean;
}) {
  return (
    <div
      className={`h-[68px] rounded-[10px] px-4 py-3 transition-colors ${
        isDarkTheme ? "bg-[#1B2331]" : "bg-[#F3F3F5]"
      }`}
    >
      <p className={`text-[11px] tracking-[0.04em] ${isDarkTheme ? "text-[#8B95A8]" : "text-[#A4ABBA]"}`}>{label}</p>
      <p
        className={`mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] ${isDarkTheme ? "text-[#E8EDF8]" : "text-[#3C4352]"}`}
      >
        {value}
      </p>
    </div>
  );
}

type EmployeeStatus = "Активен" | "В отпуске" | "Заблокирован" | "Не в сети" | "Ожидание доступа";

type EmployeeRow = {
  id: string;
  fullName: string;
  photo: string;
  role: string;
  status: EmployeeStatus;
  lastActivity: string;
  email?: string;
  pendingAccess?: boolean;
};

type EmployeeSortKey = "fullName" | "role" | "status" | "lastActivity";
type SortDirection = "asc" | "desc";
type EmployeeModalActionId = "openProfile" | "changeRole" | "block";

type RoleRow = {
  id: string;
  roleName: string;
  description: string;
  usersCount: number;
  createdOrUpdatedAt: string;
  access?: RoleAccessPermissions;
};

type RoleSortKey = "roleName" | "description" | "usersCount" | "createdOrUpdatedAt";

const EMPLOYEE_ROLE_OPTIONS = ["Руководитель", "Администратор", "Менеджер", "Мастер"] as const;
type EmployeeRoleOption = (typeof EMPLOYEE_ROLE_OPTIONS)[number];

const employeeStatusColorMap: Record<EmployeeStatus, string> = {
  Активен: "#00B515",
  "В отпуске": "#F39D00",
  Заблокирован: "#E00919",
  "Не в сети": "#ACACAC",
  "Ожидание доступа": "#F39D00",
};

const employeeRoleColorMap: Record<EmployeeRoleOption, string> = {
  Руководитель: "#7C3AED",
  Администратор: "#2563EB",
  Менеджер: "#F39D00",
  Мастер: "#00B515",
};

const EMPLOYEE_ROWS: EmployeeRow[] = [
  { id: "e1", fullName: "Алексеев Дмитрий Сергеевич", photo: "https://i.pravatar.cc/80?img=12", role: "Менеджер", status: "Активен", lastActivity: "04.05.2026, 14:32" },
  { id: "e2", fullName: "Смирнова Елена Викторовна", photo: "https://i.pravatar.cc/80?img=32", role: "Руководитель", status: "Активен", lastActivity: "04.05.2026, 14:28" },
  { id: "e3", fullName: "Капров Иван Павлович", photo: "https://i.pravatar.cc/80?img=15", role: "Менеджер", status: "В отпуске", lastActivity: "01.05.2026, 18:10" },
  { id: "e4", fullName: "Журавлёв Михаил Дмитриевич", photo: "https://i.pravatar.cc/80?img=41", role: "Мастер", status: "Активен", lastActivity: "04.05.2026, 13:55" },
  { id: "e5", fullName: "Романова Лилия Андреевна", photo: "https://i.pravatar.cc/80?img=5", role: "Менеджер", status: "Не в сети", lastActivity: "03.05.2026, 19:40" },
  { id: "e6", fullName: "Тимофеев Артём Олегович", photo: "https://i.pravatar.cc/80?img=47", role: "Мастер", status: "Активен", lastActivity: "04.05.2026, 12:08" },
  { id: "e7", fullName: "Орлова Анна Вячеславовна", photo: "https://i.pravatar.cc/80?img=34", role: "Администратор", status: "Активен", lastActivity: "04.05.2026, 11:22" },
  { id: "e8", fullName: "Фролов Алексей Игоревич", photo: "https://i.pravatar.cc/80?img=53", role: "Администратор", status: "Заблокирован", lastActivity: "28.04.2026, 09:15" },
  { id: "e9", fullName: "Кузнецов Павел Андреевич", photo: "https://i.pravatar.cc/80?img=52", role: "Менеджер", status: "Активен", lastActivity: "04.05.2026, 10:41" },
  { id: "e10", fullName: "Гусева Мария Петровна", photo: "https://i.pravatar.cc/80?img=25", role: "Мастер", status: "В отпуске", lastActivity: "30.04.2026, 17:00" },
  { id: "e11", fullName: "Власов Денис Сергеевич", photo: "https://i.pravatar.cc/80?img=49", role: "Менеджер", status: "Не в сети", lastActivity: "03.05.2026, 22:11" },
  { id: "e12", fullName: "Захарова Ирина Михайловна", photo: "https://i.pravatar.cc/80?img=58", role: "Руководитель", status: "Активен", lastActivity: "04.05.2026, 15:02" },
  { id: "e13", fullName: "Петрова Ольга Сергеевна", photo: "https://i.pravatar.cc/80?img=21", role: "Менеджер", status: "Активен", lastActivity: "04.05.2026, 10:05" },
  { id: "e14", fullName: "Николаев Сергей Викторович", photo: "https://i.pravatar.cc/80?img=66", role: "Мастер", status: "Активен", lastActivity: "04.05.2026, 09:33" },
  { id: "e15", fullName: "Егорова Татьяна Игоревна", photo: "https://i.pravatar.cc/80?img=28", role: "Администратор", status: "Не в сети", lastActivity: "03.05.2026, 20:14" },
  { id: "e16", fullName: "Соловьёв Кирилл Андреевич", photo: "https://i.pravatar.cc/80?img=38", role: "Менеджер", status: "В отпуске", lastActivity: "02.05.2026, 16:48" },
  { id: "e17", fullName: "Ковалёва Наталья Романовна", photo: "https://i.pravatar.cc/80?img=17", role: "Руководитель", status: "Активен", lastActivity: "04.05.2026, 08:57" },
  { id: "e18", fullName: "Демидов Павел Олегович", photo: "https://i.pravatar.cc/80?img=43", role: "Мастер", status: "Заблокирован", lastActivity: "28.04.2026, 13:20" },
  { id: "e19", fullName: "Мельникова Алина Дмитриевна", photo: "https://i.pravatar.cc/80?img=11", role: "Администратор", status: "Активен", lastActivity: "04.05.2026, 11:47" },
  { id: "e20", fullName: "Орехов Илья Константинович", photo: "https://i.pravatar.cc/80?img=55", role: "Менеджер", status: "Активен", lastActivity: "04.05.2026, 12:31" },
];

const ROLE_ROWS: RoleRow[] = [
  {
    id: "r1",
    roleName: "Руководитель",
    description: "Полный обзор ключевых показателей компании, сотрудников, клиентской базы и финансовой активности без изменения системных настроек.",
    usersCount: 3,
    createdOrUpdatedAt: "19.02.2026, 11:33",
  },
  {
    id: "r2",
    roleName: "Администратор",
    description: "Полный доступ ко всем разделам CRM, включая системные настройки, управление сотрудниками, ролями, заявками, клиентами и заказ-нарядами.",
    usersCount: 2,
    createdOrUpdatedAt: "12.02.2026, 10:12",
  },
  {
    id: "r3",
    roleName: "Менеджер",
    description: "Работа с входящими заявками, клиентской базой, задачами, комментариями и оформлением заказ-нарядов в рамках ежедневных операционных процессов.",
    usersCount: 8,
    createdOrUpdatedAt: "14.02.2026, 16:40",
  },
  {
    id: "r4",
    roleName: "Мастер",
    description: "Доступ к назначенным заказ-нарядам, техническим комментариям, статусам ремонта и информации по выполняемым работам без доступа к административным разделам.",
    usersCount: 7,
    createdOrUpdatedAt: "21.02.2026, 09:18",
  },
];

function EmployeeAvatar({
  fullName,
  photo,
  isDarkTheme,
}: {
  fullName: string;
  photo: string;
  isDarkTheme: boolean;
}) {
  const photoSrc = photo.trim() || null;

  return (
    <ProfilePhotoFace
      photoSrc={photoSrc}
      alt={fullName ? `Фото: ${fullName}` : "Фото профиля"}
      className={`h-[1em] w-[1em] shrink-0 rounded-full object-cover ring-1 ${isDarkTheme ? "ring-white/15" : "ring-black/10"}`}
    />
  );
}

function EmployeeModalIcon({ type, className }: { type: EmployeeModalActionId; className?: string }) {
  const cls = `h-[22px] w-[22px] shrink-0 ${className ?? ""}`;
  if (type === "openProfile") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <circle cx="12" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="2" />
        <path d="M5 20.25C5.5 16.9 8.1 15 12 15C15.9 15 18.5 16.9 19 20.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "changeRole") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <path d="M12 3.5L19 7.2V12.8C19 17 16.1 20.2 12 21.5C7.9 20.2 5 17 5 12.8V7.2L12 3.5Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
        <path d="M9 12L11 14L15 10" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  if (type === "block") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <circle cx="12" cy="8" r="3.5" stroke="currentColor" strokeWidth="2" />
        <path d="M5 20.25C5.5 16.9 8.1 15 12 15C15.9 15 18.5 16.9 19 20.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <path d="M4 12H20" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  return null;
}

function settingsHeaderSubtitle(section: SettingsSectionId, employeeRowsCount: number): string {
  switch (section) {
    case "employees":
      return `${employeeRowsCount} сотрудников`;
    case "roles":
      return "Роли и доступ";
    default:
      return "";
  }
}

/** Блок таблицы сотрудников + нижняя панель — по структуре страницы «Заявки». */
function EmployeesSection({
  isDarkTheme,
  searchQuery,
  rows,
  onEmployeeRoleChange,
  onEmployeeStatusChange,
}: {
  isDarkTheme: boolean;
  searchQuery: string;
  rows: EmployeeRow[];
  onEmployeeRoleChange: (employeeId: string, role: string) => void;
  onEmployeeStatusChange: (employeeId: string, status: EmployeeStatus) => void;
}) {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [employeeActionsModal, setEmployeeActionsModal] = useState<EmployeeRow | null>(null);
  const [rolePickerForId, setRolePickerForId] = useState<string | null>(null);
  const [employeeProfileModal, setEmployeeProfileModal] = useState<EmployeeRow | null>(null);
  const [employeeProfileSnapshot, setEmployeeProfileSnapshot] = useState<EmployeeRow | null>(null);
  const [employeeProfileMounted, setEmployeeProfileMounted] = useState(false);
  const [employeeProfileActive, setEmployeeProfileActive] = useState(false);
  const [employeeProfileTab, setEmployeeProfileTab] = useState<"main" | "kpi" | "orders">("main");
  const [employeeOrdersSection, setEmployeeOrdersSection] = useState<"active" | "recentlyDone" | "delayed">("active");
  const profileExitFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileExitingRef = useRef(false);
  const openProfileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortState, setSortState] = useState<{ key: EmployeeSortKey; direction: SortDirection } | null>(null);
  const pageSize = 12;
  const visibleRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ru-RU");
    if (!normalizedQuery) return rows;
    return rows.filter((row) => row.fullName.toLocaleLowerCase("ru-RU").includes(normalizedQuery));
  }, [rows, searchQuery]);
  const sortedRows = useMemo(() => {
    const parseLastActivity = (value: string): number => {
      const [datePart = "", timePart = ""] = value.split(",");
      const [day = "0", month = "0", year = "0"] = datePart.trim().split(".");
      const [hours = "0", minutes = "0"] = timePart.trim().split(":");
      return new Date(
        Number(year),
        Math.max(Number(month) - 1, 0),
        Number(day),
        Number(hours),
        Number(minutes),
      ).getTime();
    };

    if (!sortState) return visibleRows;

    const rowsCopy = [...visibleRows];
    rowsCopy.sort((a, b) => {
      let compare = 0;
      if (sortState.key === "lastActivity") {
        compare = parseLastActivity(a.lastActivity) - parseLastActivity(b.lastActivity);
      } else if (sortState.key === "status") {
        compare = a.status.localeCompare(b.status, "ru-RU");
      } else if (sortState.key === "role") {
        compare = a.role.localeCompare(b.role, "ru-RU");
      } else {
        compare = a.fullName.localeCompare(b.fullName, "ru-RU");
      }
      return sortState.direction === "asc" ? compare : -compare;
    });
    return rowsCopy;
  }, [visibleRows, sortState]);
  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pageRows = sortedRows.slice(pageStart, pageStart + pageSize);
  const pageFrom = total === 0 ? 0 : pageStart + 1;
  const pageTo = Math.min(pageStart + pageRows.length, total);

  const allPageRowsSelected = pageRows.length > 0 && pageRows.every((r) => selectedRowIds.has(r.id));
  const toggleSort = useCallback((key: EmployeeSortKey) => {
    setSortState((prev) => {
      if (!prev || prev.key !== key) {
        return { key, direction: "asc" };
      }
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }, []);

  const toggleSelectAllOnPage = useCallback(() => {
    setSelectedRowIds((prev) => {
      if (pageRows.every((r) => prev.has(r.id))) {
        const next = new Set(prev);
        for (const r of pageRows) next.delete(r.id);
        return next;
      }
      const next = new Set(prev);
      for (const r of pageRows) next.add(r.id);
      return next;
    });
  }, [pageRows]);

  const toggleRowSelection = useCallback((id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!employeeActionsModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setEmployeeActionsModal(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [employeeActionsModal]);

  useEffect(() => {
    if (!rolePickerForId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setRolePickerForId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [rolePickerForId]);

  useEffect(() => {
    if (rolePickerForId && !rows.some((r) => r.id === rolePickerForId)) setRolePickerForId(null);
  }, [rows, rolePickerForId]);

  const rolePickerRow = rolePickerForId ? rows.find((r) => r.id === rolePickerForId) ?? null : null;

  function commitEmployeeRole(role: EmployeeRoleOption) {
    if (!rolePickerForId) return;
    onEmployeeRoleChange(rolePickerForId, role);
    setRolePickerForId(null);
  }

  const employeeModalActions: { id: EmployeeModalActionId; label: string; danger?: boolean }[] = [
    { id: "openProfile", label: "Открыть профиль" },
    { id: "changeRole", label: "Изменить роль" },
    { id: "block", label: "Заблокировать", danger: true },
  ];
  const employeeKpiCards = [
    { title: "Выручка сотрудника", value: "185 000 ₽ за месяц", note: "↑ +12 (+10%) за неделю" },
    { title: "Выработка (нормо-часы)", value: "120 ч / 160 ч", note: "↑ +12 (+10%) за неделю" },
    { title: "Загрузка (%)", value: "75%", note: "↑ +12 (+10%) за неделю" },
    { title: "Кол-во заказов", value: "18 заказов", note: "↑ +12 (+10%) за неделю" },
    { title: "Зарплата (расчёт)", value: "42 500 ₽", note: "↑ +12 (+10%) за неделю" },
    { title: "Доп. продажи (очень важно)", value: "+25 000 ₽", note: "↑ +12 (+10%) за неделю" },
  ];
  const employeeActiveOrders = [
    { id: "194653", date: "05.08.2025", car: "Toyota Corolla", service: "Замена масла", status: "В работе", amount: "3 100 ₽" },
    { id: "455823", date: "06.08.2025", car: "Hyundai Solaris", service: "Диагностика подвески", status: "Ожидание", amount: "2 400 ₽" },
    { id: "2345", date: "07.08.2025", car: "LADA Vesta", service: "Промывка топливной системы", status: "В работе", amount: "3 600 ₽" },
    { id: "569321", date: "08.08.2025", car: "Kia Rio", service: "Замена тормозных колодок", status: "В работе", amount: "3 800 ₽" },
    { id: "1137", date: "11.08.2025", car: "Volkswagen Polo", service: "Регулировка угла развала", status: "Ожидание", amount: "1 900 ₽" },
  ];
  function handleEmployeeModalAction(actionId: EmployeeModalActionId) {
    if (!employeeActionsModal) return;
    if (actionId === "openProfile") {
      const targetEmployee = employeeActionsModal;
      setEmployeeActionsModal(null);
      if (openProfileTimerRef.current) {
        clearTimeout(openProfileTimerRef.current);
        openProfileTimerRef.current = null;
      }
      openProfileTimerRef.current = setTimeout(() => {
        setEmployeeProfileSnapshot(targetEmployee);
        setEmployeeProfileModal(targetEmployee);
        setEmployeeProfileTab("main");
        setEmployeeOrdersSection("active");
        openProfileTimerRef.current = null;
      }, 140);
      return;
    }
    if (actionId === "changeRole") {
      const targetId = employeeActionsModal.id;
      setEmployeeActionsModal(null);
      setRolePickerForId(targetId);
      return;
    }
    if (actionId === "block") {
      const targetEmployee = employeeActionsModal;
      onEmployeeStatusChange(targetEmployee.id, "Заблокирован");
      const email = targetEmployee.email ?? resolveEmployeeEmailByFullName(targetEmployee.fullName);
      if (email) blockEmployeeEmail(email);
      emitArchiveStyleToast({
        line1: targetEmployee.fullName,
        line2: "заблокирован",
      });
      setEmployeeActionsModal(null);
      return;
    }
    setEmployeeActionsModal(null);
  }
  useEffect(() => {
    return () => {
      if (openProfileTimerRef.current) {
        clearTimeout(openProfileTimerRef.current);
        openProfileTimerRef.current = null;
      }
    };
  }, []);
  useEffect(() => {
    if (employeeProfileModal) setEmployeeProfileSnapshot(employeeProfileModal);
  }, [employeeProfileModal]);
  useEffect(() => {
    if (employeeProfileModal) {
      profileExitingRef.current = false;
      if (profileExitFallbackRef.current) {
        clearTimeout(profileExitFallbackRef.current);
        profileExitFallbackRef.current = null;
      }
      setEmployeeProfileActive(false);
      setEmployeeProfileMounted(true);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setEmployeeProfileActive(true));
      });
      return () => cancelAnimationFrame(id);
    }
    profileExitingRef.current = true;
    setEmployeeProfileActive(false);
  }, [employeeProfileModal]);
  function finishProfileExit() {
    setEmployeeProfileMounted(false);
    setEmployeeProfileSnapshot(null);
    if (profileExitFallbackRef.current) {
      clearTimeout(profileExitFallbackRef.current);
      profileExitFallbackRef.current = null;
    }
  }
  function handleProfileDrawerTransitionEnd(e: React.TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    if (e.target !== e.currentTarget) return;
    if (profileExitingRef.current) {
      profileExitingRef.current = false;
      finishProfileExit();
    }
  }
  useEffect(() => {
    if (!employeeProfileModal && employeeProfileMounted) {
      profileExitFallbackRef.current = setTimeout(finishProfileExit, 700);
      return () => {
        if (profileExitFallbackRef.current) {
          clearTimeout(profileExitFallbackRef.current);
          profileExitFallbackRef.current = null;
        }
      };
    }
  }, [employeeProfileModal, employeeProfileMounted]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 max-lg:gap-5">
      <div className={`@container min-h-0 flex-1 overflow-hidden rounded-lg max-lg:min-h-[240px] max-lg:flex-none lg:flex-1 ${isDarkTheme ? "bg-[#131925]" : "bg-white"}`}>
        <div className="journal-table-scroll relative min-h-0 min-w-0 flex-1 touch-pan-x touch-pan-y overflow-x-auto overflow-y-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] max-lg:max-h-[min(72vh,680px)] lg:max-h-[min(78vh,800px)] xl:max-h-none @[1280px]:max-h-none @[1280px]:overflow-y-hidden">
          <table className="w-full min-w-[760px] table-fixed border-separate border-spacing-0 text-[16px] font-medium tracking-[-0.015em] @[1280px]:min-w-0 @[1280px]:tracking-[-0.04em]">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[32%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[4%]" />
            </colgroup>
            <thead
              className={`text-left text-[15px] font-medium leading-tight tracking-[-0.015em] whitespace-normal @[1280px]:text-[16px] @[1280px]:tracking-[-0.04em] @[1280px]:whitespace-nowrap ${isDarkTheme ? "bg-[#1B2331] text-[#9AA4BC]" : "bg-[#F3F3F5] text-[#7D7D7D]"}`}
            >
              <tr>
                <th className="rounded-l-[5px] px-4 py-2.5 align-middle font-medium">
                  <span
                    className="inline-flex cursor-pointer select-none items-center"
                    role="checkbox"
                    aria-checked={allPageRowsSelected}
                    aria-label="Выбрать все строки на странице"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectAllOnPage();
                    }}
                  >
                    <ClientsStyleCheckboxBox checked={allPageRowsSelected} dark={isDarkTheme} />
                  </span>
                </th>
                <th className="px-4 py-2.5 align-middle font-medium">
                  <span className="inline-flex items-center gap-2 font-medium">
                    ФИО
                    <button
                      type="button"
                      onClick={() => toggleSort("fullName")}
                      aria-label="Сортировать по ФИО"
                      className="cursor-pointer"
                    >
                      <SortIcon />
                    </button>
                  </span>
                </th>
                <th className="px-4 py-2.5 align-middle font-medium">
                  <span className="inline-flex items-center gap-2 font-medium">
                    Роль
                    <button
                      type="button"
                      onClick={() => toggleSort("role")}
                      aria-label="Сортировать по роли"
                      className="cursor-pointer"
                    >
                      <SortIcon />
                    </button>
                  </span>
                </th>
                <th className="px-4 py-2.5 align-middle font-medium">
                  <span className="inline-flex items-center gap-2 font-medium">
                    Статус
                    <button
                      type="button"
                      onClick={() => toggleSort("status")}
                      aria-label="Сортировать по статусу"
                      className="cursor-pointer"
                    >
                      <SortIcon />
                    </button>
                  </span>
                </th>
                <th className="px-4 py-2.5 align-middle font-medium">
                  <span className="inline-flex items-center gap-2 font-medium">
                    Последняя активность
                    <button
                      type="button"
                      onClick={() => toggleSort("lastActivity")}
                      aria-label="Сортировать по последней активности"
                      className="cursor-pointer"
                    >
                      <SortIcon />
                    </button>
                  </span>
                </th>
                <th className="rounded-r-[5px] px-4 py-2.5 align-middle font-medium text-center">⋮</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => {
                const isSelected = selectedRowIds.has(row.id);
                const borderCls = isDarkTheme ? "border-[#1A2130]" : "border-[#EEEDF0]";
                let bgCls: string;
                if (isSelected) {
                  bgCls = "bg-[#FCE6E8]";
                } else if (isDarkTheme) {
                  bgCls = (pageStart + index) % 2 === 1 ? "bg-[#141C29]" : "bg-[#0F1622]";
                } else {
                  bgCls = (pageStart + index) % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white";
                }
                const hoverCls = isSelected ? "" : "hover:bg-[rgba(224,9,25,0.10)]";
                return (
                  <tr key={row.id} className={`border-[5px] transition ${borderCls} ${bgCls} ${hoverCls}`}>
                    <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                      <span
                        className="inline-flex cursor-pointer select-none items-center"
                        role="checkbox"
                        aria-checked={isSelected}
                        aria-label={`Выбрать сотрудника ${row.fullName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRowSelection(row.id);
                        }}
                      >
                        <ClientsStyleCheckboxBox checked={isSelected} dark={isDarkTheme} />
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>
                      <span className="inline-flex max-w-full items-center gap-1.5">
                        <EmployeeAvatar fullName={row.fullName} photo={row.photo} isDarkTheme={isDarkTheme} />
                        <span className="min-w-0 truncate">{row.fullName}</span>
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>{row.role}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-medium">
                      <span className={`inline-flex items-center gap-2 font-medium ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: employeeStatusColorMap[row.status] }} />
                        <span className={`font-medium ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>{row.status}</span>
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>{row.lastActivity}</td>
                    <td className="px-4 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-expanded={employeeActionsModal?.id === row.id}
                        aria-label={`Меню действий, ${row.fullName}`}
                        className={`cursor-pointer rounded-md px-1.5 py-0.5 text-[16px] font-bold leading-none tracking-[-0.04em] text-[#A0A0A0] transition-colors hover:text-[#EC1C24] ${
                          isDarkTheme ? "hover:bg-white/5" : "hover:bg-black/[0.04]"
                        }`}
                        onClick={() => setEmployeeActionsModal(row)}
                      >
                        ...
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-1 pt-2">
          <div className={`h-1 rounded-full ${isDarkTheme ? "bg-[#242D3F]" : "bg-[#EEEDF0]"}`} />
        </div>
      </div>

      <div className="relative flex flex-col gap-4 max-lg:gap-5 max-lg:pt-1 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:pt-0">
        <button
          type="button"
          className={`rounded-[8px] px-2 py-1 text-center text-[18px] font-bold tracking-[-0.04em] max-lg:w-full lg:w-auto lg:text-left lg:text-[20px] ${isDarkTheme ? "bg-[#1A2232] text-[#EDF2FF]" : "bg-white text-black"}`}
        >
          {selectedRowIds.size} / сотрудников
        </button>
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 max-lg:relative max-lg:left-auto max-lg:top-auto max-lg:z-0 max-lg:translate-x-0 max-lg:translate-y-0 max-lg:pointer-events-auto max-lg:flex max-lg:w-full max-lg:justify-center lg:pointer-events-none lg:absolute lg:left-1/2 lg:top-1/2 lg:flex lg:w-auto lg:-translate-x-1/2 lg:-translate-y-1/2">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Предыдущая страница"
              className={`inline-flex h-[48px] w-[48px] items-center justify-center rounded-full text-[30px] font-bold leading-none tracking-[-0.02em] ${
                safeCurrentPage <= 1
                  ? "cursor-not-allowed opacity-35"
                  : isDarkTheme
                    ? "cursor-pointer hover:bg-white/5"
                    : "cursor-pointer hover:bg-black/[0.04]"
              } ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}
            >
              ‹
            </button>
            <div className="relative flex h-[48px] items-center gap-1 overflow-hidden rounded-full bg-[#11131D] p-1 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.8)]">
              <span
                className="absolute left-1 top-1 z-0 h-[40px] w-[48px] rounded-full bg-[#EC1C24] shadow-[0_6px_14px_-8px_rgba(236,28,36,0.85)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: `translateX(${(safeCurrentPage - 1) * 49}px)` }}
              />
              {Array.from({ length: totalPages }, (_, idx) => {
                const page = idx + 1;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`relative z-10 inline-flex h-[40px] w-[48px] items-center justify-center rounded-full text-[16px] font-bold tracking-[-0.02em] ${
                      page === safeCurrentPage ? "text-white" : "text-white/80 hover:text-white"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Следующая страница"
              className={`inline-flex h-[48px] w-[48px] items-center justify-center rounded-full text-[30px] font-bold leading-none tracking-[-0.02em] ${
                safeCurrentPage >= totalPages
                  ? "cursor-not-allowed opacity-35"
                  : isDarkTheme
                    ? "cursor-pointer hover:bg-white/5"
                    : "cursor-pointer hover:bg-black/[0.04]"
              } ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}
            >
              ›
            </button>
          </div>
        </div>
        <div className={`flex w-full shrink-0 justify-center gap-2 text-center text-[16px] font-bold tracking-[-0.04em] max-lg:order-last lg:w-auto lg:justify-end lg:text-right lg:text-[20px] ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>
          <span>
            {pageFrom} — {pageTo} из {total}
          </span>
        </div>
      </div>

      {employeeActionsModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setEmployeeActionsModal(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="employee-actions-title"
                className={`w-full max-w-[360px] overflow-hidden rounded-[14px] border shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)] ${
                  isDarkTheme ? "border-[#2B3345] bg-[#131925]" : "border-[#E4E5E7] bg-white"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`border-b p-5 ${isDarkTheme ? "border-[#2B3345]" : "border-[#EEEDF0]"}`}>
                  <h2 id="employee-actions-title" className={`text-[18px] font-semibold tracking-[-0.04em] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}>
                    Действия с сотрудником
                  </h2>
                  <p className={`mt-1 truncate text-[14px] font-medium tracking-[-0.04em] ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]"}`}>
                    {employeeActionsModal.fullName}
                  </p>
                </div>
                <ul className="p-0">
                  {employeeModalActions.map(({ id, label, danger }) => {
                    const iconTone = danger ? "text-[#EC1C24]" : isDarkTheme ? "text-[#B8C4DC]" : "text-[#4B5563]";
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                            danger
                              ? "text-[#EC1C24] hover:bg-[#FFF5F5]"
                              : isDarkTheme
                                ? "text-[#E8EDF8] hover:bg-white/[0.06]"
                                : "text-[#111826] hover:bg-[#F3F3F5]"
                          }`}
                          onClick={() => handleEmployeeModalAction(id)}
                        >
                          <EmployeeModalIcon type={id} className={iconTone} />
                          {label}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}

      {rolePickerRow && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[265] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setRolePickerForId(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="role-picker-title"
                className={`w-full max-w-[360px] overflow-hidden rounded-[14px] border shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)] ${
                  isDarkTheme ? "border-[#2B3345] bg-[#131925]" : "border-[#E4E5E7] bg-white"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`border-b p-5 ${isDarkTheme ? "border-[#2B3345]" : "border-[#EEEDF0]"}`}>
                  <h2 id="role-picker-title" className={`text-[18px] font-semibold tracking-[-0.04em] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}>
                    Изменить роль
                  </h2>
                  <p className={`mt-1 truncate text-[14px] font-medium tracking-[-0.04em] ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]"}`}>
                    {rolePickerRow.fullName}
                  </p>
                </div>
                <ul className="p-0">
                  {EMPLOYEE_ROLE_OPTIONS.map((role) => {
                    const isCurrent = rolePickerRow.role === role;
                    return (
                      <li key={role}>
                        <button
                          type="button"
                          onClick={() => commitEmployeeRole(role)}
                          className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                            isCurrent
                              ? isDarkTheme
                                ? "bg-white/[0.08] text-[#F4F7FF]"
                                : "bg-[#F8F8FA] text-[#111826]"
                              : isDarkTheme
                                ? "text-[#E8EDF8] hover:bg-white/[0.06]"
                                : "text-[#111826] hover:bg-[#F3F3F5]"
                          }`}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: employeeRoleColorMap[role] }} />
                          <span className="min-w-0 flex-1">{role}</span>
                          {isCurrent ? (
                            <span className={`shrink-0 text-[13px] font-medium ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]"}`}>Сейчас</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className={`border-t p-5 ${isDarkTheme ? "border-[#2B3345]" : "border-[#EEEDF0]"}`}>
                  <button
                    type="button"
                    onClick={() => setRolePickerForId(null)}
                    className={`w-full cursor-pointer rounded-[10px] p-4 text-center text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                      isDarkTheme ? "bg-[#202838] text-[#D3D9E8] hover:bg-[#2a3145]" : "bg-[#ECECEF] text-[#111111] hover:bg-[#E0E0E4]"
                    }`}
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}

      {employeeProfileMounted && employeeProfileSnapshot && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`fixed inset-0 z-[285] bg-black/35 transition-[opacity] ${employeeProfileActive ? "opacity-100" : "opacity-0"}`}
              style={{ transitionDuration: "400ms", transitionTimingFunction: "cubic-bezier(0.45, 0, 0.55, 1)" }}
              role="presentation"
              onClick={() => setEmployeeProfileModal(null)}
            >
              <div className="ml-auto flex h-full max-h-screen justify-end" onClick={(e) => e.stopPropagation()}>
                <div
                  className="relative flex h-full shrink-0"
                  style={{
                    transform: employeeProfileActive ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)",
                    transition: "transform 480ms cubic-bezier(0.45, 0, 0.55, 1)",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                  onTransitionEnd={handleProfileDrawerTransitionEnd}
                >
                  <button
                    type="button"
                    onClick={() => setEmployeeProfileModal(null)}
                    className="absolute right-full top-8 z-10 mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#E8E8E8] bg-white text-[#111111] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.18)] transition hover:bg-[#F7F7F7]"
                    aria-label="Закрыть профиль сотрудника"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <aside
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="employee-profile-title"
                    className="flex h-full w-[min(900px,58vw)] min-w-[380px] max-w-[min(1040px,calc(100vw-48px))] flex-col border-l border-[#E6E6E6] bg-white tracking-[-0.04em] shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.2)]"
                  >
                    <div className="flex items-center gap-3 border-b border-[#EFEFEF] px-5 py-4">
                      <h2 id="employee-profile-title" className="text-[36px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">
                        Профиль мастера
                      </h2>
                      <button
                        type="button"
                        className="ml-auto h-12 shrink-0 rounded-[10px] border-2 border-transparent bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out hover:border-[#EC1C24] hover:bg-white hover:text-[#EC1C24]"
                      >
                        Назначить заказ-наряд
                      </button>
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto p-5">
                      {employeeProfileTab === "main" ? (
                        <section className="relative min-h-0 rounded-[16px] bg-white">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h1 className="max-w-[420px] text-[52px] font-semibold leading-[0.98] tracking-[-0.03em] text-[#202636]">
                                <span className="block whitespace-nowrap">Капров Александр</span>
                                <span className="block">Николаевич</span>
                              </h1>
                            </div>
                            <img
                              src="https://i.pravatar.cc/160?img=11"
                              alt="Фото профиля"
                              className="h-[72px] w-[72px] rounded-full object-cover"
                            />
                          </div>
                          <div className="mt-[50px]">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                              {[
                                { label: "Дата рождения", value: "14.02.1992" },
                                { label: "Пол", value: "Мужской" },
                                { label: "Гражданство", value: "Российская Федерация" },
                                { label: "Телефон", value: "+7 (911) 123-45-67" },
                                { label: "E-mail", value: "example@post.ru" },
                                { label: "Должность", value: "Менеджер по работе с клиентами" },
                                { label: "График работы", value: "5/2, 09:00 - 18:00" },
                                { label: "Статус", value: "В отпуске" },
                              ].map((field) => (
                                <div key={field.label} className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3">
                                  <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">{field.label}</p>
                                  <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">{field.value}</p>
                                </div>
                              ))}
                            </div>
                          </div>
                          <div className="mt-[50px]">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                              {[
                                { key: "passportSeries", label: "Паспорт (серия)", value: "40 12" },
                                { key: "passportNumber", label: "Паспорт (номер)", value: "345678" },
                                { key: "inn", label: "ИНН", value: "12-28-087306-08" },
                                { key: "snils", label: "СНИЛС", value: "112-233-445 95" },
                              ].map((field) => (
                                <div key={field.key} className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3">
                                  <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">{field.label}</p>
                                  <p className="mt-1 min-w-0 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">
                                    <span className="truncate">{field.value}</span>
                                  </p>
                                </div>
                              ))}
                            </div>
                          </div>
                        </section>
                      ) : employeeProfileTab === "kpi" ? (
                        <section className="min-h-0 rounded-[16px] bg-white">
                          <div className="grid grid-cols-2 gap-3">
                            {employeeKpiCards.map((card) => (
                              <article key={card.title} className="flex h-[128px] flex-col rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                <div>
                                  <p className="text-[16px] font-medium leading-none tracking-[-0.04em] text-[#1D2330]">{card.title}</p>
                                </div>
                                <div className="mt-auto">
                                  <p className="text-[32px] font-medium leading-none tracking-[-0.04em] text-[#E00919]">{card.value}</p>
                                  <p className="mt-1 text-[13px] font-medium tracking-[-0.04em] text-[#6F7785]">{card.note}</p>
                                </div>
                              </article>
                            ))}
                          </div>
                        </section>
                      ) : (
                        <section className="rounded-[16px] bg-white">
                          <div className="inline-flex w-fit items-center gap-1 rounded-full p-1">
                            {[
                              { id: "active" as const, label: "Активные" },
                              { id: "recentlyDone" as const, label: "Недавно завершенные" },
                              { id: "delayed" as const, label: "Просроченные / Задержанные" },
                            ].map((tab) => (
                              <button
                                key={tab.id}
                                type="button"
                                onClick={() => setEmployeeOrdersSection(tab.id)}
                                className={`rounded-full px-4 py-2 text-[14px] font-medium tracking-[-0.02em] text-black ${
                                  employeeOrdersSection === tab.id ? "bg-[#F8F8FA]" : "bg-transparent"
                                }`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>

                          {employeeOrdersSection === "active" ? (
                            <div className="mt-4 overflow-hidden rounded-[12px]">
                              <table className="w-full table-fixed border-separate border-spacing-0 whitespace-nowrap text-[16px] font-medium tracking-[-0.02em]">
                                <colgroup>
                                  <col className="w-[6%]" />
                                  <col className="w-[10%]" />
                                  <col className="w-[12%]" />
                                  <col className="w-[22%]" />
                                  <col className="w-[22%]" />
                                  <col className="w-[14%]" />
                                  <col className="w-[10%]" />
                                  <col className="w-[4%]" />
                                </colgroup>
                                <thead className="text-left text-[16px] font-medium tracking-[-0.04em] bg-[#F3F3F5] text-[#7D7D7D]">
                                  <tr>
                                    <th className="rounded-l-[5px] px-3 py-2.5 font-medium">
                                      <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-[2px] border-[#D8DBDE]" />
                                    </th>
                                    <th className="px-3 py-2.5 font-medium">ID</th>
                                    <th className="px-3 py-2.5 font-medium">Дата</th>
                                    <th className="px-3 py-2.5 font-medium">Автомобиль</th>
                                    <th className="px-3 py-2.5 font-medium">Услуга</th>
                                    <th className="px-3 py-2.5 font-medium">Статус</th>
                                    <th className="px-3 py-2.5 font-medium">Сумма</th>
                                    <th className="rounded-r-[5px] px-3 py-2.5 font-medium text-center">⋮</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  {employeeActiveOrders.map((row, index) => (
                                    <tr key={row.id} className={`transition hover:bg-[rgba(224,9,25,0.10)] ${index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white"}`}>
                                      <td className="px-3 py-2.5">
                                        <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-[2px] border-[#D8DBDE]" />
                                      </td>
                                      <td className="px-3 py-2.5 text-[#E00919]">{row.id}</td>
                                      <td className="px-3 py-2.5 text-black">{row.date}</td>
                                      <td className="truncate px-3 py-2.5 text-black">{row.car}</td>
                                      <td className="truncate px-3 py-2.5 text-black">{row.service}</td>
                                      <td className="px-3 py-2.5">
                                        <span className="inline-flex items-center gap-2 font-medium text-black">
                                          <span className={`h-2.5 w-2.5 rounded-full ${row.status === "В работе" ? "bg-[#00B515]" : "bg-[#F39D00]"}`} />
                                          <span className="font-medium">{row.status}</span>
                                        </span>
                                      </td>
                                      <td className="px-3 py-2.5 text-black">{row.amount}</td>
                                      <td className="px-3 py-2.5 text-center text-[#A0A0A0]">...</td>
                                    </tr>
                                  ))}
                                </tbody>
                              </table>
                            </div>
                          ) : (
                            <div className="mt-4 rounded-[12px] bg-[#F3F3F5] px-4 py-3 text-[15px] font-medium text-[#6F7785]">
                              Раздел в разработке.
                            </div>
                          )}
                        </section>
                      )}
                    </div>
                    <div className="shrink-0 px-5 pb-5">
                      <div className="flex justify-center">
                        <div className="relative inline-grid grid-cols-3 rounded-full bg-[#11131D] p-1 text-[12px] shadow-[0_8px_24px_-14px_rgba(0,0,0,0.8)]">
                          <span
                            className={`absolute left-1 top-1 bottom-1 z-0 w-[136px] rounded-full bg-[#EC1C24] shadow-[0_6px_14px_-8px_rgba(236,28,36,0.85)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                              employeeProfileTab === "main"
                                ? "translate-x-0"
                                : employeeProfileTab === "kpi"
                                  ? "translate-x-[136px]"
                                  : "translate-x-[272px]"
                            }`}
                          />
                          <button
                            type="button"
                            onClick={() => setEmployeeProfileTab("main")}
                            className={`relative z-10 w-[136px] whitespace-nowrap rounded-full px-4 py-2 text-center text-[15px] font-bold tracking-[-0.02em] transition-colors duration-300 ${
                              employeeProfileTab === "main" ? "text-white" : "text-white/80 hover:text-white"
                            }`}
                          >
                            Основное
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmployeeProfileTab("kpi")}
                            className={`relative z-10 w-[136px] whitespace-nowrap rounded-full px-4 py-2 text-center text-[15px] font-bold tracking-[-0.02em] transition-colors duration-300 ${
                              employeeProfileTab === "kpi" ? "text-white" : "text-white/80 hover:text-white"
                            }`}
                          >
                            KPI
                          </button>
                          <button
                            type="button"
                            onClick={() => setEmployeeProfileTab("orders")}
                            className={`relative z-10 w-[136px] whitespace-nowrap rounded-full px-4 py-2 text-center text-[15px] font-bold tracking-[-0.02em] transition-colors duration-300 ${
                              employeeProfileTab === "orders" ? "text-white" : "text-white/80 hover:text-white"
                            }`}
                          >
                            Заказ-наряды
                          </button>
                        </div>
                      </div>
                    </div>
                  </aside>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

const BUILT_IN_ROLE_IDS = new Set(["r1", "r2", "r3", "r4"]);

type RoleModalActionId = "edit" | "delete";

function RoleModalIcon({ type, className }: { type: RoleModalActionId; className?: string }) {
  const cls = `h-[22px] w-[22px] shrink-0 ${className ?? ""}`;
  if (type === "edit") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <path d="M4 20H20M14.5 5.5L18.5 9.5M14.5 5.5L8 12V16H12L18.5 9.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
      <path d="M4 7H20M9 7V5H15V7M7 7L8 19H16L17 7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RolesSection({
  isDarkTheme,
  searchQuery,
  rows,
  onDeleteRole,
  onEditRole,
}: {
  isDarkTheme: boolean;
  searchQuery: string;
  rows: RoleRow[];
  onDeleteRole: (roleId: string) => void;
  onEditRole: (role: RoleRow) => void;
}) {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [roleActionsModal, setRoleActionsModal] = useState<RoleRow | null>(null);
  const [descriptionTooltip, setDescriptionTooltip] = useState<{
    text: string;
    x: number;
    y: number;
    maxWidth: number;
    forRoleId?: string;
    pinned?: boolean;
  } | null>(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortState, setSortState] = useState<{ key: RoleSortKey; direction: SortDirection } | null>(null);
  const pageSize = 12;
  const visibleRows = useMemo(() => {
    const normalizedQuery = searchQuery.trim().toLocaleLowerCase("ru-RU");
    if (!normalizedQuery) return rows;
    return rows.filter((row) => {
      const haystack = `${row.roleName} ${row.description}`.toLocaleLowerCase("ru-RU");
      return haystack.includes(normalizedQuery);
    });
  }, [rows, searchQuery]);
  const sortedRows = useMemo(() => {
    if (!sortState) return visibleRows;
    const parseDateTime = (value: string): number => {
      const [datePart = "", timePart = ""] = value.split(",");
      const [day = "0", month = "0", year = "0"] = datePart.trim().split(".");
      const [hours = "0", minutes = "0"] = timePart.trim().split(":");
      return new Date(
        Number(year),
        Math.max(Number(month) - 1, 0),
        Number(day),
        Number(hours),
        Number(minutes),
      ).getTime();
    };
    const rowsCopy = [...visibleRows];
    rowsCopy.sort((a, b) => {
      let compare = 0;
      if (sortState.key === "usersCount") compare = a.usersCount - b.usersCount;
      else if (sortState.key === "createdOrUpdatedAt") compare = parseDateTime(a.createdOrUpdatedAt) - parseDateTime(b.createdOrUpdatedAt);
      else if (sortState.key === "description") compare = a.description.localeCompare(b.description, "ru-RU");
      else compare = a.roleName.localeCompare(b.roleName, "ru-RU");
      return sortState.direction === "asc" ? compare : -compare;
    });
    return rowsCopy;
  }, [visibleRows, sortState]);

  const total = sortedRows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const pageStart = (safeCurrentPage - 1) * pageSize;
  const pageRows = sortedRows.slice(pageStart, pageStart + pageSize);
  const pageFrom = total === 0 ? 0 : pageStart + 1;
  const pageTo = Math.min(pageStart + pageRows.length, total);
  const allPageRowsSelected = pageRows.length > 0 && pageRows.every((r) => selectedRowIds.has(r.id));

  const toggleSort = useCallback((key: RoleSortKey) => {
    setSortState((prev) => {
      if (!prev || prev.key !== key) return { key, direction: "asc" };
      if (prev.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  }, []);
  const toggleSelectAllOnPage = useCallback(() => {
    setSelectedRowIds((prev) => {
      if (pageRows.every((r) => prev.has(r.id))) {
        const next = new Set(prev);
        for (const r of pageRows) next.delete(r.id);
        return next;
      }
      const next = new Set(prev);
      for (const r of pageRows) next.add(r.id);
      return next;
    });
  }, [pageRows]);
  const toggleRowSelection = useCallback((id: string) => {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  useEffect(() => {
    if (!roleActionsModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setRoleActionsModal(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [roleActionsModal]);

  function handleRoleModalAction(actionId: RoleModalActionId) {
    if (!roleActionsModal) return;
    if (actionId === "edit") {
      onEditRole(roleActionsModal);
      setRoleActionsModal(null);
      return;
    }
    if (actionId === "delete") {
      onDeleteRole(roleActionsModal.id);
      setSelectedRowIds((prev) => {
        const next = new Set(prev);
        next.delete(roleActionsModal.id);
        return next;
      });
      emitArchiveStyleToast({
        line1: roleActionsModal.roleName,
        line2: "роль удалена",
      });
      setRoleActionsModal(null);
    }
  }

  const roleModalActions: { id: RoleModalActionId; label: string; danger?: boolean; hidden?: boolean }[] = [
    { id: "edit", label: "Редактировать роль" },
    {
      id: "delete",
      label: "Удалить роль",
      danger: true,
      hidden: roleActionsModal ? BUILT_IN_ROLE_IDS.has(roleActionsModal.id) : false,
    },
  ];

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-4 max-lg:gap-5">
      <div className={`@container min-h-0 flex-1 overflow-hidden rounded-lg max-lg:min-h-[240px] max-lg:flex-none lg:flex-1 ${isDarkTheme ? "bg-[#131925]" : "bg-white"}`}>
        <div className="journal-table-scroll relative min-h-0 min-w-0 flex-1 touch-pan-x touch-pan-y overflow-x-auto overflow-y-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] max-lg:max-h-[min(72vh,680px)] lg:max-h-[min(78vh,800px)] xl:max-h-none @[1280px]:max-h-none @[1280px]:overflow-y-hidden">
          <table className="w-full min-w-[920px] table-fixed border-separate border-spacing-0 text-[16px] font-medium tracking-[-0.015em] @[1280px]:min-w-0 @[1280px]:tracking-[-0.04em]">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[22%]" />
              <col className="w-[4%]" />
            </colgroup>
            <thead className={`text-left text-[15px] font-medium leading-tight tracking-[-0.015em] whitespace-normal @[1280px]:text-[16px] @[1280px]:tracking-[-0.04em] @[1280px]:whitespace-nowrap ${isDarkTheme ? "bg-[#1B2331] text-[#9AA4BC]" : "bg-[#F3F3F5] text-[#7D7D7D]"}`}>
              <tr>
                <th className="rounded-l-[5px] px-4 py-2.5 align-middle font-medium">
                  <span
                    className="inline-flex cursor-pointer select-none items-center"
                    role="checkbox"
                    aria-checked={allPageRowsSelected}
                    aria-label="Выбрать все строки на странице"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelectAllOnPage();
                    }}
                  >
                    <ClientsStyleCheckboxBox checked={allPageRowsSelected} dark={isDarkTheme} />
                  </span>
                </th>
                <th className="px-4 py-2.5 align-middle font-medium">
                  <span className="inline-flex max-w-full items-center gap-2 overflow-hidden whitespace-nowrap font-medium">
                    <span className="truncate">Роль</span>
                    <button type="button" onClick={() => toggleSort("roleName")} className="shrink-0 cursor-pointer"><SortIcon /></button>
                  </span>
                </th>
                <th className="px-4 py-2.5 align-middle font-medium">
                  <span className="inline-flex max-w-full items-center gap-2 overflow-hidden whitespace-nowrap font-medium">
                    <span className="truncate">Описание роли</span>
                    <button type="button" onClick={() => toggleSort("description")} className="shrink-0 cursor-pointer"><SortIcon /></button>
                  </span>
                </th>
                <th className="px-4 py-2.5 align-middle font-medium">
                  <span className="inline-flex max-w-full items-center gap-2 overflow-hidden whitespace-nowrap font-medium">
                    <span className="truncate">Количество пользователей</span>
                    <button type="button" onClick={() => toggleSort("usersCount")} className="shrink-0 cursor-pointer"><SortIcon /></button>
                  </span>
                </th>
                <th className="px-4 py-2.5 align-middle font-medium">
                  <span className="inline-flex max-w-full items-center gap-2 overflow-hidden whitespace-nowrap font-medium">
                    <span className="truncate" title="Дата создания/изменение роли">Дата создания/изменение роли</span>
                    <button type="button" onClick={() => toggleSort("createdOrUpdatedAt")} className="shrink-0 cursor-pointer"><SortIcon /></button>
                  </span>
                </th>
                <th className="rounded-r-[5px] px-4 py-2.5 align-middle font-medium text-center">⋮</th>
              </tr>
            </thead>
            <tbody>
              {pageRows.map((row, index) => {
                const isSelected = selectedRowIds.has(row.id);
                const borderCls = isDarkTheme ? "border-[#1A2130]" : "border-[#EEEDF0]";
                const bgCls = isSelected ? "bg-[#FCE6E8]" : isDarkTheme ? ((pageStart + index) % 2 === 1 ? "bg-[#141C29]" : "bg-[#0F1622]") : ((pageStart + index) % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white");
                const hoverCls = isSelected ? "" : "hover:bg-[rgba(224,9,25,0.10)]";
                return (
                  <tr key={row.id} className={`border-[5px] transition ${borderCls} ${bgCls} ${hoverCls}`}>
                    <td className="px-4 py-3 align-middle" onClick={(e) => e.stopPropagation()}>
                      <span
                        className="inline-flex cursor-pointer select-none items-center"
                        role="checkbox"
                        aria-checked={isSelected}
                        aria-label={`Выбрать роль ${row.roleName}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleRowSelection(row.id);
                        }}
                      >
                        <ClientsStyleCheckboxBox checked={isSelected} dark={isDarkTheme} />
                      </span>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>
                      <span className="block truncate" title={row.roleName}>{row.roleName}</span>
                    </td>
                    <td className={`max-w-0 min-w-0 px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>
                      <button
                        type="button"
                        tabIndex={0}
                        aria-label="Описание роли, нажмите чтобы показать полностью"
                        aria-expanded={descriptionTooltip?.pinned === true && descriptionTooltip.forRoleId === row.id}
                        className={`block w-full max-w-full truncate text-left text-[16px] leading-normal outline-none ${
                          isDarkTheme ? "cursor-pointer text-[#D3DBEE]" : "cursor-pointer text-black"
                        }`}
                        onMouseEnter={(e) => {
                          const p = clampCommentTooltipPos(e.clientX, e.clientY, row.description);
                          setDescriptionTooltip({ text: row.description, x: p.x, y: p.y, maxWidth: p.maxWidth, pinned: false });
                        }}
                        onMouseMove={(e) => {
                          const p = clampCommentTooltipPos(e.clientX, e.clientY, row.description);
                          setDescriptionTooltip({ text: row.description, x: p.x, y: p.y, maxWidth: p.maxWidth, pinned: false });
                        }}
                        onMouseLeave={() => setDescriptionTooltip((t) => (t?.pinned ? t : null))}
                        onPointerUp={(e) => {
                          e.stopPropagation();
                          if (e.pointerType === "mouse") return;
                          const p = clampCommentTooltipPos(e.clientX, e.clientY, row.description);
                          setDescriptionTooltip((prev) =>
                            prev?.pinned && prev.forRoleId === row.id
                              ? null
                              : { text: row.description, x: p.x, y: p.y, maxWidth: p.maxWidth, pinned: true, forRoleId: row.id },
                          );
                        }}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {previewComment(row.description)}
                      </button>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>
                      <span className="block truncate">{row.usersCount}</span>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>
                      <span className="block truncate" title={row.createdOrUpdatedAt}>{row.createdOrUpdatedAt}</span>
                    </td>
                    <td className="px-4 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-expanded={roleActionsModal?.id === row.id}
                        aria-label={`Меню действий, ${row.roleName}`}
                        className={`cursor-pointer rounded-md px-1.5 py-0.5 text-[16px] font-bold leading-none tracking-[-0.04em] text-[#A0A0A0] transition-colors hover:text-[#EC1C24] ${
                          isDarkTheme ? "hover:bg-white/5" : "hover:bg-black/[0.04]"
                        }`}
                        onClick={() => setRoleActionsModal(row)}
                      >
                        ...
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div className="px-4 pb-1 pt-2">
          <div className={`h-1 rounded-full ${isDarkTheme ? "bg-[#242D3F]" : "bg-[#EEEDF0]"}`} />
        </div>
      </div>

      <div className="relative flex flex-col gap-4 max-lg:gap-5 max-lg:pt-1 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:pt-0">
        <button
          type="button"
          className={`rounded-[8px] px-2 py-1 text-center text-[18px] font-bold tracking-[-0.04em] max-lg:w-full lg:w-auto lg:text-left lg:text-[20px] ${isDarkTheme ? "bg-[#1A2232] text-[#EDF2FF]" : "bg-white text-black"}`}
        >
          {selectedRowIds.size} / ролей
        </button>
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 max-lg:relative max-lg:left-auto max-lg:top-auto max-lg:z-0 max-lg:translate-x-0 max-lg:translate-y-0 max-lg:pointer-events-auto max-lg:flex max-lg:w-full max-lg:justify-center lg:pointer-events-none lg:absolute lg:left-1/2 lg:top-1/2 lg:flex lg:w-auto lg:-translate-x-1/2 lg:-translate-y-1/2">
          <div className="pointer-events-auto flex items-center gap-2">
            <button
              type="button"
              disabled={safeCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              aria-label="Предыдущая страница"
              className={`inline-flex h-[48px] w-[48px] items-center justify-center rounded-full text-[30px] font-bold leading-none tracking-[-0.02em] ${
                safeCurrentPage <= 1
                  ? "cursor-not-allowed opacity-35"
                  : isDarkTheme
                    ? "cursor-pointer hover:bg-white/5"
                    : "cursor-pointer hover:bg-black/[0.04]"
              } ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}
            >
              ‹
            </button>
            <div className="relative flex h-[48px] items-center gap-1 overflow-hidden rounded-full bg-[#11131D] p-1 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.8)]">
              <span
                className="absolute left-1 top-1 z-0 h-[40px] w-[48px] rounded-full bg-[#EC1C24] shadow-[0_6px_14px_-8px_rgba(236,28,36,0.85)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]"
                style={{ transform: `translateX(${(safeCurrentPage - 1) * 49}px)` }}
              />
              {Array.from({ length: totalPages }, (_, idx) => {
                const page = idx + 1;
                return (
                  <button
                    key={page}
                    type="button"
                    onClick={() => setCurrentPage(page)}
                    className={`relative z-10 inline-flex h-[40px] w-[48px] items-center justify-center rounded-full text-[16px] font-bold tracking-[-0.02em] ${
                      page === safeCurrentPage ? "text-white" : "text-white/80 hover:text-white"
                    }`}
                  >
                    {page}
                  </button>
                );
              })}
            </div>
            <button
              type="button"
              disabled={safeCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              aria-label="Следующая страница"
              className={`inline-flex h-[48px] w-[48px] items-center justify-center rounded-full text-[30px] font-bold leading-none tracking-[-0.02em] ${
                safeCurrentPage >= totalPages
                  ? "cursor-not-allowed opacity-35"
                  : isDarkTheme
                    ? "cursor-pointer hover:bg-white/5"
                    : "cursor-pointer hover:bg-black/[0.04]"
              } ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}
            >
              ›
            </button>
          </div>
        </div>
        <div className={`flex w-full shrink-0 justify-center gap-2 text-center text-[16px] font-bold tracking-[-0.04em] max-lg:order-last lg:w-auto lg:justify-end lg:text-right lg:text-[20px] ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>
          <span>
            {pageFrom} — {pageTo} из {total}
          </span>
        </div>
      </div>


      {descriptionTooltip && typeof document !== "undefined"
        ? createPortal(
            <>
              {descriptionTooltip.pinned ? (
                <button
                  type="button"
                  className="fixed inset-0 z-[190] cursor-default bg-transparent"
                  aria-label="Закрыть подсказку"
                  onClick={() => setDescriptionTooltip(null)}
                />
              ) : null}
              <div
                role="tooltip"
                className={`fixed z-[200] max-h-[min(280px,calc(100vh-16px))] w-max min-w-0 overflow-y-auto rounded-xl border px-3 py-2.5 text-left text-[14px] font-medium leading-relaxed whitespace-pre-wrap break-words shadow-[0_12px_40px_-8px_rgba(0,0,0,0.35)] ${
                  descriptionTooltip.pinned ? "pointer-events-auto" : "pointer-events-none"
                } ${isDarkTheme ? "border-[#2B3345] bg-[#1B2331] text-[#EDF2FF]" : "border-[#E4E5E7] bg-white text-[#111826]"}`}
                style={{ left: descriptionTooltip.x, top: descriptionTooltip.y, maxWidth: descriptionTooltip.maxWidth }}
                onClick={(e) => e.stopPropagation()}
              >
                {descriptionTooltip.text}
              </div>
            </>,
            document.body,
          )
        : null}

      {roleActionsModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setRoleActionsModal(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="role-actions-title"
                className={`w-full max-w-[360px] overflow-hidden rounded-[14px] border shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)] ${
                  isDarkTheme ? "border-[#2B3345] bg-[#131925]" : "border-[#E4E5E7] bg-white"
                }`}
                onClick={(e) => e.stopPropagation()}
              >
                <div className={`border-b p-5 ${isDarkTheme ? "border-[#2B3345]" : "border-[#EEEDF0]"}`}>
                  <h2 id="role-actions-title" className={`text-[18px] font-semibold tracking-[-0.04em] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}>
                    Действия с ролью
                  </h2>
                  <p className={`mt-1 truncate text-[14px] font-medium tracking-[-0.04em] ${isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]"}`}>
                    {roleActionsModal.roleName}
                  </p>
                </div>
                <ul className="p-0">
                  {roleModalActions
                    .filter((action) => !action.hidden)
                    .map(({ id, label, danger }) => {
                      const iconTone = danger ? "text-[#EC1C24]" : isDarkTheme ? "text-[#B8C4DC]" : "text-[#4B5563]";
                      return (
                        <li key={id}>
                          <button
                            type="button"
                            className={`flex w-full cursor-pointer items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                              danger
                                ? "text-[#EC1C24] hover:bg-[#FFF5F5]"
                                : isDarkTheme
                                  ? "text-[#E8EDF8] hover:bg-white/[0.06]"
                                  : "text-[#111826] hover:bg-[#F3F3F5]"
                            }`}
                            onClick={() => handleRoleModalAction(id)}
                          >
                            <RoleModalIcon type={id} className={iconTone} />
                            {label}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
    </div>
  );
}

/** Оболочка как «Заявки»; разделы — как вкладки «Основное / …» в ClientDetailsPage2. */
export function SettingsPage() {
  const { firebaseUser, access } = useEmployeeRole();
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [section, setSection] = useState<SettingsSectionId>("employees");
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [employeeRows, setEmployeeRows] = useState<EmployeeRow[]>(() => loadSettingsEmployeeRows(EMPLOYEE_ROWS));
  const [roleRows, setRoleRows] = useState<RoleRow[]>(() => loadSettingsRoleRows(ROLE_ROWS));
  const [roleDrawerOpen, setRoleDrawerOpen] = useState(false);
  const [editingRole, setEditingRole] = useState<RoleRow | null>(null);
  const [pendingEmployees, setPendingEmployees] = useState(() => loadPendingEmployees());
  const [awaitingResponseOnly, setAwaitingResponseOnly] = useState(false);

  const pendingEmployeeRows = useMemo(
    () =>
      pendingEmployees
        .filter((pending) => !isEmployeeBlocked(pending.email))
        .map((pending) => pendingEmployeeToTableRow(pending)),
    [pendingEmployees],
  );
  const awaitingResponseCount = pendingEmployeeRows.length;
  const employeesTableRows = awaitingResponseOnly ? pendingEmployeeRows : employeeRows;

  useEffect(() => {
    const refreshPendingEmployees = () => setPendingEmployees(loadPendingEmployees());
    window.addEventListener(PENDING_EMPLOYEES_UPDATED_EVENT, refreshPendingEmployees);
    window.addEventListener("focus", refreshPendingEmployees);
    return () => {
      window.removeEventListener(PENDING_EMPLOYEES_UPDATED_EVENT, refreshPendingEmployees);
      window.removeEventListener("focus", refreshPendingEmployees);
    };
  }, []);

  useEffect(() => {
    if (!firebaseUser || !access.settings) return;

    let cancelled = false;

    async function refreshPendingFromServer() {
      try {
        const idToken = await firebaseUser.getIdToken();
        await hydrateEmployeeRoleOverridesFromApi(idToken);
        const rows = await fetchPendingEmployeesFromApi(idToken);
        if (!cancelled) setPendingEmployees(rows);
      } catch {
        if (!cancelled) setPendingEmployees(loadPendingEmployees());
      }
    }

    void refreshPendingFromServer();

    function onFocus() {
      void refreshPendingFromServer();
    }
    window.addEventListener("focus", onFocus);
    return () => {
      cancelled = true;
      window.removeEventListener("focus", onFocus);
    };
  }, [firebaseUser, access.settings]);

  useEffect(() => {
    persistSettingsEmployeeRows(employeeRows);
  }, [employeeRows]);

  useEffect(() => {
    persistSettingsRoleRows(roleRows);
  }, [roleRows]);

  useEffect(() => {
    for (const row of employeeRows) {
      if (row.status !== "Заблокирован") continue;
      const email = resolveEmployeeEmailByFullName(row.fullName);
      if (email) blockEmployeeEmail(email);
    }
  }, [employeeRows]);

  const handleExportEmployees = useCallback(() => {
    const exportRows = employeeRows.map((row) => ({
      ФИО: row.fullName,
      Роль: row.role,
      Статус: row.status,
      "Последняя активность": row.lastActivity,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Сотрудники");
    XLSX.writeFileXLSX(workbook, "сотрудники.xlsx");
  }, [employeeRows]);

  const handleExportRoles = useCallback(() => {
    const exportRows = roleRows.map((row) => ({
      Роль: row.roleName,
      "Описание роли": row.description,
      "Количество пользователей": row.usersCount,
      "Дата создания/изменение роли": row.createdOrUpdatedAt,
    }));
    const worksheet = XLSX.utils.json_to_sheet(exportRows);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Роли");
    XLSX.writeFileXLSX(workbook, "роли.xlsx");
  }, [roleRows]);

  const currentSearchPlaceholder =
    section === "roles" ? "Поиск роли..." : awaitingResponseOnly ? "Поиск сотрудника без доступа..." : "Поиск сотрудника...";
  const filterToggleRowClass = "flex cursor-pointer items-center gap-2 text-[16px] font-medium tracking-[-0.04em]";
  const filterToggleTitleClass = isDarkTheme ? "text-[#F4F7FF]" : "text-black";
  const filterToggleCountClass = isDarkTheme ? "text-[#9AA4BC]" : "text-[#7D7D7D]";
  const handleExportAction = () => {
    if (section === "employees") handleExportEmployees();
    else if (section === "roles") handleExportRoles();
  };

  const editingRoleInitialValues = useMemo(() => {
    if (!editingRole) return null;
    return {
      roleName: editingRole.roleName,
      description: editingRole.description,
      access: resolveRoleAccess(editingRole),
    };
  }, [editingRole]);

  return (
    <div className={`h-screen w-screen overflow-hidden max-lg:min-h-screen max-lg:h-auto max-lg:overflow-y-auto lg:h-screen lg:overflow-hidden ${isDarkTheme ? "bg-[#0C0F14]" : "bg-black"}`}>
      <div className="flex h-full w-full min-h-0 p-2 max-lg:h-auto lg:h-full">
        <div
          className={`flex h-full min-h-0 w-full max-lg:h-auto max-lg:flex-col rounded-[16px] p-2 shadow-none lg:flex-row lg:shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)] ${isDarkTheme ? "bg-[#0C0F14]" : "bg-black"}`}
        >
          <MarsAppShellSidebar mobileLayout="requests" />


          <main className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:overflow-x-hidden">
            <header
              className={`mb-2 rounded-[16px] border px-4 py-4 lg:px-5 lg:py-5 ${isDarkTheme ? "border-[#232937] bg-[#131925]" : "border-[#DDE1E7] bg-white"}`}
            >
              <div className="flex max-lg:flex-col max-lg:items-stretch max-lg:gap-4 items-center gap-3 lg:flex-row lg:items-center lg:gap-3">
                <div className="flex min-w-0 flex-wrap items-baseline gap-2">
                  <h1
                    className={`text-[28px] font-bold leading-[100%] tracking-[-0.04em] max-lg:shrink-0 max-sm:text-[24px] lg:text-[32px] xl:text-[36px] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}
                  >
                    Настройки
                  </h1>
                  <span className="text-[14px] font-medium tracking-[-0.04em] text-[#B4B4B6] sm:text-[16px]">{settingsHeaderSubtitle(section, employeeRows.length)}</span>
                </div>
                <div className="ml-auto flex w-full min-w-0 max-lg:ml-0 max-lg:flex-col max-lg:gap-2 sm:max-lg:flex-row sm:max-lg:flex-wrap items-stretch sm:max-lg:items-center lg:ml-auto lg:w-auto lg:flex-row lg:items-center lg:gap-1.5">
                  <div className="relative w-full min-w-0 sm:max-lg:min-w-[200px] sm:max-lg:flex-1 lg:w-auto lg:flex-none">
                    <input
                      type="search"
                      value={employeeSearchQuery}
                      onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                      className={`h-12 w-full min-w-0 rounded-[10px] border-[3px] px-3 pr-11 text-[18px] font-medium tracking-[-0.04em] outline-none [color-scheme:light] [&::-webkit-search-cancel-button]:hidden lg:w-[280px] xl:w-[320px] ${
                        isDarkTheme
                          ? "border-[#2B3345] bg-[#0E1420] text-[#C9D2E8] placeholder:text-[#7C879F]"
                          : "border-[#E4E5E7] bg-white text-[#8A8A8A] placeholder:text-[#B5B5B5]"
                      }`}
                      placeholder={currentSearchPlaceholder}
                      aria-label={currentSearchPlaceholder}
                    />
                    {employeeSearchQuery.trim() ? (
                      <button
                        type="button"
                        onClick={() => setEmployeeSearchQuery("")}
                        aria-label="Очистить поиск"
                        className={`absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] transition-colors ${
                          isDarkTheme
                            ? "text-[#A9B3C8] hover:bg-white/10 hover:text-[#EDF2FF]"
                            : "text-[#7D7D7D] hover:bg-black/5 hover:text-black"
                        }`}
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-[16px] w-[16px]" aria-hidden>
                          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  {section === "roles" ? (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingRole(null);
                        setRoleDrawerOpen(true);
                      }}
                      className="h-12 min-h-[48px] shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out max-lg:flex-1 sm:max-lg:flex-none lg:px-3 lg:text-[16px] xl:px-4 xl:text-[18px]"
                    >
                      Добавить роль
                    </button>
                  ) : null}
                  <button
                    type="button"
                    onClick={handleExportAction}
                    className="h-12 min-h-[48px] shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-black px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out max-lg:flex-1 sm:max-lg:flex-none lg:px-3 lg:text-[16px] xl:px-4 xl:text-[18px]"
                  >
                    Экспорт в Excel
                  </button>
                </div>
              </div>
            </header>

            <section
              className={`flex min-h-0 min-w-0 flex-1 flex-col gap-4 rounded-[16px] border px-4 py-4 max-lg:gap-4 lg:gap-5 lg:px-5 lg:py-5 ${isDarkTheme ? "border-[#232937] bg-[#131925]" : "border-[#DDE1E7] bg-white"}`}
              aria-label="Содержимое настроек"
            >
              <div className="flex w-full flex-col gap-3 max-lg:gap-4 lg:flex-row lg:flex-wrap lg:items-center lg:justify-between lg:gap-x-4 lg:gap-y-3">
                <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:gap-4 lg:gap-6">
                  <SettingsSectionChipBar active={section} onChange={setSection} isDarkTheme={isDarkTheme} />
                  {section === "employees" ? (
                    <span
                      className={`${filterToggleRowClass} shrink-0 cursor-pointer select-none`}
                      onClick={() => setAwaitingResponseOnly((prev) => !prev)}
                      role="checkbox"
                      aria-checked={awaitingResponseOnly}
                    >
                      <ClientsStyleCheckboxBox checked={awaitingResponseOnly} dark={isDarkTheme} />
                      <span className={filterToggleTitleClass}>Ожидают доступа </span>
                      <span className={`tabular-nums ${filterToggleCountClass}`}>({awaitingResponseCount})</span>
                    </span>
                  ) : null}
                </div>
              </div>

              {section === "employees" ? (
                <EmployeesSection
                  isDarkTheme={isDarkTheme}
                  searchQuery={employeeSearchQuery}
                  rows={employeesTableRows}
                  onEmployeeRoleChange={(employeeId, role) => {
                    const pending = pendingEmployees.find((item) => item.id === employeeId);
                    if (pending) {
                      const mappedRole = mapEmployeeRoleLabelToRole(role);
                      if (!mappedRole) return;
                      setEmployeeRoleOverride(pending.email, mappedRole);
                      removePendingEmployeeById(employeeId);
                      setPendingEmployees((prev) => prev.filter((item) => item.id !== employeeId));
                      setEmployeeRows((prev) =>
                        upsertEmployeeRow(prev, buildEmployeeRowFromPending(pending, role)),
                      );
                      void (async () => {
                        if (!firebaseUser) return;
                        try {
                          const idToken = await firebaseUser.getIdToken();
                          await persistEmployeeRoleOverrideToApi({
                            idToken,
                            email: pending.email,
                            role: mappedRole,
                          });
                          const rows = await fetchPendingEmployeesFromApi(idToken);
                          setPendingEmployees(rows);
                        } catch {
                          // локальное состояние уже обновлено
                        }
                      })();
                      emitArchiveStyleToast({
                        line1: pending.fullName,
                        line2: `роль: ${role}`,
                      });
                      return;
                    }
                    setEmployeeRows((prev) => prev.map((r) => (r.id === employeeId ? { ...r, role } : r)));
                  }}
                  onEmployeeStatusChange={(employeeId, status) => {
                    const pending = pendingEmployees.find((item) => item.id === employeeId);
                    if (pending) {
                      if (status === "Заблокирован") {
                        blockEmployeeEmail(pending.email);
                        removePendingEmployeeById(employeeId);
                        setPendingEmployees((prev) => prev.filter((item) => item.id !== employeeId));
                      }
                      return;
                    }
                    setEmployeeRows((prev) => prev.map((r) => (r.id === employeeId ? { ...r, status } : r)));
                  }}
                />
              ) : (
                <RolesSection
                  isDarkTheme={isDarkTheme}
                  searchQuery={employeeSearchQuery}
                  rows={roleRows}
                  onDeleteRole={(roleId) => setRoleRows((prev) => prev.filter((row) => row.id !== roleId))}
                  onEditRole={(role) => {
                    setEditingRole(role);
                    setRoleDrawerOpen(true);
                  }}
                />
              )}
            </section>
          </main>
        </div>
      </div>

      <AddRoleDrawer
        open={roleDrawerOpen}
        mode={editingRole ? "edit" : "add"}
        initialValues={editingRoleInitialValues}
        onOpenChange={(open) => {
          setRoleDrawerOpen(open);
          if (!open) setEditingRole(null);
        }}
        onSave={(payload) => {
          if (editingRole) {
            setRoleRows((prev) =>
              prev.map((row) =>
                row.id === editingRole.id
                  ? {
                      ...row,
                      roleName: payload.roleName,
                      description: payload.description,
                      access: payload.access,
                      createdOrUpdatedAt: payload.createdOrUpdatedAt,
                    }
                  : row,
              ),
            );
            emitArchiveStyleToast({
              line1: "Роль обновлена",
              line2: payload.roleName,
            });
            return;
          }
          setRoleRows((prev) => [
            {
              id: `r-${Date.now()}`,
              roleName: payload.roleName,
              description: payload.description,
              usersCount: 0,
              createdOrUpdatedAt: payload.createdOrUpdatedAt,
              access: payload.access,
            },
            ...prev,
          ]);
          emitArchiveStyleToast({
            line1: "Роль добавлена",
            line2: payload.roleName,
          });
        }}
      />
    </div>
  );
}
