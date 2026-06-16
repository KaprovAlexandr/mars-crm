import { getEmployeeRoleOverride } from "@/lib/auth/employeeRoleOverrides";

export type EmployeeRole = "manager" | "head" | "administrator" | "master" | "pending";

export type NavAccess = {
  requests: boolean;
  journal: boolean;
  workOrders: boolean;
  clients: boolean;
  /** Маршрут `/dashboard-owner` */
  dashboardOwner: boolean;
  /** Маршрут `/dashboard` (операционный) */
  dashboardManager: boolean;
  documents: boolean;
  settings: boolean;
  profile: boolean;
  /** Экран ожидания выдачи прав (`/awaiting-access`) */
  awaitingApprovalPage: boolean;
  /** Экран блокировки (`/blocked-access`) */
  blockedPage: boolean;
};

const ROLE_BY_EMAIL: Record<string, Exclude<EmployeeRole, "pending">> = {
  "sasharicky99@gmail.com": "manager",
  "sanejkstrronger@gmail.com": "head",
  "n0zicsgo@gmail.com": "master",
  "angel16yoo@gmail.com": "administrator",
};

/** ФИО сотрудников по e-mail (приоритетнее имени из Google). */
const EMPLOYEE_FULL_NAME_BY_EMAIL: Record<string, string> = {
  "sanejkstrronger@gmail.com": "Капров Александр Николаевич",
  "sasharicky99@gmail.com": "Алексеев Дмитрий Сергеевич",
  "n0zicsgo@gmail.com": "Журавлёв Михаил Дмитриевич",
  "angel16yoo@gmail.com": "Орлова Анна Вячеславовна",
};

function applyOptionalEmailRoles() {
  const admin = (import.meta.env.VITE_FIREBASE_ROLE_EMAIL_ADMIN as string | undefined)?.trim().toLowerCase();
  if (admin) ROLE_BY_EMAIL[admin] = "administrator";
  const master = (import.meta.env.VITE_FIREBASE_ROLE_EMAIL_MASTER as string | undefined)?.trim().toLowerCase();
  if (master) ROLE_BY_EMAIL[master] = "master";
}

applyOptionalEmailRoles();

export const ROLE_LABELS: Record<EmployeeRole, string> = {
  manager: "Менеджер",
  head: "Руководитель",
  administrator: "Администратор",
  master: "Мастер",
  pending: "Ожидание доступа",
};

export function normalizeAuthEmail(email: string | null | undefined): string {
  return (email ?? "").trim().toLowerCase();
}

export function getEmployeeFullName(email: string | null | undefined): string {
  const key = normalizeAuthEmail(email);
  if (!key) return "";
  return EMPLOYEE_FULL_NAME_BY_EMAIL[key] ?? "";
}

export function resolveEmployeeEmailByFullName(fullName: string): string | null {
  const normalized = fullName.trim().toLocaleLowerCase("ru-RU");
  if (!normalized) return null;
  for (const [email, name] of Object.entries(EMPLOYEE_FULL_NAME_BY_EMAIL)) {
    if (name.trim().toLocaleLowerCase("ru-RU") === normalized) return email;
  }
  return null;
}

/**
 * Роль по e-mail из Firebase.
 * Нет e-mail (не вошли) — `pending`; CRM-маршруты закрыты layout-ом.
 * E-mail не в списке выданных ролей — `pending` (ожидание прав администратором).
 */
export function resolveEmployeeRoleFromEmail(email: string | null | undefined): EmployeeRole {
  const key = normalizeAuthEmail(email);
  if (!key) return "pending";
  const override = getEmployeeRoleOverride(key);
  if (override) return override;
  return ROLE_BY_EMAIL[key] ?? "pending";
}

const operationalBase: NavAccess = {
  requests: true,
  journal: true,
  workOrders: true,
  clients: true,
  dashboardOwner: false,
  dashboardManager: false,
  documents: false,
  settings: false,
  profile: true,
  awaitingApprovalPage: false,
  blockedPage: false,
};

const masterNavAccess: NavAccess = {
  requests: false,
  journal: true,
  workOrders: true,
  clients: false,
  dashboardOwner: false,
  dashboardManager: false,
  documents: false,
  settings: false,
  profile: true,
  awaitingApprovalPage: false,
  blockedPage: false,
};

/** Индивидуальный набор разделов по e-mail (приоритетнее роли по умолчанию). */
const NAV_ACCESS_BY_EMAIL: Record<string, NavAccess> = {
  "angel16yoo@gmail.com": {
    requests: true,
    journal: true,
    workOrders: true,
    clients: true,
    dashboardOwner: false,
    dashboardManager: false,
    documents: true,
    settings: true,
    profile: true,
    awaitingApprovalPage: false,
    blockedPage: false,
  },
};

export function getBlockedNavAccess(): NavAccess {
  return {
    requests: false,
    journal: false,
    workOrders: false,
    clients: false,
    dashboardOwner: false,
    dashboardManager: false,
    documents: false,
    settings: false,
    profile: false,
    awaitingApprovalPage: false,
    blockedPage: true,
  };
}

export function getNavAccess(role: EmployeeRole, email?: string | null): NavAccess {
  const emailKey = normalizeAuthEmail(email);
  if (emailKey && NAV_ACCESS_BY_EMAIL[emailKey]) {
    return NAV_ACCESS_BY_EMAIL[emailKey];
  }

  switch (role) {
    case "pending":
      return {
        requests: false,
        journal: false,
        workOrders: false,
        clients: false,
        dashboardOwner: false,
        dashboardManager: false,
        documents: false,
        settings: false,
        profile: false,
        awaitingApprovalPage: true,
        blockedPage: false,
      };
    case "manager":
      return operationalBase;
    case "master":
      return masterNavAccess;
    case "head":
      return {
        ...operationalBase,
        dashboardOwner: true,
        documents: true,
        settings: true,
      };
    case "administrator":
      return {
        ...operationalBase,
        dashboardOwner: true,
        dashboardManager: true,
        documents: true,
        settings: true,
      };
    default:
      return operationalBase;
  }
}

export type AppLandingPath = "/requests" | "/journal" | "/awaiting-access" | "/blocked-access";

/** Стартовый маршрут после входа и при отказе в доступе к текущему URL. */
export function resolveDefaultHomePath(role: EmployeeRole, blocked = false): AppLandingPath {
  if (blocked) return "/blocked-access";
  if (role === "pending") return "/awaiting-access";
  if (role === "master") return "/journal";
  return "/requests";
}

/** Куда перейти после успешного входа / регистрации. */
export function resolvePostAuthLandingPath(email: string | null | undefined, blocked = false): AppLandingPath {
  return resolveDefaultHomePath(resolveEmployeeRoleFromEmail(email), blocked);
}

/** Куда отправить при отказе в доступе к текущему URL. */
export function redirectPathWhenDenied(role: EmployeeRole, blocked = false): AppLandingPath {
  return resolveDefaultHomePath(role, blocked);
}

/** Руководитель / админ: действие «назначить ответственным (руководитель)» в заявках. */
export function canAssignRequestLeadRole(role: EmployeeRole): boolean {
  return role === "head" || role === "administrator";
}

/**
 * Куда вести с единственной иконки «Дашборд» в сайдбаре.
 * У руководителя — дашборд руководителя; у администратора по умолчанию операционный `/dashboard`, иначе owner.
 */
export function primaryDashboardPath(
  role: EmployeeRole,
  access?: NavAccess,
): "/dashboard" | "/dashboard-owner" | null {
  if (access?.dashboardManager) return "/dashboard";
  if (access?.dashboardOwner) return "/dashboard-owner";
  if (access) return null;
  if (role === "administrator") return "/dashboard";
  if (role === "head") return "/dashboard-owner";
  return null;
}

export function canAccessRoute(pathname: string, access: NavAccess): boolean {
  const p = pathname;
  if (p.startsWith("/auth") || p.startsWith("/register")) return true;
  if (p.startsWith("/test-request-form")) return true;

  if (p.startsWith("/awaiting-access")) return access.awaitingApprovalPage;
  if (p.startsWith("/blocked-access")) return access.blockedPage;

  if (p.startsWith("/dashboard-owner")) return access.dashboardOwner;
  if (p === "/dashboard" || p.startsWith("/dashboard/")) return access.dashboardManager;

  if (p.startsWith("/documents")) return access.documents;
  if (p.startsWith("/settings")) return access.settings;
  if (p.startsWith("/clients")) return access.clients;
  if (p.startsWith("/work-orders")) return access.workOrders;
  if (p.startsWith("/journal")) return access.journal;
  if (p === "/requests" || p.startsWith("/requests/")) return access.requests;
  if (p.startsWith("/profile")) return access.profile;
  return false;
}
