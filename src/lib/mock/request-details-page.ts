import { SidebarItem, WorkRow } from "@/types/crm";

export const requestDetailsSidebarItems: SidebarItem[] = [
  { label: "Дашборд", icon: "home" },
  { label: "Заявки", icon: "requests", active: true },
  { label: "Мастера", icon: "masters" },
  { label: "Автомобили", icon: "cars" },
  { label: "Клиенты", icon: "users" },
  { label: "Платежи", icon: "payments" },
  { label: "Документы", icon: "docs" },
  { label: "Отчёты", icon: "reports" },
  { label: "Настройки", icon: "settings" },
];

export const requestWorks: WorkRow[] = [
  { name: "Диагностика АКПП", state: "В работе", amount: "1 500 ₽", icon: "🔧" },
  { name: "Диагностика двигателя", state: "Запланировано", amount: "7 830 ₽", icon: "🧪" },
  { name: "Диагностика раздаточной коробки", state: "Запланировано", amount: "1 000 ₽", icon: "🛠" },
  { name: "Считывание и расшифровка кодов ошибок", state: "В работе", amount: "2 990 ₽", icon: "⚙" },
  { name: "Диагностика кондиционера", state: "Запланировано", amount: "990 ₽", icon: "🧰" },
  { name: "Ремонт передней подвески с заменой стоек и втулок стабилизатора", state: "Завершено", amount: "14 200 ₽", icon: "🧩" },
];
