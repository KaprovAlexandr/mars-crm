import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import { RequestActionIconEdit, RequestActionIconStatus } from "@/components/icons/RequestRowModalIcons";
import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import { emitArchiveStyleToast } from "@/lib/notifications/inAppArchiveToastBus";
import { CURRENT_USER_ROLE } from "@/lib/session/currentUser";
import { createPortal } from "react-dom";
import { useEffect, useMemo, useRef, useState, type TransitionEvent } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

const managerMetrics = [
  {
    name: "Выручка (Revenue)",
    value: "1 240 000 ₽",
    meaning: "Сумма всех закрытых сделок менеджера",
    why: "Главный финансовый показатель",
  },
  {
    name: "Количество закрытых заказов",
    value: "86",
    meaning: "Число машин, которые уехали после оплаты",
    why: "Показывает объем работы",
  },
  {
    name: "Средний чек (AOV)",
    value: "14 418 ₽",
    meaning: "Общая выручка / Кол-во заказов",
    why: "Умение продавать доп. услуги",
  },
  {
    name: "Конверсия (Win Rate)",
    value: "63%",
    meaning: "% от «Записи» до «Оплаты»",
    why: "Качество обработки заявок",
  },
];

const dailyActivity = [
  { label: "Количество новых заявок сегодня", value: "12", note: "Входящий поток за смену" },
  { label: "Количество звонков / исходящих", value: "27 / 16", note: "Интеграция с телефонией" },
  { label: "Время первого ответа", value: "4 мин", note: "Среднее время реакции на лид" },
];

const publicProfileFields = [
  { label: "ФИО", value: "Смирнова Наталья Викторовна" },
  { label: "Тип клиента", value: "Физ.лицо" },
  { label: "Телефон", value: "+7 (909) 999-99-99" },
  { label: "Email", value: "natalya@gmail.com" },
  { label: "Адрес", value: "г. Москва, ул. Пушкина, д. 15, кв. 42" },
  { label: "Дата последнего визита", value: "06.05.2026" },
  { label: "Комментарий", value: "Не звонить после 19:00" },
];

const carProfileFields = [
  { label: "Марка и модель", value: "Hyundai Solaris" },
  { label: "Пробег", value: "87 500 км" },
  { label: "Гос.номер", value: "M456OT799 ⛓" },
  { label: "Тип кузова", value: "Седан" },
  { label: "VIN", value: "KMHC81BDXKU123456 ⛓" },
  { label: "Тип топлива", value: "Бензин" },
  { label: "Год выпуска", value: "2019" },
  { label: "Трансмиссия", value: "АКПП" },
  { label: "Цвет", value: "Серебристый" },
  { label: "Комментарий", value: "Царапина на бампере...Показать" },
];

const clientCars = [
  { name: "BMW M5 F90", orders: 8, amount: 120000, main: true },
  { name: "Lada Priora", orders: 4, amount: 28000, main: false },
  { name: "Kia Rio", orders: 6, amount: 74500, main: false },
  { name: "Skoda Octavia", orders: 5, amount: 91200, main: false },
  { name: "Renault Duster", orders: 3, amount: 39900, main: false },
  { name: "VW Polo", orders: 2, amount: 18700, main: false },
];

const carDocumentItems = [
  "Акт приёма-передачи автомобиля.pdf",
  "Заказ-наряд.pdf",
  "Диагностический протокол.docx",
  "Дефектовочная ведомость.docx",
  "Согласование цены.pdf",
  "Акт выполненных работ.pdf",
  "Кассовый чек.pdf",
  "Гарантийный талон.pdf",
];

const initialCarPhotoItems = [
  "/bmwm5_1.png",
  "/bmwm5_2.png",
  "/bmwm5_3.png",
  "/bmwm5_4.png",
  "/bmwm5_5.png",
  "/bmwm5_6.png",
];

const clientCarListItems = [
  "BMW M5 F90 — 8 заказ-нарядов",
  "Lada Priora — 4 заказ-наряда",
  "Kia Rio — 6 заказ-нарядов",
  "Skoda Octavia — 5 заказ-нарядов",
];

const clientActivityItems = [
  { type: "Заказ-наряд", text: "Заказ-наряд №294894 · BMW", icon: "/group87.svg" },
  { type: "Заказ-наряд", text: "Заказ-наряд №294895 · Lada", icon: "/group87.svg" },
  { type: "Заявка", text: "Заявка №5490 · 25.04", icon: "/order.svg" },
  { type: "Заявка", text: "Заявка №6218 · 12.02", icon: "/order.svg" },
  { type: "Запись", text: "Запись №7821 · 22.03 14:00", icon: "/zapis.svg" },
  { type: "Запись", text: "Запись №1920 · 10.09 19:00", icon: "/zapis.svg" },
];

type WorkStatusKind = "progress" | "wait" | "closed" | "new";
type WorkRow = [string, string, string, WorkStatusKind, string, string?];

/** [название, статус, сумма, статусKind: "progress" | "wait" | "closed" | "new", дата добавления] */
const workOrderCurrentWorks: WorkRow[] = [
  ["Диагностика ходовой части", "В работе", "4 200 ₽", "progress", "07.05.2026"],
  ["Замена тормозных колодок (перед)", "В работе", "8 900 ₽", "progress", "07.05.2026"],
  ["Согласование доп. работ по АКПП", "Ожидает", "0 ₽", "wait", "06.05.2026"],
  ["Проверка аккумулятора и генератора", "В работе", "1 800 ₽", "progress", "06.05.2026"],
  ["Замена ламп ближнего света", "Ожидает", "1 200 ₽", "wait", "05.05.2026"],
  ["Чистка дроссельной заслонки", "В работе", "3 400 ₽", "progress", "05.05.2026"],
  ["Диагностика системы охлаждения", "В работе", "2 600 ₽", "progress", "04.05.2026"],
  ["Замена ремня навесного оборудования", "Ожидает", "2 900 ₽", "wait", "04.05.2026"],
  ["Проверка тормозных дисков", "В работе", "1 700 ₽", "progress", "03.05.2026"],
  ["Замена свечей зажигания", "В работе", "3 100 ₽", "progress", "03.05.2026"],
  ["Промывка форсунок", "Ожидает", "4 500 ₽", "wait", "02.05.2026"],
  ["Регулировка фар", "В работе", "1 300 ₽", "progress", "02.05.2026"],
  ["Диагностика подвески (повторная)", "В работе", "2 200 ₽", "progress", "01.05.2026"],
];

const workOrderCompletedWorks: WorkRow[] = [
  ["ТО-60 000 км", "Закрыт", "14 100 ₽", "closed", "07.05.2026"],
  ["Замена масла ДВС и фильтра", "Закрыт", "3 500 ₽", "closed", "05.05.2026"],
  ["Развал-схождение", "Закрыт", "2 800 ₽", "closed", "03.05.2026"],
];
const workCatalogSections = [
  {
    label: "Все работы",
    items: [] as string[],
  },
  {
    label: "Диагностика",
    items: [
      "Компьютерная диагностика", "Диагностика ходовой части", "Диагностика тормозной системы", "Диагностика двигателя", "Диагностика АКПП",
      "Диагностика МКПП", "Диагностика рулевого управления", "Диагностика подвески", "Диагностика системы охлаждения", "Диагностика кондиционера",
      "Диагностика электрики", "Проверка аккумулятора", "Проверка генератора", "Проверка стартера", "Проверка утечки тока",
      "Диагностика системы зажигания", "Диагностика топливной системы", "Эндоскопия двигателя", "Проверка компрессии",
    ],
  },
  {
    label: "Техническое обслуживание",
    items: [
      "Замена масла в двигателе", "Замена масляного фильтра", "Замена воздушного фильтра", "Замена салонного фильтра", "Замена топливного фильтра",
      "Замена свечей зажигания", "Замена охлаждающей жидкости", "Замена тормозной жидкости", "Замена жидкости ГУР", "Замена масла АКПП",
      "Замена масла МКПП", "Замена масла в редукторе", "Замена масла в раздатке", "Замена ремня навесного оборудования", "Замена цепи ГРМ",
      "Замена ремня ГРМ", "Чистка дроссельной заслонки", "Промывка форсунок", "Обслуживание кондиционера", "Заправка кондиционера",
      "Антибактериальная обработка кондиционера",
    ],
  },
  {
    label: "Тормозная система",
    items: [
      "Замена тормозных колодок (перед)", "Замена тормозных колодок (зад)", "Замена тормозных дисков", "Замена тормозных барабанов",
      "Замена тормозных цилиндров", "Замена тормозных шлангов", "Замена суппорта", "Ремонт суппорта", "Обслуживание тормозных механизмов",
      "Прокачка тормозной системы", "Замена ручного тормоза", "Регулировка ручного тормоза", "Диагностика ABS",
    ],
  },
  {
    label: "Подвеска",
    items: [
      "Замена амортизаторов", "Замена стоек стабилизатора", "Замена втулок стабилизатора", "Замена шаровой опоры", "Замена рулевых наконечников",
      "Замена рулевой тяги", "Замена ступичного подшипника", "Замена рычага подвески", "Замена сайлентблоков", "Замена пружин подвески",
      "Замена опорных подшипников", "Замена ШРУСа", "Замена пыльника ШРУСа", "Замена подрамника", "Сход-развал",
    ],
  },
  {
    label: "Двигатель",
    items: [
      "Замена прокладки клапанной крышки", "Замена прокладки ГБЦ", "Замена сальников двигателя", "Замена помпы", "Замена термостата",
      "Замена радиатора охлаждения", "Замена вентилятора охлаждения", "Замена датчиков двигателя", "Замена опор двигателя", "Замена турбины",
      "Ремонт турбины", "Ремонт двигателя", "Капитальный ремонт двигателя", "Регулировка клапанов", "Замена поршневых колец",
      "Замена цепи ГРМ", "Замена ремня ГРМ", "Замена натяжителя цепи", "Замена катушки зажигания",
    ],
  },
  {
    label: "Коробка передач",
    items: [
      "Замена сцепления", "Замена выжимного подшипника", "Замена маховика", "Ремонт МКПП", "Ремонт АКПП", "Замена АКПП", "Замена МКПП",
      "Диагностика коробки передач", "Замена масла АКПП", "Замена масла МКПП", "Адаптация АКПП",
    ],
  },
  {
    label: "Рулевое управление",
    items: [
      "Замена рулевой рейки", "Ремонт рулевой рейки", "Замена насоса ГУР", "Замена жидкости ГУР", "Замена электроусилителя руля", "Диагностика рулевого управления",
    ],
  },
  {
    label: "Электрика",
    items: [
      "Замена аккумулятора", "Замена генератора", "Ремонт генератора", "Замена стартера", "Ремонт стартера", "Замена ламп освещения",
      "Замена предохранителей", "Ремонт электропроводки", "Установка сигнализации", "Установка видеорегистратора", "Установка камеры заднего вида",
      "Установка парктроников", "Установка магнитолы", "Диагностика электрики",
    ],
  },
  {
    label: "Система охлаждения",
    items: [
      "Замена радиатора", "Замена патрубков", "Замена термостата", "Замена помпы", "Промывка системы охлаждения", "Замена антифриза", "Устранение утечки охлаждающей жидкости",
    ],
  },
  {
    label: "Выхлопная система",
    items: [
      "Замена глушителя", "Замена резонатора", "Замена катализатора", "Удаление катализатора", "Замена лямбда-зонда", "Ремонт выхлопной системы", "Сварочные работы",
    ],
  },
  {
    label: "Шиномонтаж",
    items: [
      "Снятие / установка колеса", "Балансировка колес", "Ремонт прокола", "Ремонт бокового пореза", "Сезонная переобувка", "Хранение шин", "Проверка давления в шинах",
    ],
  },
  {
    label: "Кузовные работы",
    items: [
      "Полировка кузова", "Локальная покраска", "Покраска элемента", "Ремонт бампера", "Ремонт кузова", "Удаление вмятин", "Замена стекла", "Замена зеркала", "Замена фары", "Ремонт креплений",
    ],
  },
  {
    label: "Доп. работы",
    items: [
      "Мойка автомобиля", "Химчистка салона", "Озонация салона", "Подготовка автомобиля к продаже", "Установка дополнительного оборудования", "Эвакуация автомобиля", "Выездная диагностика",
    ],
  },
] as const;
const WORK_STATUS_OPTIONS: Array<{ label: string; kind: WorkStatusKind }> = [
  { label: "Новая", kind: "new" },
  { label: "В работе", kind: "progress" },
  { label: "Ожидает", kind: "wait" },
  { label: "Закрыт", kind: "closed" },
];
const workStatusColorMap: Record<string, string> = {
  Новая: "#ACACAC",
  "В работе": "#2E78C9",
  Ожидает: "#F39D00",
  Закрыт: "#00B515",
};

const MASTER_PROFILE = { fullName: "Журавлёв Михаил Дмитриевич" };
const CURRENT_WORK_ORDER_ID = "593423";
const MASTER_WORK_ORDERS_PAGE_NAME = "Журавлёв М.";
const workOrderMasterOverrideStorageKey = "workOrderMasterOverrides";
const masterFullNameByName: Record<string, string> = {
  "Алексеев Д.": "Алексеев Дмитрий Андреевич",
  "Семёнова Е.": "Семёнова Елена Викторовна",
  "Кириллов О.": "Кириллов Олег Игоревич",
  "Гусева М.": "Гусева Марина Сергеевна",
  "Тимофеев А.": "Тимофеев Артём Павлович",
  "Романова Л.": "Романова Лидия Николаевна",
  "Журавлёв М.": "Журавлёв Михаил Дмитриевич",
  "Кузнецов Е.": "Кузнецов Евгений Александрович",
  "Захарова И.": "Захарова Ирина Олеговна",
};
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
const masterProfileMetaByName: Record<
  string,
  { birthDate: string; gender: string; citizenship: string; phone: string; email: string; role: string; schedule: string; status: string }
> = {
  "Алексеев Д.": { birthDate: "22.07.1990", gender: "Мужской", citizenship: "Российская Федерация", phone: "+7 (911) 101-20-30", email: "alekseev.d@mars-auto.ru", role: "Мастер", schedule: "5/2, 8:00 - 20:00", status: "На смене" },
  "Семёнова Е.": { birthDate: "04.11.1993", gender: "Женский", citizenship: "Российская Федерация", phone: "+7 (911) 111-22-33", email: "semenova.e@mars-auto.ru", role: "Мастер", schedule: "5/2, 8:00 - 20:00", status: "На смене" },
  "Кириллов О.": { birthDate: "13.03.1989", gender: "Мужской", citizenship: "Российская Федерация", phone: "+7 (911) 122-33-44", email: "kirillov.o@mars-auto.ru", role: "Мастер", schedule: "5/2, 8:00 - 20:00", status: "Выходной" },
  "Гусева М.": { birthDate: "29.05.1991", gender: "Женский", citizenship: "Российская Федерация", phone: "+7 (911) 133-44-55", email: "guseva.m@mars-auto.ru", role: "Мастер", schedule: "5/2, 8:00 - 20:00", status: "На смене" },
  "Тимофеев А.": { birthDate: "08.12.1988", gender: "Мужской", citizenship: "Российская Федерация", phone: "+7 (911) 144-55-66", email: "timofeev.a@mars-auto.ru", role: "Мастер", schedule: "5/2, 8:00 - 20:00", status: "На смене" },
  "Романова Л.": { birthDate: "16.09.1994", gender: "Женский", citizenship: "Российская Федерация", phone: "+7 (911) 155-66-77", email: "romanova.l@mars-auto.ru", role: "Мастер", schedule: "5/2, 8:00 - 20:00", status: "Выходной" },
  "Журавлёв М.": { birthDate: "14.02.1992", gender: "Мужской", citizenship: "Российская Федерация", phone: "+7 (911) 123-45-67", email: "zhuravlev.m@mars-auto.ru", role: "Мастер", schedule: "5/2, 8:00 - 20:00", status: "В отпуске" },
  "Кузнецов Е.": { birthDate: "31.01.1990", gender: "Мужской", citizenship: "Российская Федерация", phone: "+7 (911) 166-77-88", email: "kuznetsov.e@mars-auto.ru", role: "Мастер", schedule: "5/2, 8:00 - 20:00", status: "На смене" },
  "Захарова И.": { birthDate: "25.06.1995", gender: "Женский", citizenship: "Российская Федерация", phone: "+7 (911) 177-88-99", email: "zakharova.i@mars-auto.ru", role: "Мастер", schedule: "5/2, 8:00 - 20:00", status: "На смене" },
};
const workOrdersSourceRows = [
  { id: "294894", car: "BMW M5 F90", master: "Алексеев Д.", status: "В работе", dueDate: "02.04.2026" },
  { id: "593423", car: "Kia Rio", master: "Семёнова Е.", status: "Новый", dueDate: "04.04.2026" },
  { id: "839022", car: "Lada Priora", master: "Кириллов О.", status: "Ожидание запчастей", dueDate: "06.04.2026" },
  { id: "847952", car: "Toyota Camry", master: "Гусева М.", status: "В работе", dueDate: "08.04.2026" },
  { id: "495783", car: "Skoda Octavia", master: "Тимофеев А.", status: "Закрыт", dueDate: "10.04.2026" },
  { id: "987384", car: "Hyundai Solaris", master: "Романова Л.", status: "Новый", dueDate: "12.04.2026" },
  { id: "284750", car: "Renault Duster", master: "Журавлёв М.", status: "В работе", dueDate: "14.04.2026" },
  { id: "847597", car: "VW Polo", master: "Кузнецов Е.", status: "Закрыт", dueDate: "16.04.2026" },
  { id: "658472", car: "MAN TGS", master: "Алексеев Д.", status: "В работе", dueDate: "18.04.2026" },
  { id: "309845", car: "Mercedes Actros", master: "Семёнова Е.", status: "Готово", dueDate: "20.04.2026" },
  { id: "208476", car: "Mazda 6", master: "Захарова И.", status: "Ожидание запчастей", dueDate: "22.04.2026" },
  { id: "989923", car: "Ford Transit", master: "Тимофеев А.", status: "Закрыт", dueDate: "24.04.2026" },
  { id: "923117", car: "Nissan X-Trail", master: "Алексеев Д.", status: "В работе", dueDate: "26.04.2026" },
  { id: "731550", car: "Scania R450", master: "Журавлёв М.", status: "Отказ клиента", dueDate: "28.04.2026" },
  { id: "615004", car: "Kia Sportage", master: "Гусева М.", status: "Закрыт", dueDate: "30.04.2026" },
  { id: "771208", car: "Audi A6", master: "Кузнецов Е.", status: "В работе", dueDate: "02.05.2026" },
  { id: "842661", car: "Skoda Kodiaq", master: "Семёнова Е.", status: "Ожидание запчастей", dueDate: "03.05.2026" },
  { id: "904552", car: "DAF XF", master: "Тимофеев А.", status: "Готово", dueDate: "04.05.2026" },
  { id: "956740", car: "BMW X5", master: "Алексеев Д.", status: "В работе", dueDate: "05.05.2026" },
  { id: "118390", car: "Toyota RAV4", master: "Гусева М.", status: "Закрыт", dueDate: "06.05.2026" },
  { id: "552701", car: "BMW 320i", master: "Журавлёв М.", status: "В работе", dueDate: "07.05.2026" },
  { id: "552702", car: "Skoda Rapid", master: "Журавлёв М.", status: "Закрыт", dueDate: "05.05.2026" },
] as const;

function downloadMockDocument(fileName: string) {
  const content = [
    `Документ: ${fileName}`,
    `Дата выгрузки: ${new Date().toLocaleString("ru-RU")}`,
    "",
    "Это демо-файл для проверки скачивания на странице заказ-наряда.",
  ].join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

function parseRubAmount(value: string): number {
  const digits = value.replace(/[^\d]/g, "");
  return digits ? Number(digits) : 0;
}

function parseRuDate(value: string): Date | null {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(value.trim());
  if (!match) return null;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(year, month, day);
  if (date.getFullYear() !== year || date.getMonth() !== month || date.getDate() !== day) return null;
  return date;
}

function isDelayedWorkOrderByPageRules(status: string, dueDate: string, now: Date): boolean {
  if (status !== "В работе" && status !== "Новый") return false;
  const acceptedAt = parseRuDate(dueDate);
  if (!acceptedAt) return false;
  const delayedFromMs = acceptedAt.getTime() + 24 * 60 * 60 * 1000;
  return now.getTime() >= delayedFromMs;
}

function extractWorkOrderIdFromCardText(text: string): string | null {
  const match = /№\s*(\d+)/.exec(text);
  return match ? match[1] : null;
}

function toTelHref(rawPhone: string): string {
  const normalized = rawPhone.replace(/[^\d+]/g, "");
  return `tel:${normalized}`;
}

function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function ClientsStyleCheckboxBox({ checked }: { checked: boolean }) {
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

function MasterActionIcon({ type, className }: { type: "profile" | "schedule" | "switch" | "call"; className?: string }) {
  const cls = `h-[22px] w-[22px] shrink-0 ${className ?? ""}`;
  if (type === "profile") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <circle cx="12" cy="7.5" r="3.5" stroke="currentColor" strokeWidth="2" />
        <path d="M5 20.25C5.5 16.9 8.1 15 12 15C15.9 15 18.5 16.9 19 20.25" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "schedule") {
    return (
      <img src="/zapis.svg" alt="" className={cls} />
    );
  }
  if (type === "call") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
        <path d="M20.2 16.35V19.1C20.2 19.76 19.66 20.3 19 20.3C10.85 20.3 4.2 13.65 4.2 5.5C4.2 4.84 4.74 4.3 5.4 4.3H8.15C8.77 4.3 9.3 4.77 9.37 5.38L9.67 8.03C9.72 8.48 9.57 8.93 9.26 9.26L7.96 10.56C9.05 12.74 10.81 14.5 12.99 15.59L14.29 14.29C14.62 13.98 15.07 13.83 15.52 13.88L18.17 14.18C18.78 14.25 19.25 14.78 19.25 15.4V18.15" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cls} aria-hidden>
      <circle cx="8" cy="8" r="2.5" stroke="currentColor" strokeWidth="1.9" />
      <path d="M3.5 17.5C3.9 14.8 5.8 13.4 8.6 13.4C11.4 13.4 13.3 14.8 13.7 17.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      <path d="M14 9.5H21M18 6.5L21 9.5L18 12.5" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WorkActionIcon({ type, className }: { type: "parts" | "status" | "edit"; className?: string }) {
  const cls = className ?? "";
  if (type === "status") return <RequestActionIconStatus className={cls} />;
  if (type === "edit") return <RequestActionIconEdit className={cls} />;
  return (
    <svg viewBox="0 0 27 27" fill="none" className={`h-[22px] w-[22px] shrink-0 ${cls}`} aria-hidden>
      <path d="M12.1122 12.1112L5.16797 5.16846" stroke="currentColor" strokeWidth="2" />
      <path d="M3.77929 7.25146L7.25138 3.78009L3.08487 1.69727L1.69603 3.08582L3.77929 7.25146ZM24.5771 9.29957C25.2439 8.63351 25.7026 7.78799 25.8974 6.86596C26.0922 5.94394 26.0147 4.98517 25.6743 4.1064L23.6994 6.08092H20.9217V3.30382L22.8966 1.32931C22.0176 0.988198 21.0583 0.910051 20.1357 1.10439C19.213 1.29872 18.3668 1.75715 17.7002 2.42382C17.0335 3.09049 16.5752 3.93662 16.381 4.85912C16.1868 5.78162 16.2652 6.74067 16.6066 7.61943L7.62081 16.6047C6.74187 16.2634 5.78262 16.1851 4.85992 16.3792C3.93723 16.5733 3.09092 17.0316 2.42411 17.6981C1.75731 18.3646 1.29878 19.2106 1.10441 20.1331C0.910032 21.0556 0.988196 22.0146 1.32938 22.8935L3.30291 20.9189H6.08059V23.696L4.10566 25.6705C4.98446 26.0117 5.94349 26.0899 6.86598 25.8958C7.78847 25.7017 8.63461 25.2436 9.30134 24.5773C9.96808 23.911 10.4266 23.0653 10.6212 22.1431C10.8157 21.2208 10.7379 20.262 10.3971 19.3832L19.3856 10.3965C20.2642 10.7363 21.2226 10.8135 22.1443 10.6187C23.066 10.424 23.9112 9.96569 24.5771 9.29957Z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
      <path d="M13.2188 16.972L21.0018 24.7534C21.1759 24.9279 21.3828 25.0663 21.6105 25.1607C21.8382 25.2551 22.0823 25.3037 22.3288 25.3037C22.5753 25.3037 22.8194 25.2551 23.0472 25.1607C23.2749 25.0663 23.4817 24.9279 23.6559 24.7534L24.7558 23.6537C24.9303 23.4796 25.0687 23.2728 25.1632 23.0451C25.2576 22.8174 25.3062 22.5734 25.3062 22.3269C25.3062 22.0805 25.2576 21.8364 25.1632 21.6088C25.0687 21.3811 24.9303 21.1743 24.7558 21.0002L16.9728 13.2188" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
    </svg>
  );
}

export function WorkOrdersDetailsPage() {
  const navigate = useNavigate();
  const isManager = CURRENT_USER_ROLE === "manager";
  const [activeTab, setActiveTab] = useState<"client" | "car">("client");
  const [displayedTab, setDisplayedTab] = useState<"client" | "car">("client");
  const [leftContentPhase, setLeftContentPhase] = useState<"idle" | "out" | "in">("idle");
  const [activeClientPanel, setActiveClientPanel] = useState<"main" | "cars">("main");
  const [activeCarPanel, setActiveCarPanel] = useState<"orders" | "documents" | "photos" | "finance">("orders");
  const [workSearchQuery, setWorkSearchQuery] = useState("");
  const [worksScope, setWorksScope] = useState<"current" | "completed">("current");
  const [workActionsModal, setWorkActionsModal] = useState<{ title: string; workId: string; scope: "current" | "completed"; statusLabel: string } | null>(null);
  const [workStatusPicker, setWorkStatusPicker] = useState<{ title: string; workId: string; statusLabel: string } | null>(null);
  const [masterActionsModalOpen, setMasterActionsModalOpen] = useState(false);
  const [switchMasterModalOpen, setSwitchMasterModalOpen] = useState(false);
  const [switchMasterSelection, setSwitchMasterSelection] = useState<string | null>(null);
  const [assignedMasterName, setAssignedMasterName] = useState<string>(MASTER_WORK_ORDERS_PAGE_NAME);
  const [employeeProfileModal, setEmployeeProfileModal] = useState<typeof MASTER_PROFILE | null>(null);
  const [employeeProfileSnapshot, setEmployeeProfileSnapshot] = useState<typeof MASTER_PROFILE | null>(null);
  const [employeeProfileMounted, setEmployeeProfileMounted] = useState(false);
  const [employeeProfileActive, setEmployeeProfileActive] = useState(false);
  const [employeeProfileTab, setEmployeeProfileTab] = useState<"main" | "kpi" | "orders">("main");
  const [employeeOrdersSection, setEmployeeOrdersSection] = useState<"active" | "recentlyDone" | "delayed">("active");
  const profileExitFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileExitingRef = useRef(false);
  const addWorkExitFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addWorkExitingRef = useRef(false);
  const openProfileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [carPhotos, setCarPhotos] = useState<string[]>(initialCarPhotoItems);
  const [newlyAddedPhoto, setNewlyAddedPhoto] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [addPhotoModalOpen, setAddPhotoModalOpen] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoPreview, setNewPhotoPreview] = useState("");
  const [addWorkModalOpen, setAddWorkModalOpen] = useState(false);
  const [addWorkModalMounted, setAddWorkModalMounted] = useState(false);
  const [addWorkModalActive, setAddWorkModalActive] = useState(false);
  const [addWorkSearchQuery, setAddWorkSearchQuery] = useState("");
  const [addWorkCategory, setAddWorkCategory] = useState<(typeof workCatalogSections)[number]["label"]>("Все работы");
  const [selectedWorkCatalogItem, setSelectedWorkCatalogItem] = useState<{ title: string; price: number; durationMin: number } | null>(null);
  const [extraCurrentWorks, setExtraCurrentWorks] = useState<WorkRow[]>([]);
  const [workStatusById, setWorkStatusById] = useState<Record<string, { label: string; kind: WorkStatusKind }>>({});
  const [highlightedWorkId, setHighlightedWorkId] = useState<string | null>(null);
  const [clientFields, setClientFields] = useState(publicProfileFields);
  const [vehicleFields, setVehicleFields] = useState(carProfileFields);
  const [isEditingFields, setIsEditingFields] = useState(false);
  const assignedMasterFullName = masterFullNameByName[assignedMasterName] ?? assignedMasterName;
  const assignedMasterPhoto = masterPhotoByName[assignedMasterName] ?? "https://i.pravatar.cc/80";
  const assignedMasterPhotoLarge = assignedMasterPhoto.replace("/80?", "/160?");
  const assignedMasterNameParts = assignedMasterFullName.split(" ");
  const assignedMasterFirstLine = assignedMasterNameParts.slice(0, 2).join(" ");
  const assignedMasterSecondLine = assignedMasterNameParts.slice(2).join(" ");
  const currentWorkOrderStatus =
    workOrdersSourceRows.find((row) => row.id === CURRENT_WORK_ORDER_ID)?.status ?? "Новый";
  const assignedMasterProfileMeta =
    masterProfileMetaByName[assignedMasterName] ??
    { birthDate: "-", gender: "-", citizenship: "-", phone: "-", email: "-", role: "Мастер", schedule: "5/2, 8:00 - 20:00", status: "-" };
  const visibleFields = displayedTab === "client" ? clientFields : vehicleFields;
  const totalOrders = clientCars.reduce((sum, car) => sum + car.orders, 0);
  const totalAmount = clientCars.reduce((sum, car) => sum + car.amount, 0);
  const averageCheck = totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0;
  const formatCurrency = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;
  const currentWorks = useMemo(() => [...extraCurrentWorks, ...workOrderCurrentWorks], [extraCurrentWorks]);
  const allWorks = [...currentWorks, ...workOrderCompletedWorks];
  const worksSubtotal = allWorks.reduce((sum, [, , amount]) => sum + parseRubAmount(amount), 0);
  const partsSubtotal = Math.round(worksSubtotal * 0.35);
  const grossSubtotal = worksSubtotal + partsSubtotal;
  const discountAmount = Math.round(grossSubtotal * 0.07);
  const totalToPay = grossSubtotal - discountAmount;
  const paidAmount = Math.round(totalToPay * 0.62);
  const dueAmount = Math.max(totalToPay - paidAmount, 0);
  const employeeKpiCards = useMemo(() => {
    const closedWorks = workOrderCompletedWorks.length;
    const activeWorks = currentWorks.length;
    const totalWorksCount = closedWorks + activeWorks;
    const closedRevenue = workOrderCompletedWorks.reduce((sum, [, , amount]) => sum + parseRubAmount(amount), 0);
    const activeRevenueForecast = Math.round(
      currentWorks.reduce((sum, [, , amount]) => sum + parseRubAmount(amount), 0) * 0.55,
    );
    const monthlyRevenue = closedRevenue + activeRevenueForecast;
    const normHoursPlan = 160;
    const normHoursDone = Math.min(normHoursPlan, closedWorks * 8 + activeWorks * 4);
    const loadPct = Math.round((normHoursDone / normHoursPlan) * 100);
    const avgCheck = totalWorksCount > 0 ? Math.round(monthlyRevenue / totalWorksCount) : 0;
    const salary = Math.round(45000 + monthlyRevenue * 0.06 + closedWorks * 1100);
    const extraSales = Math.round(partsSubtotal * 0.42 + closedWorks * 350);
    const weeklyDeltaBase = Math.max(3, Math.round(totalWorksCount * 0.4));
    const weeklyPctBase = Math.max(4, Math.round(loadPct * 0.09));

    return [
      { title: "Выручка сотрудника", value: `${formatCurrency(monthlyRevenue)} за месяц`, note: `↑ +${weeklyDeltaBase + 5} (+${weeklyPctBase + 3}%) за неделю` },
      { title: "Выработка (нормо-часы)", value: `${normHoursDone} ч / ${normHoursPlan} ч`, note: `↑ +${Math.max(2, Math.round(normHoursDone * 0.08))} ч за неделю` },
      { title: "Загрузка (%)", value: `${loadPct}%`, note: `↑ +${Math.max(2, Math.round(loadPct * 0.06))}% за неделю` },
      { title: "Кол-во заказов", value: `${totalWorksCount} заказов`, note: `↑ +${Math.max(1, Math.round(closedWorks * 0.35))} за неделю` },
      { title: "Средний чек", value: formatCurrency(avgCheck), note: `↑ +${Math.max(300, Math.round(avgCheck * 0.07)).toLocaleString("ru-RU")} ₽ за неделю` },
      { title: "Зарплата (расчёт)", value: formatCurrency(salary + extraSales), note: `включая доп. продажи ${formatCurrency(extraSales)}` },
    ];
  }, [currentWorks, formatCurrency, partsSubtotal]);
  const masterDelayedOrderItems = useMemo(() => {
    const now = new Date();
    return workOrdersSourceRows
      .filter(
        (row) =>
          row.master === assignedMasterName &&
          isDelayedWorkOrderByPageRules(row.status, row.dueDate, now),
      )
      .map((row) => ({
        type: "Заказ-наряд",
        text: `Заказ-наряд №${row.id} · ${row.car}`,
        icon: "/group87.svg",
      }));
  }, [assignedMasterName]);
  const masterActiveOrderItems = useMemo(() => {
    const today = new Date();
    return workOrdersSourceRows
      .filter((row) => {
        if (row.master !== assignedMasterName) return false;
        if (row.status !== "Новый" && row.status !== "В работе") return false;
        const acceptedAt = parseRuDate(row.dueDate);
        if (!acceptedAt) return false;
        return (
          acceptedAt.getFullYear() === today.getFullYear() &&
          acceptedAt.getMonth() === today.getMonth() &&
          acceptedAt.getDate() === today.getDate()
        );
      })
      .map((row) => ({
        type: "Заказ-наряд",
        text: `Заказ-наряд №${row.id} · ${row.car}`,
        icon: "/group87.svg",
      }));
  }, [assignedMasterName]);
  const masterCompletedOrderItems = useMemo(() => {
    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return workOrdersSourceRows
      .filter((row) => {
        if (row.master !== assignedMasterName) return false;
        if (row.status !== "Закрыт" && row.status !== "Отказ клиента") return false;
        const acceptedAt = parseRuDate(row.dueDate);
        if (!acceptedAt) return false;
        const diffMs = now.getTime() - acceptedAt.getTime();
        return diffMs >= 0 && diffMs <= sevenDaysMs;
      })
      .map((row) => ({
        type: "Заказ-наряд",
        text: `Заказ-наряд №${row.id} · ${row.car}`,
        icon: "/group87.svg",
      }));
  }, [assignedMasterName]);
  const availableMasters = useMemo(
    () =>
      [...new Set(workOrdersSourceRows.map((row) => row.master))]
        .filter((masterName) => masterName !== assignedMasterName)
        .sort((a, b) => a.localeCompare(b, "ru")),
    [assignedMasterName],
  );
  const filteredWorks = useMemo(() => {
    const sourceRows = worksScope === "current" ? currentWorks : workOrderCompletedWorks;
    const normalizedRows = sourceRows.map((row, sourceIndex) => {
      const [title, statusLabel, amount, kind, addedDate, workId] = row;
      const rowWorkId = workId ?? `${worksScope}-base-${sourceIndex}`;
      const override = workStatusById[rowWorkId];
      return {
        title,
        statusLabel: override?.label ?? statusLabel,
        amount,
        kind: override?.kind ?? kind,
        addedDate,
        rowWorkId,
      };
    });
    const query = workSearchQuery.trim().toLowerCase();
    if (!query) return normalizedRows;
    return normalizedRows.filter((row) => row.title.toLowerCase().includes(query));
  }, [worksScope, workSearchQuery, currentWorks, workStatusById]);

  const filteredCatalogWorks = useMemo(() => {
    const allItems = workCatalogSections.flatMap((section) => (section.label === "Все работы" ? [] : section.items));
    const categoryItems =
      addWorkCategory === "Все работы"
        ? [...new Set(allItems)]
        : workCatalogSections.find((section) => section.label === addWorkCategory)?.items ?? [];
    const query = normalizeSearchText(addWorkSearchQuery);
    const pricedItems = categoryItems.map((title) => ({
      title,
      price: 1500 + title.length * 120,
      durationMin: 20 + (title.length % 9) * 10,
    }));
    if (!query) return pricedItems;
    const exactMatches = pricedItems.filter((item) => normalizeSearchText(item.title) === query);
    if (exactMatches.length > 0) return exactMatches;

    const startsWithMatches = pricedItems.filter((item) => normalizeSearchText(item.title).startsWith(query));
    if (startsWithMatches.length > 0) return startsWithMatches;

    return pricedItems.filter((item) => normalizeSearchText(item.title).includes(query));
  }, [addWorkSearchQuery, addWorkCategory]);
  const leftContentMotionClass = useMemo(() => {
    if (leftContentPhase === "out") return "animate-[workOrderLeftOut_180ms_ease_forwards]";
    if (leftContentPhase === "in") return "animate-[workOrderLeftIn_240ms_cubic-bezier(0.22,1,0.36,1)_forwards]";
    return "";
  }, [leftContentPhase]);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    if (activeTab === displayedTab) return;
    setLeftContentPhase("out");
    const swapTimer = window.setTimeout(() => {
      setDisplayedTab(activeTab);
      setLeftContentPhase("in");
    }, 180);
    const settleTimer = window.setTimeout(() => {
      setLeftContentPhase("idle");
    }, 430);
    return () => {
      window.clearTimeout(swapTimer);
      window.clearTimeout(settleTimer);
    };
  }, [activeTab, displayedTab]);

  useEffect(() => {
    if (!workActionsModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setWorkActionsModal(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workActionsModal]);

  useEffect(() => {
    if (!workStatusPicker) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setWorkStatusPicker(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [workStatusPicker]);

  useEffect(() => {
    if (!switchMasterModalOpen) setSwitchMasterSelection(null);
  }, [switchMasterModalOpen]);

  useEffect(() => {
    const focusWorkId = searchParams.get("focusWorkId");
    const armedFocusId = window.sessionStorage.getItem("workFocusId");
    if (!focusWorkId || armedFocusId !== focusWorkId) return;
    window.sessionStorage.removeItem("workFocusId");
    setActiveCarPanel("orders");
    setWorksScope("current");
    setHighlightedWorkId(focusWorkId);
    // Consume the flag immediately so later rerenders won't retrigger highlight.
    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("focusWorkId");
      next.delete("panel");
      return next;
    }, { replace: true });
    const clearId = window.setTimeout(() => setHighlightedWorkId(null), 4000);
    return () => {
      window.clearTimeout(clearId);
    };
  }, [searchParams, setSearchParams]);

  useEffect(() => {
    if (addWorkModalOpen) {
      addWorkExitingRef.current = false;
      if (addWorkExitFallbackRef.current) {
        clearTimeout(addWorkExitFallbackRef.current);
        addWorkExitFallbackRef.current = null;
      }
      setAddWorkModalMounted(true);
      setAddWorkModalActive(false);
      setAddWorkSearchQuery("");
      setSelectedWorkCatalogItem(null);
      setAddWorkCategory("Все работы");
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.setTimeout(() => setAddWorkModalActive(true), 90);
        });
      });
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") setAddWorkModalOpen(false);
      }
      window.addEventListener("keydown", onKey);
      return () => {
        cancelAnimationFrame(id);
        window.removeEventListener("keydown", onKey);
      };
    }
    addWorkExitingRef.current = true;
    setAddWorkModalActive(false);
  }, [addWorkModalOpen]);

  useEffect(() => {
    const raw = window.localStorage.getItem(workOrderMasterOverrideStorageKey);
    if (!raw) return;
    try {
      const parsed = JSON.parse(raw) as Record<string, string>;
      const overrideMaster = parsed[CURRENT_WORK_ORDER_ID];
      if (overrideMaster) {
        setAssignedMasterName(overrideMaster);
      }
    } catch {
      // ignore invalid storage payload
    }
  }, []);

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

  function handleProfileDrawerTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    if (e.target !== e.currentTarget) return;
    if (profileExitingRef.current) {
      profileExitingRef.current = false;
      finishProfileExit();
    }
  }

  function finishAddWorkExit() {
    setAddWorkModalMounted(false);
    if (addWorkExitFallbackRef.current) {
      clearTimeout(addWorkExitFallbackRef.current);
      addWorkExitFallbackRef.current = null;
    }
  }

  function handleAddWorkDrawerTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    if (e.target !== e.currentTarget) return;
    if (addWorkExitingRef.current) {
      addWorkExitingRef.current = false;
      finishAddWorkExit();
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

  useEffect(() => {
    if (!addWorkModalOpen && addWorkModalMounted) {
      addWorkExitFallbackRef.current = setTimeout(finishAddWorkExit, 700);
      return () => {
        if (addWorkExitFallbackRef.current) {
          clearTimeout(addWorkExitFallbackRef.current);
          addWorkExitFallbackRef.current = null;
        }
      };
    }
  }, [addWorkModalOpen, addWorkModalMounted]);

  useEffect(() => {
    if (selectedPhotoIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedPhotoIndex(null);
        return;
      }
      if (e.key === "ArrowRight") {
        setSelectedPhotoIndex((prev) => (prev === null ? 0 : (prev + 1) % carPhotos.length));
        return;
      }
      if (e.key === "ArrowLeft") {
        setSelectedPhotoIndex((prev) => (prev === null ? 0 : (prev - 1 + carPhotos.length) % carPhotos.length));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPhotoIndex, carPhotos.length]);

  function closeAddPhotoModal() {
    setAddPhotoModalOpen(false);
    setNewPhotoUrl("");
    setNewPhotoPreview("");
  }

  function navigateToWorkOrderFromCard(text: string) {
    const workOrderId = extractWorkOrderIdFromCardText(text);
    if (!workOrderId) return;
    navigate(`/work-orders?workOrder=${workOrderId}`);
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-black tracking-[-0.02em]">
      <div className="flex h-full w-full p-2">
        <div className="flex h-full w-full rounded-[16px] bg-black p-2 shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)]">
          <aside className="mr-2 flex w-[100px] flex-col items-center rounded-[11px] bg-black">
            <button className="mb-2 grid h-[90px] w-full place-items-center rounded-[16px] bg-[#EC1C24] text-[18px] font-semibold text-white">Марс</button>
            <button onClick={() => navigate("/dashboard")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="home" /></button>
            <button onClick={() => navigate("/")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="cube" /></button>
            <button onClick={() => navigate("/journal")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="layers" /></button>
            <button onClick={() => navigate("/work-orders")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] bg-white text-[#11131D]"><MarsShellSidebarIcon type="chat" /></button>
            <button onClick={() => navigate("/clients")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="pie" /></button>
            <div className="mt-auto space-y-2">
              {!isManager ? <button className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="grid" /></button> : null}
              {!isManager ? <button className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="doc" /></button> : null}
              <NavRailNotifications />
              {!isManager ? (
                <button
                  type="button"
                  className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5] hover:bg-white/10"
                  title="Настройки"
                  aria-label="Настройки"
                >
                  <MarsShellSidebarIcon type="settings" />
                </button>
              ) : null}
              <button className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="user" /></button>
            </div>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col">
            <header className="mb-2 rounded-[16px] border border-[#DDE1E7] bg-white px-5 py-5">
              <div className="flex items-center gap-3">
                <h1 className="text-[36px] font-bold leading-[100%] tracking-[-0.02em] text-[#111826]">Заказ-наряд №593423</h1>
                <span className="rounded-[10px] bg-[#F3F3F5] px-3 py-2 text-[16px] font-medium tracking-[-0.02em] text-[#111826]">
                  {currentWorkOrderStatus}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  <div className="relative">
                    <input
                      value={activeCarPanel === "orders" ? workSearchQuery : ""}
                      onChange={(e) => {
                        if (activeCarPanel === "orders") setWorkSearchQuery(e.target.value);
                      }}
                      className="h-12 w-[320px] rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 pr-11 text-[18px] font-medium tracking-[-0.02em] text-black outline-none placeholder:text-[#B5B5B5] [color-scheme:light] [&::-webkit-search-cancel-button]:hidden"
                      placeholder={activeCarPanel === "orders"
                        ? "Поиск работы..."
                        : activeTab === "client"
                          ? "Поиск автомобиля клиента..."
                          : "Поиск заказ-наряда..."}
                    />
                    {activeCarPanel === "orders" && workSearchQuery.trim() ? (
                      <button
                        type="button"
                        onClick={() => setWorkSearchQuery("")}
                        aria-label="Очистить поиск"
                        className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-black"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-[16px] w-[16px]" aria-hidden>
                          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                  <button className="h-12 rounded-[10px] bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.02em] text-white">
                    Позвонить клиенту
                  </button>
                </div>
              </div>
            </header>

            <section className="relative flex min-h-0 flex-1 gap-2">
              <section className="relative z-20 w-[40%] min-w-[360px] rounded-[16px] bg-white p-6">
                <div className={leftContentMotionClass}>
                  <div
                    style={{ transitionDelay: "0ms" }}
                    className="flex items-start justify-between gap-4 transition-all duration-350 ease-out"
                  >
                    <div>
                      <h1 className="max-w-[420px] text-[52px] font-semibold leading-[0.98] tracking-[-0.03em] text-[#202636]">
                        {displayedTab === "client" ? (
                          <>
                            <span className="block whitespace-nowrap">Смирнова Наталья</span>
                            <span className="block">Викторовна</span>
                          </>
                        ) : (
                          <>
                            <span className="block whitespace-nowrap">BMW M5 F90</span>
                            <span className="block">Competition</span>
                          </>
                        )}
                      </h1>
                    </div>
                    <button
                      type="button"
                      onClick={() => setIsEditingFields((v) => !v)}
                      className={`grid h-12 w-12 cursor-pointer place-items-center rounded-[10px] ${
                        isEditingFields ? "bg-[#EC1C24] text-white" : "bg-[#F3F3F5] text-[#8C909C]"
                      }`}
                      aria-label="Редактировать поля"
                    >
                      <svg viewBox="0 0 24 24" fill="none" className="h-[28px] w-[28px]">
                        <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        <path d="M12.5 7l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-[50px]">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                      {visibleFields.map((field, index) => {
                        const isCommentField = displayedTab === "client" && field.label === "Комментарий";
                        return (
                          <div
                            key={field.label}
                            style={{
                              transitionDelay:
                                displayedTab === "client"
                                  ? `${index * 24}ms`
                                  : `${(visibleFields.length - 1 - index) * 18}ms`,
                              transitionDuration: displayedTab === "client" ? "350ms" : "240ms",
                            }}
                            className={`${isCommentField ? "col-span-2 h-[68px]" : "h-[68px]"} rounded-[10px] border-2 px-4 py-3 transition-all duration-350 ease-out ${
                              isEditingFields ? "border-[#EC1C24] bg-white" : "border-transparent bg-[#F3F3F5]"
                            }`}
                          >
                            <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">{field.label}</p>
                            {isEditingFields ? (
                              <input
                                value={field.value}
                                onChange={(e) => {
                                  const nextValue = e.target.value;
                                  if (displayedTab === "client") {
                                    setClientFields((prev) =>
                                      prev.map((item) =>
                                        item.label === field.label ? { ...item, value: nextValue } : item,
                                      ),
                                    );
                                  } else {
                                    setVehicleFields((prev) =>
                                      prev.map((item) =>
                                        item.label === field.label ? { ...item, value: nextValue } : item,
                                      ),
                                    );
                                  }
                                }}
                                className="mt-1 block w-full bg-transparent text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352] outline-none"
                              />
                            ) : (
                              <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">{field.value}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-[50px]" />
                </div>
                <div className="absolute bottom-4 left-1/2 -translate-x-1/2 inline-grid grid-cols-2 rounded-full bg-[#11131D] p-1 text-[12px] shadow-[0_8px_24px_-14px_rgba(0,0,0,0.8)]">
                  <span
                    className={`absolute left-1 top-1 bottom-1 z-0 w-[132px] rounded-full bg-[#EC1C24] shadow-[0_6px_14px_-8px_rgba(236,28,36,0.85)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      activeTab === "client" ? "translate-x-0" : "translate-x-[132px]"
                    }`}
                  />
                  <button
                    onClick={() => setActiveTab("client")}
                    className={`relative z-10 w-[132px] rounded-full px-5 py-2 text-center text-[16px] font-bold tracking-[-0.02em] transition-colors duration-300 ${
                      activeTab === "client" ? "text-white" : "text-white/80 hover:text-white"
                    }`}
                  >
                    Клиент
                  </button>
                  <button
                    onClick={() => setActiveTab("car")}
                    className={`relative z-10 w-[132px] rounded-full px-5 py-2 text-center text-[16px] font-bold tracking-[-0.02em] transition-colors duration-300 ${
                      activeTab === "car" ? "text-white" : "text-white/80 hover:text-white"
                    }`}
                  >
                    Автомобиль
                  </button>
                </div>
              </section>

              <section className="relative z-20 min-w-0 flex-1 rounded-[16px] bg-white p-6">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="inline-flex w-fit items-center gap-1 rounded-full p-1">
                    {[
                      { label: "Работы", value: "orders" as const },
                      { label: "Документы", value: "documents" as const },
                      { label: "Фото автомобиля", value: "photos" as const },
                      { label: "Финансовая сводка", value: "finance" as const },
                    ].map((tab) => (
                      <button
                        key={tab.label}
                        type="button"
                        onClick={() => setActiveCarPanel(tab.value)}
                        className={`rounded-full px-4 py-2 text-[14px] font-medium tracking-[-0.02em] text-black ${
                          activeCarPanel === tab.value
                            ? "bg-[#F8F8FA]"
                            : "bg-transparent"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  <>
                    {activeCarPanel === "documents" ? (
                        <article className="relative order-2 mt-[107px] min-h-0 flex-1 rounded-[12px] bg-transparent">
                          <div className="absolute left-0 right-0 top-0 -translate-y-full pb-3">
                            <div className="flex w-full items-center justify-between">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Документы</h3>
                              <button
                                type="button"
                                className="shrink-0 cursor-pointer rounded-[10px] bg-black px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] text-white"
                              >
                                Добавить документ
                              </button>
                            </div>
                          </div>
                          <div className="hide-scrollbar min-h-0 min-w-0 max-h-[598px] space-y-4 overflow-y-auto overflow-x-hidden scroll-smooth rounded-lg bg-transparent">
                            {carDocumentItems.map((item) => (
                              <article key={item} className="flex w-full items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                                  <img src="/document.svg" alt="" className="h-5 w-4" />
                                </span>
                                <p className="text-[20px] font-medium leading-[1.1] tracking-[-0.02em] text-[#7D7D7D]">{item}</p>
                                <button
                                  type="button"
                                  onClick={() => downloadMockDocument(item)}
                                  className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EC1C24] text-white"
                                >
                                  <img src="/download.svg" alt="" className="h-[19px] w-[18px]" />
                                </button>
                              </article>
                            ))}
                          </div>
                        </article>
                    ) : activeCarPanel === "orders" ? (
                        <article className="relative order-2 mt-[107px] min-h-0 flex-1 rounded-[12px] bg-transparent">
                          <div className="absolute left-0 top-0 -translate-y-full pb-3">
                            <div className="flex items-center">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Ответственный мастер</h3>
                            </div>
                          </div>
                          <div className="hide-scrollbar flex min-h-0 min-w-0 max-h-[598px] flex-col gap-4 overflow-y-auto overflow-x-hidden scroll-smooth rounded-lg bg-transparent pr-1">
                            <article
                              className="flex cursor-pointer items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3"
                              onClick={() => {
                                const profilePayload = { fullName: assignedMasterFullName };
                                setEmployeeProfileSnapshot(profilePayload);
                                setEmployeeProfileModal(profilePayload);
                                setEmployeeProfileTab("main");
                                setEmployeeOrdersSection("active");
                              }}
                            >
                              <div className="flex min-w-0 flex-1 items-center gap-3 text-[20px] font-medium leading-[1.5] tracking-[-0.02em] text-black">
                                <span className="inline-flex h-[1lh] w-[1lh] shrink-0 overflow-hidden rounded-full bg-[#E8E8EC]">
                                  <img
                                    src={assignedMasterPhoto}
                                    alt={assignedMasterFullName}
                                    className="h-full w-full object-cover"
                                  />
                                </span>
                                <p className="min-w-0 text-black">{assignedMasterFullName}</p>
                              </div>
                              <button
                                type="button"
                                className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-[22px] font-semibold text-[#7D7D7D]"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMasterActionsModalOpen(true);
                                }}
                              >
                                ...
                              </button>
                            </article>

                            <div className="mt-[28px] min-h-0 min-w-0 flex-1 rounded-[12px] bg-white">
                              <div className="flex items-center">
                                <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Работы</h3>
                                <div className="ml-auto flex flex-wrap items-center pl-1">
                                  <div className="flex items-center gap-6">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHighlightedWorkId(null);
                                        window.sessionStorage.removeItem("workFocusId");
                                        setWorksScope("current");
                                      }}
                                      className="flex cursor-pointer items-center gap-2 text-[16px] font-medium tracking-[-0.04em] text-black"
                                    >
                                      <ClientsStyleCheckboxBox checked={worksScope === "current"} />
                                      <span>Текущие</span>
                                      <span className="tabular-nums text-[#7D7D7D]">({currentWorks.length})</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHighlightedWorkId(null);
                                        window.sessionStorage.removeItem("workFocusId");
                                        setWorksScope("completed");
                                      }}
                                      className="flex cursor-pointer items-center gap-2 text-[16px] font-medium tracking-[-0.04em] text-black"
                                    >
                                      <ClientsStyleCheckboxBox checked={worksScope === "completed"} />
                                      <span>Завершенные</span>
                                      <span className="tabular-nums text-[#7D7D7D]">({workOrderCompletedWorks.length})</span>
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => setAddWorkModalOpen(true)}
                                    className="ml-[60px] shrink-0 cursor-pointer rounded-[10px] bg-black px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] text-white"
                                  >
                                    Добавить работу
                                  </button>
                                </div>
                              </div>
                              <div className="hide-scrollbar mt-3 min-h-0 min-w-0 max-h-[405px] overflow-y-scroll overflow-x-hidden scroll-smooth rounded-lg bg-transparent">
                                <table className="w-full table-fixed border-separate border-spacing-0 whitespace-nowrap text-[16px] font-medium tracking-[-0.02em]">
                                  <colgroup>
                                    <col className="w-[35%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[14%]" />
                                    <col className="w-[16%]" />
                                    <col className="w-[6%]" />
                                  </colgroup>
                                  <thead className="sticky top-0 z-10 bg-[#F3F3F5] text-left text-[16px] font-medium tracking-[-0.02em] text-[#7D7D7D]">
                                    <tr className="h-[45px]">
                                      <th className="h-[45px] rounded-l-[5px] px-3 align-middle font-medium">Название работы</th>
                                      <th className="h-[45px] px-3 align-middle font-medium">Статус</th>
                                      <th className="h-[45px] px-3 align-middle font-medium">Сумма</th>
                                      <th className="h-[45px] px-3 align-middle font-medium">Дата добавления</th>
                                      <th className="h-[45px] rounded-r-[5px] px-3 text-center align-middle font-medium">⋮</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {filteredWorks.map(
                                      (row, index) => {
                                        const { title, statusLabel, amount, kind, addedDate, rowWorkId } = row;
                                        const dotClass =
                                          kind === "closed"
                                            ? "bg-[#00B515]"
                                            : kind === "new"
                                              ? "bg-[#ACACAC]"
                                            : kind === "progress"
                                              ? "bg-[#2E78C9]"
                                              : "bg-[#FFB020]";
                                        return (
                                          <tr
                                            key={`${worksScope}-${title}-${index}`}
                                            className={`h-[45px] transition hover:bg-[rgba(224,9,25,0.10)] ${index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white"}`}
                                            style={highlightedWorkId === rowWorkId ? { animation: "workRowHighlightBorder 4s ease-out" } : undefined}
                                          >
                                            <td className="h-[45px] truncate px-3 align-middle text-black">{title}</td>
                                            <td className="h-[45px] px-3 align-middle">
                                              <span className="inline-flex items-center gap-2 font-medium text-black">
                                                <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${dotClass}`} />
                                                <span className="font-medium text-black">{statusLabel}</span>
                                              </span>
                                            </td>
                                            <td className="h-[45px] px-3 align-middle text-black">{amount}</td>
                                            <td className="h-[45px] px-3 align-middle text-black">{addedDate}</td>
                                            <td className="h-[45px] px-3 text-center align-middle">
                                              <button
                                                type="button"
                                                className="cursor-pointer rounded-md px-1.5 py-0.5 text-[16px] font-bold leading-none tracking-[-0.04em] text-[#A0A0A0] transition-colors hover:bg-black/[0.04] hover:text-[#EC1C24]"
                                                aria-label="Действия"
                                                onClick={() => setWorkActionsModal({ title, workId: rowWorkId, scope: worksScope, statusLabel })}
                                              >
                                                ...
                                              </button>
                                            </td>
                                          </tr>
                                        );
                                      },
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </article>
                    ) : activeCarPanel === "finance" ? (
                        <article className="relative mt-[107px] min-h-0 flex-1 rounded-[12px] bg-transparent tracking-[-0.04em]">
                          <div className="absolute left-0 right-0 top-0 -translate-y-full pb-3">
                            <div className="flex w-full items-center justify-between">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Финансовая сводка</h3>
                              <button
                                type="button"
                                className="shrink-0 cursor-pointer rounded-[10px] bg-black px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] text-white"
                              >
                                Экспорт в PDF
                              </button>
                            </div>
                          </div>
                          <div className="min-h-0 space-y-4">
                            <div className="grid grid-cols-3 gap-3">
                              <article className="rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                <p className="text-[14px] font-medium tracking-[-0.02em] text-[#6F7785]">Стоимость работ</p>
                                <p className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-[#EC1C24]">
                                  {formatCurrency(worksSubtotal)}
                                </p>
                              </article>
                              <article className="rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                <p className="text-[14px] font-medium tracking-[-0.02em] text-[#6F7785]">Стоимость запчастей</p>
                                <p className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-[#EC1C24]">
                                  {formatCurrency(partsSubtotal)}
                                </p>
                              </article>
                              <article className="rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                <p className="text-[14px] font-medium tracking-[-0.02em] text-[#6F7785]">Количество работ</p>
                                <p className="mt-2 text-[30px] font-semibold leading-none tracking-[-0.03em] text-[#EC1C24]">
                                  {allWorks.length}
                                </p>
                              </article>
                            </div>

                            <div className="rounded-[12px] bg-[#F3F3F5] px-5 py-4">
                              <div className="space-y-2 text-[16px]">
                                <div className="flex items-center justify-between">
                                  <span className="text-[#6F7785]">Работы</span>
                                  <span className="font-medium text-[#111826]">{formatCurrency(worksSubtotal)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[#6F7785]">Запчасти</span>
                                  <span className="font-medium text-[#111826]">{formatCurrency(partsSubtotal)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[#6F7785]">Скидка 7%</span>
                                  <span className="font-medium text-[#EC1C24]">- {formatCurrency(discountAmount)}</span>
                                </div>
                                <div className="my-2 border-t border-[#E2E5EA]" />
                                <div className="flex items-center justify-between">
                                  <span className="text-[18px] font-semibold text-[#111826]">Итого к оплате</span>
                                  <span className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">{formatCurrency(totalToPay)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[#6F7785]">Оплачено</span>
                                  <span className="font-medium text-[#00B515]">{formatCurrency(paidAmount)}</span>
                                </div>
                                <div className="flex items-center justify-between">
                                  <span className="text-[#6F7785]">К доплате</span>
                                  <span className="font-medium text-[#EC1C24]">{formatCurrency(dueAmount)}</span>
                                </div>
                              </div>
                            </div>
                            <button
                              type="button"
                              className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[8px] border border-[#D8DDE6] bg-white text-[16px] font-semibold text-[#EC1C24]"
                            >
                              <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
                                <path d="M12 5V19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                                <path d="M5 12H19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              </svg>
                              Распечатать чек
                            </button>
                          </div>
                        </article>
                    ) : (
                        <article className="relative mt-[107px] flex min-h-0 flex-1 flex-col rounded-[12px] bg-transparent">
                          <div className="absolute left-0 top-0 -translate-y-full pb-3">
                            <div className="flex items-center">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Фото автомобиля</h3>
                            </div>
                          </div>
                          <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto scroll-smooth pr-1">
                            <div className="grid grid-cols-3 gap-3">
                              {carPhotos.map((photoSrc, index) => (
                                <article
                                  key={index}
                                  onClick={() => setSelectedPhotoIndex(index)}
                                  className={`group relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-[10px] bg-[#F3F3F5] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-12px_rgba(17,24,38,0.45)] ${
                                    newlyAddedPhoto === photoSrc
                                      ? "animate-[photoCardIn_420ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
                                      : ""
                                  }`}
                                >
                                  <img src={photoSrc} alt="BMW M5 F90 Competition" className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
                                  <span className="pointer-events-none absolute inset-0 rounded-[10px] ring-2 ring-transparent transition-all duration-300 group-hover:ring-[#EC1C24]/55" />
                                  <span className="pointer-events-none absolute inset-0 bg-[#111826]/0 transition-colors duration-300 group-hover:bg-[#111826]/10" />
                                </article>
                              ))}
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={() => setAddPhotoModalOpen(true)}
                            className="mt-3 flex h-[46px] w-full items-center justify-center gap-2 rounded-[8px] border border-[#D8DDE6] bg-white text-[16px] font-semibold text-[#EC1C24]"
                          >
                            <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]">
                              <path d="M4 19H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              <path d="M12 15V5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                              <path d="M8 9L12 5L16 9" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Добавить фото
                          </button>
                        </article>
                    )}
                  </>
                </div>
              </section>
            </section>
          </main>
        </div>
      </div>
      {employeeProfileMounted && employeeProfileSnapshot && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`fixed inset-0 z-[285] bg-black/35 transition-[opacity] ${employeeProfileActive ? "opacity-100" : "opacity-0"}`}
              style={{ transitionDuration: addWorkModalActive ? "620ms" : "400ms", transitionTimingFunction: "cubic-bezier(0.45, 0, 0.55, 1)" }}
              role="presentation"
              onClick={() => setEmployeeProfileModal(null)}
            >
              <div className="ml-auto flex h-full max-h-screen justify-end" onClick={(e) => e.stopPropagation()}>
                <div
                  className="relative flex h-full shrink-0"
                  style={{
                    transform: employeeProfileActive ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)",
                    transition: addWorkModalActive
                      ? "transform 680ms cubic-bezier(0.22, 1, 0.36, 1)"
                      : "transform 480ms cubic-bezier(0.45, 0, 0.55, 1)",
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
                    </div>
                    <div className="min-h-0 flex-1 overflow-y-auto scroll-smooth p-5">
                      {employeeProfileTab === "main" ? (
                        <section className="relative min-h-0 rounded-[16px] bg-white">
                          <div className="flex items-start justify-between gap-4">
                            <div>
                              <h1 className="max-w-[420px] text-[52px] font-semibold leading-[0.98] tracking-[-0.03em] text-[#202636]">
                                <span className="block whitespace-nowrap">{assignedMasterFirstLine}</span>
                                <span className="block">{assignedMasterSecondLine || "\u00A0"}</span>
                              </h1>
                            </div>
                            <img src={assignedMasterPhotoLarge} alt={`Фото профиля: ${assignedMasterFullName}`} className="h-[72px] w-[72px] rounded-full object-cover" />
                          </div>
                          <div className="mt-[50px]">
                            <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                              {[
                                { label: "Дата рождения", value: assignedMasterProfileMeta.birthDate },
                                { label: "Пол", value: assignedMasterProfileMeta.gender },
                                { label: "Гражданство", value: assignedMasterProfileMeta.citizenship },
                                { label: "Телефон", value: assignedMasterProfileMeta.phone },
                                { label: "E-mail", value: assignedMasterProfileMeta.email },
                                { label: "Должность", value: assignedMasterProfileMeta.role },
                                { label: "График работы", value: assignedMasterProfileMeta.schedule },
                                { label: "Статус", value: assignedMasterProfileMeta.status },
                              ].map((field) => (
                                <div key={field.label} className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3">
                                  <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">{field.label}</p>
                                  <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">{field.value}</p>
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
                                <p className="text-[16px] font-medium leading-none tracking-[-0.04em] text-[#1D2330]">{card.title}</p>
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
                                className={`rounded-full px-4 py-2 text-[14px] font-medium tracking-[-0.02em] text-black ${employeeOrdersSection === tab.id ? "bg-[#F8F8FA]" : "bg-transparent"}`}
                              >
                                {tab.label}
                              </button>
                            ))}
                          </div>
                          {employeeOrdersSection === "active" ? (
                            <div className="mt-4 space-y-4">
                              {masterActiveOrderItems.length > 0 ? (
                                masterActiveOrderItems.map((item) => {
                                  const [titlePart, ...restParts] = item.text.split(" · ");
                                  const detailsPart = restParts.join(" · ");
                                  return (
                                    <article key={item.text} className="flex items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                                        <img src={item.icon} alt="" className="h-5 w-5" />
                                      </span>
                                      <p className="text-[20px] font-medium leading-[1.1] tracking-[-0.02em] text-[#7D7D7D]">
                                        <span className="text-[#111826]">{titlePart}</span>
                                        {detailsPart ? ` · ${detailsPart}` : ""}
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => navigateToWorkOrderFromCard(item.text)}
                                        className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#EC1C24] text-white"
                                      >
                                        <img src="/go_to.svg" alt="" className="h-[17px] w-5" />
                                      </button>
                                    </article>
                                  );
                                })
                              ) : (
                                <div className="rounded-[12px] bg-[#F3F3F5] px-4 py-3 text-[15px] font-medium tracking-[-0.04em] text-[#6F7785]">
                                  Активных заказ-нарядов нет.
                                </div>
                              )}
                            </div>
                          ) : employeeOrdersSection === "recentlyDone" ? (
                            <div className="mt-4 space-y-4">
                              {masterCompletedOrderItems.length > 0 ? (
                                masterCompletedOrderItems.map((item) => {
                                  const [titlePart, ...restParts] = item.text.split(" · ");
                                  const detailsPart = restParts.join(" · ");
                                  return (
                                    <article key={item.text} className="flex items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                                        <img src={item.icon} alt="" className="h-5 w-5" />
                                      </span>
                                      <p className="text-[20px] font-medium leading-[1.1] tracking-[-0.02em] text-[#7D7D7D]">
                                        <span className="text-[#111826]">{titlePart}</span>
                                        {detailsPart ? ` · ${detailsPart}` : ""}
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => navigateToWorkOrderFromCard(item.text)}
                                        className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#EC1C24] text-white"
                                      >
                                        <img src="/go_to.svg" alt="" className="h-[17px] w-5" />
                                      </button>
                                    </article>
                                  );
                                })
                              ) : (
                                <div className="rounded-[12px] bg-[#F3F3F5] px-4 py-3 text-[15px] font-medium tracking-[-0.04em] text-[#6F7785]">
                                  Недавно завершенных заказ-нарядов нет.
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="mt-4 space-y-4">
                              {masterDelayedOrderItems.length > 0 ? (
                                masterDelayedOrderItems.map((item) => {
                                  const [titlePart, ...restParts] = item.text.split(" · ");
                                  const detailsPart = restParts.join(" · ");
                                  return (
                                    <article key={item.text} className="flex items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                      <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                                        <img src={item.icon} alt="" className="h-5 w-5" />
                                      </span>
                                      <p className="text-[20px] font-medium leading-[1.1] tracking-[-0.02em] text-[#7D7D7D]">
                                        <span className="text-[#111826]">{titlePart}</span>
                                        {detailsPart ? ` · ${detailsPart}` : ""}
                                      </p>
                                      <button
                                        type="button"
                                        onClick={() => navigateToWorkOrderFromCard(item.text)}
                                        className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#EC1C24] text-white"
                                      >
                                        <img src="/go_to.svg" alt="" className="h-[17px] w-5" />
                                      </button>
                                    </article>
                                  );
                                })
                              ) : (
                                <div className="rounded-[12px] bg-[#F3F3F5] px-4 py-3 text-[15px] font-medium tracking-[-0.04em] text-[#6F7785]">
                                  У этого мастера нет задержанных заказ-нарядов.
                                </div>
                              )}
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
                              employeeProfileTab === "main" ? "translate-x-0" : employeeProfileTab === "kpi" ? "translate-x-[136px]" : "translate-x-[272px]"
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
      {workActionsModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setWorkActionsModal(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="work-actions-title"
                className="w-full max-w-[360px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="work-actions-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Действия с работой
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    {workActionsModal.title}
                  </p>
                </div>
                <ul className="p-0">
                  {[
                    { label: "Посмотреть запчасти", icon: "parts" as const },
                    { label: "Изменить статус", icon: "status" as const },
                    { label: "Редактировать", icon: "edit" as const },
                  ].map(({ label, icon }) => (
                    <li key={label}>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] text-[#111826] transition-colors hover:bg-[#F3F3F5]"
                        onClick={() => {
                          if (label === "Изменить статус" && workActionsModal) {
                            setWorkStatusPicker({
                              title: workActionsModal.title,
                              workId: workActionsModal.workId,
                              statusLabel: workActionsModal.statusLabel,
                            });
                          }
                          setWorkActionsModal(null);
                        }}
                      >
                        <WorkActionIcon type={icon} className="text-[#4B5563]" />
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
      {workStatusPicker && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[261] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setWorkStatusPicker(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="work-status-picker-title"
                className="w-full max-w-[360px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="work-status-picker-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Изменить статус
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    {workStatusPicker.title}
                  </p>
                </div>
                <ul className="p-0">
                  {WORK_STATUS_OPTIONS.map((status) => {
                    const currentStatusLabel = workStatusById[workStatusPicker.workId]?.label ?? workStatusPicker.statusLabel;
                    const selected =
                      status.label === "Новая"
                        ? currentStatusLabel === "Новая" || currentStatusLabel === "Новый"
                        : currentStatusLabel === status.label;
                    return (
                      <li key={status.label}>
                        <button
                          type="button"
                          className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                            selected ? "bg-[#F8F8FA] text-[#111826]" : "text-[#111826] hover:bg-[#F3F3F5]"
                          }`}
                          onClick={() => {
                            setWorkStatusById((prev) => ({
                              ...prev,
                              [workStatusPicker.workId]: { label: status.label, kind: status.kind },
                            }));
                            setWorkStatusPicker(null);
                          }}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: workStatusColorMap[status.label] }} />
                          <span className="min-w-0 flex-1">{status.label}</span>
                          {selected ? <span className="shrink-0 text-[13px] font-medium text-[#7D7D7D]">Сейчас</span> : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-[#EEEDF0] p-5">
                  <button
                    type="button"
                    onClick={() => setWorkStatusPicker(null)}
                    className="w-full cursor-pointer rounded-[10px] bg-[#ECECEF] p-4 text-center text-[16px] font-medium tracking-[-0.04em] text-[#111111] hover:bg-[#E0E0E4]"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {masterActionsModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setMasterActionsModalOpen(false)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="master-actions-title"
                className="w-full max-w-[360px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="master-actions-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Действия с мастером
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    {assignedMasterFullName}
                  </p>
                </div>
                <ul className="p-0">
                  {[
                    { label: "Открыть профиль", icon: "profile" as const },
                    { label: "Позвонить мастеру", icon: "call" as const },
                    { label: "Сменить мастера", icon: "switch" as const },
                  ].map(({ label, icon }) => (
                    <li key={label}>
                      <button
                        type="button"
                        className="flex w-full cursor-pointer items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] text-[#111826] transition-colors hover:bg-[#F3F3F5]"
                        onClick={() => {
                          setMasterActionsModalOpen(false);
                          if (label === "Открыть профиль") {
                            if (openProfileTimerRef.current) {
                              clearTimeout(openProfileTimerRef.current);
                              openProfileTimerRef.current = null;
                            }
                            openProfileTimerRef.current = setTimeout(() => {
                              const profilePayload = { fullName: assignedMasterFullName };
                              setEmployeeProfileSnapshot(profilePayload);
                              setEmployeeProfileModal(profilePayload);
                              setEmployeeProfileTab("main");
                              setEmployeeOrdersSection("active");
                              openProfileTimerRef.current = null;
                            }, 140);
                          }
                          if (label === "Сменить мастера") {
                            setSwitchMasterModalOpen(true);
                          }
                          if (label === "Позвонить мастеру") {
                            const telHref = toTelHref(assignedMasterProfileMeta.phone);
                            const callLink = document.createElement("a");
                            callLink.href = telHref;
                            document.body.appendChild(callLink);
                            callLink.click();
                            document.body.removeChild(callLink);
                          }
                        }}
                      >
                        <MasterActionIcon type={icon} className="text-[#4B5563]" />
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
      {switchMasterModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[261] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setSwitchMasterModalOpen(false)}
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
                <ul className="max-h-[420px] overflow-y-auto p-2">
                  {availableMasters.map((masterName) => (
                    <li key={masterName}>
                      <button
                        type="button"
                        className={`flex w-full cursor-pointer items-center rounded-[10px] px-4 py-3 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                          switchMasterSelection === masterName
                            ? "bg-[#EC1C24] text-white"
                            : "text-[#111826] hover:bg-[#F3F3F5]"
                        }`}
                        onClick={() => setSwitchMasterSelection(masterName)}
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
                    onClick={() => setSwitchMasterModalOpen(false)}
                    className="h-11 rounded-[10px] bg-[#ECECEF] px-4 text-[15px] font-medium text-black"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={!switchMasterSelection}
                    onClick={() => {
                      if (!switchMasterSelection) return;
                      setAssignedMasterName(switchMasterSelection);
                      setSwitchMasterModalOpen(false);
                      const raw = window.localStorage.getItem(workOrderMasterOverrideStorageKey);
                      let parsed: Record<string, string> = {};
                      if (raw) {
                        try {
                          parsed = JSON.parse(raw) as Record<string, string>;
                        } catch {
                          parsed = {};
                        }
                      }
                      parsed[CURRENT_WORK_ORDER_ID] = switchMasterSelection;
                      window.localStorage.setItem(workOrderMasterOverrideStorageKey, JSON.stringify(parsed));
                    }}
                    className="h-11 rounded-[10px] bg-[#EC1C24] px-5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Назначить
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {addWorkModalMounted && typeof document !== "undefined"
        ? createPortal(
            <div
              className={`fixed inset-0 z-[292] bg-black/35 transition-[opacity] ${addWorkModalActive ? "opacity-100" : "opacity-0"}`}
              style={{ transitionDuration: "400ms", transitionTimingFunction: "cubic-bezier(0.45, 0, 0.55, 1)" }}
              role="presentation"
              onClick={() => setAddWorkModalOpen(false)}
            >
              <div className="ml-auto flex h-full max-h-screen justify-end" onClick={(e) => e.stopPropagation()}>
                <div
                  className="relative flex h-full shrink-0"
                  style={{
                    transform: addWorkModalActive ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)",
                    transition: "transform 480ms cubic-bezier(0.45, 0, 0.55, 1)",
                    willChange: "transform",
                    backfaceVisibility: "hidden",
                    WebkitBackfaceVisibility: "hidden",
                  }}
                  onTransitionEnd={handleAddWorkDrawerTransitionEnd}
                >
                  <button
                    type="button"
                    onClick={() => setAddWorkModalOpen(false)}
                    className="absolute right-full top-8 z-10 mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#E8E8E8] bg-white text-[#111111] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.18)] transition hover:bg-[#F7F7F7]"
                    aria-label="Закрыть модалку добавления работы"
                  >
                    <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
                      <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                    </svg>
                  </button>
                  <aside
                    role="dialog"
                    aria-modal="true"
                    aria-labelledby="add-work-title"
                    className="flex h-full w-[min(900px,58vw)] min-w-[380px] max-w-[min(1040px,calc(100vw-48px))] flex-col border-l border-[#E6E6E6] bg-white tracking-[-0.04em] shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.2)]"
                  >
                    <div className="border-b border-[#EEEDF0] px-6 py-5">
                      <h2 id="add-work-title" className="text-[32px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">Добавить работу</h2>
                    </div>
                    <div className="hide-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 scroll-smooth">
                      <div>
                        <input
                          value={addWorkSearchQuery}
                          onChange={(e) => setAddWorkSearchQuery(e.target.value)}
                          placeholder="Поиск работы из справочника..."
                          className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[16px] font-medium tracking-[-0.02em] text-black outline-none placeholder:text-[#B5B5B5]"
                        />
                      </div>
                      <div>
                        <div className="mb-5 flex flex-wrap gap-2 pb-1">
                          {workCatalogSections.map((section) => (
                            <button
                              key={section.label}
                              type="button"
                              onClick={() => {
                                setAddWorkCategory(section.label);
                                setSelectedWorkCatalogItem(null);
                              }}
                              className={`shrink-0 rounded-[10px] px-3 py-2 text-[13px] font-medium tracking-[-0.02em] ${
                                addWorkCategory === section.label ? "bg-[#EC1C24] text-white" : "bg-[#ECECEF] text-[#111826]"
                              }`}
                            >
                              {section.label}
                            </button>
                          ))}
                        </div>
                        <div className="h-[504px] space-y-2 overflow-y-auto">
                          {filteredCatalogWorks.map((item) => (
                            <button
                              key={item.title}
                              type="button"
                              onClick={() => setSelectedWorkCatalogItem(item)}
                              className={`flex min-h-[56px] w-full cursor-pointer items-center justify-between rounded-[10px] px-3 py-3 text-left text-[15px] font-medium transition-colors ${
                                selectedWorkCatalogItem?.title === item.title
                                  ? "bg-[#EC1C24] text-white"
                                  : "bg-[#F3F3F5] text-[#111826] hover:bg-[#EBECF0]"
                              }`}
                            >
                              <span>{item.title}</span>
                              <span className="text-[13px] opacity-85">{item.price.toLocaleString("ru-RU")} ₽</span>
                            </button>
                          ))}
                          {filteredCatalogWorks.length === 0 ? (
                            <div className="rounded-[10px] bg-[#F3F3F5] px-3 py-2 text-[14px] font-medium text-[#6F7785]">
                              Ничего не найдено.
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center justify-between border-t border-[#EEEDF0] px-6 py-4">
                      <button
                        type="button"
                        onClick={() => setAddWorkModalOpen(false)}
                        className="h-11 rounded-[10px] bg-[#ECECEF] px-4 text-[15px] font-medium text-black"
                      >
                        Отмена
                      </button>
                      <button
                        type="button"
                        disabled={!selectedWorkCatalogItem}
                        onClick={() => {
                          if (!selectedWorkCatalogItem) return;
                          const newWorkId =
                            typeof crypto !== "undefined" && "randomUUID" in crypto
                              ? crypto.randomUUID()
                              : `work-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                          setExtraCurrentWorks((prev) => [
                            [
                              selectedWorkCatalogItem.title,
                              "Новый",
                              `${selectedWorkCatalogItem.price.toLocaleString("ru-RU")} ₽`,
                              "new",
                              "07.05.2026",
                              newWorkId,
                            ],
                            ...prev,
                          ]);
                          setHighlightedWorkId(null);
                          window.sessionStorage.removeItem("workFocusId");
                          setWorksScope("current");
                          setAddWorkModalOpen(false);
                          window.setTimeout(() => {
                            emitArchiveStyleToast({
                              line1: selectedWorkCatalogItem.title,
                              line2: "добавлена в блок работ",
                              navigateTo: `/work-orders/${CURRENT_WORK_ORDER_ID}?panel=orders&focusWorkId=${encodeURIComponent(newWorkId)}`,
                            });
                          }, 60);
                        }}
                        className="h-11 rounded-[10px] bg-[#EC1C24] px-5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        Добавить
                      </button>
                    </div>
                  </aside>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {addPhotoModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[290] flex items-center justify-center bg-black/50 p-4"
              role="presentation"
              onClick={closeAddPhotoModal}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-photo-title"
                className="w-full max-w-[520px] overflow-hidden rounded-[16px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] px-6 py-5">
                  <h2 id="add-photo-title" className="text-[22px] font-semibold tracking-[-0.03em] text-[#111826]">Добавить фото автомобиля</h2>
                  <p className="mt-1 text-[14px] text-[#7D7D7D]">Выберите файл с компьютера или вставьте ссылку на изображение.</p>
                </div>

                <div className="space-y-4 px-6 py-5">
                  <label className="block">
                    <span className="mb-2 block text-[14px] font-medium text-[#4A4F59]">Файл</span>
                    <input
                      type="file"
                      accept="image/*"
                      className="block w-full cursor-pointer rounded-[10px] border border-[#D8DDE6] bg-white px-3 py-2 text-[14px] text-[#2E3642] file:mr-3 file:cursor-pointer file:rounded-[8px] file:border-0 file:bg-[#ECECEF] file:px-3 file:py-2 file:text-[13px] file:font-medium"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const localPreview = URL.createObjectURL(file);
                        setNewPhotoPreview(localPreview);
                        setNewPhotoUrl("");
                      }}
                    />
                  </label>

                  <label className="block">
                    <span className="mb-2 block text-[14px] font-medium text-[#4A4F59]">Или ссылка на фото</span>
                    <input
                      type="url"
                      value={newPhotoUrl}
                      onChange={(e) => {
                        setNewPhotoUrl(e.target.value);
                        setNewPhotoPreview(e.target.value.trim());
                      }}
                      placeholder="https://example.com/car-photo.jpg"
                      className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[16px] font-medium tracking-[-0.02em] text-[#111826] outline-none placeholder:text-[#B5B5B5]"
                    />
                  </label>

                  <div className="rounded-[12px] border border-dashed border-[#D8DDE6] bg-[#FAFBFC] p-3">
                    {newPhotoPreview ? (
                      <img src={newPhotoPreview} alt="Предпросмотр" className="h-[180px] w-full rounded-[10px] object-cover" />
                    ) : (
                      <div className="grid h-[180px] place-items-center rounded-[10px] bg-[#F3F3F5] text-[14px] font-medium text-[#8A8A8A]">
                        Предпросмотр изображения
                      </div>
                    )}
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 border-t border-[#EEEDF0] px-6 py-4">
                  <button
                    type="button"
                    onClick={closeAddPhotoModal}
                    className="h-11 rounded-[10px] bg-[#ECECEF] px-4 text-[15px] font-medium text-black"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={!newPhotoPreview}
                    onClick={() => {
                      if (!newPhotoPreview) return;
                      setNewlyAddedPhoto(newPhotoPreview);
                      setCarPhotos((prev) => [newPhotoPreview, ...prev]);
                      closeAddPhotoModal();
                      window.setTimeout(() => setNewlyAddedPhoto(null), 500);
                    }}
                    className="h-11 rounded-[10px] bg-[#EC1C24] px-4 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Добавить
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {selectedPhotoIndex !== null && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[295] flex items-center justify-center bg-black/80 p-6"
              role="presentation"
              onClick={() => setSelectedPhotoIndex(null)}
            >
              <button
                type="button"
                onClick={() => setSelectedPhotoIndex(null)}
                className="absolute right-6 top-6 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-[28px] leading-none text-white transition hover:bg-white/25"
                aria-label="Закрыть просмотр фото"
              >
                ×
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPhotoIndex((prev) => (prev === null ? 0 : (prev - 1 + carPhotos.length) % carPhotos.length));
                }}
                className="absolute left-6 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-[34px] leading-none text-white transition hover:bg-white/25"
                aria-label="Предыдущее фото"
              >
                ‹
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPhotoIndex((prev) => (prev === null ? 0 : (prev + 1) % carPhotos.length));
                }}
                className="absolute right-6 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-[34px] leading-none text-white transition hover:bg-white/25"
                aria-label="Следующее фото"
              >
                ›
              </button>
              <img
                src={carPhotos[selectedPhotoIndex]}
                alt="Просмотр фото автомобиля"
                className="max-h-[calc(100vh-80px)] max-w-[calc(100vw-80px)] rounded-[12px] object-contain shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)]"
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body,
          )
        : null}
      <style>{`
        @keyframes workOrderLeftOut {
          0% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(-28px); }
        }
        @keyframes workOrderLeftIn {
          0% { opacity: 0; transform: translateX(28px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes photoCardIn {
          0% { opacity: 0; transform: translateY(10px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
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
      `}</style>
    </div>
  );
}
