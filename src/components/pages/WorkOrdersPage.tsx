import { MarsAppShellSidebar } from "@/components/layout/MarsAppShellSidebar";
import { emitArchiveStyleToast } from "@/lib/notifications/inAppArchiveToastBus";
import { WORK_ORDER_LIST_FLASH_ARMED_KEY } from "@/lib/notifications/inferNotificationDeepLink";
import {
  insertWorkOrderStorageRow,
  isWorkOrdersRemoteEnabled,
  listWorkOrdersStorageRows,
  updateWorkOrdersStorageRows,
  type WorkOrderStorageRow,
} from "@/lib/data/workOrdersDataSource";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type AnimationEvent } from "react";
import { createPortal } from "react-dom";
import { useLocation, useNavigate, useSearchParams } from "react-router-dom";
import * as XLSX from "xlsx";

type WorkOrderRow = {
  id: string;
  archived?: boolean;
  urgent?: boolean;
  client: string;
  car: string;
  plate: string;
  master: string;
  masterPhoto: string;
  status: "Новый" | "В работе" | "Ожидание запчастей" | "Готово" | "Закрыт" | "Отказ клиента";
  amount: string;
  dueDate: string;
};

type DateAcceptancePreset = "today" | "yesterday" | "last7" | "last30" | "custom";
type WorkOrderActionId = "open" | "status" | "urgent" | "edit" | "archive" | "callClient" | "switchMaster";
type WorkOrderActionEntry = { id: WorkOrderActionId; label: string; danger?: boolean };
type EditWorkOrderDraft = {
  client: string;
  car: string;
  plate: string;
};
type ClientDirectoryEntry = {
  fullName: string;
  phone: string;
  cars: Array<{ car: string; plate: string }>;
};
type CatalogWorkItem = {
  section: string;
  title: string;
  price: number;
};
const TRANSFER_TO_WORK_ORDER_DRAFT_KEY = "transferToWorkOrderDraft";
const workOrderMasterOverrideStorageKey = "workOrderMasterOverrides";
const WORK_ORDERS_ROWS_PERSIST_KEY = "workOrdersRowsPersistedV1";
const CLIENT_CARS_SHARED_STORAGE_KEY = "clientCarsSharedByFioV1";
const clientDirectoryMock: ClientDirectoryEntry[] = [
  { fullName: "Иванов Артём Сергеевич", phone: "+7 (999) 111-22-33", cars: [{ car: "BMW M5 F90", plate: "А123ВС777" }] },
  {
    fullName: "Смирнова Наталья Викторовна",
    phone: "+7 (915) 222-33-44",
    cars: [
      { car: "BMW M5 Competition", plate: "М456КХ199" },
      { car: "Hyundai Solaris", plate: "М456КХ199" },
      { car: "Kia Rio", plate: "М456КХ199" },
    ],
  },
  { fullName: "Журавлёв Михаил Дмитриевич", phone: "+7 (901) 700-11-22", cars: [{ car: "VW Polo", plate: "С555КК77" }] },
  { fullName: "Павлова Ольга Дмитриевна", phone: "+7 (930) 456-70-80", cars: [{ car: "Skoda Kodiaq", plate: "Н442НР799" }] },
];
const WORK_CATALOG_ALL_SECTION = "Все работы";
const workCatalogSections: Array<{ label: string; items: string[] }> = [
  { label: WORK_CATALOG_ALL_SECTION, items: [] },
  {
    label: "Диагностика",
    items: [
      "Компьютерная диагностика",
      "Диагностика ходовой части",
      "Диагностика тормозной системы",
      "Диагностика двигателя",
      "Диагностика АКПП",
      "Диагностика МКПП",
      "Диагностика рулевого управления",
      "Диагностика подвески",
    ],
  },
  {
    label: "Техническое обслуживание",
    items: ["Замена масла в двигателе", "Замена масляного фильтра", "Замена воздушного фильтра", "Замена салонного фильтра", "Замена свечей зажигания"],
  },
  {
    label: "Тормозная система",
    items: ["Замена тормозных колодок (перед)", "Замена тормозных колодок (зад)", "Замена тормозных дисков", "Прокачка тормозной системы"],
  },
  { label: "Подвеска", items: ["Замена амортизаторов", "Замена стоек стабилизатора", "Замена шаровой опоры", "Сход-развал"] },
  { label: "Двигатель", items: ["Замена ремня ГРМ", "Замена цепи ГРМ", "Замена термостата", "Ремонт двигателя"] },
  { label: "Коробка передач", items: ["Замена сцепления", "Ремонт АКПП", "Ремонт МКПП", "Замена масла АКПП"] },
  { label: "Рулевое управление", items: ["Замена рулевой рейки", "Ремонт рулевой рейки", "Замена жидкости ГУР"] },
  { label: "Электрика", items: ["Замена аккумулятора", "Замена генератора", "Ремонт стартера", "Установка сигнализации"] },
  { label: "Система охлаждения", items: ["Замена радиатора", "Замена патрубков", "Промывка системы охлаждения", "Замена антифриза"] },
  { label: "Выхлопная система", items: ["Замена глушителя", "Замена катализатора", "Ремонт выхлопной системы"] },
  { label: "Шиномонтаж", items: ["Снятие / установка колеса", "Балансировка колес", "Ремонт прокола", "Сезонная переобувка"] },
  { label: "Кузовные работы", items: ["Полировка кузова", "Локальная покраска", "Ремонт бампера", "Удаление вмятин"] },
  { label: "Доп. работы", items: ["Мойка автомобиля", "Химчистка салона", "Озонация салона", "Выездная диагностика"] },
];
const workCatalogMock: CatalogWorkItem[] = workCatalogSections.flatMap((section) =>
  section.label === WORK_CATALOG_ALL_SECTION
    ? []
    : section.items.map((title, idx) => ({
        section: section.label,
        title,
        price: 1700 + ((title.length + idx * 7) % 16) * 320,
      })),
);

function formatRub(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

function maskRuPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.startsWith("8") ? `7${digits.slice(1)}` : digits.startsWith("7") ? digits : `7${digits}`;
  const body = normalized.slice(1, 11);
  const p1 = body.slice(0, 3);
  const p2 = body.slice(3, 6);
  const p3 = body.slice(6, 8);
  const p4 = body.slice(8, 10);
  if (body.length <= 3) return `+7${p1 ? ` (${p1}` : ""}`;
  if (body.length <= 6) return `+7 (${p1}) ${p2}`;
  if (body.length <= 8) return `+7 (${p1}) ${p2}-${p3}`;
  return `+7 (${p1}) ${p2}-${p3}-${p4}`;
}

function national10FromPhoneInput(input: string): string {
  const digits = input.replace(/\D/g, "");
  if (!digits) return "";
  const normalized = digits.startsWith("8") ? `7${digits.slice(1)}` : digits.startsWith("7") ? digits : `7${digits}`;
  return normalized.slice(1, 11);
}

function normalizeRuFio(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

function toTelHref(raw: string): string {
  const digits = raw.replace(/\D/g, "");
  if (!digits) return "tel:";
  const normalized = digits.startsWith("8") ? `7${digits.slice(1)}` : digits.startsWith("7") ? digits : `7${digits}`;
  return `tel:+${normalized}`;
}

function normalizeTransferredText(input: string): string {
  const value = input.trim();
  if (!value) return "";
  const normalized = value.toLowerCase();
  if (normalized === "—" || normalized === "-" || normalized === "не указан" || normalized === "не указано") {
    return "";
  }
  return value;
}

function splitClientNameForProfileLikeDisplay(fullName: string): { firstLine: string; secondLine: string } {
  const clean = fullName.trim();
  if (!clean) return { firstLine: "—", secondLine: "" };
  const parts = clean.split(/\s+/);
  if (parts.length === 1) return { firstLine: parts[0], secondLine: "" };
  return {
    firstLine: parts.slice(0, -1).join(" "),
    secondLine: parts[parts.length - 1] ?? "",
  };
}

function firstClientCar(entry: ClientDirectoryEntry | null): { car: string; plate: string } {
  return entry?.cars?.[0] ?? { car: "", plate: "" };
}

function mapWorkOrderStorageToUi(row: WorkOrderStorageRow): WorkOrderRow {
  return {
    id: row.id,
    status: row.status ?? "Новый",
    client: row.client,
    car: row.car,
    plate: row.plate,
    master: row.master,
    masterPhoto: row.master_photo ?? masterPhotoByName[row.master] ?? "https://i.pravatar.cc/80",
    amount: row.amount,
    dueDate: row.due_date,
    archived: Boolean(row.archived),
    urgent: Boolean(row.urgent),
  };
}

function mapUiWorkOrderToStorage(row: WorkOrderRow): WorkOrderStorageRow {
  return {
    id: row.id,
    status: row.status,
    client: row.client,
    car: row.car,
    plate: row.plate,
    master: row.master,
    master_photo: row.masterPhoto,
    amount: row.amount,
    due_date: row.dueDate,
    archived: Boolean(row.archived),
    urgent: Boolean(row.urgent),
  };
}

function exportWorkOrdersToXlsx(workOrders: WorkOrderRow[]) {
  const data = workOrders.map((r) => ({
    "№ заказ-наряда": r.id,
    Статус: r.status,
    Клиент: r.client,
    Автомобиль: r.car,
    "Гос. номер": r.plate,
    Мастер: r.master,
    "Дата приема": r.dueDate,
    Сумма: r.amount,
  }));
  const ws = XLSX.utils.json_to_sheet(data);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Заказ-наряды");
  XLSX.writeFile(wb, "заказ-наряды.xlsx");
}

function WorkOrderActionIconOpen({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`h-5 w-5 shrink-0 ${className}`} aria-hidden>
      <path d="M8 4H4.75A1.75 1.75 0 0 0 3 5.75v9.5A1.75 1.75 0 0 0 4.75 17h9.5A1.75 1.75 0 0 0 16 15.25V12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <path d="M11 4h5v5M16 4l-7 7" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WorkOrderActionIconUrgent({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`h-5 w-5 shrink-0 ${className}`} aria-hidden>
      <path d="M10 3l1.9 3.84L16 7.43l-3 2.92.7 4.15L10 12.67 6.3 14.5l.7-4.15-3-2.92 4.1-.59L10 3z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function WorkOrderActionIconEdit({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`h-5 w-5 shrink-0 ${className}`} aria-hidden>
      <path d="M3.75 16.25h3.1l8.25-8.25-3.1-3.1-8.25 8.25v3.1z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
      <path d="M10.8 6.2l3.1 3.1" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WorkOrderActionIconArchive({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`h-5 w-5 shrink-0 ${className}`} aria-hidden>
      <path d="M3 6.5h14M5 6.5v9.25A1.25 1.25 0 0 0 6.25 17h7.5A1.25 1.25 0 0 0 15 15.75V6.5M7.5 6.5V4.75A1.75 1.75 0 0 1 9.25 3h1.5A1.75 1.75 0 0 1 12.5 4.75V6.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function WorkOrderActionIconStatus({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`h-5 w-5 shrink-0 ${className}`} aria-hidden>
      <path d="M5 6h10M5 10h10M5 14h6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="14.5" cy="14" r="1.2" fill="currentColor" />
    </svg>
  );
}

function WorkOrderActionIconCall({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`h-5 w-5 shrink-0 ${className}`} aria-hidden>
      <path
        d="M5.6 3.5h2.3l1.1 3.1-1.5 1.5a11.6 11.6 0 0 0 4.4 4.4l1.5-1.5 3.1 1.1v2.3a1.3 1.3 0 0 1-1.3 1.3h-.6A11.6 11.6 0 0 1 4.3 5.4v-.6A1.3 1.3 0 0 1 5.6 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function WorkOrderActionIconSwitchMaster({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="none" className={`h-5 w-5 shrink-0 ${className}`} aria-hidden>
      <path d="M4 6h10m0 0-2-2m2 2-2 2M16 14H6m0 0 2-2m-2 2 2 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function formatRuDateFromDate(date: Date): string {
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yyyy = date.getFullYear();
  return `${dd}.${mm}.${yyyy}`;
}

function maskRuDateInput(input: string): string {
  const digits = input.replace(/\D/g, "").slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}.${digits.slice(2)}`;
  return `${digits.slice(0, 2)}.${digits.slice(2, 4)}.${digits.slice(4)}`;
}

function workOrdersCheckboxBox(checked: boolean) {
  if (checked) {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-[#d51a21] text-white">
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <path d="M3 8L6.2 11L13 4.5" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-[2px] border-[#D8DBDE]" />;
}

const workOrderStatusColorMap: Record<WorkOrderRow["status"], string> = {
  Новый: "#ACACAC",
  "В работе": "#2E78C9",
  "Ожидание запчастей": "#F39D00",
  Готово: "#00B515",
  Закрыт: "#222222",
  "Отказ клиента": "#EC1C24",
};

export const workOrderRows: WorkOrderRow[] = [
  { id: "294894", client: "Иванов Артём Сергеевич", car: "BMW M5 F90", plate: "А123ВС777", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "18 500 ₽", dueDate: "02.04.2026" },
  { id: "593423", client: "Смирнова Наталья Викторовна", car: "BMW M5 Competition", plate: "М456КХ199", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", status: "Новый", amount: "12 300 ₽", dueDate: "04.04.2026" },
  { id: "839022", client: 'ООО "Сад"', car: "Lada Priora", plate: "О789ЕН750", master: "Кириллов О.", masterPhoto: "https://i.pravatar.cc/80?img=14", status: "Ожидание запчастей", amount: "25 800 ₽", dueDate: "06.04.2026" },
  { id: "847952", client: "ИП Лебедев Максим Олегович", car: "Toyota Camry", plate: "Т321ОР197", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", status: "В работе", amount: "9 700 ₽", dueDate: "08.04.2026" },
  { id: "495783", client: 'ООО "ЭкоМобил"', car: "Skoda Octavia", plate: "У654НС777", master: "Тимофеев А.", masterPhoto: "https://i.pravatar.cc/80?img=47", status: "Закрыт", amount: "31 400 ₽", dueDate: "10.04.2026" },
  { id: "987384", client: "Белов Алексей Игоревич", car: "Hyundai Solaris", plate: "В222ОО177", master: "Романова Л.", masterPhoto: "https://i.pravatar.cc/80?img=5", status: "Новый", amount: "7 200 ₽", dueDate: "12.04.2026" },
  { id: "284750", client: "Фролова Алина Андреевна", car: "Renault Duster", plate: "Р988РР799", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "В работе", amount: "14 900 ₽", dueDate: "14.04.2026" },
  { id: "847597", client: "Журавлёв Михаил Дмитриевич", car: "VW Polo", plate: "С555КК77", master: "Кузнецов Е.", masterPhoto: "https://i.pravatar.cc/80?img=52", status: "Закрыт", amount: "22 000 ₽", dueDate: "16.04.2026" },
  { id: "658472", client: 'ООО "ГрузСервис"', car: "MAN TGS", plate: "Е100ХХ750", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "56 700 ₽", dueDate: "18.04.2026" },
  { id: "309845", client: 'ООО "ТехноТрак"', car: "Mercedes Actros", plate: "Н777АА116", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", status: "Готово", amount: "43 900 ₽", dueDate: "20.04.2026" },
  { id: "208476", client: "Гаврилова Ирина Михайловна", car: "Mazda 6", plate: "У001УР199", master: "Захарова И.", masterPhoto: "https://i.pravatar.cc/80?img=58", status: "Ожидание запчастей", amount: "17 600 ₽", dueDate: "22.04.2026" },
  { id: "989923", client: 'ООО "ЭкспрессТранс"', car: "Ford Transit", plate: "Р454КХ799", master: "Тимофеев А.", masterPhoto: "https://i.pravatar.cc/80?img=47", status: "Закрыт", amount: "28 300 ₽", dueDate: "24.04.2026" },
  { id: "923117", client: "Кузнецов Павел Андреевич", car: "Nissan X-Trail", plate: "Х878ТТ177", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "19 400 ₽", dueDate: "26.04.2026" },
  { id: "731550", client: 'ООО "Магистраль"', car: "Scania R450", plate: "М320СС97", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "Отказ клиента", amount: "63 200 ₽", dueDate: "28.04.2026" },
  { id: "615004", client: "Орлова Анна Вячеславовна", car: "Kia Sportage", plate: "Р600РО177", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", status: "Закрыт", amount: "11 800 ₽", dueDate: "30.04.2026" },
  { id: "771208", client: "Савельев Кирилл Романович", car: "Audi A6", plate: "А701АА77", master: "Кузнецов Е.", masterPhoto: "https://i.pravatar.cc/80?img=52", status: "В работе", amount: "35 100 ₽", dueDate: "02.05.2026" },
  { id: "842661", client: "Павлова Ольга Дмитриевна", car: "Skoda Kodiaq", plate: "Н442НР799", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", status: "Ожидание запчастей", amount: "21 500 ₽", dueDate: "03.05.2026" },
  { id: "904552", client: 'ООО "ЛогистикПлюс"', car: "DAF XF", plate: "Р909РЕ750", master: "Тимофеев А.", masterPhoto: "https://i.pravatar.cc/80?img=47", status: "Готово", amount: "47 000 ₽", dueDate: "04.05.2026" },
  { id: "956740", client: "Тихонов Максим Сергеевич", car: "BMW X5", plate: "Е212ЕР199", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "39 600 ₽", dueDate: "05.05.2026" },
  { id: "118390", client: "Егорова Мария Игоревна", car: "Toyota RAV4", plate: "К811КК777", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", status: "Закрыт", amount: "13 200 ₽", dueDate: "06.05.2026" },
  { id: "552701", client: "Киселёв Андрей Петрович", car: "BMW 320i", plate: "В777ВВ799", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "В работе", amount: "16 800 ₽", dueDate: "07.05.2026" },
  { id: "552702", client: "Лаврова Дарья Олеговна", car: "Skoda Rapid", plate: "Р333РР799", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "Закрыт", amount: "11 400 ₽", dueDate: "05.05.2026" },
  { id: "881600", client: "Капров Александр Николаевич", car: "BMW M5", plate: "A21213X7", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "Закрыт", amount: "250 000 ₽", dueDate: "10.05.2026" },
  { id: "881601", client: "Капров Александр Николаевич", car: "BMW M5", plate: "A21213X7", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "Закрыт", amount: "131 058 ₽", dueDate: "15.06.2026" },
  { id: "881602", client: "Капров Александр Николаевич", car: "BMW M5", plate: "A21213X7", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "Закрыт", amount: "250 000 ₽", dueDate: "20.06.2026" },
  { id: "881603", client: "Капров Александр Николаевич", car: "BMW M5", plate: "A21213X7", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "В работе", amount: "131 058 ₽", dueDate: "25.06.2026" },
  { id: "881604", client: "Капров Александр Николаевич", car: "BMW M5", plate: "A21213X7", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "250 000 ₽", dueDate: "28.06.2026" },
  { id: "881605", client: "Капров Александр Николаевич", car: "BMW M5", plate: "A21213X7", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "В работе", amount: "131 058 ₽", dueDate: "30.06.2026" },
];
const masterPhotoByName: Record<string, string> = {
  "Алексеев Д.": "https://i.pravatar.cc/80?img=12",
  "Семёнова Е.": "https://i.pravatar.cc/80?img=32",
  "Кириллов О.": "https://i.pravatar.cc/80?img=14",
  "Гусева М.": "https://i.pravatar.cc/80?img=25",
  "Тимофеев А.": "https://i.pravatar.cc/80?img=47",
  "Романова Л.": "https://i.pravatar.cc/80?img=5",
  "Журавлёв М.": "https://i.pravatar.cc/80?img=41",
  "Кузнецов Е.": "https://i.pravatar.cc/80?img=52",
  "Захарова И.": "https://i.pravatar.cc/80?img=58",
};

type WorkOrdersTableDataRowProps = {
  row: WorkOrderRow;
  index: number;
  isSelected: boolean;
  isArchiving: boolean;
  flashTargetId: string | null;
  flashNonce: number;
  rowRef: (el: HTMLTableRowElement | null) => void;
  onRowNavigate: () => void;
  onToggleSelect: () => void;
  onOpenActions: () => void;
  actionsModalOpenForThisRow: boolean;
  onFlashAnimationEnd: (e: AnimationEvent, rowId: string) => void;
};

function WorkOrdersTableDataRow({
  row,
  index,
  isSelected,
  isArchiving,
  flashTargetId,
  flashNonce,
  rowRef,
  onRowNavigate,
  onToggleSelect,
  onOpenActions,
  actionsModalOpenForThisRow,
  onFlashAnimationEnd,
}: WorkOrdersTableDataRowProps) {
  const isFlashTarget = flashTargetId === row.id;
  const highlightStyle = useMemo(
    () => (isFlashTarget ? { animation: "workRowHighlightBorder 4s ease-out" as const } : undefined),
    [isFlashTarget, flashNonce],
  );
  return (
    <tr
      ref={rowRef}
      onClick={onRowNavigate}
      className={`border-[5px] border-[#EEEDF0] transition [&_td]:align-middle ${
        isArchiving
          ? "pointer-events-none animate-[archiveRowOut_260ms_ease_forwards]"
          : ""
      } ${
        isSelected
          ? "bg-[rgba(224,9,25,0.10)]"
          : `${index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white"} hover:bg-[rgba(224,9,25,0.10)]`
      }`}
      style={highlightStyle}
      onAnimationEnd={(e) => onFlashAnimationEnd(e, row.id)}
    >
      <td className="px-3 py-3 @[1280px]:px-4" onClick={(e) => e.stopPropagation()}>
        <span
          className="inline-flex cursor-pointer select-none items-center justify-center"
          role="checkbox"
          aria-checked={isSelected}
          aria-label={`Выбрать заказ-наряд ${row.id}`}
          onClick={onToggleSelect}
        >
          {workOrdersCheckboxBox(isSelected)}
        </span>
      </td>
      <td className="px-3 py-3 text-[15px] leading-snug text-black @[1280px]:px-4 @[1280px]:text-[16px] @[1280px]:leading-normal">
        <span className="inline-flex items-center gap-1.5">
          {row.urgent ? <span aria-label="Срочный заказ-наряд">🔥</span> : null}
          <span>{row.id}</span>
        </span>
      </td>
      <td className="px-3 py-3 text-[15px] leading-snug text-black whitespace-normal break-words [overflow-wrap:anywhere] @[1280px]:px-4 @[1280px]:text-[16px] @[1280px]:leading-normal @[1280px]:whitespace-nowrap @[1280px]:break-normal">
        {row.client}
      </td>
      <td className="px-3 py-3 text-[15px] leading-snug text-black whitespace-normal break-words [overflow-wrap:anywhere] @[1280px]:px-4 @[1280px]:text-[16px] @[1280px]:leading-normal @[1280px]:whitespace-nowrap @[1280px]:break-normal">
        {row.car}
      </td>
      <td className="px-3 py-3 text-[15px] leading-normal text-black whitespace-normal break-all [overflow-wrap:anywhere] @[1280px]:px-4 @[1280px]:text-[16px] @[1280px]:whitespace-nowrap @[1280px]:break-normal">
        {row.plate}
      </td>
      <td className="px-3 py-3 font-medium @[1280px]:px-4">
        <span className="inline-flex max-w-full items-center gap-2 text-black">
          <span
            className="h-2.5 w-2.5 shrink-0 rounded-full"
            style={{ backgroundColor: workOrderStatusColorMap[row.status] }}
          />
          <span className="min-w-0 max-w-[12rem] truncate text-[15px] font-medium text-black @[1280px]:max-w-none @[1280px]:whitespace-nowrap @[1280px]:text-[16px]">
            {row.status}
          </span>
        </span>
      </td>
      <td className="px-3 py-3 text-[15px] text-black @[1280px]:px-4 @[1280px]:text-[16px]">
        <span className="inline-flex max-w-full items-center gap-1.5">
          <img
            src={row.masterPhoto}
            alt=""
            className="h-[18px] w-[18px] shrink-0 rounded-full object-cover ring-1 ring-black/10 @[1280px]:h-[1em] @[1280px]:w-[1em]"
          />
          <span className="min-w-0 max-w-[10rem] truncate @[1280px]:max-w-none">{row.master}</span>
        </span>
      </td>
      <td className="px-3 py-3 text-[15px] text-black @[1280px]:px-4 @[1280px]:text-[16px]">{row.dueDate}</td>
      <td className="px-3 py-3 text-[15px] text-black @[1280px]:px-4 @[1280px]:text-[16px]">{row.amount}</td>
      <td className="px-3 py-3 text-center text-[#A0A0A0] @[1280px]:px-4">
        <button
          type="button"
          className="cursor-pointer text-[#A0A0A0]"
          aria-label={`Действия для заказ-наряда ${row.id}`}
          aria-expanded={actionsModalOpenForThisRow}
          onClick={(e) => {
            e.stopPropagation();
            onOpenActions();
          }}
        >
          ...
        </button>
      </td>
    </tr>
  );
}

export function WorkOrdersPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const [flashHighlightWorkOrderId, setFlashHighlightWorkOrderId] = useState<string | null>(null);
  const [flashHighlightNonce, setFlashHighlightNonce] = useState(0);
  const [flashHighlightPage, setFlashHighlightPage] = useState<number | null>(null);
  const workOrderRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const [rows, setRows] = useState<WorkOrderRow[]>(() => {
    if (isWorkOrdersRemoteEnabled()) return [];
    if (typeof window !== "undefined") {
      try {
        const persistedRaw = window.localStorage.getItem(WORK_ORDERS_ROWS_PERSIST_KEY);
        if (persistedRaw) {
          const persistedParsed = JSON.parse(persistedRaw);
          if (Array.isArray(persistedParsed)) {
            return persistedParsed as WorkOrderRow[];
          }
        }
      } catch {
        // ignore broken persisted payload and fall back to defaults
      }
    }
    let overrides: Record<string, string> = {};
    if (typeof window !== "undefined") {
      const raw = window.localStorage.getItem(workOrderMasterOverrideStorageKey);
      if (raw) {
        try {
          overrides = JSON.parse(raw) as Record<string, string>;
        } catch {
          overrides = {};
        }
      }
    }
    return workOrderRows.map((r) => {
      const master = overrides[r.id] ?? r.master;
      return {
        ...r,
        master,
        masterPhoto: masterPhotoByName[master] ?? r.masterPhoto,
        urgent: false,
        archived: false,
      };
    });
  });
  /** Пока удалённый список не «дозрел», не считаем ?workOrder= несуществующим (иначе гонка: rows=[] сбрасывает query до fetch). */
  const [remoteWorkOrdersListSettled, setRemoteWorkOrdersListSettled] = useState(() => !isWorkOrdersRemoteEnabled());
  useEffect(() => {
    if (!isWorkOrdersRemoteEnabled()) return;
    let cancelled = false;
    async function loadWorkOrdersFromSupabase() {
      try {
        const data = await listWorkOrdersStorageRows();
        if (!cancelled && Array.isArray(data)) {
          setRows(data.map((item) => mapWorkOrderStorageToUi(item as WorkOrderStorageRow)));
        }
      } catch (error) {
        console.warn("Failed to load work orders from Supabase.", error);
      } finally {
        if (!cancelled) {
          setRemoteWorkOrdersListSettled(true);
        }
      }
    }
    void loadWorkOrdersFromSupabase();
    return () => {
      cancelled = true;
    };
  }, []);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [workOrderActionsModal, setWorkOrderActionsModal] = useState<WorkOrderRow | null>(null);
  const [switchMasterModalOpen, setSwitchMasterModalOpen] = useState(false);
  const [switchMasterSelection, setSwitchMasterSelection] = useState<string | null>(null);
  const [switchMasterTargetId, setSwitchMasterTargetId] = useState<string | null>(null);
  const [archivingRowId, setArchivingRowId] = useState<string | null>(null);
  const [workOrderStatusPickerIds, setWorkOrderStatusPickerIds] = useState<string[] | null>(null);
  const [editWorkOrderId, setEditWorkOrderId] = useState<string | null>(null);
  const [editWorkOrderDraft, setEditWorkOrderDraft] = useState<EditWorkOrderDraft | null>(null);
  const [openFilter, setOpenFilter] = useState<"status" | "master" | "dueDate" | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<WorkOrderRow["status"]>>(
    () => new Set(["Новый", "В работе", "Ожидание запчастей", "Готово", "Закрыт", "Отказ клиента"]),
  );
  const [masterFilter, setMasterFilter] = useState<Set<string>>(
    () => new Set([...new Set(workOrderRows.map((r) => r.master))]),
  );
  const [datePreset, setDatePreset] = useState<DateAcceptancePreset | null>(null);
  const [dateFromInput, setDateFromInput] = useState("");
  const [dateToInput, setDateToInput] = useState("");
  const [awaitingPaymentOnly, setAwaitingPaymentOnly] = useState(false);
  const [archiveOnly, setArchiveOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortState, setSortState] = useState<
    | { key: "id" | "status" | "client" | "car" | "plate" | "master" | "dueDate" | "amount"; dir: "asc" | "desc" }
    | null
  >(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(WORK_ORDERS_ROWS_PERSIST_KEY, JSON.stringify(rows));
    } catch {
      // ignore storage write errors
    }
  }, [rows]);
  const [createOrderModalOpen, setCreateOrderModalOpen] = useState(false);
  const [createOrderModalMounted, setCreateOrderModalMounted] = useState(false);
  const [createOrderModalActive, setCreateOrderModalActive] = useState(false);
  const [createOrderStep, setCreateOrderStep] = useState<1 | 2 | 3 | 4>(1);
  const [createOrderPhoneNational10, setCreateOrderPhoneNational10] = useState("");
  const [createOrderMode, setCreateOrderMode] = useState<"existing" | "new" | null>(null);
  const [createOrderExistingSurname, setCreateOrderExistingSurname] = useState("");
  const [createOrderExistingClient, setCreateOrderExistingClient] = useState<ClientDirectoryEntry | null>(null);
  const [createOrderExistingCar, setCreateOrderExistingCar] = useState<{ car: string; plate: string } | null>(null);
  const [createOrderNewClientName, setCreateOrderNewClientName] = useState("");
  const [createOrderNewClientPhoneNational10, setCreateOrderNewClientPhoneNational10] = useState("");
  const [createOrderNewClientCar, setCreateOrderNewClientCar] = useState("");
  const [createOrderNewClientPlate, setCreateOrderNewClientPlate] = useState("");
  const [createOrderCatalogQuery, setCreateOrderCatalogQuery] = useState("");
  const [createOrderWorkCategory, setCreateOrderWorkCategory] = useState(WORK_CATALOG_ALL_SECTION);
  const [createOrderSelectedWorks, setCreateOrderSelectedWorks] = useState<Set<string>>(() => new Set());
  const [createOrderSelectedMaster, setCreateOrderSelectedMaster] = useState<string | null>(null);
  const createOrderOpenRafRef = useRef<number | null>(null);
  const createOrderOpenTimerRef = useRef<number | null>(null);
  const [transferOrderModalOpen, setTransferOrderModalOpen] = useState(false);
  const [transferOrderModalMounted, setTransferOrderModalMounted] = useState(false);
  const [transferOrderModalActive, setTransferOrderModalActive] = useState(false);
  const [transferOrderStep, setTransferOrderStep] = useState<2 | 21 | 3>(2);
  const [transferOrderClientName, setTransferOrderClientName] = useState("");
  const [transferOrderClientPhone, setTransferOrderClientPhone] = useState("");
  const [transferOrderClientCar, setTransferOrderClientCar] = useState("");
  const [transferOrderClientPlate, setTransferOrderClientPlate] = useState("");
  const [transferOrderMissingField, setTransferOrderMissingField] = useState<"phone" | "car" | "plate" | null>(null);
  const [transferOrderCatalogQuery, setTransferOrderCatalogQuery] = useState("");
  const [transferOrderWorkCategory, setTransferOrderWorkCategory] = useState(WORK_CATALOG_ALL_SECTION);
  const [transferOrderSelectedWorks, setTransferOrderSelectedWorks] = useState<Set<string>>(() => new Set());
  const transferOrderOpenRafRef = useRef<number | null>(null);
  const transferOrderOpenTimerRef = useRef<number | null>(null);
  const skipTransferOrderResetOnceRef = useRef(false);
  const clientDirectory = useMemo<ClientDirectoryEntry[]>(() => {
    if (typeof window === "undefined") return clientDirectoryMock;
    type SharedCarsMap = Record<string, Array<{ car: string; plate: string }>>;
    let sharedByFio: SharedCarsMap = {};
    try {
      const raw = window.sessionStorage.getItem(CLIENT_CARS_SHARED_STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw) as SharedCarsMap;
        if (parsed && typeof parsed === "object") sharedByFio = parsed;
      }
    } catch {
      sharedByFio = {};
    }

    return clientDirectoryMock.map((entry) => {
      const fioKey = normalizeRuFio(entry.fullName);
      const sharedCars = Array.isArray(sharedByFio[fioKey]) ? sharedByFio[fioKey] : [];
      if (sharedCars.length === 0) return entry;
      const mergedCars = [...entry.cars];
      for (const shared of sharedCars) {
        const car = (shared?.car ?? "").trim();
        if (!car) continue;
        const exists = mergedCars.some((item) => item.car.trim().toLowerCase() === car.toLowerCase());
        if (exists) continue;
        mergedCars.push({ car, plate: (shared?.plate ?? "").trim() });
      }
      return { ...entry, cars: mergedCars };
    });
  }, [createOrderModalOpen, location.key]);

  function parseRuDate(s: string): Date | null {
    const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s.trim());
    if (!m) return null;
    const d = Number(m[1]);
    const mo = Number(m[2]) - 1;
    const y = Number(m[3]);
    const dt = new Date(y, mo, d);
    if (dt.getFullYear() !== y || dt.getMonth() !== mo || dt.getDate() !== d) return null;
    return dt;
  }

  const createOrderPhoneMatch = useMemo(() => {
    if (createOrderPhoneNational10.length !== 10) return null;
    return (
      clientDirectory.find((client) => national10FromPhoneInput(client.phone) === createOrderPhoneNational10) ?? null
    );
  }, [clientDirectory, createOrderPhoneNational10]);

  const createOrderSurnameCandidates = useMemo(() => {
    if (createOrderMode !== "existing") return [];
    const query = createOrderExistingSurname.trim().toLowerCase();
    if (!query) return [];
    return clientDirectory.filter((client) => client.fullName.toLowerCase().startsWith(query));
  }, [clientDirectory, createOrderMode, createOrderExistingSurname]);

  const createOrderCatalogItems = useMemo(() => {
    const q = createOrderCatalogQuery.trim().toLowerCase();
    return workCatalogMock.filter((item) => {
      if (createOrderWorkCategory !== WORK_CATALOG_ALL_SECTION && item.section !== createOrderWorkCategory) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q);
    });
  }, [createOrderCatalogQuery, createOrderWorkCategory]);

  const createOrderSelectedWorkItems = useMemo(
    () => workCatalogMock.filter((item) => createOrderSelectedWorks.has(item.title)),
    [createOrderSelectedWorks],
  );

  const createOrderTotalAmount = useMemo(
    () => createOrderSelectedWorkItems.reduce((sum, item) => sum + item.price, 0),
    [createOrderSelectedWorkItems],
  );

  const createOrderResolvedClient = useMemo(() => {
    if (createOrderPhoneMatch) {
      const carChoice = firstClientCar(createOrderPhoneMatch);
      return {
        fullName: createOrderPhoneMatch.fullName,
        phone: createOrderPhoneMatch.phone,
        car: carChoice.car,
        plate: carChoice.plate || "—",
      };
    }
    if (createOrderMode === "existing" && createOrderExistingClient && createOrderExistingCar) {
      return {
        fullName: createOrderExistingClient.fullName,
        phone: createOrderExistingClient.phone,
        car: createOrderExistingCar.car,
        plate: createOrderExistingCar.plate || "—",
      };
    }
    if (createOrderMode === "new") {
      return {
        fullName: createOrderNewClientName.trim(),
        phone: maskRuPhoneInput(createOrderNewClientPhoneNational10),
        car: createOrderNewClientCar.trim(),
        plate: createOrderNewClientPlate.trim() || "—",
      };
    }
    return null;
  }, [
    createOrderPhoneMatch,
    createOrderMode,
    createOrderExistingClient,
    createOrderExistingCar,
    createOrderNewClientName,
    createOrderNewClientPhoneNational10,
    createOrderNewClientCar,
    createOrderNewClientPlate,
  ]);
  const createOrderClientNameLines = useMemo(
    () => splitClientNameForProfileLikeDisplay(createOrderResolvedClient?.fullName ?? ""),
    [createOrderResolvedClient?.fullName],
  );
  const transferOrderClientNameLines = useMemo(
    () => splitClientNameForProfileLikeDisplay(transferOrderClientName),
    [transferOrderClientName],
  );

  const canGoToCreateOrderStep2 = useMemo(() => {
    if (createOrderPhoneMatch) return true;
    if (createOrderMode === "existing") return Boolean(createOrderExistingClient && createOrderExistingCar);
    if (createOrderMode === "new") {
      return Boolean(
        createOrderNewClientName.trim() &&
          createOrderNewClientPhoneNational10.length === 10 &&
          createOrderNewClientCar.trim() &&
          createOrderNewClientPlate.trim(),
      );
    }
    return false;
  }, [
    createOrderPhoneMatch,
    createOrderMode,
    createOrderExistingClient,
    createOrderExistingCar,
    createOrderNewClientName,
    createOrderNewClientPhoneNational10,
    createOrderNewClientCar,
    createOrderNewClientPlate,
  ]);
  const transferOrderCatalogItems = useMemo(() => {
    const q = transferOrderCatalogQuery.trim().toLowerCase();
    return workCatalogMock.filter((item) => {
      if (transferOrderWorkCategory !== WORK_CATALOG_ALL_SECTION && item.section !== transferOrderWorkCategory) return false;
      if (!q) return true;
      return item.title.toLowerCase().includes(q);
    });
  }, [transferOrderCatalogQuery, transferOrderWorkCategory]);
  const transferOrderSelectedWorkItems = useMemo(
    () => workCatalogMock.filter((item) => transferOrderSelectedWorks.has(item.title)),
    [transferOrderSelectedWorks],
  );
  const transferOrderTotalAmount = useMemo(
    () => transferOrderSelectedWorkItems.reduce((sum, item) => sum + item.price, 0),
    [transferOrderSelectedWorkItems],
  );
  const createOrderMasterOptions = useMemo(() => {
    const fromRows = rows.map((row) => row.master).filter(Boolean);
    const all = [...new Set([...fromRows, ...Object.keys(masterPhotoByName)])];
    return all.sort((a, b) => a.localeCompare(b, "ru"));
  }, [rows]);
  function resetCreateOrderModalState() {
    setCreateOrderStep(1);
    setCreateOrderPhoneNational10("");
    setCreateOrderMode(null);
    setCreateOrderExistingSurname("");
    setCreateOrderExistingClient(null);
    setCreateOrderExistingCar(null);
    setCreateOrderNewClientName("");
    setCreateOrderNewClientPhoneNational10("");
    setCreateOrderNewClientCar("");
    setCreateOrderNewClientPlate("");
    setCreateOrderCatalogQuery("");
    setCreateOrderWorkCategory(WORK_CATALOG_ALL_SECTION);
    setCreateOrderSelectedWorks(new Set());
    setCreateOrderSelectedMaster(null);
  }

  function closeCreateOrderModal() {
    setCreateOrderModalOpen(false);
  }

  function resetTransferOrderModalState() {
    setTransferOrderStep(2);
    setTransferOrderClientName("");
    setTransferOrderClientPhone("");
    setTransferOrderClientCar("");
    setTransferOrderClientPlate("");
    setTransferOrderMissingField(null);
    setTransferOrderCatalogQuery("");
    setTransferOrderWorkCategory(WORK_CATALOG_ALL_SECTION);
    setTransferOrderSelectedWorks(new Set());
  }

  function closeTransferOrderModal() {
    setTransferOrderModalOpen(false);
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(TRANSFER_TO_WORK_ORDER_DRAFT_KEY);
    }
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("newWorkOrderFromBooking");
        next.delete("transferToken");
        next.delete("client");
        next.delete("phone");
        next.delete("car");
        next.delete("plate");
        return next;
      },
      { replace: true },
    );
  }

  function commitCreatedWorkOrder() {
    if (!createOrderResolvedClient) return;
    if (createOrderSelectedWorkItems.length === 0) return;
    const maxNumericId = rows.reduce((max, row) => {
      const current = Number(row.id);
      if (!Number.isFinite(current)) return max;
      return current > max ? current : max;
    }, 0);
    const newId = String(maxNumericId + 1).padStart(6, "0");
    const primaryMaster = createOrderSelectedMaster ?? rows[0]?.master ?? "Алексеев Д.";
    const newRow: WorkOrderRow = {
      id: newId,
      client: createOrderResolvedClient.fullName,
      car: createOrderResolvedClient.car,
      plate: createOrderResolvedClient.plate || "—",
      master: primaryMaster,
      masterPhoto: masterPhotoByName[primaryMaster] ?? "https://i.pravatar.cc/80",
      status: "Новый",
      amount: formatRub(createOrderTotalAmount),
      dueDate: formatRuDateFromDate(new Date()),
      urgent: false,
      archived: false,
    };
    if (isWorkOrdersRemoteEnabled()) {
      void (async () => {
        try {
          const payload = mapUiWorkOrderToStorage(newRow);
          const data = await insertWorkOrderStorageRow(payload);
          if (data) {
            setRows((prev) => [mapWorkOrderStorageToUi(data as WorkOrderStorageRow), ...prev]);
          } else {
            setRows((prev) => [newRow, ...prev]);
          }
          setCurrentPage(1);
          setSelectedRowIds(new Set());
          closeCreateOrderModal();
          window.setTimeout(() => {
            emitArchiveStyleToast({
              line1: `Заказ-наряд № ${newId}`,
              line2: "успешно создан",
              navigateTo: `/work-orders/${newId}`,
            });
          }, 60);
        } catch (error) {
          console.warn("Failed to create work order in Supabase.", error);
          emitArchiveStyleToast({
            line1: "Не удалось создать заказ-наряд",
            line2: "Проверьте подключение к базе и policy insert",
          });
        }
      })();
      return;
    }
    setRows((prev) => [newRow, ...prev]);
    setCurrentPage(1);
    setSelectedRowIds(new Set());
    closeCreateOrderModal();
    window.setTimeout(() => {
      emitArchiveStyleToast({
        line1: `Заказ-наряд № ${newId}`,
        line2: "успешно создан",
        navigateTo: `/work-orders/${newId}`,
      });
    }, 60);
  }

  function commitTransferredWorkOrder() {
    if (!transferOrderClientName.trim()) return;
    if (!transferOrderClientPhone.trim()) return;
    if (transferOrderSelectedWorkItems.length === 0) return;
    const maxNumericId = rows.reduce((max, row) => {
      const current = Number(row.id);
      if (!Number.isFinite(current)) return max;
      return current > max ? current : max;
    }, 0);
    const newId = String(maxNumericId + 1).padStart(6, "0");
    const primaryMaster = rows[0]?.master ?? "Алексеев Д.";
    const newRow: WorkOrderRow = {
      id: newId,
      client: transferOrderClientName.trim(),
      car: transferOrderClientCar.trim() || "—",
      plate: transferOrderClientPlate.trim() || "—",
      master: primaryMaster,
      masterPhoto: masterPhotoByName[primaryMaster] ?? "https://i.pravatar.cc/80",
      status: "Новый",
      amount: formatRub(transferOrderTotalAmount),
      dueDate: formatRuDateFromDate(new Date()),
      urgent: false,
      archived: false,
    };
    if (isWorkOrdersRemoteEnabled()) {
      void (async () => {
        try {
          const payload = mapUiWorkOrderToStorage(newRow);
          const data = await insertWorkOrderStorageRow(payload);
          if (data) {
            setRows((prev) => [mapWorkOrderStorageToUi(data as WorkOrderStorageRow), ...prev]);
          } else {
            setRows((prev) => [newRow, ...prev]);
          }
          setCurrentPage(1);
          setSelectedRowIds(new Set());
          closeTransferOrderModal();
          window.setTimeout(() => {
            emitArchiveStyleToast({
              line1: `Заказ-наряд № ${newId}`,
              line2: "успешно создан",
              navigateTo: `/work-orders/${newId}`,
            });
          }, 60);
        } catch (error) {
          console.warn("Failed to create transferred work order in Supabase.", error);
          emitArchiveStyleToast({
            line1: "Не удалось создать заказ-наряд",
            line2: "Проверьте подключение к базе и policy insert",
          });
        }
      })();
      return;
    }
    setRows((prev) => [newRow, ...prev]);
    setCurrentPage(1);
    setSelectedRowIds(new Set());
    closeTransferOrderModal();
    window.setTimeout(() => {
      emitArchiveStyleToast({
        line1: `Заказ-наряд № ${newId}`,
        line2: "успешно создан",
        navigateTo: `/work-orders/${newId}`,
      });
    }, 60);
  }

  useEffect(() => {
    if (!workOrderActionsModal) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setWorkOrderActionsModal(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [workOrderActionsModal]);

  useEffect(() => {
    if (!editWorkOrderId) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setEditWorkOrderId(null);
        setEditWorkOrderDraft(null);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editWorkOrderId]);

  useEffect(() => {
    const transferState = (location.state as { transferToWorkOrder?: { client?: string; phone?: string; car?: string; plate?: string; token?: string } } | null)?.transferToWorkOrder;
    let storageClient = "";
    let storagePhone = "";
    let storageCar = "";
    let storagePlate = "";
    if (typeof window !== "undefined") {
      const raw = window.sessionStorage.getItem(TRANSFER_TO_WORK_ORDER_DRAFT_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as { client?: string; phone?: string; car?: string; plate?: string; token?: string };
          storageClient = (parsed.client ?? "").trim();
          storagePhone = (parsed.phone ?? "").trim();
          storageCar = (parsed.car ?? "").trim();
          storagePlate = (parsed.plate ?? "").trim();
        } catch {
          storageClient = "";
          storagePhone = "";
          storageCar = "";
          storagePlate = "";
        }
      }
    }
    const stateClient = (transferState?.client ?? "").trim();
    const statePhone = (transferState?.phone ?? "").trim();
    const stateCar = normalizeTransferredText(transferState?.car ?? "");
    const statePlate = normalizeTransferredText(transferState?.plate ?? "");
    const queryClient = (searchParams.get("client") ?? "").trim();
    const queryPhone = (searchParams.get("phone") ?? "").trim();
    const queryCar = normalizeTransferredText(searchParams.get("car") ?? "");
    const queryPlate = normalizeTransferredText(searchParams.get("plate") ?? "");
    const client = stateClient || queryClient || storageClient;
    const phone = statePhone || queryPhone || storagePhone;
    const car = stateCar || queryCar || normalizeTransferredText(storageCar);
    const plate = statePlate || queryPlate || normalizeTransferredText(storagePlate);
    if (searchParams.get("newWorkOrderFromBooking") !== "1" && !client) return;
    if (!client) return;
    const directoryClient =
      clientDirectory.find((entry) => entry.fullName.trim().toLowerCase() === client.trim().toLowerCase()) ?? null;
    const directoryFirstCar = firstClientCar(directoryClient);
    const resolvedPhone = phone || directoryClient?.phone || "";
    const resolvedCar = car || directoryFirstCar.car || "";
    const resolvedPlate = plate || directoryFirstCar.plate || "";
    skipTransferOrderResetOnceRef.current = true;
    setTransferOrderStep(2);
    setTransferOrderClientName(client);
    setTransferOrderClientPhone(resolvedPhone);
    setTransferOrderClientCar(resolvedCar);
    setTransferOrderClientPlate(resolvedPlate);
    setTransferOrderMissingField(null);
    setTransferOrderCatalogQuery("");
    setTransferOrderWorkCategory(WORK_CATALOG_ALL_SECTION);
    setTransferOrderSelectedWorks(new Set());
    setTransferOrderModalOpen(true);

    if (transferState) {
      navigate(location.pathname + location.search, { replace: true, state: null });
    }
  }, [clientDirectory, location.pathname, location.search, location.state, navigate, searchParams, setSearchParams]);

  useEffect(() => {
    if (createOrderModalOpen) {
      setCreateOrderModalMounted(true);
      setCreateOrderModalActive(false);
      const raf = window.requestAnimationFrame(() => {
        createOrderOpenRafRef.current = window.requestAnimationFrame(() => {
          createOrderOpenTimerRef.current = window.setTimeout(() => setCreateOrderModalActive(true), 90);
        });
      });
      createOrderOpenRafRef.current = raf;
      return () => {
        if (createOrderOpenRafRef.current !== null) {
          window.cancelAnimationFrame(createOrderOpenRafRef.current);
          createOrderOpenRafRef.current = null;
        }
        if (createOrderOpenTimerRef.current !== null) {
          window.clearTimeout(createOrderOpenTimerRef.current);
          createOrderOpenTimerRef.current = null;
        }
      };
    }
    setCreateOrderModalActive(false);
    return;
  }, [createOrderModalOpen]);

  useEffect(() => {
    if (createOrderMode !== "existing") {
      setCreateOrderExistingClient(null);
      setCreateOrderExistingCar(null);
    }
  }, [createOrderMode]);

  useEffect(() => {
    if (createOrderModalOpen) return;
    if (createOrderModalMounted || createOrderModalActive) return;
    resetCreateOrderModalState();
  }, [createOrderModalOpen, createOrderModalMounted, createOrderModalActive]);

  useEffect(() => {
    if (transferOrderModalOpen) {
      setTransferOrderModalMounted(true);
      setTransferOrderModalActive(false);
      const raf = window.requestAnimationFrame(() => {
        transferOrderOpenRafRef.current = window.requestAnimationFrame(() => {
          transferOrderOpenTimerRef.current = window.setTimeout(() => setTransferOrderModalActive(true), 90);
        });
      });
      transferOrderOpenRafRef.current = raf;
      return () => {
        if (transferOrderOpenRafRef.current !== null) {
          window.cancelAnimationFrame(transferOrderOpenRafRef.current);
          transferOrderOpenRafRef.current = null;
        }
        if (transferOrderOpenTimerRef.current !== null) {
          window.clearTimeout(transferOrderOpenTimerRef.current);
          transferOrderOpenTimerRef.current = null;
        }
      };
    }
    setTransferOrderModalActive(false);
    return;
  }, [transferOrderModalOpen]);

  useEffect(() => {
    if (transferOrderModalOpen) return;
    if (transferOrderModalMounted || transferOrderModalActive) return;
    if (skipTransferOrderResetOnceRef.current) {
      skipTransferOrderResetOnceRef.current = false;
      return;
    }
    resetTransferOrderModalState();
  }, [transferOrderModalOpen, transferOrderModalMounted, transferOrderModalActive]);

  const PAGE_SIZE = 12;

  const displayRows = useMemo(() => {
    const qText = searchQuery.trim().toLowerCase();
    const qDigits = searchQuery.replace(/\D/g, "");
    const fromD = parseRuDate(dateFromInput);
    const toD = parseRuDate(dateToInput);
    const fromBound = fromD ? new Date(fromD.getFullYear(), fromD.getMonth(), fromD.getDate()) : null;
    const toBound = toD ? new Date(toD.getFullYear(), toD.getMonth(), toD.getDate(), 23, 59, 59, 999) : null;

    return rows.filter((row) => {
      if (qText) {
        const byClient = row.client.toLowerCase().includes(qText);
        const byId = qDigits.length > 0 && row.id.includes(qDigits);
        if (!byClient && !byId) return false;
      }
      if (archiveOnly) {
        if (!row.archived) return false;
      } else if (row.archived) {
        return false;
      }
      if (awaitingPaymentOnly && row.status !== "Готово") return false;
      if (!statusFilter.has(row.status)) return false;
      if (!masterFilter.has(row.master)) return false;
      const rowDate = parseRuDate(row.dueDate);
      if (fromBound && (!rowDate || rowDate < fromBound)) return false;
      if (toBound && (!rowDate || rowDate > toBound)) return false;
      return true;
    });
  }, [rows, searchQuery, awaitingPaymentOnly, archiveOnly, statusFilter, masterFilter, dateFromInput, dateToInput]);

  const sortedRows = useMemo(() => {
    if (!sortState) return displayRows;
    const factor = sortState.dir === "asc" ? 1 : -1;
    const arr = [...displayRows];
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortState.key === "id") cmp = a.id.localeCompare(b.id);
      else if (sortState.key === "status") cmp = a.status.localeCompare(b.status, "ru");
      else if (sortState.key === "client") cmp = a.client.localeCompare(b.client, "ru");
      else if (sortState.key === "car") cmp = a.car.localeCompare(b.car, "ru");
      else if (sortState.key === "plate") cmp = a.plate.localeCompare(b.plate, "ru");
      else if (sortState.key === "master") cmp = a.master.localeCompare(b.master, "ru");
      else if (sortState.key === "dueDate") cmp = (parseRuDate(a.dueDate)?.getTime() ?? 0) - (parseRuDate(b.dueDate)?.getTime() ?? 0);
      else cmp = Number(a.amount.replace(/[^\d]/g, "")) - Number(b.amount.replace(/[^\d]/g, ""));
      if (cmp === 0) return a.id.localeCompare(b.id);
      return cmp * factor;
    });
    return arr;
  }, [displayRows, sortState]);

  const sortedRowsRef = useRef(sortedRows);
  sortedRowsRef.current = sortedRows;

  const workOrdersCount = rows.length;

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / PAGE_SIZE));
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageStart = (currentPageSafe - 1) * PAGE_SIZE;
  const pagedRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE);
  const pageEnd = Math.min(pageStart + pagedRows.length, sortedRows.length);
  const paginationItems: Array<number | "ellipsis"> =
    totalPages <= 5
      ? Array.from({ length: totalPages }, (_, idx) => idx + 1)
      : [1, 2, 3, "ellipsis", totalPages];
  const paginationActiveIndex = Math.max(
    0,
    paginationItems.findIndex((item) => item === currentPageSafe),
  );
  const allPageRowsSelected = pagedRows.length > 0 && pagedRows.every((r) => selectedRowIds.has(r.id));
  const awaitingPaymentCount = rows.filter((r) => r.status === "Готово" && (archiveOnly ? Boolean(r.archived) : !Boolean(r.archived))).length;
  const archiveCount = rows.filter((r) => Boolean(r.archived)).length;

  const currentPageRef = useRef(currentPage);
  currentPageRef.current = currentPage;
  const focusWorkOrderFiltersResetFor = useRef<string | null>(null);
  const focusWorkOrderScrollKey = useRef<string>("");

  useLayoutEffect(() => {
    const wid = searchParams.get("workOrder");
    if (!wid) {
      focusWorkOrderFiltersResetFor.current = null;
      return;
    }
    const targetArchiveMode = searchParams.get("archive") === "1";
    if (!rows.some((r) => r.id === wid)) {
      if (isWorkOrdersRemoteEnabled() && !remoteWorkOrdersListSettled) {
        return;
      }
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("workOrder");
          next.delete("archive");
          return next;
        },
        { replace: true },
      );
      focusWorkOrderFiltersResetFor.current = null;
      return;
    }
    if (focusWorkOrderFiltersResetFor.current === wid) return;
    focusWorkOrderFiltersResetFor.current = wid;

    setSearchQuery("");
    setAwaitingPaymentOnly(false);
    setArchiveOnly(targetArchiveMode);
    setOpenFilter(null);
    setSelectedRowIds(new Set());
    setSortState(null);
    setDatePreset(null);
    setDateFromInput("");
    setDateToInput("");
    setStatusFilter(new Set(["Новый", "В работе", "Ожидание запчастей", "Готово", "Закрыт", "Отказ клиента"]));
    setMasterFilter(new Set([...new Set(rows.map((r) => r.master))]));
  }, [searchParams, rows, setSearchParams, remoteWorkOrdersListSettled]);

  useLayoutEffect(() => {
    const wid = searchParams.get("workOrder");
    if (!wid) {
      focusWorkOrderScrollKey.current = "";
      return;
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(WORK_ORDER_LIST_FLASH_ARMED_KEY);
    }
    const idx = sortedRows.findIndex((r) => r.id === wid);
    if (idx === -1) return;
    const scrollKey = `${wid}@${idx}`;
    if (focusWorkOrderScrollKey.current === scrollKey) return;
    focusWorkOrderScrollKey.current = scrollKey;
    const targetPage = Math.floor(idx / PAGE_SIZE) + 1;
    setFlashHighlightWorkOrderId(wid);
    setFlashHighlightPage(targetPage);
    setFlashHighlightNonce((n) => n + 1);
    setCurrentPage(targetPage);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("workOrder");
        next.delete("archive");
        return next;
      },
      { replace: true },
    );
    const clearFlashTid = window.setTimeout(() => {
      setFlashHighlightWorkOrderId((prev) => (prev === wid ? null : prev));
      setFlashHighlightPage((prev) => (prev === targetPage ? null : prev));
    }, 4200);
    const clearRefsTid = window.setTimeout(() => {
      focusWorkOrderScrollKey.current = "";
      focusWorkOrderFiltersResetFor.current = null;
    }, 1200);
    return () => {
      window.clearTimeout(clearFlashTid);
      window.clearTimeout(clearRefsTid);
    };
  }, [searchParams, sortedRows, setSearchParams]);

  function onWorkOrderFlashAnimationEnd(e: AnimationEvent, rowId: string) {
    if (e.animationName !== "workRowHighlightBorder") return;
    setFlashHighlightWorkOrderId((cur) => (cur === rowId ? null : cur));
  }

  function handleCreateOrderDrawerTransitionEnd() {
    if (createOrderModalOpen) return;
    if (createOrderModalActive) return;
    setCreateOrderModalMounted(false);
  }

  function handleTransferOrderDrawerTransitionEnd() {
    if (transferOrderModalOpen) return;
    if (transferOrderModalActive) return;
    setTransferOrderModalMounted(false);
  }

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    if (!switchMasterModalOpen) {
      setSwitchMasterSelection(null);
      setSwitchMasterTargetId(null);
    }
  }, [switchMasterModalOpen]);

  useEffect(() => {
    if (!flashHighlightWorkOrderId || flashHighlightPage === null) return;
    if (currentPage !== flashHighlightPage) {
      setFlashHighlightWorkOrderId(null);
      setFlashHighlightPage(null);
    }
  }, [currentPage, flashHighlightWorkOrderId, flashHighlightPage]);

  function clearWorkOrderFlashState() {
    setFlashHighlightWorkOrderId(null);
    setFlashHighlightPage(null);
  }

  function toggleSort(key: "id" | "status" | "client" | "car" | "plate" | "master" | "dueDate" | "amount") {
    setSortState((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" as const };
      if (prev.dir === "asc") return { key, dir: "desc" as const };
      return null;
    });
  }

  function toggleRowSelection(id: string) {
    setSelectedRowIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAllOnPage() {
    setSelectedRowIds((prev) => {
      if (pagedRows.length === 0) return prev;
      const all = pagedRows.every((r) => prev.has(r.id));
      if (all) {
        const next = new Set(prev);
        pagedRows.forEach((r) => next.delete(r.id));
        return next;
      }
      const next = new Set(prev);
      pagedRows.forEach((r) => next.add(r.id));
      return next;
    });
  }

  function resetFilters() {
    clearWorkOrderFlashState();
    setSearchQuery("");
    setAwaitingPaymentOnly(false);
    setArchiveOnly(false);
    setSelectedRowIds(new Set());
    setOpenFilter(null);
    setStatusFilter(new Set(["Новый", "В работе", "Ожидание запчастей", "Готово", "Закрыт", "Отказ клиента"]));
    setMasterFilter(new Set([...new Set(workOrderRows.map((r) => r.master))]));
    setDatePreset(null);
    setDateFromInput("");
    setDateToInput("");
  }

  function applyPresetToDateInputs(preset: Exclude<DateAcceptancePreset, "custom">) {
    const now = new Date();
    const end = formatRuDateFromDate(now);
    if (preset === "today") {
      setDateFromInput(end);
      setDateToInput(end);
    } else if (preset === "yesterday") {
      const d = new Date(now);
      d.setDate(d.getDate() - 1);
      const day = formatRuDateFromDate(d);
      setDateFromInput(day);
      setDateToInput(day);
    } else if (preset === "last7") {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      setDateFromInput(formatRuDateFromDate(d));
      setDateToInput(end);
    } else {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      setDateFromInput(formatRuDateFromDate(d));
      setDateToInput(end);
    }
    setDatePreset(preset);
  }

  function filterChipActive(id: "status" | "master" | "dueDate"): boolean {
    if (openFilter === id) return true;
    if (id === "dueDate" && (datePreset !== null || dateFromInput.trim() !== "" || dateToInput.trim() !== "")) return true;
    return false;
  }

  const panelBase = "absolute left-0 top-full z-30 mt-2 min-w-[240px] rounded-[10px] border border-[#DDE1E7] bg-white p-3 shadow-lg";

  const workOrderModalActions: WorkOrderActionEntry[] = useMemo(() => {
    if (!workOrderActionsModal) return [];
    const current = rows.find((r) => r.id === workOrderActionsModal.id) ?? workOrderActionsModal;
    const isArchivedContext = Boolean(current.archived) || archiveOnly;
    if (selectedRowIds.size > 1) {
      return [
        { id: "status", label: "Изменить статус" },
        { id: "urgent", label: "Сделать срочным" },
        isArchivedContext
          ? { id: "archive", label: "Вернуть в таблицу" }
          : { id: "archive", label: "Переместить в архив", danger: true },
      ];
    }
    return [
      { id: "open", label: "Открыть заказ-наряд" },
      { id: "callClient", label: "Позвонить клиенту" },
      { id: "status", label: "Изменить статус" },
      { id: "switchMaster", label: "Сменить мастера" },
      { id: "urgent", label: current.urgent ? "Убрать срочность" : "Сделать срочным" },
      { id: "edit", label: "Редактировать" },
      isArchivedContext
        ? { id: "archive", label: "Вернуть в таблицу" }
        : { id: "archive", label: "Переместить в архив", danger: true },
    ];
  }, [workOrderActionsModal, rows, selectedRowIds, archiveOnly]);

  function actionIconById(actionId: WorkOrderActionId, danger?: boolean) {
    const tone = danger ? "text-[#EC1C24]" : "text-[#4B5563]";
    if (actionId === "open") return <WorkOrderActionIconOpen className={tone} />;
    if (actionId === "callClient") return <WorkOrderActionIconCall className={tone} />;
    if (actionId === "status") return <WorkOrderActionIconStatus className={tone} />;
    if (actionId === "switchMaster") return <WorkOrderActionIconSwitchMaster className={tone} />;
    if (actionId === "urgent") return <WorkOrderActionIconUrgent className={tone} />;
    if (actionId === "edit") return <WorkOrderActionIconEdit className={tone} />;
    return <WorkOrderActionIconArchive className={tone} />;
  }

  async function handleWorkOrderModalAction(actionId: WorkOrderActionId) {
    if (!workOrderActionsModal) return;
    const isBulkAction = selectedRowIds.size > 1;
    const targetIds = isBulkAction ? Array.from(selectedRowIds) : [workOrderActionsModal.id];
    if (actionId === "open") {
      navigate(`/work-orders/${workOrderActionsModal.id}`);
      setWorkOrderActionsModal(null);
      return;
    }
    if (actionId === "callClient") {
      const normalizedRowClient = normalizeRuFio(workOrderActionsModal.client);
      const clientPhone =
        clientDirectory.find((entry) => normalizeRuFio(entry.fullName) === normalizedRowClient)?.phone ??
        "";
      const digits = clientPhone.replace(/\D/g, "");
      if (digits.length < 10) {
        emitArchiveStyleToast({
          line1: "Нет номера для звонка",
          line2: "У этого клиента номер не найден",
        });
        setWorkOrderActionsModal(null);
        return;
      }
      const callLink = document.createElement("a");
      callLink.href = toTelHref(clientPhone);
      document.body.appendChild(callLink);
      callLink.click();
      document.body.removeChild(callLink);
      setWorkOrderActionsModal(null);
      return;
    }
    if (actionId === "status") {
      setWorkOrderStatusPickerIds(targetIds);
      setWorkOrderActionsModal(null);
      return;
    }
    if (actionId === "switchMaster") {
      const current = rows.find((row) => row.id === workOrderActionsModal.id) ?? workOrderActionsModal;
      setSwitchMasterSelection(current.master);
      setSwitchMasterTargetId(current.id);
      setSwitchMasterModalOpen(true);
      setWorkOrderActionsModal(null);
      return;
    }
    if (actionId === "urgent") {
      if (isWorkOrdersRemoteEnabled()) {
        try {
          if (isBulkAction) {
            await updateWorkOrdersStorageRows(targetIds, { urgent: true });
          } else {
            const currentRow = rows.find((row) => row.id === workOrderActionsModal.id) ?? workOrderActionsModal;
            const nextUrgent = !Boolean(currentRow.urgent);
            await updateWorkOrdersStorageRows([currentRow.id], { urgent: nextUrgent });
          }
        } catch (error) {
          console.warn("Failed to update urgent flag in Supabase.", error);
          emitArchiveStyleToast({
            line1: "Не удалось изменить срочность",
            line2: "Проверьте подключение к базе и policy update",
          });
          setWorkOrderActionsModal(null);
          return;
        }
      }
      if (isBulkAction) {
        setRows((prev) => prev.map((row) => (targetIds.includes(row.id) ? { ...row, urgent: true } : row)));
      } else {
        setRows((prev) =>
          prev.map((row) =>
            row.id === workOrderActionsModal.id ? { ...row, urgent: !row.urgent } : row,
          ),
        );
      }
    }
    if (actionId === "archive") {
      const isRestoreAction = archiveOnly || targetIds.every((id) => Boolean((rows.find((r) => r.id === id) ?? workOrderActionsModal)?.archived));
      if (isWorkOrdersRemoteEnabled()) {
        try {
          await updateWorkOrdersStorageRows(targetIds, { archived: isRestoreAction ? false : true });
        } catch (error) {
          console.warn("Failed to update work orders archive flag in Supabase.", error);
          emitArchiveStyleToast({
            line1: isRestoreAction ? "Не удалось вернуть в таблицу" : "Не удалось переместить в архив",
            line2: "Проверьте подключение к базе и policy update",
          });
          setWorkOrderActionsModal(null);
          return;
        }
      }
      if (isRestoreAction) {
        if (isBulkAction) {
          setRows((prev) => prev.map((row) => (targetIds.includes(row.id) ? { ...row, archived: false } : row)));
          setSelectedRowIds(new Set());
          emitArchiveStyleToast({
            line1: `${targetIds.length} заказ-нарядов`,
            line2: "возвращены в таблицу",
          });
        } else {
          const restoredRowId = workOrderActionsModal.id;
          const restoredClient = workOrderActionsModal.client;
          setArchivingRowId(restoredRowId);
          window.setTimeout(() => {
            setRows((prev) =>
              prev.map((row) =>
                row.id === restoredRowId ? { ...row, archived: false } : row,
              ),
            );
            setSelectedRowIds((prev) => {
              const next = new Set(prev);
              next.delete(restoredRowId);
              return next;
            });
            setArchivingRowId((current) => (current === restoredRowId ? null : current));
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(WORK_ORDER_LIST_FLASH_ARMED_KEY, restoredRowId);
            }
            emitArchiveStyleToast({
              line1: `Заказ-наряд № ${restoredRowId} (${restoredClient})`,
              line2: "возвращен в таблицу",
              navigateTo: `/work-orders?workOrder=${encodeURIComponent(restoredRowId)}`,
            });
          }, 260);
        }
      } else if (isBulkAction) {
        setRows((prev) => prev.map((row) => (targetIds.includes(row.id) ? { ...row, archived: true } : row)));
        setSelectedRowIds(new Set());
        emitArchiveStyleToast({
          line1: `${targetIds.length} заказ-нарядов`,
          line2: "перемещены в архив",
        });
      } else {
        const archivedRowId = workOrderActionsModal.id;
        const archivedClient = workOrderActionsModal.client;
        setArchivingRowId(archivedRowId);
        window.setTimeout(() => {
          setRows((prev) =>
            prev.map((row) =>
              row.id === archivedRowId ? { ...row, archived: true } : row,
            ),
          );
          setSelectedRowIds((prev) => {
            const next = new Set(prev);
            next.delete(archivedRowId);
            return next;
          });
          setArchivingRowId((current) => (current === archivedRowId ? null : current));
            if (typeof window !== "undefined") {
              window.sessionStorage.setItem(WORK_ORDER_LIST_FLASH_ARMED_KEY, archivedRowId);
            }
          emitArchiveStyleToast({
            line1: `Заказ-наряд № ${archivedRowId} (${archivedClient})`,
            line2: "перемещен в архив",
              navigateTo: `/work-orders?workOrder=${encodeURIComponent(archivedRowId)}&archive=1`,
          });
        }, 260);
      }
    }
    if (actionId === "edit") {
      const rowToEdit = rows.find((row) => row.id === workOrderActionsModal.id) ?? workOrderActionsModal;
      setEditWorkOrderId(rowToEdit.id);
      setEditWorkOrderDraft({
        client: rowToEdit.client,
        car: rowToEdit.car,
        plate: rowToEdit.plate,
      });
    }
    setWorkOrderActionsModal(null);
  }

  async function commitWorkOrderStatus(status: WorkOrderRow["status"]) {
    if (!workOrderStatusPickerIds || workOrderStatusPickerIds.length === 0) return;
    const ids = new Set(workOrderStatusPickerIds);
    if (isWorkOrdersRemoteEnabled()) {
      try {
        await updateWorkOrdersStorageRows(Array.from(ids), { status });
      } catch (error) {
        console.warn("Failed to update work order status in Supabase.", error);
        emitArchiveStyleToast({
          line1: "Не удалось изменить статус",
          line2: "Проверьте подключение к базе и policy update",
        });
        setWorkOrderStatusPickerIds(null);
        return;
      }
    }
    setRows((prev) => prev.map((row) => (ids.has(row.id) ? { ...row, status } : row)));
    setWorkOrderStatusPickerIds(null);
  }

  async function commitWorkOrderEdit() {
    if (!editWorkOrderId || !editWorkOrderDraft) return;
    const targetId = editWorkOrderId;
    const nextClient = editWorkOrderDraft.client.trim();
    const nextCar = editWorkOrderDraft.car.trim();
    const nextPlate = editWorkOrderDraft.plate.trim();
    if (isWorkOrdersRemoteEnabled()) {
      try {
        const current = rows.find((row) => row.id === targetId);
        await updateWorkOrdersStorageRows([targetId], {
          client: nextClient || current?.client || "",
          car: nextCar || current?.car || "",
          plate: nextPlate || current?.plate || "",
        });
      } catch (error) {
        console.warn("Failed to edit work order in Supabase.", error);
        emitArchiveStyleToast({
          line1: "Не удалось сохранить изменения",
          line2: "Проверьте подключение к базе и policy update",
        });
        setEditWorkOrderId(null);
        setEditWorkOrderDraft(null);
        return;
      }
    }
    setRows((prev) =>
      prev.map((row) =>
        row.id === targetId
          ? {
              ...row,
              client: nextClient || row.client,
              car: nextCar || row.car,
              plate: nextPlate || row.plate,
            }
          : row,
      ),
    );
    setEditWorkOrderId(null);
    setEditWorkOrderDraft(null);
  }

  const noActiveFilters = !searchQuery.trim() && !awaitingPaymentOnly && !archiveOnly && !dateFromInput.trim() && !dateToInput.trim();
  const switchMasterTargetRow = switchMasterTargetId ? rows.find((row) => row.id === switchMasterTargetId) ?? null : null;
  const switchMasterOptions = [...new Set(rows.map((row) => row.master).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ru"));

  return (
    <div className="h-screen w-screen overflow-hidden bg-black max-lg:min-h-screen max-lg:h-auto max-lg:overflow-y-auto lg:h-screen lg:overflow-hidden">
      <div className="flex h-full w-full min-h-0 p-2 max-lg:h-auto lg:h-full">
        <div className="flex h-full min-h-0 w-full max-lg:h-auto max-lg:flex-col rounded-[16px] bg-black p-2 shadow-none lg:flex-row lg:shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)]">
          <MarsAppShellSidebar mobileLayout="requests" />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:overflow-x-hidden">
            <header className="mb-2 rounded-[16px] border border-[#DDE1E7] bg-white px-4 py-4 lg:px-5 lg:py-5">
              <div className="flex max-lg:flex-col max-lg:items-stretch max-lg:gap-4 items-center gap-3 lg:flex-row lg:items-center lg:gap-3">
                <div className="flex min-w-0 items-baseline gap-2 whitespace-nowrap">
                  <h1 className="text-[28px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826] max-sm:text-[24px] lg:text-[32px] xl:text-[36px]">Заказ-наряды</h1>
                  <span className="shrink-0 text-[16px] font-bold tracking-[-0.04em] text-[#888888]">({workOrdersCount})</span>
                </div>
                <div className="ml-auto flex w-full min-w-0 max-lg:ml-0 max-lg:flex-col max-lg:gap-2 sm:max-lg:flex-row sm:max-lg:flex-wrap items-stretch sm:max-lg:items-center lg:ml-auto lg:w-auto lg:flex-row lg:items-center lg:gap-1 xl:gap-1.5">
                  <div className="relative w-full min-w-0 sm:max-lg:min-w-[200px] sm:max-lg:flex-1 lg:w-auto">
                    <input
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="h-12 w-full min-w-0 rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 pr-11 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5] [color-scheme:light] [&::-webkit-search-cancel-button]:hidden lg:w-[280px] xl:w-[320px]"
                      placeholder="Поиск по ID или ФИО..."
                      aria-label="Поиск по ID или ФИО..."
                    />
                    {searchQuery.trim() ? (
                      <button
                        type="button"
                        onClick={() => setSearchQuery("")}
                        aria-label="Очистить поиск"
                        className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[8px] text-black"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-[16px] w-[16px]" aria-hidden>
                          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    onClick={() => setCreateOrderModalOpen(true)}
                    className="h-12 min-h-[48px] shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out max-lg:flex-1 sm:max-lg:flex-none lg:px-3 lg:text-[16px] xl:px-4 xl:text-[18px]"
                  >
                    Создать заказ-наряд
                  </button>
                  <button
                    type="button"
                    onClick={() => exportWorkOrdersToXlsx(noActiveFilters ? rows : sortedRows)}
                    className="h-12 min-h-[48px] shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-black px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out max-lg:flex-1 sm:max-lg:flex-none lg:px-3 lg:text-[16px] xl:px-4 xl:text-[18px]"
                  >
                    Экспорт в Excel
                  </button>
                </div>
              </div>
            </header>

            <section className="flex min-h-0 flex-1 flex-col gap-4 rounded-[16px] border border-[#DDE1E7] bg-white px-4 py-4 max-lg:gap-4 lg:gap-5 lg:px-5 lg:py-5">
              <div className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-3">
                <div className="flex min-w-0 flex-wrap items-center gap-[10px] gap-y-3">
                  {[
                    { id: "status" as const, label: "Статус" },
                    { id: "master" as const, label: "Мастер" },
                    { id: "dueDate" as const, label: "Дата приема" },
                  ].map(({ id, label }) => (
                    <div key={id} className="relative">
                      <button
                        type="button"
                        onClick={() => setOpenFilter((prev) => (prev === id ? null : id))}
                        className={`cursor-pointer rounded-[10px] px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] ${
                          filterChipActive(id) ? "bg-[#EC1C24] text-white" : "bg-[#ECECEF] text-[#111111]"
                        }`}
                      >
                        <span className="flex items-center justify-center gap-[12px]">
                          <span>{label}</span>
                          <svg
                            viewBox="0 0 16 16"
                            fill="none"
                            className={`h-[16px] w-[16px] transition-transform duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${
                              filterChipActive(id) ? "text-white" : "text-[#111111]"
                            } ${openFilter === id ? "rotate-180" : "rotate-0"}`}
                          >
                            <path d="M3 6L8 11L13 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                      {id === "status" && openFilter === "status" && (
                        <div className={panelBase}>
                          <p className="mb-2 text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">Статус</p>
                          {(["Новый", "В работе", "Ожидание запчастей", "Готово", "Закрыт", "Отказ клиента"] as const).map((s) => (
                            <span
                              key={s}
                              className="flex cursor-pointer items-center gap-2 py-1.5 text-[15px] font-medium tracking-[-0.04em] text-[#111111]"
                              onClick={() =>
                                setStatusFilter((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(s)) next.delete(s);
                                  else next.add(s);
                                  return next.size === 0 ? new Set(["Новый", "В работе", "Ожидание запчастей", "Готово", "Закрыт", "Отказ клиента"]) : next;
                                })
                              }
                            >
                              {workOrdersCheckboxBox(statusFilter.has(s))}
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {id === "master" && openFilter === "master" && (
                        <div className={panelBase}>
                          <p className="mb-2 text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">Мастер</p>
                          {[...new Set(rows.map((r) => r.master))].map((m) => (
                            <span
                              key={m}
                              className="flex cursor-pointer items-center gap-2 py-1.5 text-[15px] font-medium tracking-[-0.04em] text-[#111111]"
                              onClick={() =>
                                setMasterFilter((prev) => {
                                  const next = new Set(prev);
                                  if (next.has(m)) next.delete(m);
                                  else next.add(m);
                                  return next.size === 0 ? new Set([...new Set(rows.map((r) => r.master))]) : next;
                                })
                              }
                            >
                              {workOrdersCheckboxBox(masterFilter.has(m))}
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                      {id === "dueDate" && openFilter === "dueDate" && (
                        <div className={panelBase}>
                          <p className="mb-2 text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">Дата приема</p>
                          <div className="flex flex-col gap-0.5">
                            {(
                              [
                                ["today", "Сегодня"],
                                ["yesterday", "Вчера"],
                                ["last7", "Последние 7 дней"],
                                ["last30", "Последние 30 дней"],
                              ] as const
                            ).map(([preset, label]) => (
                              <span
                                key={preset}
                                className={`flex cursor-pointer items-center gap-2 rounded-[8px] py-1.5 text-[15px] font-medium tracking-[-0.04em] text-[#111111] ${
                                  datePreset === preset ? "bg-white" : ""
                                }`}
                                onClick={() => applyPresetToDateInputs(preset)}
                                role="checkbox"
                                aria-checked={datePreset === preset}
                              >
                                {workOrdersCheckboxBox(datePreset === preset)}
                                {label}
                              </span>
                            ))}
                            <span
                              className={`flex cursor-pointer items-center gap-2 rounded-[8px] py-1.5 text-[15px] font-medium tracking-[-0.04em] text-[#111111] ${
                                datePreset === "custom" ? "bg-white" : ""
                              }`}
                              onClick={() => {
                                setDatePreset("custom");
                                setDateFromInput("");
                                setDateToInput("");
                              }}
                              role="checkbox"
                              aria-checked={datePreset === "custom"}
                            >
                              {workOrdersCheckboxBox(datePreset === "custom")}
                              Свой диапазон
                            </span>
                          </div>
                          {datePreset === "custom" ? (
                            <div className="mt-3 flex flex-col gap-2 border-t border-[#DDE1E7] pt-3">
                              <label className="text-[13px] text-[#7D7D7D]">С</label>
                              <input
                                value={dateFromInput}
                                onChange={(e) => {
                                  setDateFromInput(maskRuDateInput(e.target.value));
                                  setDatePreset("custom");
                                }}
                                className="h-10 rounded-[8px] border border-[#E4E5E7] bg-white px-2 text-[15px] outline-none"
                                placeholder="дд.мм.гггг"
                              />
                              <label className="text-[13px] text-[#7D7D7D]">По</label>
                              <input
                                value={dateToInput}
                                onChange={(e) => {
                                  setDateToInput(maskRuDateInput(e.target.value));
                                  setDatePreset("custom");
                                }}
                                className="h-10 rounded-[8px] border border-[#E4E5E7] bg-white px-2 text-[15px] outline-none"
                                placeholder="дд.мм.гггг"
                              />
                            </div>
                          ) : null}
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-6 pl-1 sm:pl-3">
                    <span
                      className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-[16px] font-medium tracking-[-0.04em]"
                      onClick={() => {
                        clearWorkOrderFlashState();
                        setAwaitingPaymentOnly((v) => {
                          const next = !v;
                          setArchiveOnly(false);
                          return next;
                        });
                      }}
                    >
                      {workOrdersCheckboxBox(awaitingPaymentOnly)}
                      <span className="text-black">Готово к выдаче </span>
                      <span className="text-[#7D7D7D] tabular-nums">({awaitingPaymentCount})</span>
                    </span>
                    <span
                      className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-[16px] font-medium tracking-[-0.04em]"
                      onClick={() => {
                        clearWorkOrderFlashState();
                        setArchiveOnly((v) => {
                          const next = !v;
                          setAwaitingPaymentOnly(false);
                          return next;
                        });
                      }}
                    >
                      {workOrdersCheckboxBox(archiveOnly)}
                      <span className="text-black">Архив </span>
                      <span className="text-[#7D7D7D] tabular-nums">({archiveCount})</span>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={noActiveFilters}
                  className="inline-flex w-full shrink-0 cursor-pointer items-center justify-center rounded-[10px] border-2 border-[#EC1C24] bg-white px-[16px] py-[12px] text-[16px] font-medium leading-none tracking-[-0.04em] text-[#EC1C24] box-border disabled:cursor-not-allowed disabled:opacity-45 sm:w-auto sm:justify-start lg:w-auto"
                >
                  Сбросить фильтры
                </button>
              </div>

              <div className="@container flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-lg bg-white max-lg:min-h-[240px] max-lg:flex-none lg:flex-1">
                <div className="journal-table-scroll relative min-h-0 min-w-0 flex-1 touch-pan-x touch-pan-y overflow-x-auto overflow-y-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] max-lg:max-h-[min(72vh,680px)] lg:max-h-[min(78vh,800px)] xl:max-h-none @[1280px]:max-h-none @[1280px]:overflow-y-hidden">
                  <table className="w-full min-w-[1520px] table-fixed border-separate border-spacing-0 text-[16px] font-medium tracking-[-0.015em] @[1280px]:min-w-0 @[1280px]:tracking-[-0.04em]">
                    <colgroup>
                      <col className="w-[4%]" />
                      <col className="w-[9%]" />
                      <col className="w-[20%]" />
                      <col className="w-[14%]" />
                      <col className="w-[14%]" />
                      <col className="w-[16%]" />
                      <col className="w-[13%]" />
                      <col className="w-[12%]" />
                      <col className="w-[9%]" />
                      <col className="w-[4%]" />
                    </colgroup>
                    <thead className="bg-[#F3F3F5] text-left text-[15px] font-medium leading-tight tracking-[-0.015em] text-[#7D7D7D] whitespace-normal @[1280px]:text-[16px] @[1280px]:tracking-[-0.04em] @[1280px]:whitespace-nowrap">
                      <tr>
                        <th className="rounded-l-[5px] px-3 py-3 font-medium align-middle @[1280px]:px-4 @[1280px]:py-2.5">
                          <button type="button" onClick={toggleSelectAllOnPage} className="inline-flex cursor-pointer items-center">
                            {workOrdersCheckboxBox(allPageRowsSelected)}
                          </button>
                        </th>
                        <th className="px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5"><span className="inline-flex items-center gap-2 font-medium">ID<button type="button" onClick={() => toggleSort("id")} className="cursor-pointer shrink-0"><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5"><span className="inline-flex items-center gap-2 font-medium">Клиент<button type="button" onClick={() => toggleSort("client")} className="cursor-pointer shrink-0"><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5"><span className="inline-flex items-center gap-2 font-medium">Автомобиль<button type="button" onClick={() => toggleSort("car")} className="cursor-pointer shrink-0"><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5"><span className="inline-flex items-center gap-2 font-medium">Гос. номер<button type="button" onClick={() => toggleSort("plate")} className="cursor-pointer shrink-0"><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5"><span className="inline-flex items-center gap-2 font-medium">Статус<button type="button" onClick={() => toggleSort("status")} className="cursor-pointer shrink-0"><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5"><span className="inline-flex items-center gap-2 font-medium">Мастер<button type="button" onClick={() => toggleSort("master")} className="cursor-pointer shrink-0"><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5"><span className="inline-flex items-center gap-2 font-medium">Дата приема<button type="button" onClick={() => toggleSort("dueDate")} className="cursor-pointer shrink-0"><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-3 py-3 align-middle font-medium @[1280px]:px-4 @[1280px]:py-2.5"><span className="inline-flex items-center gap-2 font-medium">Сумма<button type="button" onClick={() => toggleSort("amount")} className="cursor-pointer shrink-0"><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="rounded-r-[5px] px-3 py-3 text-center font-medium align-middle @[1280px]:px-4 @[1280px]:py-2.5">⋮</th>
                      </tr>
                    </thead>
                    <tbody>
                      {sortedRows.length === 0 ? (
                        <tr>
                          <td
                            colSpan={10}
                            className="px-3 py-16 text-center text-[18px] font-medium tracking-[-0.04em] text-[#7D7D7D] whitespace-normal @[1280px]:px-4"
                          >
                            Ничего не найдено
                          </td>
                        </tr>
                      ) : (
                        pagedRows.map((row, index) => {
                          const isSelected = selectedRowIds.has(row.id);
                          return (
                            <WorkOrdersTableDataRow
                              key={row.id}
                              row={row}
                              index={index}
                              isSelected={isSelected}
                              isArchiving={archivingRowId === row.id}
                              flashTargetId={flashHighlightWorkOrderId}
                              flashNonce={flashHighlightNonce}
                              rowRef={(el) => {
                                workOrderRowRefs.current[row.id] = el;
                              }}
                              onRowNavigate={() => navigate(`/work-orders/${row.id}`)}
                              onToggleSelect={() => toggleRowSelection(row.id)}
                              onOpenActions={() => setWorkOrderActionsModal(row)}
                              actionsModalOpenForThisRow={workOrderActionsModal?.id === row.id}
                              onFlashAnimationEnd={onWorkOrderFlashAnimationEnd}
                            />
                          );
                        })
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="relative flex flex-col gap-4 max-lg:gap-5 max-lg:pt-1 lg:flex-row lg:items-center lg:justify-between lg:gap-0 lg:pt-0">
                <button className="rounded-[8px] bg-white px-2 py-1 text-center text-[18px] font-bold tracking-[-0.04em] text-black max-lg:w-full lg:w-auto lg:text-left lg:text-[20px]">
                  {selectedRowIds.size} / заказ-нарядов
                </button>
                <div className="pointer-events-none absolute left-1/2 top-1/2 z-[1] -translate-x-1/2 -translate-y-1/2 max-lg:relative max-lg:left-auto max-lg:top-auto max-lg:z-0 max-lg:translate-x-0 max-lg:translate-y-0 max-lg:pointer-events-auto max-lg:flex max-lg:w-full max-lg:justify-center lg:pointer-events-none lg:absolute lg:left-1/2 lg:top-1/2 lg:flex lg:w-auto lg:-translate-x-1/2 lg:-translate-y-1/2">
                  <div className="pointer-events-auto flex flex-wrap items-center justify-center gap-2">
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                      className="inline-flex h-[48px] w-[48px] items-center justify-center rounded-full text-[30px] font-bold leading-none tracking-[-0.02em] text-black"
                    >
                      ‹
                    </button>
                    <div className="relative flex h-[48px] items-center gap-1 overflow-hidden rounded-full bg-[#11131D] p-1 shadow-[0_8px_24px_-14px_rgba(0,0,0,0.8)]">
                      <span className="absolute left-1 top-1 z-0 h-[40px] w-[48px] rounded-full bg-[#EC1C24] shadow-[0_6px_14px_-8px_rgba(236,28,36,0.85)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)]" style={{ transform: `translateX(${paginationActiveIndex * 52}px)` }} />
                      {paginationItems.map((item, idx) =>
                        item === "ellipsis" ? (
                          <button key={`ellipsis-${idx}`} type="button" className="relative z-10 inline-flex h-[40px] w-[48px] cursor-default items-center justify-center text-[16px] font-bold tracking-[-0.02em] text-white/90">...</button>
                        ) : (
                          <button key={item} type="button" onClick={() => setCurrentPage(item)} className={`relative z-10 inline-flex h-[40px] w-[48px] items-center justify-center rounded-full text-[16px] font-bold tracking-[-0.02em] transition-colors duration-300 ${item === currentPageSafe ? "text-white" : "text-white/80 hover:text-white"}`}>{item}</button>
                        ),
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                      className="inline-flex h-[48px] w-[48px] items-center justify-center rounded-full text-[30px] font-bold leading-none tracking-[-0.02em] text-black"
                    >
                      ›
                    </button>
                  </div>
                </div>
                <div className="flex w-full shrink-0 justify-center gap-2 text-center text-[16px] font-bold tracking-[-0.04em] text-black max-lg:order-last lg:w-auto lg:justify-end lg:text-right lg:text-[20px]">
                  <span>
                    {sortedRows.length === 0 ? "0 из 0" : `${pageStart + 1} — ${pageEnd} из ${sortedRows.length}`}
                  </span>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
      {createOrderModalMounted && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`fixed inset-0 z-[291] bg-black/35 transition-[opacity] ${createOrderModalActive ? "opacity-100" : "opacity-0"}`}
              style={{ transitionDuration: "400ms", transitionTimingFunction: "cubic-bezier(0.45, 0, 0.55, 1)" }}
              role="presentation"
              onClick={closeCreateOrderModal}
            >
              <div className="ml-auto flex h-full max-h-screen justify-end" onClick={(e) => e.stopPropagation()}>
                <div
                  className="relative flex h-full shrink-0"
                  style={{
                    transform: createOrderModalActive ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)",
                    transition: "transform 480ms cubic-bezier(0.45, 0, 0.55, 1)",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                  onTransitionEnd={handleCreateOrderDrawerTransitionEnd}
                >
                  <button
                    type="button"
                    onClick={closeCreateOrderModal}
                    className="absolute right-full top-8 z-10 mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#E8E8E8] bg-white text-[#111111] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.18)] transition hover:bg-[#F7F7F7]"
                    aria-label="Закрыть модалку создания заказ-наряда"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <aside
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="create-work-order-title"
                    className="flex h-full w-[min(900px,58vw)] min-w-[380px] max-w-[min(1040px,calc(100vw-48px))] flex-col border-l border-[#E6E6E6] bg-white tracking-[-0.04em] shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.2)]"
                  >
                    <div className="border-b border-[#EEEDF0] px-6 py-5">
                      <h2 id="create-work-order-title" className="text-[32px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">
                        Создать заказ-наряд
                      </h2>
                      <p className="mt-2 text-[15px] font-medium text-[#6F7785]">Шаг {createOrderStep} из 4</p>
                    </div>

                    <div className="hide-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                      {createOrderStep === 1 ? (
                        <div className="space-y-4">
                          <label className="block">
                            <span className="mb-2 block text-[14px] font-medium text-[#5A6472]">Телефон</span>
                            <input
                              type="tel"
                              autoComplete="tel"
                              inputMode="numeric"
                              value={maskRuPhoneInput(createOrderPhoneNational10)}
                              onChange={(e) => setCreateOrderPhoneNational10(national10FromPhoneInput(e.target.value))}
                              placeholder="+7 (999) 000-00-00"
                              className="mt-1.5 h-12 w-full min-w-0 rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                            />
                          </label>

                          {createOrderPhoneMatch ? (
                            <div className="rounded-[12px] border border-[#E4E5E7] bg-[#F8F8FA] p-4">
                              <p className="text-[14px] font-medium text-[#6F7785]">Клиент найден</p>
                              <p className="mt-1 text-[18px] font-semibold text-[#111826]">{createOrderPhoneMatch.fullName}</p>
                              <p className="mt-1 text-[15px] text-[#4A4F59]">{createOrderPhoneMatch.phone}</p>
                              <div className="mt-3 rounded-[10px] bg-white px-3 py-2">
                                <p className="text-[15px] font-medium text-[#111826]">{firstClientCar(createOrderPhoneMatch).car}</p>
                                <p className="text-[13px] text-[#7D7D7D]">{firstClientCar(createOrderPhoneMatch).plate}</p>
                              </div>
                            </div>
                          ) : createOrderPhoneNational10.length === 10 ? (
                            <div className="space-y-4 rounded-[12px] bg-[#F8F8FA] p-4">
                              <p className="text-[14px] font-medium text-black">Клиент с таким номером не найден</p>
                              <div className="flex flex-wrap gap-2">
                                <button
                                  type="button"
                                  onClick={() => setCreateOrderMode("existing")}
                                  className={`h-11 rounded-[10px] px-5 text-[15px] font-medium ${
                                    createOrderMode === "existing" ? "bg-[#EC1C24] text-white" : "bg-[#ECECEF] text-black"
                                  }`}
                                >
                                  Привязать к существующему
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setCreateOrderMode("new");
                                    setCreateOrderNewClientPhoneNational10(createOrderPhoneNational10);
                                  }}
                                  className={`h-11 rounded-[10px] px-5 text-[15px] font-medium ${
                                    createOrderMode === "new" ? "bg-[#EC1C24] text-white" : "bg-[#ECECEF] text-black"
                                  }`}
                                >
                                  Новый клиент
                                </button>
                              </div>

                              {createOrderMode === "existing" ? (
                                <div className="space-y-3">
                                  <input
                                    value={createOrderExistingSurname}
                                    onChange={(e) => setCreateOrderExistingSurname(e.target.value)}
                                    placeholder="Фамилия"
                                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                                  />
                                  <div className="space-y-2">
                                    {createOrderSurnameCandidates.map((client) => (
                                      <div key={`${client.fullName}-${client.phone}`} className="rounded-[10px] bg-[#ECECEF] p-3">
                                        <p className="text-[15px] font-semibold text-[#111826]">{client.fullName}</p>
                                        <p className="mt-0.5 text-[14px] text-[#5A6472]">{client.phone}</p>
                                        <div className="mt-3 flex flex-wrap gap-2">
                                          {client.cars.map((carEntry) => {
                                            const selected =
                                              createOrderExistingClient?.fullName === client.fullName &&
                                              createOrderExistingCar?.car === carEntry.car &&
                                              createOrderExistingCar?.plate === carEntry.plate;
                                            return (
                                              <button
                                                key={`${client.fullName}-${carEntry.car}-${carEntry.plate}`}
                                                type="button"
                                                onClick={() => {
                                                  setCreateOrderExistingClient(client);
                                                  setCreateOrderExistingCar(carEntry);
                                                }}
                                                className={`rounded-lg px-3 py-2 text-left text-[13px] font-medium ${
                                                  selected ? "bg-[#EC1C24] text-white" : "bg-white text-[#3B4656]"
                                                }`}
                                              >
                                                {carEntry.car}
                                                <span className={`block text-[12px] font-normal ${selected ? "text-white/90" : "text-[#6D788A]"}`}>
                                                  {carEntry.plate || "—"}
                                                </span>
                                              </button>
                                            );
                                          })}
                                        </div>
                                      </div>
                                    ))}
                                    {createOrderExistingSurname.trim() && createOrderSurnameCandidates.length === 0 ? (
                                      <div className="flex h-11 items-center rounded-[10px] bg-black px-5 text-[15px] font-medium text-white">
                                        По фамилии ничего не найдено.
                                      </div>
                                    ) : null}
                                  </div>
                                </div>
                              ) : null}

                              {createOrderMode === "new" ? (
                                <div className="space-y-3">
                                  <input
                                    value={createOrderNewClientName}
                                    onChange={(e) => setCreateOrderNewClientName(e.target.value)}
                                    placeholder="ФИО"
                                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                                  />
                                  <input
                                    type="tel"
                                    autoComplete="tel"
                                    inputMode="numeric"
                                    value={maskRuPhoneInput(createOrderNewClientPhoneNational10)}
                                    onChange={(e) => setCreateOrderNewClientPhoneNational10(national10FromPhoneInput(e.target.value))}
                                    placeholder="+7 (999) 000-00-00"
                                    className="mt-1.5 h-12 w-full min-w-0 rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                                  />
                                  <input
                                    value={createOrderNewClientCar}
                                    onChange={(e) => setCreateOrderNewClientCar(e.target.value)}
                                    placeholder="Автомобиль"
                                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                                  />
                                  <input
                                    value={createOrderNewClientPlate}
                                    onChange={(e) => setCreateOrderNewClientPlate(e.target.value)}
                                    placeholder="Гос. номер"
                                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                                  />
                                </div>
                              ) : null}
                            </div>
                          ) : null}
                        </div>
                      ) : null}

                      {createOrderStep === 2 ? (
                        <div className="space-y-4">
                          <input
                            value={createOrderCatalogQuery}
                            onChange={(e) => setCreateOrderCatalogQuery(e.target.value)}
                            placeholder="Поиск работы из справочника..."
                            className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[16px] font-medium tracking-[-0.02em] text-black outline-none placeholder:text-[#B5B5B5]"
                          />
                          <div>
                            <div className="mb-5 flex flex-wrap gap-2 pb-1">
                              {workCatalogSections.map((section) => (
                                <button
                                  key={section.label}
                                  type="button"
                                  onClick={() => setCreateOrderWorkCategory(section.label)}
                                  className={`shrink-0 rounded-[10px] px-3 py-2 text-[13px] font-medium tracking-[-0.02em] ${
                                    createOrderWorkCategory === section.label ? "bg-[#EC1C24] text-white" : "bg-[#ECECEF] text-[#111826]"
                                  }`}
                                >
                                  {section.label}
                                </button>
                              ))}
                            </div>
                            <div className="h-[504px] space-y-2 overflow-y-auto">
                              {createOrderCatalogItems.map((item) => {
                                const selected = createOrderSelectedWorks.has(item.title);
                                return (
                                  <button
                                    key={item.title}
                                    type="button"
                                    onClick={() =>
                                      setCreateOrderSelectedWorks((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(item.title)) next.delete(item.title);
                                        else next.add(item.title);
                                        return next;
                                      })
                                    }
                                    className={`flex min-h-[56px] w-full cursor-pointer items-center justify-between rounded-[10px] px-3 py-3 text-left text-[15px] font-medium transition-colors ${
                                      selected ? "bg-[#EC1C24] text-white" : "bg-[#F3F3F5] text-[#111826] hover:bg-[#EBECF0]"
                                    }`}
                                  >
                                    <span>{item.title}</span>
                                    <span>{item.price.toLocaleString("ru-RU")} ₽</span>
                                  </button>
                                );
                              })}
                              {createOrderCatalogItems.length === 0 ? (
                                <div className="flex h-11 items-center rounded-[10px] bg-black px-5 text-[15px] font-medium text-white">
                                  Ничего не найдено.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {createOrderStep === 3 ? (
                        <div className="space-y-4">
                          <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Выберите мастера</h3>
                          <div className="max-h-[540px] space-y-2 overflow-y-auto pr-1">
                            {createOrderMasterOptions.map((masterName) => {
                              const selected = createOrderSelectedMaster === masterName;
                              return (
                                <button
                                  key={masterName}
                                  type="button"
                                  onClick={() => setCreateOrderSelectedMaster(masterName)}
                                  className={`flex min-h-[56px] w-full cursor-pointer items-center gap-3 rounded-[10px] px-3 py-3 text-left text-[16px] font-medium transition-colors ${
                                    selected ? "bg-[#EC1C24] text-white" : "bg-[#F3F3F5] text-[#111826] hover:bg-[#EBECF0]"
                                  }`}
                                >
                                  <span className="inline-flex h-9 w-9 shrink-0 overflow-hidden rounded-full bg-[#E8E8EC]">
                                    <img
                                      src={masterPhotoByName[masterName] ?? "https://i.pravatar.cc/80"}
                                      alt={masterName}
                                      className="h-full w-full object-cover"
                                    />
                                  </span>
                                  <span className="min-w-0 flex-1 truncate">{masterName}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ) : null}

                      {createOrderStep === 4 ? (
                        <div className="space-y-[50px]">
                          <div>
                            <h3 className="max-w-[420px] text-[52px] font-semibold leading-[0.98] tracking-[-0.03em] text-[#202636]">
                              <span className="block whitespace-nowrap">{createOrderClientNameLines.firstLine}</span>
                              {createOrderClientNameLines.secondLine ? (
                                <span className="block">{createOrderClientNameLines.secondLine}</span>
                              ) : null}
                            </h3>
                            <p className="mt-4 text-[20px] font-medium tracking-[-0.02em] text-[#3C4352]">
                              Мастер: {createOrderSelectedMaster ?? rows[0]?.master ?? "—"}
                            </p>
                            <div className="mt-[50px] grid grid-cols-2 gap-x-3 gap-y-4">
                              <div className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3">
                                <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">Телефон</p>
                                <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">
                                  {createOrderResolvedClient?.phone || "—"}
                                </p>
                              </div>
                              <div className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3">
                                <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">Автомобиль</p>
                                <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">
                                  {createOrderResolvedClient?.car || "—"}
                                </p>
                              </div>
                              <div className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3">
                                <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">Гос. номер</p>
                                <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">
                                  {createOrderResolvedClient?.plate || "—"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">
                              Работы <span className="text-[#888888]">({createOrderSelectedWorkItems.length})</span>
                            </h3>
                            <ul className="max-h-[184px] space-y-2 overflow-y-auto pr-1">
                              {createOrderSelectedWorkItems.map((item) => (
                                <li key={item.title} className="flex min-h-[56px] w-full items-center justify-between rounded-[10px] bg-[#F3F3F5] px-3 py-3 text-left text-[15px] font-medium text-[#111826]">
                                  <span>{item.title}</span>
                                  <span>{item.price.toLocaleString("ru-RU")} ₽</span>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-[50px] text-[32px] font-medium leading-none tracking-[-0.04em] text-black">
                              Итого: {formatRub(createOrderTotalAmount)}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between border-t border-[#EEEDF0] px-6 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (createOrderStep === 1) closeCreateOrderModal();
                          else setCreateOrderStep((prev) => (prev === 4 ? 3 : prev === 3 ? 2 : 1));
                        }}
                        className="h-11 cursor-pointer rounded-[10px] bg-[#ECECEF] px-4 text-[15px] font-medium text-black"
                      >
                        {createOrderStep === 1 ? "Отмена" : "Назад"}
                      </button>
                      <button
                        type="button"
                        disabled={
                          (createOrderStep === 1 && !canGoToCreateOrderStep2) ||
                          (createOrderStep === 2 && createOrderSelectedWorks.size === 0) ||
                          (createOrderStep === 3 && !createOrderSelectedMaster)
                        }
                        onClick={() => {
                          if (createOrderStep === 1) setCreateOrderStep(2);
                          else if (createOrderStep === 2) setCreateOrderStep(3);
                          else if (createOrderStep === 3) setCreateOrderStep(4);
                          else commitCreatedWorkOrder();
                        }}
                        className="h-11 cursor-pointer rounded-[10px] bg-[#EC1C24] px-5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {createOrderStep === 4 ? "Подтвердить" : "Далее"}
                      </button>
                    </div>
                  </aside>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {transferOrderModalMounted && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`fixed inset-0 z-[291] bg-black/35 transition-[opacity] ${transferOrderModalActive ? "opacity-100" : "opacity-0"}`}
              style={{ transitionDuration: "400ms", transitionTimingFunction: "cubic-bezier(0.45, 0, 0.55, 1)" }}
              role="presentation"
              onClick={closeTransferOrderModal}
            >
              <div className="ml-auto flex h-full max-h-screen justify-end" onClick={(e) => e.stopPropagation()}>
                <div
                  className="relative flex h-full shrink-0"
                  style={{
                    transform: transferOrderModalActive ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)",
                    transition: "transform 480ms cubic-bezier(0.45, 0, 0.55, 1)",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                  onTransitionEnd={handleTransferOrderDrawerTransitionEnd}
                >
                  <button
                    type="button"
                    onClick={closeTransferOrderModal}
                    className="absolute right-full top-8 z-10 mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#E8E8E8] bg-white text-[#111111] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.18)] transition hover:bg-[#F7F7F7]"
                    aria-label="Закрыть модалку переноса в заказ-наряд"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <aside
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="transfer-work-order-title"
                    className="flex h-full w-[min(900px,58vw)] min-w-[380px] max-w-[min(1040px,calc(100vw-48px))] flex-col border-l border-[#E6E6E6] bg-white tracking-[-0.04em] shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.2)]"
                  >
                    <div className="border-b border-[#EEEDF0] px-6 py-5">
                      <h2 id="transfer-work-order-title" className="text-[32px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">
                        Перенести в заказ-наряд
                      </h2>
                      <p className="mt-2 text-[15px] font-medium text-[#6F7785]">Шаг {transferOrderStep} из 3</p>
                    </div>

                    <div className="hide-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5">
                      {transferOrderStep === 2 ? (
                        <div className="space-y-4">
                          <input
                            value={transferOrderCatalogQuery}
                            onChange={(e) => setTransferOrderCatalogQuery(e.target.value)}
                            placeholder="Поиск работы из справочника..."
                            className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[16px] font-medium tracking-[-0.02em] text-black outline-none placeholder:text-[#B5B5B5]"
                          />
                          <div>
                            <div className="mb-5 flex flex-wrap gap-2 pb-1">
                              {workCatalogSections.map((section) => (
                                <button
                                  key={section.label}
                                  type="button"
                                  onClick={() => setTransferOrderWorkCategory(section.label)}
                                  className={`shrink-0 rounded-[10px] px-3 py-2 text-[13px] font-medium tracking-[-0.02em] ${
                                    transferOrderWorkCategory === section.label ? "bg-[#EC1C24] text-white" : "bg-[#ECECEF] text-[#111826]"
                                  }`}
                                >
                                  {section.label}
                                </button>
                              ))}
                            </div>
                            <div className="h-[504px] space-y-2 overflow-y-auto">
                              {transferOrderCatalogItems.map((item) => {
                                const selected = transferOrderSelectedWorks.has(item.title);
                                return (
                                  <button
                                    key={item.title}
                                    type="button"
                                    onClick={() =>
                                      setTransferOrderSelectedWorks((prev) => {
                                        const next = new Set(prev);
                                        if (next.has(item.title)) next.delete(item.title);
                                        else next.add(item.title);
                                        return next;
                                      })
                                    }
                                    className={`flex min-h-[56px] w-full cursor-pointer items-center justify-between rounded-[10px] px-3 py-3 text-left text-[15px] font-medium transition-colors ${
                                      selected ? "bg-[#EC1C24] text-white" : "bg-[#F3F3F5] text-[#111826] hover:bg-[#EBECF0]"
                                    }`}
                                  >
                                    <span>{item.title}</span>
                                    <span>{item.price.toLocaleString("ru-RU")} ₽</span>
                                  </button>
                                );
                              })}
                              {transferOrderCatalogItems.length === 0 ? (
                                <div className="flex h-11 items-center rounded-[10px] bg-black px-5 text-[15px] font-medium text-white">
                                  Ничего не найдено.
                                </div>
                              ) : null}
                            </div>
                          </div>
                        </div>
                      ) : null}

                      {transferOrderStep === 21 ? (
                        <div className="space-y-4">
                          <div className="rounded-[12px] bg-[#F8F8FA] p-4">
                            <p className="text-[18px] font-semibold text-[#111826]">
                              {transferOrderMissingField === "phone"
                                ? "Не указан номер телефона"
                                : transferOrderMissingField === "car"
                                  ? "Не указан автомобиль клиента"
                                  : "Не указан гос. номер"}
                            </p>
                            <p className="mt-1 text-[15px] font-medium text-[#4A4F59]">
                              Пожалуйста заполните поле ввода
                            </p>
                          </div>
                          {transferOrderMissingField === "phone" ? (
                            <input
                              type="tel"
                              autoComplete="tel"
                              inputMode="numeric"
                              value={transferOrderClientPhone}
                              onChange={(e) => setTransferOrderClientPhone(maskRuPhoneInput(national10FromPhoneInput(e.target.value)))}
                              placeholder="+7 (999) 000-00-00"
                              className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                            />
                          ) : null}
                          {transferOrderMissingField === "car" ? (
                            <input
                              value={transferOrderClientCar}
                              onChange={(e) => setTransferOrderClientCar(e.target.value)}
                              placeholder="Автомобиль"
                              className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                            />
                          ) : null}
                          {transferOrderMissingField === "plate" ? (
                            <input
                              value={transferOrderClientPlate}
                              onChange={(e) => setTransferOrderClientPlate(e.target.value)}
                              placeholder="Гос. номер"
                              className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                            />
                          ) : null}
                        </div>
                      ) : null}

                      {transferOrderStep === 3 ? (
                        <div className="space-y-[50px]">
                          <div>
                            <h3 className="max-w-[420px] text-[52px] font-semibold leading-[0.98] tracking-[-0.03em] text-[#202636]">
                              <span className="block whitespace-nowrap">{transferOrderClientNameLines.firstLine}</span>
                              {transferOrderClientNameLines.secondLine ? (
                                <span className="block">{transferOrderClientNameLines.secondLine}</span>
                              ) : null}
                            </h3>
                            <div className="mt-[50px] grid grid-cols-2 gap-x-3 gap-y-4">
                              <div className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3">
                                <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">Телефон</p>
                                <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">
                                  {transferOrderClientPhone || "—"}
                                </p>
                              </div>
                              <div className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3">
                                <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">Автомобиль</p>
                                <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">
                                  {transferOrderClientCar || "—"}
                                </p>
                              </div>
                              <div className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3">
                                <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">Гос. номер</p>
                                <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">
                                  {transferOrderClientPlate || "—"}
                                </p>
                              </div>
                            </div>
                          </div>

                          <div>
                            <h3 className="mb-3 text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">
                              Работы <span className="text-[#888888]">({transferOrderSelectedWorkItems.length})</span>
                            </h3>
                            <ul className="max-h-[248px] space-y-2 overflow-y-auto pr-1">
                              {transferOrderSelectedWorkItems.map((item) => (
                                <li key={item.title} className="flex min-h-[56px] w-full items-center justify-between rounded-[10px] bg-[#F3F3F5] px-3 py-3 text-left text-[15px] font-medium text-[#111826]">
                                  <span>{item.title}</span>
                                  <span>{item.price.toLocaleString("ru-RU")} ₽</span>
                                </li>
                              ))}
                            </ul>
                            <p className="mt-[50px] text-[32px] font-medium leading-none tracking-[-0.04em] text-black">
                              Итого: {formatRub(transferOrderTotalAmount)}
                            </p>
                          </div>
                        </div>
                      ) : null}
                    </div>

                    <div className="flex items-center justify-between border-t border-[#EEEDF0] px-6 py-4">
                      <button
                        type="button"
                        onClick={() => {
                          if (transferOrderStep === 2) closeTransferOrderModal();
                          else if (transferOrderStep === 21) setTransferOrderStep(2);
                          else setTransferOrderStep(2);
                        }}
                        className="h-11 rounded-[10px] bg-[#ECECEF] px-4 text-[15px] font-medium text-black"
                      >
                        Назад
                      </button>
                      <button
                        type="button"
                        disabled={
                          (transferOrderStep === 2 && transferOrderSelectedWorks.size === 0) ||
                          (transferOrderStep === 21 &&
                            ((transferOrderMissingField === "phone" && !transferOrderClientPhone.trim()) ||
                              (transferOrderMissingField === "car" && !transferOrderClientCar.trim()) ||
                              (transferOrderMissingField === "plate" && !transferOrderClientPlate.trim())))
                        }
                        onClick={() => {
                          if (transferOrderStep === 2) {
                            if (!transferOrderClientPhone.trim()) {
                              setTransferOrderMissingField("phone");
                              setTransferOrderStep(21);
                              return;
                            }
                            if (!transferOrderClientCar.trim()) {
                              setTransferOrderMissingField("car");
                              setTransferOrderStep(21);
                              return;
                            }
                            if (!transferOrderClientPlate.trim()) {
                              setTransferOrderMissingField("plate");
                              setTransferOrderStep(21);
                              return;
                            }
                            setTransferOrderStep(3);
                          } else if (transferOrderStep === 21) {
                            if (!transferOrderClientPhone.trim()) {
                              setTransferOrderMissingField("phone");
                              return;
                            }
                            if (!transferOrderClientCar.trim()) {
                              setTransferOrderMissingField("car");
                              return;
                            }
                            if (!transferOrderClientPlate.trim()) {
                              setTransferOrderMissingField("plate");
                              return;
                            }
                            setTransferOrderStep(3);
                          }
                          else commitTransferredWorkOrder();
                        }}
                        className="h-11 rounded-[10px] bg-[#EC1C24] px-5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {transferOrderStep === 3 ? "Подтвердить" : "Далее"}
                      </button>
                    </div>
                  </aside>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {workOrderActionsModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setWorkOrderActionsModal(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="work-order-actions-title"
                className="w-full max-w-[360px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="work-order-actions-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    {selectedRowIds.size > 1 ? "Действия с заказ-нарядами" : "Действия с заказ-нарядом"}
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    {selectedRowIds.size > 1
                      ? `${selectedRowIds.size} выбрано`
                      : `№ ${workOrderActionsModal.id} · ${workOrderActionsModal.client}`}
                  </p>
                </div>
                <ul className="p-0">
                  {workOrderModalActions.map(({ id, label, danger }) => (
                    <li key={id}>
                      <button
                        type="button"
                        className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                          danger ? "text-[#EC1C24] hover:bg-[#EC1C24]/10" : "text-[#111826] hover:bg-[#F3F3F5]"
                        }`}
                        onClick={() => handleWorkOrderModalAction(id)}
                      >
                        {actionIconById(id, danger)}
                        {label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
      {workOrderStatusPickerIds && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[261] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setWorkOrderStatusPickerIds(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="work-order-status-picker-title"
                className="w-full max-w-[360px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="work-order-status-picker-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Изменить статус
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    {workOrderStatusPickerIds.length > 1 ? `${workOrderStatusPickerIds.length} выбрано` : `№ ${workOrderStatusPickerIds[0]}`}
                  </p>
                </div>
                <ul className="p-0">
                  {(["Новый", "В работе", "Ожидание запчастей", "Готово", "Закрыт", "Отказ клиента"] as WorkOrderRow["status"][]).map((status) => (
                    <li key={status}>
                      <button
                        type="button"
                        className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                          workOrderStatusPickerIds.length === 1 &&
                          (rows.find((r) => r.id === workOrderStatusPickerIds[0])?.status ?? null) === status
                            ? "bg-[#F8F8FA] text-[#111826]"
                            : "text-[#111826] hover:bg-[#F3F3F5]"
                        }`}
                        onClick={() => commitWorkOrderStatus(status)}
                      >
                        <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: workOrderStatusColorMap[status] }} />
                        <span className="min-w-0 flex-1">{status}</span>
                        {workOrderStatusPickerIds.length === 1 &&
                        (rows.find((r) => r.id === workOrderStatusPickerIds[0])?.status ?? null) === status ? (
                          <span className="shrink-0 text-[13px] font-medium text-[#7D7D7D]">Сейчас</span>
                        ) : null}
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="border-t border-[#EEEDF0] p-5">
                  <button
                    type="button"
                    onClick={() => setWorkOrderStatusPickerIds(null)}
                    className="w-full cursor-pointer rounded-[10px] bg-[#ECECEF] p-4 text-center text-[16px] font-medium tracking-[-0.04em] text-[#111111] transition-colors hover:bg-[#E0E0E4]"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {switchMasterModalOpen && switchMasterTargetRow && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[262] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => {
                setSwitchMasterModalOpen(false);
                setSwitchMasterTargetId(null);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="switch-master-title"
                className="w-full max-w-[440px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="switch-master-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Список мастеров
                  </h2>
                  <p className="mt-1 text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    Выберите мастера для назначения
                  </p>
                </div>
                <ul className="max-h-[420px] space-y-2 overflow-y-auto p-2">
                  {switchMasterOptions.map((masterName) => (
                    <li key={masterName}>
                      <button
                        type="button"
                        onClick={() => setSwitchMasterSelection(masterName)}
                        className={`flex min-h-[56px] w-full cursor-pointer items-center rounded-[10px] px-3 py-3 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                          switchMasterSelection === masterName
                            ? "bg-[#EC1C24] text-white"
                            : "bg-[#F3F3F5] text-[#111826] hover:bg-[#EBECF0]"
                        }`}
                      >
                        <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[#ECECEF]">
                          <img
                            src={masterPhotoByName[masterName] ?? "https://i.pravatar.cc/80"}
                            alt={masterName}
                            className="h-full w-full object-cover"
                          />
                        </span>
                        <span className="ml-3">{masterName}</span>
                      </button>
                    </li>
                  ))}
                </ul>
                <div className="flex items-center justify-between border-t border-[#EEEDF0] p-4">
                  <button
                    type="button"
                    onClick={() => {
                      setSwitchMasterModalOpen(false);
                      setSwitchMasterTargetId(null);
                    }}
                    className="h-11 rounded-[10px] bg-[#ECECEF] px-4 text-[15px] font-medium tracking-[-0.04em] text-black"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={!switchMasterSelection}
                    onClick={async () => {
                      if (!switchMasterSelection || !switchMasterTargetId) return;
                      const nextMaster = switchMasterSelection;
                      const nextMasterPhoto = masterPhotoByName[nextMaster] ?? "https://i.pravatar.cc/80";
                      try {
                        if (isWorkOrdersRemoteEnabled()) {
                          await updateWorkOrdersStorageRows([switchMasterTargetId], {
                            master: nextMaster,
                            master_photo: nextMasterPhoto,
                          });
                        }
                        setRows((prev) =>
                          prev.map((row) =>
                            row.id === switchMasterTargetId
                              ? { ...row, master: nextMaster, masterPhoto: nextMasterPhoto }
                              : row,
                          ),
                        );
                        setSwitchMasterModalOpen(false);
                        setSwitchMasterTargetId(null);
                      } catch (error) {
                        console.warn("Failed to switch master from work-orders modal.", error);
                        emitArchiveStyleToast({
                          line1: "Не удалось сменить мастера",
                          line2: "Проверьте подключение к базе и повторите",
                        });
                      }
                    }}
                    className="h-11 rounded-[10px] bg-[#EC1C24] px-5 text-[15px] font-medium tracking-[-0.04em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Назначить
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {editWorkOrderId && editWorkOrderDraft && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[263] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => {
                setEditWorkOrderId(null);
                setEditWorkOrderDraft(null);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="edit-work-order-title"
                className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="edit-work-order-title" className="text-[20px] font-bold tracking-[-0.04em] text-[#111826]">
                    Редактировать заказ-наряд
                  </h2>
                </div>
                <div className="flex flex-col gap-3 p-5">
                  <input
                    value={editWorkOrderDraft.client}
                    onChange={(e) =>
                      setEditWorkOrderDraft((prev) => (prev ? { ...prev, client: e.target.value } : prev))
                    }
                    className="h-11 rounded-[10px] border border-[#E4E5E7] bg-white px-3 text-[15px] font-medium text-[#111826] outline-none"
                    placeholder="ФИО"
                  />
                  <input
                    value={editWorkOrderDraft.car}
                    onChange={(e) =>
                      setEditWorkOrderDraft((prev) => (prev ? { ...prev, car: e.target.value } : prev))
                    }
                    className="h-11 rounded-[10px] border border-[#E4E5E7] bg-white px-3 text-[15px] font-medium text-[#111826] outline-none"
                    placeholder="Автомобиль"
                  />
                  <input
                    value={editWorkOrderDraft.plate}
                    onChange={(e) =>
                      setEditWorkOrderDraft((prev) => (prev ? { ...prev, plate: e.target.value } : prev))
                    }
                    className="h-11 rounded-[10px] border border-[#E4E5E7] bg-white px-3 text-[15px] font-medium text-[#111826] outline-none"
                    placeholder="Гос. номер"
                  />
                </div>
                <div className="flex gap-2 border-t border-[#EEEDF0] p-5">
                  <button
                    type="button"
                    onClick={() => {
                      setEditWorkOrderId(null);
                      setEditWorkOrderDraft(null);
                    }}
                    className="flex-1 rounded-[10px] bg-[#ECECEF] p-4 text-center text-[16px] font-medium tracking-[-0.04em] text-black"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={commitWorkOrderEdit}
                    className="flex-1 rounded-[10px] border-2 border-[#EC1C24] bg-[#EC1C24] p-4 text-center text-[16px] font-medium tracking-[-0.04em] text-white"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <style>{`
        @keyframes workRowHighlightBorder {
          0% {
            box-shadow: inset 0 0 0 0 rgba(236, 28, 36, 0);
          }
          20% {
            box-shadow: inset 0 0 0 3px #EC1C24;
          }
          70% {
            box-shadow: inset 0 0 0 3px #EC1C24;
          }
          100% {
            box-shadow: inset 0 0 0 0 rgba(236, 28, 36, 0);
          }
        }
        @keyframes archiveRowOut {
          0% {
            opacity: 1;
            transform: scale(1);
          }
          100% {
            opacity: 0;
            transform: scale(0.985);
          }
        }
      `}</style>
    </div>
  );
}
