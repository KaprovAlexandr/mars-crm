import { SidebarItem } from "@/types/crm";

export const clientDetailsSidebarItems: SidebarItem[] = [
  { label: "Дашборд", icon: "home" },
  { label: "Заявки", icon: "requests" },
  { label: "Мастера", icon: "masters" },
  { label: "Автомобили", icon: "cars" },
  { label: "Клиенты", icon: "users", active: true },
  { label: "Платежи", icon: "payments" },
  { label: "Документы", icon: "docs" },
  { label: "Отчёты", icon: "reports" },
  { label: "Настройки", icon: "settings" },
];

export const clientKpi = [
  { label: "Всего заявок", value: "28" },
  { label: "Автомобилей", value: "6" },
  { label: "Общая выручка", value: "1 286 500 ₽" },
  { label: "Долг", value: "42 300 ₽" },
  { label: "Последний визит", value: "08.08.2025" },
];

export const clientCompanyInfo = [
  { label: "Название компании", value: "ООО \"ТехноПромСклад\"" },
  { label: "ИНН/КПП", value: "7701234567 / 770101001" },
  { label: "ОГРН", value: "1147746123456" },
  { label: "Ответственное лицо", value: "Орлов Алексей Сергеевич" },
  { label: "Телефон", value: "+7 (495) 123-45-67" },
  { label: "Email", value: "info@tehpromsklad.ru" },
  { label: "Юр адрес", value: "г. Москва, ул. Ленина, 45" },
  { label: "Форма оплаты", value: "Безнал" },
  { label: "НДС", value: "20%" },
  { label: "Комментарий", value: "VIP клиент, обслуживание по договору" },
];

export const clientCars = [
  { plate: "A123BC777", car: "Toyota Camry", vin: "XW7BF4FK10S123456", year: "2021", mileage: "72 000 км", lastVisit: "08.08.2025", status: "Активный" },
  { plate: "M456OT799", car: "Hyundai Solaris", vin: "KMHC81BDXXU123456", year: "2019", mileage: "87 500 км", lastVisit: "03.08.2025", status: "Активный" },
  { plate: "P981KP777", car: "Ford Transit", vin: "WF0XXXTTGXLG12345", year: "2020", mileage: "141 200 км", lastVisit: "31.07.2025", status: "В ремонте" },
  { plate: "X777AA77", car: "LADA Largus", vin: "XTAFS045LC1234567", year: "2018", mileage: "166 400 км", lastVisit: "24.07.2025", status: "Ожидание" },
];

export const clientRequests = [
  { id: "943837", date: "08.08.2025", car: "Hyundai Solaris", works: "Диагностика + ремонт ходовой", status: "В работе", master: "Журавлёв М.", amount: "12 420 ₽", debt: "6 620 ₽" },
  { id: "940221", date: "05.08.2025", car: "Toyota Camry", works: "ТО-90 + замена фильтров", status: "Завершено", master: "Алексеев Д.", amount: "24 300 ₽", debt: "0 ₽" },
  { id: "938004", date: "02.08.2025", car: "Ford Transit", works: "Диагностика двигателя", status: "Ожидание", master: "Кириллов О.", amount: "9 700 ₽", debt: "9 700 ₽" },
  { id: "931885", date: "29.07.2025", car: "LADA Largus", works: "Ремонт подвески", status: "Завершено", master: "Семёнова Е.", amount: "31 800 ₽", debt: "0 ₽" },
];

export const clientFinancialSummary = [
  { label: "Всего оплачено", value: "1 244 200 ₽" },
  { label: "Всего выставлено", value: "1 286 500 ₽" },
  { label: "Текущий долг", value: "42 300 ₽" },
  { label: "Средний чек", value: "45 946 ₽" },
  { label: "Скидка клиента", value: "10%" },
  { label: "Бонус / лояльность", value: "Gold" },
];

export const clientCommunications = [
  "08.08.2025 — Исходящий звонок",
  "05.08.2025 — Создана заявка №943837",
  "02.08.2025 — Отправлен акт выполненных работ",
  "29.07.2025 — Добавлен комментарий менеджера",
];

export const clientManagerNotes = [
  "Не звонить после 19:00",
  "Предпочитает безнал",
  "Часто обсуждает смету до старта работ",
  "VIP клиент",
];

export const clientQuickActions = [
  "Создать новую заявку",
  "Добавить авто",
  "Позвонить клиенту",
  "Отправить сообщение",
  "Редактировать данные",
  "Выставить счёт",
];
