import { SidebarItem } from "@/types/crm";

export const dashboardSidebarItems: SidebarItem[] = [
  { label: "Дашборд", icon: "home", active: true },
  { label: "Заявки", icon: "requests" },
  { label: "Мастера", icon: "masters" },
  { label: "Автомобили", icon: "cars" },
  { label: "Клиенты", icon: "users" },
  { label: "Платежи", icon: "payments" },
  { label: "Документы", icon: "docs" },
  { label: "Отчёты", icon: "reports" },
  { label: "Настройки", icon: "settings" },
];

export const dashboardKpis = [
  { label: "Активные заявки", value: "24", tone: "text-[#2E3035]" },
  { label: "Сегодня записано", value: "18", tone: "text-[#2E3035]" },
  { label: "Завершено сегодня", value: "11", tone: "text-[#2E8B57]" },
  { label: "Выручка сегодня", value: "184 500 ₽", tone: "text-[#2E8B57]" },
  { label: "Долги клиентов", value: "72 800 ₽", tone: "text-[#B77B27]" },
  { label: "Просроченные заявки", value: "3", tone: "text-[#d51a21]" },
];

export const todaySchedule = [
  "10:00 — Смирнова / Hyundai Solaris / Диагностика",
  "11:30 — Иванов / Toyota Camry / Замена масла",
  "13:00 — ООО Технопром / Skoda / Подвеска",
  "15:00 — Морозов / Hyundai Tucson / Электрика",
  "16:30 — Петров / Ford Focus / Тормозная система",
];

export const requestStatuses = [
  { label: "Новые", count: 12, width: 48, color: "bg-[#DDEBFF]" },
  { label: "В работе", count: 8, width: 65, color: "bg-[#E4F5EA]" },
  { label: "Ожидание деталей", count: 4, width: 35, color: "bg-[#FFF2DA]" },
  { label: "Готово к выдаче", count: 3, width: 28, color: "bg-[#EDEBFF]" },
  { label: "Завершено", count: 27, width: 85, color: "bg-[#DDF7EA]" },
  { label: "Отменено", count: 2, width: 20, color: "bg-[#FCE4E4]" },
];

export const masterLoad = [
  { name: "Журавлёв М.", activeTasks: 5, load: 92, closedToday: 3 },
  { name: "Алексеев Д.", activeTasks: 4, load: 76, closedToday: 2 },
  { name: "Семёнова Е.", activeTasks: 3, load: 58, closedToday: 4 },
  { name: "Кириллов О.", activeTasks: 2, load: 43, closedToday: 1 },
];

export const financeToday = [
  { label: "Выручка за неделю", value: "1 246 800 ₽" },
  { label: "Средний чек", value: "18 450 ₽" },
  { label: "Оплачено сегодня", value: "143 900 ₽" },
  { label: "Неоплачено", value: "40 600 ₽" },
];

export const systemActivity = [
  "12:32 — Создана заявка №943837",
  "12:10 — Поступила оплата 5 800 ₽",
  "11:48 — Завершена работа по заявке №943120",
  "11:20 — Добавлен новый клиент",
  "10:54 — Мастер Журавлёв назначен на заявку №943837",
];

export const urgentAlerts = [
  "3 просроченные заявки",
  "2 клиента с долгом",
  "1 мастер перегружен",
  "Заканчиваются тормозные колодки на складе",
];

export const weeklyRevenue = [
  { day: "Пн", amount: 132000 },
  { day: "Вт", amount: 148000 },
  { day: "Ср", amount: 171000 },
  { day: "Чт", amount: 163000 },
  { day: "Пт", amount: 188000 },
  { day: "Сб", amount: 205000 },
  { day: "Вс", amount: 176000 },
];

export const paymentSplit = [
  { label: "Карта", value: 42, color: "#D51A21" },
  { label: "СБП", value: 24, color: "#5E9DF5" },
  { label: "Безнал", value: 21, color: "#7FCFA7" },
  { label: "Наличные", value: 13, color: "#F2C96D" },
];
