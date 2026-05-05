import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import { CURRENT_USER_ROLE } from "@/lib/session/currentUser";
import * as XLSX from "xlsx";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useNavigate } from "react-router-dom";

type SettingsSectionId = "employees" | "roles" | "integrations";

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
  { id: "integrations", label: "Интеграции" },
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
    <div className="inline-flex w-fit items-center gap-1 rounded-full p-1">
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

type EmployeeStatus = "Активен" | "В отпуске" | "Заблокирован" | "Не в сети";

type EmployeeRow = {
  id: string;
  fullName: string;
  photo: string;
  role: string;
  status: EmployeeStatus;
  lastActivity: string;
};

type EmployeeSortKey = "fullName" | "role" | "status" | "lastActivity";
type SortDirection = "asc" | "desc";
type EmployeeModalActionId = "openProfile" | "changeRole" | "changeStatus" | "resetPassword" | "logoutAllDevices" | "deleteEmployee";

type RoleRow = {
  id: string;
  roleName: string;
  description: string;
  usersCount: number;
  createdOrUpdatedAt: string;
};

type RoleSortKey = "roleName" | "description" | "usersCount" | "createdOrUpdatedAt";
type RoleModalActionId = "viewAssignedEmployees" | "editRole" | "deleteRole";

const employeeStatusColorMap: Record<EmployeeStatus, string> = {
  Активен: "#00B515",
  "В отпуске": "#F39D00",
  Заблокирован: "#E00919",
  "Не в сети": "#ACACAC",
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

function getInitials(fullName: string): string {
  return fullName
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? "")
    .join("");
}

function EmployeeAvatar({
  fullName,
  photo,
  isDarkTheme,
}: {
  fullName: string;
  photo: string;
  isDarkTheme: boolean;
}) {
  const [hasPhotoError, setHasPhotoError] = useState(false);
  const initials = useMemo(() => getInitials(fullName), [fullName]);

  if (hasPhotoError) {
    return (
      <span
        className={`inline-flex h-[1em] w-[1em] shrink-0 items-center justify-center rounded-full text-[0.48em] font-semibold leading-none ${
          isDarkTheme ? "bg-[#314055] text-[#E8EDF8]" : "bg-[#DDE4EE] text-[#3C4352]"
        }`}
        aria-hidden
      >
        {initials}
      </span>
    );
  }

  return (
    <img
      src={photo}
      alt=""
      className={`h-[1em] w-[1em] shrink-0 rounded-full object-cover ring-1 ${isDarkTheme ? "ring-white/15" : "ring-black/10"}`}
      onError={() => setHasPhotoError(true)}
      loading="lazy"
      decoding="async"
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
  if (type === "changeStatus") {
    return (
      <svg viewBox="0 0 24 28" fill="none" className={cls} aria-hidden>
        <path d="M17.25 1.25L22.0577 6.13284L17.25 11.0157" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M6.05762 26.25L1.24992 21.3672L6.05762 16.4843" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M1.25 12.4219V8.35939C1.25 7.82066 1.44156 7.304 1.78253 6.92307C2.12351 6.54213 2.58597 6.32813 3.06818 6.32812H21.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M22.25 15.4688V19.5313C22.25 20.07 22.0584 20.5867 21.7175 20.9676C21.3765 21.3485 20.914 21.5625 20.4318 21.5625H2.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
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
  if (type === "resetPassword") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <rect x="4" y="11" width="16" height="9" rx="2.2" stroke="currentColor" strokeWidth="2" />
        <path d="M8 11V8.8C8 6.15 9.95 4 12 4C14.05 4 16 6.15 16 8.8V11" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
        <circle cx="12" cy="15.5" r="1.2" fill="currentColor" />
      </svg>
    );
  }
  if (type === "logoutAllDevices") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <rect x="3.5" y="4.5" width="10" height="15" rx="1.8" stroke="currentColor" strokeWidth="2" />
        <path d="M13 12H21M18 9L21 12L18 15" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 28" fill="none" className={cls} aria-hidden>
      <path
        d="M1.25 6.80556H26.25M10.625 12.3611V20.6944M16.875 12.3611V20.6944M2.8125 6.80556L4.375 23.4722C4.375 24.2089 4.70424 24.9155 5.29029 25.4364C5.87634 25.9573 6.6712 26.25 7.5 26.25H20C20.8288 26.25 21.6237 25.9573 22.2097 25.4364C22.7958 24.9155 23.125 24.2089 23.125 23.4722L24.6875 6.80556M9.0625 6.80556V2.63889C9.0625 2.27053 9.22712 1.91726 9.52015 1.6568C9.81317 1.39633 10.2106 1.25 10.625 1.25H16.875C17.2894 1.25 17.6868 1.39633 17.9799 1.6568C18.2729 1.91726 18.4375 2.27053 18.4375 2.63889V6.80556"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function RoleModalIcon({ type, className }: { type: RoleModalActionId; className?: string }) {
  const cls = `h-[22px] w-[22px] shrink-0 ${className ?? ""}`;
  if (type === "viewAssignedEmployees") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <circle cx="9" cy="8" r="3" stroke="currentColor" strokeWidth="2" />
        <circle cx="16.5" cy="9.5" r="2.5" stroke="currentColor" strokeWidth="2" />
        <path d="M4.5 19C4.9 16.2 6.9 14.5 9.9 14.5C12.9 14.5 14.9 16.2 15.3 19" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "editRole") {
    return (
      <svg viewBox="0 0 25 25" fill="none" className={cls} aria-hidden>
        <path d="M2.77778 22.2222H4.75694L18.3333 8.64583L16.3542 6.66667L2.77778 20.2431V22.2222ZM1.38889 25C0.99537 25 0.665741 24.8667 0.4 24.6C0.134259 24.3333 0.000925926 24.0037 0 23.6111V20.2431C0 19.8727 0.0694446 19.5194 0.208333 19.1833C0.347222 18.8472 0.543981 18.5523 0.798611 18.2986L18.3333 0.798611C18.6111 0.543981 18.9181 0.347222 19.2542 0.208333C19.5903 0.0694446 19.9431 0 20.3125 0C20.6819 0 21.0407 0.0694446 21.3889 0.208333C21.737 0.347222 22.038 0.555555 22.2917 0.833333L24.2014 2.77778C24.4792 3.03241 24.6815 3.33333 24.8083 3.68056C24.9352 4.02778 24.9991 4.375 25 4.72222C25 5.09259 24.9361 5.44583 24.8083 5.78194C24.6806 6.11806 24.4782 6.42454 24.2014 6.70139L6.70139 24.2014C6.44676 24.456 6.15139 24.6528 5.81528 24.7917C5.47917 24.9306 5.12639 25 4.75694 25H1.38889Z" fill="currentColor" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 28 28" fill="none" className={cls} aria-hidden>
      <path
        d="M1.25 6.80556H26.25M10.625 12.3611V20.6944M16.875 12.3611V20.6944M2.8125 6.80556L4.375 23.4722C4.375 24.2089 4.70424 24.9155 5.29029 25.4364C5.87634 25.9573 6.6712 26.25 7.5 26.25H20C20.8288 26.25 21.6237 25.9573 22.2097 25.4364C22.7958 24.9155 23.125 24.2089 23.125 23.4722L24.6875 6.80556M9.0625 6.80556V2.63889C9.0625 2.27053 9.22712 1.91726 9.52015 1.6568C9.81317 1.39633 10.2106 1.25 10.625 1.25H16.875C17.2894 1.25 17.6868 1.39633 17.9799 1.6568C18.2729 1.91726 18.4375 2.27053 18.4375 2.63889V6.80556"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function settingsHeaderSubtitle(section: SettingsSectionId, employeeRowsCount: number): string {
  switch (section) {
    case "employees":
      return `${employeeRowsCount} сотрудников`;
    case "roles":
      return "Роли и доступ";
    case "integrations":
      return "Интеграции";
    default:
      return "";
  }
}

/** Блок таблицы сотрудников + нижняя панель — по структуре страницы «Заявки». */
function EmployeesSection({
  isDarkTheme,
  searchQuery,
  rows,
}: {
  isDarkTheme: boolean;
  searchQuery: string;
  rows: EmployeeRow[];
}) {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [employeeActionsModal, setEmployeeActionsModal] = useState<EmployeeRow | null>(null);
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

  const employeeModalActions: { id: EmployeeModalActionId; label: string; danger?: boolean }[] = [
    { id: "openProfile", label: "Открыть профиль" },
    { id: "changeRole", label: "Изменить роль" },
    { id: "changeStatus", label: "Изменить статус" },
    { id: "resetPassword", label: "Сбросить пароль" },
    { id: "logoutAllDevices", label: "Выйти со всех устройств" },
    { id: "deleteEmployee", label: "Удалить сотрудника", danger: true },
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
    <>
      <div className={`min-h-0 flex-1 overflow-hidden rounded-lg ${isDarkTheme ? "bg-[#131925]" : "bg-white"}`}>
        <div className="h-full overflow-x-hidden overflow-y-hidden">
          <table className="w-full table-fixed border-separate border-spacing-0 text-[16px] font-medium tracking-[-0.04em]">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[32%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[18%]" />
              <col className="w-[4%]" />
            </colgroup>
            <thead
              className={`text-left text-[16px] font-medium tracking-[-0.04em] ${isDarkTheme ? "bg-[#1B2331] text-[#9AA4BC]" : "bg-[#F3F3F5] text-[#7D7D7D]"}`}
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

      <div className="relative flex items-center justify-between">
        <button
          type="button"
          className={`rounded-[8px] px-2 py-1 text-[20px] font-bold tracking-[-0.04em] ${isDarkTheme ? "bg-[#1A2232] text-[#EDF2FF]" : "bg-white text-black"}`}
        >
          {selectedRowIds.size} / сотрудников
        </button>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
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
        <div className={`flex items-center gap-2 text-[20px] font-bold tracking-[-0.04em] ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>
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
                    const iconTone = danger
                      ? "text-[#EC1C24]"
                      : isDarkTheme
                        ? "text-[#B8C4DC]"
                        : "text-[#4B5563]";
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                            danger
                              ? "text-[#EC1C24] hover:bg-[#EC1C24]/10"
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
    </>
  );
}

function RolesSection({
  isDarkTheme,
  searchQuery,
  rows,
}: {
  isDarkTheme: boolean;
  searchQuery: string;
  rows: RoleRow[];
}) {
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [roleActionsModal, setRoleActionsModal] = useState<RoleRow | null>(null);
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
  const roleModalActions: { id: RoleModalActionId; label: string; danger?: boolean }[] = [
    { id: "viewAssignedEmployees", label: "Назначенные сотрудники" },
    { id: "editRole", label: "Редактировать роль" },
    { id: "deleteRole", label: "Удалить роль", danger: true },
  ];

  return (
    <>
      <div className={`min-h-0 flex-1 overflow-hidden rounded-lg ${isDarkTheme ? "bg-[#131925]" : "bg-white"}`}>
        <div className="h-full overflow-x-hidden overflow-y-hidden">
          <table className="w-full table-fixed border-separate border-spacing-0 text-[16px] font-medium tracking-[-0.04em]">
            <colgroup>
              <col className="w-[5%]" />
              <col className="w-[24%]" />
              <col className="w-[33%]" />
              <col className="w-[16%]" />
              <col className="w-[18%]" />
              <col className="w-[4%]" />
            </colgroup>
            <thead className={`text-left text-[16px] font-medium tracking-[-0.04em] ${isDarkTheme ? "bg-[#1B2331] text-[#9AA4BC]" : "bg-[#F3F3F5] text-[#7D7D7D]"}`}>
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
                <th className="px-4 py-2.5 align-middle font-medium"><span className="inline-flex items-center gap-2 font-medium">Роль<button type="button" onClick={() => toggleSort("roleName")} className="cursor-pointer"><SortIcon /></button></span></th>
                <th className="px-4 py-2.5 align-middle font-medium"><span className="inline-flex items-center gap-2 font-medium">Описание роли<button type="button" onClick={() => toggleSort("description")} className="cursor-pointer"><SortIcon /></button></span></th>
                <th className="px-4 py-2.5 align-middle font-medium"><span className="inline-flex items-center gap-2 font-medium">Количество пользователей<button type="button" onClick={() => toggleSort("usersCount")} className="cursor-pointer"><SortIcon /></button></span></th>
                <th className="px-4 py-2.5 align-middle font-medium"><span className="inline-flex items-center gap-2 font-medium">Дата создания/изменение роли<button type="button" onClick={() => toggleSort("createdOrUpdatedAt")} className="cursor-pointer"><SortIcon /></button></span></th>
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
                    <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>{row.roleName}</td>
                    <td className={`px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>
                      <span className="line-clamp-1">{row.description}</span>
                    </td>
                    <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>{row.usersCount}</td>
                    <td className={`whitespace-nowrap px-4 py-3 ${isDarkTheme ? "text-[#D3DBEE]" : "text-black"}`}>{row.createdOrUpdatedAt}</td>
                    <td className="px-4 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        aria-haspopup="dialog"
                        aria-expanded={roleActionsModal?.id === row.id}
                        aria-label={`Меню действий, роль ${row.roleName}`}
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

      <div className="relative flex items-center justify-between">
        <button
          type="button"
          className={`rounded-[8px] px-2 py-1 text-[20px] font-bold tracking-[-0.04em] ${isDarkTheme ? "bg-[#1A2232] text-[#EDF2FF]" : "bg-white text-black"}`}
        >
          {selectedRowIds.size} / ролей
        </button>
        <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
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
        <div className={`flex items-center gap-2 text-[20px] font-bold tracking-[-0.04em] ${isDarkTheme ? "text-[#EDF2FF]" : "text-black"}`}>
          <span>
            {pageFrom} — {pageTo} из {total}
          </span>
        </div>
      </div>

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
                  {roleModalActions.map(({ id, label, danger }) => {
                    const iconTone = danger
                      ? "text-[#EC1C24]"
                      : isDarkTheme
                        ? "text-[#B8C4DC]"
                        : "text-[#4B5563]";
                    return (
                      <li key={id}>
                        <button
                          type="button"
                          className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                            danger
                              ? "text-[#EC1C24] hover:bg-[#EC1C24]/10"
                              : isDarkTheme
                                ? "text-[#E8EDF8] hover:bg-white/[0.06]"
                                : "text-[#111826] hover:bg-[#F3F3F5]"
                          }`}
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
    </>
  );
}

function IntegrationsPanel({ isDarkTheme }: { isDarkTheme: boolean }) {
  const items = [
    {
      name: "Телефония",
      status: "Подключено",
      description: "Получайте уведомления о новых заявках, изменениях статусов и сообщениях от клиентов.",
      actions: ["Настроить", "Отключить"],
    },
    {
      name: "СМС-рассылки",
      status: "Требует настройки",
      description: "Автоматическая отправка SMS клиентам по статусам заявок и событиям.",
      actions: ["Настроить", "Проверить соединение"],
    },
    {
      name: "WhatsApp",
      status: "Требует настройки",
      description: "Отправка уведомлений клиентам напрямую в WhatsApp по статусам заявки.",
      actions: ["Настроить", "Проверить соединение"],
    },
    {
      name: "Webhook / Форма сайта",
      status: "Подключено",
      description: "Двусторонняя синхронизация заявок и лидов с сайтом компании.",
      actions: ["Настроить", "Отключить"],
    },
    {
      name: "Email",
      status: "Не подключено",
      description: "Отправка массовых email-уведомлений клиентам о новых услугах, акциях или изменениях.",
      actions: ["Подключить"],
    },
    {
      name: "Telegram",
      status: "Не подключено",
      description: "Уведомления и служебные оповещения в Telegram для менеджеров и руководителей.",
      actions: ["Подключить"],
    },
  ] as const;

  const statusTone = (status: string): string => {
    if (status === "Подключено") return "bg-[#DFF2E4] text-[#2E8B57]";
    if (status === "Требует настройки") return "bg-[#FCEBC8] text-[#A46C10]";
    return "bg-[#F9DDE1] text-[#C13B4C]";
  };

  return (
    <div className="min-h-0 flex-1">
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {items.map((item) => {
          const isConnected = item.status === "Подключено";
          return (
          <div
            key={item.name}
            className={`rounded-[8px] px-4 py-3 ${
              isDarkTheme ? "bg-[#1B2331]" : "bg-[#F3F3F5]"
            }`}
          >
            <span className={`inline-flex rounded-[4px] px-2 py-0.5 text-[11px] font-medium ${statusTone(item.status)}`}>{item.status}</span>
            <h3 className={`mt-2 text-[16px] font-semibold leading-[1.2] ${isDarkTheme ? "text-[#EDF2FF]" : "text-[#2A2A2A]"}`}>{item.name}</h3>
            <p className={`mt-1 min-h-[54px] text-[12px] leading-[1.25] ${isDarkTheme ? "text-[#AEB8CC]" : "text-[#767676]"}`}>{item.description}</p>
            <div className="mt-3 flex flex-wrap items-center gap-2">
              {item.actions.map((actionLabel) => {
                const isPrimary = actionLabel === "Подключить";
                const isSetup = actionLabel === "Настроить";
                return (
                  <button
                    key={`${item.name}-${actionLabel}`}
                    type="button"
                    className={`px-3 py-1 text-[12px] font-medium ${
                      isSetup
                        ? "rounded-[10px] bg-[#EC1C24] text-white hover:bg-[#d91922]"
                        : isPrimary
                        ? "bg-[#F2BE59] text-[#2A2A2A] hover:bg-[#E9B24C]"
                        : isDarkTheme
                          ? "rounded-[6px] text-[#C9D2E8] hover:text-white"
                          : "rounded-[6px] text-[#535353] hover:text-black"
                    }`}
                  >
                    {actionLabel}
                  </button>
                );
              })}
              {isConnected ? null : (
                <span className={`text-[12px] ${isDarkTheme ? "text-[#8FA9D8]" : "text-[#4A8BCF]"}`}>○ Как подключить</span>
              )}
            </div>
          </div>
          );
        })}
      </div>
    </div>
  );
}

/** Оболочка как «Заявки»; разделы — как вкладки «Основное / …» в ClientDetailsPage2. */
export function SettingsPage() {
  const navigate = useNavigate();
  const isManager = CURRENT_USER_ROLE === "manager";
  const [isDarkTheme, setIsDarkTheme] = useState(false);
  const [section, setSection] = useState<SettingsSectionId>("employees");
  const [employeeSearchQuery, setEmployeeSearchQuery] = useState("");
  const [employeeRows, setEmployeeRows] = useState<EmployeeRow[]>(EMPLOYEE_ROWS);
  const [roleRows, setRoleRows] = useState<RoleRow[]>(ROLE_ROWS);

  const handleAddEmployee = useCallback(() => {
    const fullNameRaw = window.prompt("Введите ФИО нового сотрудника:");
    if (fullNameRaw === null) return;
    const fullName = fullNameRaw.trim();
    if (!fullName) return;

    const nextIndex = employeeRows.length + 1;
    const now = new Date();
    const two = (n: number) => String(n).padStart(2, "0");
    const timestamp = `${two(now.getDate())}.${two(now.getMonth() + 1)}.${now.getFullYear()}, ${two(now.getHours())}:${two(now.getMinutes())}`;
    const defaultAvatar = `https://i.pravatar.cc/80?img=${(nextIndex % 70) + 1}`;

    setEmployeeRows((prev) => [
      ...prev,
      {
        id: `e${Date.now()}`,
        fullName,
        photo: defaultAvatar,
        role: "Менеджер",
        status: "Активен",
        lastActivity: timestamp,
      },
    ]);
  }, [employeeRows.length]);

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

  const handleAddRole = useCallback(() => {
    const roleNameRaw = window.prompt("Введите название роли:");
    if (roleNameRaw === null) return;
    const roleName = roleNameRaw.trim();
    if (!roleName) return;
    const descriptionRaw = window.prompt("Введите описание роли:") ?? "";
    const description = descriptionRaw.trim() || "Описание не указано";
    const now = new Date();
    const two = (n: number) => String(n).padStart(2, "0");
    const stamp = `${two(now.getDate())}.${two(now.getMonth() + 1)}.${now.getFullYear()}, ${two(now.getHours())}:${two(now.getMinutes())}`;
    setRoleRows((prev) => [
      ...prev,
      {
        id: `r${Date.now()}`,
        roleName,
        description,
        usersCount: 0,
        createdOrUpdatedAt: stamp,
      },
    ]);
  }, []);

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
    section === "roles" ? "Поиск роли..." : section === "employees" ? "Поиск сотрудника..." : "Поиск по настройкам...";
  const primaryActionLabel =
    section === "roles" ? "Добавить роль" : section === "employees" ? "Добавить сотрудника" : "Сохранить";
  const handlePrimaryAction = () => {
    if (section === "employees") handleAddEmployee();
    else if (section === "roles") handleAddRole();
  };
  const handleExportAction = () => {
    if (section === "employees") handleExportEmployees();
    else if (section === "roles") handleExportRoles();
  };

  return (
    <div className={`h-screen w-screen overflow-hidden ${isDarkTheme ? "bg-[#0C0F14]" : "bg-black"}`}>
      <div className="flex h-full w-full p-2">
        <div
          className={`flex h-full w-full rounded-[16px] p-2 shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)] ${isDarkTheme ? "bg-[#0C0F14]" : "bg-black"}`}
        >
          <aside className="mr-2 flex w-[100px] flex-col items-center rounded-[11px] bg-black">
            <button
              type="button"
              className="mb-2 grid h-[90px] w-full place-items-center rounded-[16px] bg-[#EC1C24] text-[18px] font-semibold text-white"
            >
              Марс
            </button>
            <button
              type="button"
              onClick={() => navigate("/dashboard")}
              className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"
            >
              <MarsShellSidebarIcon type="home" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/")}
              className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"
            >
              <MarsShellSidebarIcon type="cube" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/journal")}
              className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"
            >
              <MarsShellSidebarIcon type="layers" />
            </button>
            <button
              type="button"
              onClick={() => navigate("/work-orders")}
              className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"
            >
              <MarsShellSidebarIcon type="chat" />
            </button>
            <button type="button" onClick={() => navigate("/clients")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]">
              <MarsShellSidebarIcon type="pie" />
            </button>
            <div className="mt-auto space-y-2">
              <button
                type="button"
                onClick={() => setIsDarkTheme((prev) => !prev)}
                className={`grid h-12 w-12 place-items-center rounded-[10px] transition ${
                  isDarkTheme ? "bg-white text-[#11131D]" : "text-[#8C93A5] hover:bg-white/10"
                }`}
                title="Переключить тему"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-[24px] w-[24px]">
                  {isDarkTheme ? (
                    <>
                      <circle cx="12" cy="12" r="4.2" stroke="currentColor" strokeWidth="1.8" />
                      <path
                        d="M12 2.8V5.1M12 18.9V21.2M2.8 12H5.1M18.9 12H21.2M5.2 5.2L6.9 6.9M17.1 17.1L18.8 18.8M18.8 5.2L17.1 6.9M6.9 17.1L5.2 18.8"
                        stroke="currentColor"
                        strokeWidth="1.8"
                        strokeLinecap="round"
                      />
                    </>
                  ) : (
                    <path
                      d="M15.8 3.6C13.8 3.9 11.9 5 10.8 6.7C9.7 8.4 9.5 10.6 10.2 12.5C10.9 14.4 12.3 15.9 14.2 16.7C16.2 17.5 18.4 17.4 20.2 16.4C19.4 18 18.1 19.4 16.5 20.3C14.8 21.2 12.9 21.5 11 21.1C9 20.7 7.2 19.6 5.9 18C4.6 16.4 3.9 14.4 4 12.3C4.1 10.3 4.9 8.3 6.3 6.9C7.7 5.4 9.6 4.5 11.6 4.2C13 3.9 14.4 3.8 15.8 3.6Z"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  )}
                </svg>
              </button>
              {!isManager ? (
                <>
                  <button
                    type="button"
                    className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"
                  >
                    <MarsShellSidebarIcon type="grid" />
                  </button>
                  <button
                    type="button"
                    className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"
                  >
                    <MarsShellSidebarIcon type="doc" />
                  </button>
                </>
              ) : null}
              <NavRailNotifications />
              {!isManager ? (
                <button
                  type="button"
                  className="grid h-12 w-12 place-items-center rounded-[10px] bg-white text-[#11131D]"
                  title="Настройки"
                  aria-label="Настройки"
                  aria-current="page"
                >
                  <MarsShellSidebarIcon type="settings" />
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => navigate("/profile")}
                className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"
              >
                <MarsShellSidebarIcon type="user" />
              </button>
            </div>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col">
            <header
              className={`mb-2 rounded-[16px] border px-5 py-5 ${isDarkTheme ? "border-[#232937] bg-[#131925]" : "border-[#DDE1E7] bg-white"}`}
            >
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-2">
                  <h1
                    className={`text-[36px] font-bold leading-[100%] tracking-[-0.04em] ${isDarkTheme ? "text-[#F4F7FF]" : "text-[#111826]"}`}
                  >
                    Настройки
                  </h1>
                  <span className="text-[16px] font-medium tracking-[-0.04em] text-[#B4B4B6]">{settingsHeaderSubtitle(section, employeeRows.length)}</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="relative">
                    <input
                      type="search"
                      value={employeeSearchQuery}
                      onChange={(e) => setEmployeeSearchQuery(e.target.value)}
                      className={`h-12 w-[320px] rounded-[10px] border-[3px] px-3 pr-11 text-[18px] font-medium tracking-[-0.04em] outline-none [color-scheme:light] [&::-webkit-search-cancel-button]:hidden ${
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
                  <button
                    type="button"
                    onClick={handlePrimaryAction}
                    className="h-12 rounded-[10px] border-2 border-transparent bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out hover:border-[#EC1C24] hover:bg-white hover:text-[#EC1C24]"
                  >
                    {primaryActionLabel}
                  </button>
                  <button
                    type="button"
                    onClick={handleExportAction}
                    className="h-12 shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-black px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out hover:border-black hover:bg-white hover:text-black"
                  >
                    Экспорт в Excel
                  </button>
                </div>
              </div>
            </header>

            <section
              className={`flex min-h-0 min-w-0 flex-1 flex-col gap-5 overflow-hidden rounded-[16px] border px-5 py-5 ${isDarkTheme ? "border-[#232937] bg-[#131925]" : "border-[#DDE1E7] bg-white"}`}
              aria-label="Содержимое настроек"
            >
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <SettingsSectionChipBar active={section} onChange={setSection} isDarkTheme={isDarkTheme} />
              </div>

              {section === "employees" ? (
                <EmployeesSection isDarkTheme={isDarkTheme} searchQuery={employeeSearchQuery} rows={employeeRows} />
              ) : section === "roles" ? (
                <RolesSection isDarkTheme={isDarkTheme} searchQuery={employeeSearchQuery} rows={roleRows} />
              ) : (
                <div key={section} className="hide-scrollbar min-h-0 flex-1 overflow-y-auto pr-1">
                  {section === "integrations" && <IntegrationsPanel isDarkTheme={isDarkTheme} />}
                </div>
              )}
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
