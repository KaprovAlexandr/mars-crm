export type SidebarIconType =
  | "home"
  | "requests"
  | "masters"
  | "cars"
  | "users"
  | "payments"
  | "docs"
  | "reports"
  | "settings";

export type RequestStatus =
  | "Новая заявка"
  | "В архиве"
  | "Отменено"
  | "Ожидание"
  | "Просрочено";

export interface SidebarItem {
  label: string;
  icon: SidebarIconType;
  active?: boolean;
}

export interface RequestRow {
  id: string;
  status: RequestStatus;
  client: string;
  car: string;
  plate: string;
  master: string;
  masterPhoto: string;
  date: string;
  readiness: number;
  amount: string;
}

export interface WorkRow {
  name: string;
  state: string;
  amount: string;
  icon: string;
}
