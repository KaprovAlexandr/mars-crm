export type RoleAccessKey =
  | "requests"
  | "journal"
  | "workOrders"
  | "clients"
  | "dashboardOwner"
  | "dashboardManager"
  | "documents"
  | "settings"
  | "profile";

export type RoleAccessPermissions = Record<RoleAccessKey, boolean>;

export type RoleRowAccessSource = {
  id: string;
  roleName: string;
  access?: RoleAccessPermissions;
};

export const ROLE_ACCESS_SECTIONS: { key: RoleAccessKey; label: string }[] = [
  { key: "requests", label: "Заявки" },
  { key: "journal", label: "Журнал записи" },
  { key: "workOrders", label: "Заказ-наряды" },
  { key: "clients", label: "Клиенты" },
  { key: "dashboardOwner", label: "Дашборд руководителя" },
  { key: "documents", label: "Документы" },
  { key: "settings", label: "Настройки" },
];

export function createEmptyRoleAccess(): RoleAccessPermissions {
  return {
    requests: false,
    journal: false,
    workOrders: false,
    clients: false,
    dashboardOwner: false,
    dashboardManager: false,
    documents: false,
    settings: false,
    profile: true,
  };
}

/** Права по умолчанию для встроенных ролей (r1–r4), если access не сохранён в строке. */
const BUILT_IN_ROLE_ID_ACCESS: Record<string, RoleAccessPermissions> = {
  r1: {
    requests: true,
    journal: true,
    workOrders: true,
    clients: true,
    dashboardOwner: true,
    dashboardManager: false,
    documents: true,
    settings: true,
    profile: true,
  },
  r2: {
    requests: true,
    journal: true,
    workOrders: true,
    clients: true,
    dashboardOwner: true,
    dashboardManager: true,
    documents: true,
    settings: true,
    profile: true,
  },
  r3: {
    requests: true,
    journal: true,
    workOrders: true,
    clients: true,
    dashboardOwner: false,
    dashboardManager: false,
    documents: false,
    settings: false,
    profile: true,
  },
  r4: {
    requests: false,
    journal: true,
    workOrders: true,
    clients: false,
    dashboardOwner: false,
    dashboardManager: false,
    documents: false,
    settings: false,
    profile: true,
  },
};

export function resolveRoleAccess(row: RoleRowAccessSource): RoleAccessPermissions {
  if (row.access) return { ...row.access };
  const builtIn = BUILT_IN_ROLE_ID_ACCESS[row.id];
  if (builtIn) return { ...builtIn };
  return createEmptyRoleAccess();
}
