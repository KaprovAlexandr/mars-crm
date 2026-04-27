import { RequestRow, SidebarItem } from "@/types/crm";

export const requestsSidebarItems: SidebarItem[] = [
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

export const requestsData: RequestRow[] = [
  { id: "294891", status: "Новая заявка", client: "Иванов Артём Сергеевич", car: "Toyota Corolla", plate: "A123BC777", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", date: "03.08.2024", readiness: 0, amount: "1 200" },
  { id: "593423", status: "В архиве", client: "Смирнова Наталья Викторовна", car: "Hyundai Solaris", plate: "M456KX199", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", date: "05.08.2024", readiness: 100, amount: "3 500" },
  { id: "839022", status: "Отменено", client: "ООО \"Сад\"", car: "LADA Vesta", plate: "O789EH750", master: "Кириллов О.", masterPhoto: "https://i.pravatar.cc/80?img=14", date: "08.08.2024", readiness: 30, amount: "7 900" },
  { id: "847952", status: "Новая заявка", client: "ИП Лебедев Максим Олегович", car: "Kia Rio", plate: "T320P197", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", date: "13.08.2024", readiness: 0, amount: "14 500" },
  { id: "495783", status: "Ожидание", client: "ООО \"ЭкоМобиль\"", car: "Renault Duster", plate: "Y654HC777", master: "Тимофеева А.", masterPhoto: "https://i.pravatar.cc/80?img=47", date: "15.08.2024", readiness: 60, amount: "22 300" },
  { id: "987384", status: "В архиве", client: "Белов Алексей Игоревич", car: "Ford Focus", plate: "P111MP178", master: "Романова Н.", masterPhoto: "https://i.pravatar.cc/80?img=5", date: "17.08.2024", readiness: 100, amount: "5 700" },
  { id: "284750", status: "Ожидание", client: "Фролова Анна Андреевна", car: "Volkswagen Polo", plate: "A888MM799", master: "Егоров П.", masterPhoto: "https://i.pravatar.cc/80?img=61", date: "20.08.2024", readiness: 80, amount: "38 900" },
  { id: "847597", status: "Новая заявка", client: "Белов Алексей Игоревич", car: "Nissan Qashqai", plate: "E222CC750", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", date: "22.08.2024", readiness: 0, amount: "11 200" },
  { id: "658472", status: "Просрочено", client: "ООО \"ГрузСервис\"", car: "Skoda Octavia", plate: "X333OP777", master: "Власова Д.", masterPhoto: "https://i.pravatar.cc/80?img=49", date: "26.08.2024", readiness: 20, amount: "63 000" },
  { id: "308845", status: "В архиве", client: "ООО \"ТехноТрак\"", car: "Mitsubishi Outlander", plate: "B999EK177", master: "Токарев Ф.", masterPhoto: "https://i.pravatar.cc/80?img=52", date: "28.08.2024", readiness: 100, amount: "88 750" },
  { id: "208476", status: "Ожидание", client: "Гаврилова Ирина Михайловна", car: "Subaru Forester", plate: "K111CX190", master: "Захарова И.", masterPhoto: "https://i.pravatar.cc/80?img=58", date: "30.08.2024", readiness: 40, amount: "2 800" },
  { id: "989923", status: "Новая заявка", client: "ООО \"ЭкспрессТранс\"", car: "Mercedes-Benz Sprinter", plate: "Y777AY197", master: "Фролов А.", masterPhoto: "https://i.pravatar.cc/80?img=53", date: "02.09.2024", readiness: 0, amount: "19 900" },
  { id: "745120", status: "Ожидание", client: "Кузнецов Андрей Сергеевич", car: "Mazda CX-5", plate: "H530KP777", master: "Лавров В.", masterPhoto: "https://i.pravatar.cc/80?img=65", date: "04.09.2024", readiness: 50, amount: "16 400" },
  { id: "562014", status: "В архиве", client: "ООО \"АвтоПартнер\"", car: "Toyota Camry", plate: "M901AB799", master: "Павлова К.", masterPhoto: "https://i.pravatar.cc/80?img=45", date: "06.09.2024", readiness: 100, amount: "9 300" },
  { id: "901557", status: "Новая заявка", client: "Морозов Евгений Павлович", car: "Hyundai Tucson", plate: "P445TT799", master: "Орлова С.", masterPhoto: "https://i.pravatar.cc/80?img=34", date: "09.09.2024", readiness: 0, amount: "12 700" },
];

export const statusColorMap: Record<RequestRow["status"], string> = {
  "Новая заявка": "bg-[#DDF7EA] text-[#2E8B57]",
  "В архиве": "bg-[#ECEEF0] text-[#5A6673]",
  Отменено: "bg-[#FCE4E4] text-[#BA4F4F]",
  Ожидание: "bg-[#FFF2DA] text-[#B77B27]",
  Просрочено: "bg-[#F5E7EF] text-[#A95B7E]",
};
