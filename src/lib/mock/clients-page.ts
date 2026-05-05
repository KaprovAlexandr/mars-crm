import { SidebarItem } from "@/types/crm";

export interface ClientRow {
  id: string;
  status: "Активный" | "Ожидание" | "В архиве";
  fullName: string;
  clientType: "Физ.лицо" | "Юр.лицо";
  phone: string;
  manager: string;
  managerPhoto: string;
  lastVisit: string;
  carsCount: number;
  requestsCount: number;
  paymentForm: "Наличные" | "СБП" | "Безнал" | "Карта";
  totalAmount: string;
}

export const clientsSidebarItems: SidebarItem[] = [
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

export const clientsData: ClientRow[] = [
  { id: "10001", status: "Активный", fullName: "Смирнова Наталья Викторовна", clientType: "Физ.лицо", phone: "+7 (909) 999-99-99", manager: "Алексеев Д.", managerPhoto: "https://i.pravatar.cc/80?img=12", lastVisit: "03.08.2025", carsCount: 1, requestsCount: 3, paymentForm: "Карта", totalAmount: "13 320 ₽" },
  { id: "10002", status: "Ожидание", fullName: "Иванов Артём Сергеевич", clientType: "Физ.лицо", phone: "+7 (910) 111-22-33", manager: "Семёнова Е.", managerPhoto: "https://i.pravatar.cc/80?img=32", lastVisit: "01.08.2025", carsCount: 2, requestsCount: 2, paymentForm: "СБП", totalAmount: "8 540 ₽" },
  { id: "10003", status: "В архиве", fullName: "Белов Алексей Игоревич", clientType: "Физ.лицо", phone: "+7 (911) 321-45-67", manager: "Журавлёв М.", managerPhoto: "https://i.pravatar.cc/80?img=41", lastVisit: "28.07.2025", carsCount: 2, requestsCount: 7, paymentForm: "Наличные", totalAmount: "42 000 ₽" },
  { id: "10004", status: "Активный", fullName: "Фролова Анна Андреевна", clientType: "Физ.лицо", phone: "+7 (922) 765-43-21", manager: "Романова Н.", managerPhoto: "https://i.pravatar.cc/80?img=5", lastVisit: "30.07.2025", carsCount: 1, requestsCount: 4, paymentForm: "Карта", totalAmount: "19 400 ₽" },
  { id: "10005", status: "Активный", fullName: "ООО «ТехноТрак»", clientType: "Юр.лицо", phone: "+7 (915) 456-78-90", manager: "Орлова С.", managerPhoto: "https://i.pravatar.cc/80?img=34", lastVisit: "02.08.2025", carsCount: 4, requestsCount: 1, paymentForm: "Безнал", totalAmount: "4 700 ₽" },
  { id: "10006", status: "Ожидание", fullName: "Кузнецов Андрей Сергеевич", clientType: "Физ.лицо", phone: "+7 (903) 222-11-00", manager: "Лавров В.", managerPhoto: "https://i.pravatar.cc/80?img=65", lastVisit: "29.07.2025", carsCount: 2, requestsCount: 5, paymentForm: "СБП", totalAmount: "28 900 ₽" },
  { id: "10007", status: "Активный", fullName: "Гаврилова Ирина Михайловна", clientType: "Физ.лицо", phone: "+7 (966) 777-88-99", manager: "Захарова И.", managerPhoto: "https://i.pravatar.cc/80?img=58", lastVisit: "25.07.2025", carsCount: 1, requestsCount: 2, paymentForm: "Наличные", totalAmount: "7 900 ₽" },
  { id: "10008", status: "В архиве", fullName: "Сидоров Пётр Петрович", clientType: "Физ.лицо", phone: "+7 (901) 123-45-67", manager: "Токарев Ф.", managerPhoto: "https://i.pravatar.cc/80?img=52", lastVisit: "21.07.2025", carsCount: 3, requestsCount: 9, paymentForm: "Карта", totalAmount: "63 500 ₽" },
  { id: "10009", status: "Активный", fullName: "Орлова Мария Андреевна", clientType: "Физ.лицо", phone: "+7 (905) 999-12-34", manager: "Павлова К.", managerPhoto: "https://i.pravatar.cc/80?img=45", lastVisit: "04.08.2025", carsCount: 2, requestsCount: 6, paymentForm: "СБП", totalAmount: "35 600 ₽" },
  { id: "10010", status: "Ожидание", fullName: "Тарасов Николай Егорович", clientType: "Физ.лицо", phone: "+7 (904) 111-22-44", manager: "Гусева М.", managerPhoto: "https://i.pravatar.cc/80?img=25", lastVisit: "27.07.2025", carsCount: 2, requestsCount: 3, paymentForm: "Наличные", totalAmount: "11 200 ₽" },
  { id: "10011", status: "Активный", fullName: "Петрова Елена Сергеевна", clientType: "Физ.лицо", phone: "+7 (913) 456-00-11", manager: "Егоров П.", managerPhoto: "https://i.pravatar.cc/80?img=61", lastVisit: "05.08.2025", carsCount: 1, requestsCount: 2, paymentForm: "Карта", totalAmount: "9 300 ₽" },
  { id: "10012", status: "В архиве", fullName: "Литвинов Антон Ильич", clientType: "Физ.лицо", phone: "+7 (926) 100-20-30", manager: "Фролов А.", managerPhoto: "https://i.pravatar.cc/80?img=53", lastVisit: "18.07.2025", carsCount: 4, requestsCount: 10, paymentForm: "Безнал", totalAmount: "71 800 ₽" },
  { id: "10013", status: "Активный", fullName: "ООО «ЭкспрессТранс»", clientType: "Юр.лицо", phone: "+7 (925) 200-30-40", manager: "Власова Д.", managerPhoto: "https://i.pravatar.cc/80?img=49", lastVisit: "31.07.2025", carsCount: 5, requestsCount: 4, paymentForm: "Безнал", totalAmount: "16 700 ₽" },
  { id: "10014", status: "Ожидание", fullName: "Никитин Роман Павлович", clientType: "Физ.лицо", phone: "+7 (967) 555-66-77", manager: "Тимофеева А.", managerPhoto: "https://i.pravatar.cc/80?img=47", lastVisit: "24.07.2025", carsCount: 2, requestsCount: 3, paymentForm: "СБП", totalAmount: "14 250 ₽" },
  { id: "10015", status: "Активный", fullName: "Крылова Дарья Викторовна", clientType: "Физ.лицо", phone: "+7 (968) 888-99-10", manager: "Кириллов О.", managerPhoto: "https://i.pravatar.cc/80?img=14", lastVisit: "06.08.2025", carsCount: 1, requestsCount: 5, paymentForm: "Карта", totalAmount: "23 100 ₽" },
];

export const clientStatusColorMap: Record<ClientRow["status"], string> = {
  Активный: "bg-[#DDF7EA] text-[#2E8B57]",
  Ожидание: "bg-[#FFF2DA] text-[#B77B27]",
  "В архиве": "bg-[#ECEEF0] text-[#5A6673]",
};
