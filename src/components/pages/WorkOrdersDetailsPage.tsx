import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import { RequestActionIconEdit, RequestActionIconStatus, RequestActionIconTrash } from "@/components/icons/RequestRowModalIcons";
import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import { downloadFinanceSummaryPdf } from "@/lib/finance/exportFinanceSummaryPdf";
import { emitArchiveStyleToast } from "@/lib/notifications/inAppArchiveToastBus";
import { WORK_ORDER_LIST_FLASH_ARMED_KEY } from "@/lib/notifications/inferNotificationDeepLink";
import { CURRENT_USER_ROLE } from "@/lib/session/currentUser";
import {
  isWorkOrdersRemoteEnabled,
  listWorkOrdersStorageRows,
  updateWorkOrdersStorageRows,
  type WorkOrderStorageRow,
} from "@/lib/data/workOrdersDataSource";
import {
  isWorkOrderDetailsRemoteEnabled,
  loadWorkOrderDetailsState,
  saveWorkOrderDetailsState,
  type WorkOrderDetailsStateStorage,
} from "@/lib/data/workOrderDetailsDataSource";
import { createPortal } from "react-dom";
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type AnimationEvent, type ChangeEvent, type TransitionEvent } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";

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

const clientCars = [
  { name: "BMW M5 F90", orders: 8, amount: 120000, main: true },
  { name: "Lada Priora", orders: 4, amount: 28000, main: false },
  { name: "Kia Rio", orders: 6, amount: 74500, main: false },
  { name: "Skoda Octavia", orders: 5, amount: 91200, main: false },
  { name: "Renault Duster", orders: 3, amount: 39900, main: false },
  { name: "VW Polo", orders: 2, amount: 18700, main: false },
];

const initialCarDocumentNames = [
  "Акт приёма-передачи автомобиля.pdf",
  "Заказ-наряд.pdf",
  "Диагностический протокол.docx",
  "Дефектовочная ведомость.docx",
  "Согласование цены.pdf",
  "Акт выполненных работ.pdf",
  "Кассовый чек.pdf",
  "Гарантийный талон.pdf",
];

type CarDocumentRow = { id: string; name: string; blobUrl?: string };

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
/** [название, кол-во, цена, дата добавления, id] */
type PartRow = [string, string, string, string, string];

function getCatalogWorkPrice(title: string): number {
  return 1500 + title.length * 120;
}

function formatWorkPrice(price: number): string {
  return `${price.toLocaleString("ru-RU")} ₽`;
}

function parsePartQuantityInput(raw: string): number | null {
  const t = raw.trim().replace(/\s/g, "").replace(",", ".");
  if (t === "") return null;
  const n = Number(t);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function formatPartQuantityCell(n: number): string {
  if (Number.isInteger(n)) return String(n);
  let s = n.toLocaleString("en-US", { useGrouping: false, maximumFractionDigits: 10 });
  if (s.includes(".")) {
    s = s.replace(/\.?0+$/, "");
  }
  return s;
}

function formatPartLineTotalRub(unitPrice: number, quantity: number): string {
  const total = Math.round(unitPrice * quantity * 100) / 100;
  const hasFraction = !Number.isInteger(total);
  return `${total.toLocaleString("ru-RU", { minimumFractionDigits: hasFraction ? 2 : 0, maximumFractionDigits: 2 })} ₽`;
}

function seededRandom(seed: number): () => number {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function makeOrderSeed(orderId: string): number {
  let hash = 0;
  for (let i = 0; i < orderId.length; i += 1) {
    hash = (hash * 31 + orderId.charCodeAt(i)) | 0;
  }
  return Math.abs(hash) + 1;
}

const workOrderCurrentWorks: WorkRow[] = [
  ["Диагностика ходовой части", "В работе", formatWorkPrice(getCatalogWorkPrice("Диагностика ходовой части")), "progress", "07.05.2026"],
  ["Замена тормозных колодок (перед)", "В работе", formatWorkPrice(getCatalogWorkPrice("Замена тормозных колодок (перед)")), "progress", "07.05.2026"],
  ["Диагностика АКПП", "Ожидает", formatWorkPrice(getCatalogWorkPrice("Диагностика АКПП")), "wait", "06.05.2026"],
  ["Проверка аккумулятора", "В работе", formatWorkPrice(getCatalogWorkPrice("Проверка аккумулятора")), "progress", "06.05.2026"],
  ["Замена ламп освещения", "Ожидает", formatWorkPrice(getCatalogWorkPrice("Замена ламп освещения")), "wait", "05.05.2026"],
  ["Чистка дроссельной заслонки", "В работе", formatWorkPrice(getCatalogWorkPrice("Чистка дроссельной заслонки")), "progress", "05.05.2026"],
  ["Диагностика системы охлаждения", "В работе", formatWorkPrice(getCatalogWorkPrice("Диагностика системы охлаждения")), "progress", "04.05.2026"],
  ["Замена ремня навесного оборудования", "Ожидает", formatWorkPrice(getCatalogWorkPrice("Замена ремня навесного оборудования")), "wait", "04.05.2026"],
  ["Проверка тормозных дисков", "В работе", formatWorkPrice(getCatalogWorkPrice("Проверка тормозных дисков")), "progress", "03.05.2026"],
  ["Замена свечей зажигания", "В работе", formatWorkPrice(getCatalogWorkPrice("Замена свечей зажигания")), "progress", "03.05.2026"],
  ["Промывка форсунок", "Ожидает", formatWorkPrice(getCatalogWorkPrice("Промывка форсунок")), "wait", "02.05.2026"],
  ["Регулировка фар", "В работе", formatWorkPrice(getCatalogWorkPrice("Регулировка фар")), "progress", "02.05.2026"],
  ["Диагностика подвески", "В работе", formatWorkPrice(getCatalogWorkPrice("Диагностика подвески")), "progress", "01.05.2026"],
];

const workOrderCompletedWorks: WorkRow[] = [
  ["ТО-60 000 км", "Готово", formatWorkPrice(getCatalogWorkPrice("ТО-60 000 км")), "closed", "07.05.2026"],
  ["Замена масла ДВС и фильтра", "Готово", formatWorkPrice(getCatalogWorkPrice("Замена масла ДВС и фильтра")), "closed", "05.05.2026"],
  ["Развал-схождение", "Готово", formatWorkPrice(getCatalogWorkPrice("Развал-схождение")), "closed", "03.05.2026"],
];
const partsCurrentRows: PartRow[] = (
  [
    ["Масляный фильтр", "2", "690 ₽", "07.05.2026"],
    ["Воздушный фильтр", "1", "780 ₽", "07.05.2026"],
    ["Свеча зажигания", "4", "540 ₽", "06.05.2026"],
    ["Амортизатор передний", "2", "6 200 ₽", "06.05.2026"],
    ["Тормозной диск", "2", "3 400 ₽", "05.05.2026"],
    ["Рулевая рейка", "1", "21 400 ₽", "05.05.2026"],
    ["Сцепление комплект", "1", "12 400 ₽", "04.05.2026"],
    ["Лампа ближнего света", "2", "450 ₽", "04.05.2026"],
    ["Фара передняя", "1", "19 800 ₽", "03.05.2026"],
    ["Компрессор кондиционера", "1", "26 800 ₽", "03.05.2026"],
    ["Шина летняя", "4", "7 300 ₽", "02.05.2026"],
    ["Антифриз", "3", "1 300 ₽", "02.05.2026"],
    ["Масло АКПП", "5", "1 900 ₽", "01.05.2026"],
  ] as const
).map((row, index) => {
  const [title, qtyStr, unitPriceStr, date] = row;
  const qty = parsePartQuantityInput(qtyStr) ?? 1;
  const unitRub = parseRubAmount(unitPriceStr);
  const lineStr = formatPartLineTotalRub(unitRub, qty);
  return [title, qtyStr, lineStr, date, `parts-current-base-${index}`] as PartRow;
});
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

function findWorkCatalogCategoryForTitle(title: string): string {
  for (const section of workCatalogSections) {
    if (section.label === "Все работы") continue;
    if ((section.items as readonly string[]).includes(title)) return section.label;
  }
  return "Все работы";
}

function catalogWorkItemFromTitle(title: string): { title: string; price: number; durationMin: number } {
  const price = getCatalogWorkPrice(title);
  return { title, price, durationMin: 20 + (title.length % 9) * 10 };
}

const partsCatalogSections: Array<{ label: string; items: Array<{ title: string; price: number }> }> = [
  {
    label: "Все запчасти",
    items: [],
  },
  {
    label: "Двигатель",
    items: [
      { title: "Масляный фильтр", price: 690 }, { title: "Воздушный фильтр", price: 780 }, { title: "Салонный фильтр", price: 820 }, { title: "Топливный фильтр", price: 1150 },
      { title: "Свеча зажигания", price: 540 }, { title: "Катушка зажигания", price: 2850 }, { title: "Ремень ГРМ", price: 3650 }, { title: "Цепь ГРМ", price: 7900 },
      { title: "Натяжитель цепи", price: 3350 }, { title: "Ролик натяжной", price: 2100 }, { title: "Помпа", price: 4200 }, { title: "Прокладка ГБЦ", price: 2650 },
      { title: "Прокладка клапанной крышки", price: 1450 }, { title: "Сальник коленвала", price: 980 }, { title: "Сальник распредвала", price: 940 }, { title: "Поршень", price: 3900 },
      { title: "Кольца поршневые", price: 2250 }, { title: "Шатун", price: 4400 }, { title: "Вкладыши", price: 1980 }, { title: "Клапан впускной", price: 1350 },
      { title: "Клапан выпускной", price: 1390 }, { title: "Гидрокомпенсатор", price: 1120 }, { title: "Турбина", price: 32800 }, { title: "Интеркулер", price: 9800 },
      { title: "Радиатор двигателя", price: 7400 }, { title: "Вентилятор охлаждения", price: 5200 }, { title: "Термостат", price: 1900 }, { title: "Датчик температуры", price: 1250 },
      { title: "ДМРВ", price: 4750 }, { title: "Лямбда-зонд", price: 5600 }, { title: "Дроссельная заслонка", price: 8900 }, { title: "Форсунка", price: 3850 },
      { title: "ТНВД", price: 24800 }, { title: "Стартер", price: 7900 }, { title: "Генератор", price: 9900 }, { title: "Аккумулятор", price: 8600 },
    ],
  },
  {
    label: "Подвеска",
    items: [
      { title: "Амортизатор передний", price: 6200 }, { title: "Амортизатор задний", price: 5200 }, { title: "Стойка стабилизатора", price: 1350 }, { title: "Втулка стабилизатора", price: 540 },
      { title: "Шаровая опора", price: 1650 }, { title: "Рычаг подвески", price: 6900 }, { title: "Сайлентблок", price: 790 }, { title: "Пружина подвески", price: 3150 },
      { title: "Опора амортизатора", price: 1900 }, { title: "Подшипник опоры", price: 1250 }, { title: "Ступица", price: 5400 }, { title: "Подшипник ступицы", price: 2450 },
      { title: "Поворотный кулак", price: 8100 }, { title: "ШРУС внутренний", price: 3600 }, { title: "ШРУС наружный", price: 3300 }, { title: "Привод в сборе", price: 12400 },
    ],
  },
  {
    label: "Тормозная система",
    items: [
      { title: "Тормозные колодки передние", price: 2600 }, { title: "Тормозные колодки задние", price: 2300 }, { title: "Тормозной диск", price: 3400 }, { title: "Тормозной барабан", price: 2950 },
      { title: "Суппорт", price: 6800 }, { title: "Ремкомплект суппорта", price: 1250 }, { title: "Тормозной цилиндр", price: 1750 }, { title: "Главный тормозной цилиндр", price: 5900 },
      { title: "Вакуумный усилитель", price: 7200 }, { title: "Тормозной шланг", price: 650 }, { title: "Тормозная трубка", price: 520 }, { title: "Датчик ABS", price: 2300 },
      { title: "Тормозная жидкость", price: 980 },
    ],
  },
  {
    label: "Рулевое управление",
    items: [
      { title: "Рулевая рейка", price: 21400 }, { title: "Тяга рулевая", price: 1450 }, { title: "Наконечник рулевой", price: 1200 }, { title: "Насос ГУР", price: 11800 },
      { title: "Жидкость ГУР", price: 880 }, { title: "Электроусилитель руля", price: 26800 }, { title: "Кардан рулевой", price: 4200 },
    ],
  },
  {
    label: "Трансмиссия",
    items: [
      { title: "Сцепление комплект", price: 12400 }, { title: "Корзина сцепления", price: 7100 }, { title: "Выжимной подшипник", price: 2300 }, { title: "Маховик", price: 16800 },
      { title: "МКПП", price: 64800 }, { title: "АКПП", price: 114000 }, { title: "Масло АКПП", price: 1900 }, { title: "Масло МКПП", price: 1650 },
      { title: "Прокладка поддона АКПП", price: 1400 }, { title: "Сальник привода", price: 920 }, { title: "Дифференциал", price: 38500 },
    ],
  },
  {
    label: "Электрика",
    items: [
      { title: "Лампа ближнего света", price: 450 }, { title: "Лампа дальнего света", price: 470 }, { title: "LED лампа", price: 1650 }, { title: "Предохранитель", price: 120 },
      { title: "Реле", price: 350 }, { title: "Блок управления", price: 27800 }, { title: "Проводка", price: 5400 }, { title: "Датчик ABS", price: 2300 },
      { title: "Датчик коленвала", price: 1950 }, { title: "Датчик распредвала", price: 1890 }, { title: "Камера заднего вида", price: 3200 }, { title: "Парктроник", price: 1450 },
    ],
  },
  {
    label: "Кузов",
    items: [
      { title: "Бампер передний", price: 15400 }, { title: "Бампер задний", price: 14800 }, { title: "Крыло переднее", price: 9200 }, { title: "Крыло заднее", price: 13200 },
      { title: "Капот", price: 18600 }, { title: "Дверь", price: 22400 }, { title: "Крышка багажника", price: 17100 }, { title: "Решетка радиатора", price: 5400 },
      { title: "Фара передняя", price: 19800 }, { title: "Фонарь задний", price: 8600 }, { title: "ПТФ", price: 3100 }, { title: "Зеркало боковое", price: 7900 },
      { title: "Лобовое стекло", price: 17300 }, { title: "Стеклоподъемник", price: 4200 }, { title: "Замок двери", price: 2400 },
    ],
  },
  {
    label: "Система кондиционирования",
    items: [
      { title: "Компрессор кондиционера", price: 26800 }, { title: "Радиатор кондиционера", price: 11200 }, { title: "Испаритель", price: 9300 },
      { title: "Осушитель кондиционера", price: 2500 }, { title: "Фреон", price: 1800 }, { title: "Датчик давления кондиционера", price: 2200 },
    ],
  },
  {
    label: "Шиномонтаж",
    items: [
      { title: "Шина летняя", price: 7300 }, { title: "Шина зимняя", price: 8900 }, { title: "Диск литой", price: 12400 }, { title: "Диск штампованный", price: 4700 },
      { title: "Ниппель", price: 110 }, { title: "Грузик балансировочный", price: 90 }, { title: "Ремкомплект шины", price: 650 },
    ],
  },
  {
    label: "Технические жидкости",
    items: [
      { title: "Масло моторное 5W-30", price: 2400 }, { title: "Масло моторное 5W-40", price: 2500 }, { title: "Антифриз", price: 1300 },
      { title: "Тормозная жидкость DOT-4", price: 990 }, { title: "Жидкость ГУР", price: 880 }, { title: "Омывающая жидкость", price: 350 },
      { title: "Масло АКПП", price: 1900 }, { title: "Масло МКПП", price: 1650 },
    ],
  },
];

function findPartsCatalogCategoryForTitle(title: string): string {
  for (const section of partsCatalogSections) {
    if (section.label === "Все запчасти") continue;
    if (section.items.some((it) => it.title === title)) return section.label;
  }
  return "Все запчасти";
}

function findPartsCatalogItemByTitle(title: string): { title: string; price: number } | null {
  for (const section of partsCatalogSections) {
    if (section.label === "Все запчасти") continue;
    const hit = section.items.find((it) => it.title === title);
    if (hit) return hit;
  }
  return null;
}

function catalogPartItemFromTitle(title: string): { title: string; price: number; durationMin: number } {
  const found = findPartsCatalogItemByTitle(title);
  if (found) return { title: found.title, price: found.price, durationMin: 0 };
  return { title, price: 1500, durationMin: 0 };
}

const WORK_STATUS_OPTIONS: Array<{ label: string; kind: WorkStatusKind }> = [
  { label: "Новый", kind: "new" },
  { label: "В работе", kind: "progress" },
  { label: "Ожидает", kind: "wait" },
  { label: "Готово", kind: "closed" },
  { label: "Закрыт", kind: "closed" },
];
const workStatusColorMap: Record<string, string> = {
  Новый: "#ACACAC",
  "В работе": "#2E78C9",
  Ожидает: "#F39D00",
  "Отказ клиента": "#EC1C24",
  Готово: "#00B515",
  Закрыт: "#111111",
};

const MASTER_PROFILE = { fullName: "Журавлёв Михаил Дмитриевич" };
const FALLBACK_WORK_ORDER_ID = "593423";
const DEFAULT_MASTER_NAME = "Журавлёв М.";
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
  { id: "495783", car: "Skoda Octavia", master: "Тимофеев А.", status: "Готово", dueDate: "10.04.2026" },
  { id: "987384", car: "Hyundai Solaris", master: "Романова Л.", status: "Новый", dueDate: "12.04.2026" },
  { id: "284750", car: "Renault Duster", master: "Журавлёв М.", status: "В работе", dueDate: "14.04.2026" },
  { id: "847597", car: "VW Polo", master: "Кузнецов Е.", status: "Готово", dueDate: "16.04.2026" },
  { id: "658472", car: "MAN TGS", master: "Алексеев Д.", status: "В работе", dueDate: "18.04.2026" },
  { id: "309845", car: "Mercedes Actros", master: "Семёнова Е.", status: "Готово", dueDate: "20.04.2026" },
  { id: "208476", car: "Mazda 6", master: "Захарова И.", status: "Ожидание запчастей", dueDate: "22.04.2026" },
  { id: "989923", car: "Ford Transit", master: "Тимофеев А.", status: "Готово", dueDate: "24.04.2026" },
  { id: "923117", car: "Nissan X-Trail", master: "Алексеев Д.", status: "В работе", dueDate: "26.04.2026" },
  { id: "731550", car: "Scania R450", master: "Журавлёв М.", status: "Готово", dueDate: "28.04.2026" },
  { id: "615004", car: "Kia Sportage", master: "Гусева М.", status: "Готово", dueDate: "30.04.2026" },
  { id: "771208", car: "Audi A6", master: "Кузнецов Е.", status: "В работе", dueDate: "02.05.2026" },
  { id: "842661", car: "Skoda Kodiaq", master: "Семёнова Е.", status: "Ожидание запчастей", dueDate: "03.05.2026" },
  { id: "904552", car: "DAF XF", master: "Тимофеев А.", status: "Готово", dueDate: "04.05.2026" },
  { id: "956740", car: "BMW X5", master: "Алексеев Д.", status: "В работе", dueDate: "05.05.2026" },
  { id: "118390", car: "Toyota RAV4", master: "Гусева М.", status: "Готово", dueDate: "06.05.2026" },
  { id: "552701", car: "BMW 320i", master: "Журавлёв М.", status: "В работе", dueDate: "07.05.2026" },
  { id: "552702", car: "Skoda Rapid", master: "Журавлёв М.", status: "Готово", dueDate: "05.05.2026" },
] as const;

type WorkOrderMeta = {
  id: string;
  client: string;
  car: string;
  plate: string;
  master: string;
  status: string;
  dueDate: string;
  amount: string;
};

function mapWorkOrderStorageToMeta(row: WorkOrderStorageRow): WorkOrderMeta {
  return {
    id: row.id,
    client: row.client,
    car: row.car,
    plate: row.plate,
    master: row.master,
    status: row.status ?? "Новый",
    dueDate: row.due_date,
    amount: row.amount,
  };
}

function fallbackWorkOrderMeta(id: string): WorkOrderMeta {
  const row = workOrdersSourceRows.find((item) => item.id === id);
  if (!row) {
    return {
      id,
      client: "",
      car: "Автомобиль не указан",
      plate: "—",
      master: DEFAULT_MASTER_NAME,
      status: "Новый",
      dueDate: "—",
      amount: "0 ₽",
    };
  }
  return {
    id: row.id,
    client: "",
    car: row.car,
    plate: "—",
    master: row.master,
    status: row.status,
    dueDate: row.dueDate,
    amount: "0 ₽",
  };
}

function mapSourceRowToMeta(row: (typeof workOrdersSourceRows)[number]): WorkOrderMeta {
  return {
    id: row.id,
    client: "",
    car: row.car,
    plate: "—",
    master: row.master,
    status: row.status,
    dueDate: row.dueDate,
    amount: "0 ₽",
  };
}

function buildClientFields(order: WorkOrderMeta) {
  return [
    { label: "ФИО", value: order.client || "" },
    { label: "Тип клиента", value: "Физ.лицо" },
    { label: "Телефон", value: "+7 (909) 999-99-99" },
    { label: "Email", value: "natalya@gmail.com" },
    { label: "Адрес", value: "г. Москва, ул. Пушкина, д. 15, кв. 42" },
    { label: "Дата последнего визита", value: order.dueDate || "—" },
    { label: "Комментарий", value: "Не звонить после 19:00" },
  ];
}

function buildVehicleFields(order: WorkOrderMeta) {
  return [
    { label: "Марка и модель", value: order.car || "—" },
    { label: "Пробег", value: "87 500 км" },
    { label: "Гос.номер", value: `${order.plate || "—"} ⛓` },
    { label: "Тип кузова", value: "Седан" },
    { label: "VIN", value: "KMHC81BDXKU123456 ⛓" },
    { label: "Тип топлива", value: "Бензин" },
    { label: "Год выпуска", value: "2019" },
    { label: "Трансмиссия", value: "АКПП" },
    { label: "Цвет", value: "Серебристый" },
    { label: "Комментарий", value: "Царапина на бампере...Показать" },
  ];
}

function splitToTwoLines(value: string): { first: string; second: string } {
  const words = value.trim().split(/\s+/).filter(Boolean);
  if (words.length <= 1) return { first: value.trim(), second: "" };
  return { first: words.slice(0, -1).join(" "), second: words[words.length - 1] ?? "" };
}

function generateWorkRowsByOrderId(orderId: string): { current: WorkRow[]; completed: WorkRow[] } {
  const rand = seededRandom(makeOrderSeed(orderId));
  const allCatalogTitles = workCatalogSections
    .filter((section) => section.label !== "Все работы")
    .flatMap((section) => section.items);
  const uniqueTitles = Array.from(new Set(allCatalogTitles));
  const shuffled = [...uniqueTitles].sort(() => rand() - 0.5);
  const currentCount = 8 + Math.floor(rand() * 6);
  const completedCount = 2 + Math.floor(rand() * 4);
  const currentTitles = shuffled.slice(0, currentCount);
  const completedTitles = shuffled.slice(currentCount, currentCount + completedCount);
  const dayBase = 1 + Math.floor(rand() * 20);
  const toDate = (offset: number) => `${String(Math.max(1, dayBase - offset)).padStart(2, "0")}.05.2026`;

  const current = currentTitles.map((title, index) => {
    const kind: WorkStatusKind = rand() > 0.28 ? "progress" : "wait";
    const statusLabel = kind === "progress" ? "В работе" : "Ожидает";
    return [
      title,
      statusLabel,
      formatWorkPrice(getCatalogWorkPrice(title)),
      kind,
      toDate(index % 10),
      `current-${orderId}-${index}`,
    ];
  });

  const completed = completedTitles.map((title, index) => {
    return [
      title,
      "Готово",
      formatWorkPrice(getCatalogWorkPrice(title)),
      "closed",
      toDate(2 + (index % 10)),
      `completed-${orderId}-${index}`,
    ];
  });

  return { current, completed };
}

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

function downloadCarDocument(doc: CarDocumentRow) {
  if (doc.blobUrl) {
    const link = document.createElement("a");
    link.href = doc.blobUrl;
    link.download = doc.name;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    return;
  }
  downloadMockDocument(doc.name);
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

function filterCatalogByQuery<T extends { title: string }>(items: T[], rawQuery: string): T[] {
  const query = normalizeSearchText(rawQuery);
  if (!query) return items;
  const exactMatches = items.filter((item) => normalizeSearchText(item.title) === query);
  if (exactMatches.length > 0) return exactMatches;
  const startsWithMatches = items.filter((item) => normalizeSearchText(item.title).startsWith(query));
  if (startsWithMatches.length > 0) return startsWithMatches;
  return items.filter((item) => normalizeSearchText(item.title).includes(query));
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

function WorkActionIcon({
  type,
  className,
}: {
  type: "status" | "edit" | "archive" | "restore" | "download";
  className?: string;
}) {
  const cls = className ?? "";
  if (type === "status") return <RequestActionIconStatus className={cls} />;
  if (type === "edit") return <RequestActionIconEdit className={cls} />;
  if (type === "archive") return <RequestActionIconTrash className={cls} />;
  if (type === "download") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={`h-[22px] w-[22px] shrink-0 ${cls}`} aria-hidden>
        <path
          d="M12 4v11m0 0 3.5-3.5M12 15 8.5 11.5M5 20h14"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-[22px] w-[22px] shrink-0 ${cls}`} aria-hidden>
      <path
        d="M9 14 4 9l5-5M4 9h11a5 5 0 0 1 0 10h-3"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MoreDotsCircleMenuIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className ?? "h-[18px] w-[18px] shrink-0"}
      aria-hidden
    >
      <circle cx="4" cy="12" r="2.5" />
      <circle cx="12" cy="12" r="2.5" />
      <circle cx="20" cy="12" r="2.5" />
    </svg>
  );
}

export function WorkOrdersDetailsPage() {
  const navigate = useNavigate();
  const params = useParams<{ id: string }>();
  const currentWorkOrderId = params.id ?? FALLBACK_WORK_ORDER_ID;
  const [orderMeta, setOrderMeta] = useState<WorkOrderMeta>(() => fallbackWorkOrderMeta(currentWorkOrderId));
  const [orderMetaHydrated, setOrderMetaHydrated] = useState(false);
  const [allWorkOrdersMeta, setAllWorkOrdersMeta] = useState<WorkOrderMeta[]>(() => workOrdersSourceRows.map(mapSourceRowToMeta));
  const isManager = CURRENT_USER_ROLE === "manager";
  const [activeTab, setActiveTab] = useState<"client" | "car">("client");
  const [displayedTab, setDisplayedTab] = useState<"client" | "car">("client");
  const [leftContentPhase, setLeftContentPhase] = useState<"idle" | "out" | "in">("idle");
  const [activeClientPanel, setActiveClientPanel] = useState<"main" | "cars">("main");
  const [activeCarPanel, setActiveCarPanel] = useState<"orders" | "parts" | "documents" | "photos" | "finance">("orders");
  const [workSearchQuery, setWorkSearchQuery] = useState("");
  const [partsSearchQuery, setPartsSearchQuery] = useState("");
  const [documentsSearchQuery, setDocumentsSearchQuery] = useState("");
  const [worksScope, setWorksScope] = useState<"current" | "completed" | "archived">("current");
  const [workActionsModal, setWorkActionsModal] = useState<{
    title: string;
    workId: string;
    scope: "current" | "completed" | "archived" | "parts" | "partsArchived";
    statusLabel: string;
  } | null>(null);
  const [workStatusPicker, setWorkStatusPicker] = useState<{ title: string; workId: string; statusLabel: string } | null>(null);
  const [masterActionsModalOpen, setMasterActionsModalOpen] = useState(false);
  const [switchMasterModalOpen, setSwitchMasterModalOpen] = useState(false);
  const [switchMasterSelection, setSwitchMasterSelection] = useState<string | null>(null);
  const [assignedMasterName, setAssignedMasterName] = useState<string>(() => fallbackWorkOrderMeta(currentWorkOrderId).master || DEFAULT_MASTER_NAME);
  const [employeeProfileModal, setEmployeeProfileModal] = useState<typeof MASTER_PROFILE | null>(null);
  const [employeeProfileSnapshot, setEmployeeProfileSnapshot] = useState<typeof MASTER_PROFILE | null>(null);
  const [employeeProfileMounted, setEmployeeProfileMounted] = useState(false);
  const [employeeProfileActive, setEmployeeProfileActive] = useState(false);
  const [employeeProfileTab, setEmployeeProfileTab] = useState<"main" | "kpi" | "orders">("main");
  const [employeeOrdersSection, setEmployeeOrdersSection] = useState<"active" | "recentlyDone">("active");
  const profileExitFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const profileExitingRef = useRef(false);
  const addWorkExitFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const addWorkExitingRef = useRef(false);
  const addWorkCatalogSelectedBtnRef = useRef<HTMLButtonElement | null>(null);
  const openProfileTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [carPhotos, setCarPhotos] = useState<string[]>(initialCarPhotoItems);
  const [carDocumentsCurrent, setCarDocumentsCurrent] = useState<CarDocumentRow[]>(() =>
    initialCarDocumentNames.map((name, i) => ({ id: `doc-seed-${i}`, name })),
  );
  const [carDocumentsArchived, setCarDocumentsArchived] = useState<CarDocumentRow[]>([]);
  const [documentsScope, setDocumentsScope] = useState<"current" | "archived">("current");
  const [documentActionsModal, setDocumentActionsModal] = useState<{
    title: string;
    docId: string;
    scope: "documentsCurrent" | "documentsArchived";
  } | null>(null);
  const [archivingDocRowId, setArchivingDocRowId] = useState<string | null>(null);
  const documentUploadInputRef = useRef<HTMLInputElement>(null);
  const documentBlobUrlsRef = useRef<Set<string>>(new Set());
  const [newlyAddedPhoto, setNewlyAddedPhoto] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [addPhotoModalOpen, setAddPhotoModalOpen] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoPreview, setNewPhotoPreview] = useState("");
  const [addWorkModalOpen, setAddWorkModalOpen] = useState(false);
  const [addWorkEditWorksTarget, setAddWorkEditWorksTarget] = useState<{
    workId: string;
    listScope: "current" | "completed" | "archived";
    originalTitle: string;
  } | null>(null);
  const [addWorkEditPartsTarget, setAddWorkEditPartsTarget] = useState<{
    partId: string;
    listScope: "current" | "archived";
    originalTitle: string;
    originalQuantityStr: string;
  } | null>(null);
  const [addCatalogTarget, setAddCatalogTarget] = useState<"works" | "parts">("works");
  const [addWorkModalMounted, setAddWorkModalMounted] = useState(false);
  const [addWorkModalActive, setAddWorkModalActive] = useState(false);
  const [addWorkSearchQuery, setAddWorkSearchQuery] = useState("");
  const [addWorkCategory, setAddWorkCategory] = useState<string>("Все работы");
  const [selectedWorkCatalogItem, setSelectedWorkCatalogItem] = useState<{ title: string; price: number; durationMin: number } | null>(null);
  const [addPartQuantityInput, setAddPartQuantityInput] = useState("");
  const [currentWorksData, setCurrentWorksData] = useState<WorkRow[]>(() => generateWorkRowsByOrderId(currentWorkOrderId).current);
  const [completedWorksData, setCompletedWorksData] = useState<WorkRow[]>(() => generateWorkRowsByOrderId(currentWorkOrderId).completed);
  const [partsCurrentData, setPartsCurrentData] = useState<PartRow[]>(() => partsCurrentRows);
  const [partsArchivedData, setPartsArchivedData] = useState<PartRow[]>([]);
  const [partsScope, setPartsScope] = useState<"current" | "archived">("current");
  const [archivedWorksData, setArchivedWorksData] = useState<WorkRow[]>([]);
  const detailsStateHydratedRef = useRef(false);
  const [detailsStateReady, setDetailsStateReady] = useState(false);
  const [archivingWorkRowId, setArchivingWorkRowId] = useState<string | null>(null);
  const [workStatusById, setWorkStatusById] = useState<Record<string, { label: string; kind: WorkStatusKind }>>({});
  const [highlightedWorkId, setHighlightedWorkId] = useState<string | null>(null);
  function onHighlightBorderAnimationEnd(e: AnimationEvent, entityId: string) {
    if (e.animationName !== "workRowHighlightBorder") return;
    setHighlightedWorkId((cur) => (cur === entityId ? null : cur));
  }
  function applyStatusToWorkLists(workId: string, statusLabel: string, statusKind: WorkStatusKind) {
    const patchList = (rows: WorkRow[]): WorkRow[] => {
      let changed = false;
      const next = rows.map((row) => {
        if (row[5] !== workId) return row;
        changed = true;
        return [row[0], statusLabel, row[2], statusKind, row[4], row[5]] as WorkRow;
      });
      return changed ? next : rows;
    };
    setCurrentWorksData((prev) => patchList(prev));
    setCompletedWorksData((prev) => patchList(prev));
    setArchivedWorksData((prev) => patchList(prev));
  }
  const [clientFields, setClientFields] = useState(() => buildClientFields(fallbackWorkOrderMeta(currentWorkOrderId)));
  const [vehicleFields, setVehicleFields] = useState(() => buildVehicleFields(fallbackWorkOrderMeta(currentWorkOrderId)));
  const [isEditingFields, setIsEditingFields] = useState(false);
  const assignedMasterFullName = masterFullNameByName[assignedMasterName] ?? assignedMasterName;
  const assignedMasterPhoto = masterPhotoByName[assignedMasterName] ?? "https://i.pravatar.cc/80";
  const assignedMasterPhotoLarge = assignedMasterPhoto.replace("/80?", "/160?");
  const assignedMasterNameParts = assignedMasterFullName.split(" ");
  const assignedMasterFirstLine = assignedMasterNameParts.slice(0, 2).join(" ");
  const assignedMasterSecondLine = assignedMasterNameParts.slice(2).join(" ");
  const currentWorkOrderStatus = orderMeta.status || "Новый";
  const currentWorkOrderStatusColor = workStatusColorMap[currentWorkOrderStatus] ?? "#ACACAC";
  const assignedMasterProfileMeta =
    masterProfileMetaByName[assignedMasterName] ??
    { birthDate: "-", gender: "-", citizenship: "-", phone: "-", email: "-", role: "Мастер", schedule: "5/2, 8:00 - 20:00", status: "-" };
  const visibleFields = displayedTab === "client" ? clientFields : vehicleFields;
  const clientNameLines = splitToTwoLines(clientFields.find((field) => field.label === "ФИО")?.value ?? orderMeta.client);
  const carNameLines = splitToTwoLines(vehicleFields.find((field) => field.label === "Марка и модель")?.value ?? orderMeta.car);
  const displayClientFirstLine = orderMetaHydrated ? clientNameLines.first : "";
  const displayClientSecondLine = orderMetaHydrated ? clientNameLines.second : "";
  const displayMasterFirstLine = orderMetaHydrated ? assignedMasterFirstLine : "";
  const displayMasterSecondLine = orderMetaHydrated ? assignedMasterSecondLine : "";
  const displayMasterFullName = orderMetaHydrated ? assignedMasterFullName : "";
  const identityVisibilityClass = orderMetaHydrated ? "opacity-100" : "opacity-0";
  const totalOrders = clientCars.reduce((sum, car) => sum + car.orders, 0);
  const totalAmount = clientCars.reduce((sum, car) => sum + car.amount, 0);
  const averageCheck = totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0;
  const formatCurrency = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;
  const currentWorks = currentWorksData;
  const allWorks = [...currentWorks, ...completedWorksData];
  const worksSubtotal = allWorks.reduce((sum, [, , amount]) => sum + parseRubAmount(amount), 0);
  const partsSubtotal = partsCurrentData.reduce((sum, row) => sum + parseRubAmount(String(row[2])), 0);
  const grossSubtotal = worksSubtotal + partsSubtotal;
  const discountAmount = Math.round(grossSubtotal * 0.07);
  const totalToPay = grossSubtotal - discountAmount;
  const totalWorksCount = detailsStateReady ? currentWorksData.length + completedWorksData.length + archivedWorksData.length : 0;
  const employeeKpiCards = useMemo(() => {
    const closedWorks = completedWorksData.length;
    const activeWorks = currentWorks.length;
    const totalWorksCount = closedWorks + activeWorks;
    const closedRevenue = completedWorksData.reduce((sum, [, , amount]) => sum + parseRubAmount(amount), 0);
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
  }, [currentWorks, completedWorksData, formatCurrency, partsSubtotal]);
  const masterActiveOrderItems = useMemo(() => {
    return allWorkOrdersMeta
      .filter((row) => {
        if (row.master !== assignedMasterName) return false;
        return row.status === "Новый" || row.status === "В работе" || row.status === "Ожидание запчастей";
      })
      .map((row) => ({
        type: "Заказ-наряд",
        text: `Заказ-наряд №${row.id} · ${row.car}`,
        icon: "/group87.svg",
      }));
  }, [allWorkOrdersMeta, assignedMasterName]);
  const masterCompletedOrderItems = useMemo(() => {
    const now = new Date();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
    return allWorkOrdersMeta
      .filter((row) => {
        if (row.master !== assignedMasterName) return false;
        if (row.status !== "Готово" && row.status !== "Закрыт") return false;
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
  }, [allWorkOrdersMeta, assignedMasterName]);
  const availableMasters = useMemo(
    () =>
      [...new Set(allWorkOrdersMeta.map((row) => row.master))]
        .filter((masterName) => masterName !== assignedMasterName)
        .sort((a, b) => a.localeCompare(b, "ru")),
    [allWorkOrdersMeta, assignedMasterName],
  );
  const filteredWorks = useMemo(() => {
    const sourceRows =
      worksScope === "current" ? currentWorksData : worksScope === "completed" ? completedWorksData : archivedWorksData;
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
  }, [worksScope, workSearchQuery, currentWorksData, completedWorksData, archivedWorksData, workStatusById]);

  const filteredPartsRows = useMemo(() => {
    const rows = partsScope === "current" ? partsCurrentData : partsArchivedData;
    const q = partsSearchQuery.trim().toLowerCase();
    if (!q) return rows;
    return rows.filter((row) => String(row[0]).toLowerCase().includes(q));
  }, [partsScope, partsSearchQuery, partsCurrentData, partsArchivedData]);

  const filteredDocumentsList = useMemo(() => {
    const list = documentsScope === "current" ? carDocumentsCurrent : carDocumentsArchived;
    const q = documentsSearchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter((doc) => doc.name.toLowerCase().includes(q));
  }, [documentsScope, documentsSearchQuery, carDocumentsCurrent, carDocumentsArchived]);

  const filteredCatalogWorks = useMemo(() => {
    if (addCatalogTarget === "parts") {
      const allPartItemsRaw = partsCatalogSections.flatMap((section) => (section.label === "Все запчасти" ? [] : section.items));
      const allPartItems = Array.from(
        new Map(allPartItemsRaw.map((item) => [normalizeSearchText(item.title), item])).values(),
      );
      const categoryPartItems =
        addWorkCategory === "Все запчасти"
          ? allPartItems
          : (partsCatalogSections.find((section) => section.label === addWorkCategory)?.items ?? []);
      const uniqueCategoryItems = Array.from(
        new Map(categoryPartItems.map((item) => [normalizeSearchText(item.title), item])).values(),
      );
      const pricedItems = uniqueCategoryItems.map((item) => ({
        title: item.title,
        price: item.price,
        durationMin: 0,
      }));
      return filterCatalogByQuery(pricedItems, addWorkSearchQuery);
    }
    const allItems = workCatalogSections.flatMap((section) => (section.label === "Все работы" ? [] : section.items));
    const categoryItems =
      addWorkCategory === "Все работы"
        ? [...new Set(allItems)]
        : workCatalogSections.find((section) => section.label === addWorkCategory)?.items ?? [];
    const pricedItems = categoryItems.map((title) => ({
      title,
      price: 1500 + title.length * 120,
      durationMin: 20 + (title.length % 9) * 10,
    }));
    return filterCatalogByQuery(pricedItems, addWorkSearchQuery);
  }, [addWorkSearchQuery, addWorkCategory, addCatalogTarget]);
  const leftContentMotionClass = useMemo(() => {
    if (leftContentPhase === "out") return "animate-[workOrderLeftOut_180ms_ease_forwards]";
    if (leftContentPhase === "in") return "animate-[workOrderLeftIn_240ms_cubic-bezier(0.22,1,0.36,1)_forwards]";
    return "";
  }, [leftContentPhase]);
  const [searchParams, setSearchParams] = useSearchParams();

  useEffect(() => {
    setOrderMetaHydrated(false);
    let cancelled = false;

    async function hydrateOrderMeta() {
      const fallback = fallbackWorkOrderMeta(currentWorkOrderId);
      if (!isWorkOrdersRemoteEnabled()) {
        if (!cancelled) {
          setOrderMeta(fallback);
          setAllWorkOrdersMeta(workOrdersSourceRows.map(mapSourceRowToMeta));
          setOrderMetaHydrated(true);
        }
        return;
      }

      try {
        const rows = await listWorkOrdersStorageRows();
        if (cancelled) return;
        const mappedRows = rows.map(mapWorkOrderStorageToMeta);
        setAllWorkOrdersMeta(mappedRows);
        const matched = rows.find((row) => row.id === currentWorkOrderId);
        setOrderMeta(matched ? mapWorkOrderStorageToMeta(matched) : fallback);
        setOrderMetaHydrated(true);
      } catch {
        if (!cancelled) {
          setOrderMeta(fallback);
          setAllWorkOrdersMeta(workOrdersSourceRows.map(mapSourceRowToMeta));
          setOrderMetaHydrated(true);
        }
      }
    }

    void hydrateOrderMeta();
    return () => {
      cancelled = true;
    };
  }, [currentWorkOrderId]);

  useEffect(() => {
    setAssignedMasterName(orderMeta.master || DEFAULT_MASTER_NAME);
    setClientFields(buildClientFields(orderMeta));
    setVehicleFields(buildVehicleFields(orderMeta));
    setIsEditingFields(false);
  }, [orderMeta]);

  useEffect(() => {
    // Prevent cross-order overwrite: block save until current order is hydrated.
    detailsStateHydratedRef.current = false;
    setDetailsStateReady(false);
    setCurrentWorksData([]);
    setCompletedWorksData([]);
    setArchivedWorksData([]);
    setPartsCurrentData([]);
    setPartsArchivedData([]);
  }, [currentWorkOrderId]);

  useEffect(() => {
    if (isWorkOrderDetailsRemoteEnabled()) return;
    const generated = generateWorkRowsByOrderId(currentWorkOrderId);
    setCurrentWorksData(generated.current);
    setCompletedWorksData(generated.completed);
    setArchivedWorksData([]);
    setPartsCurrentData(partsCurrentRows);
    setPartsArchivedData([]);
    detailsStateHydratedRef.current = true;
    setDetailsStateReady(true);
  }, [currentWorkOrderId]);

  useEffect(() => {
    if (!isWorkOrderDetailsRemoteEnabled()) {
      detailsStateHydratedRef.current = true;
      return;
    }
    let cancelled = false;
    async function hydrateDetailsState() {
      try {
        const state = await loadWorkOrderDetailsState(currentWorkOrderId);
        if (cancelled) return;
        if (state) {
          setCurrentWorksData(Array.isArray(state.works_current) ? (state.works_current as WorkRow[]) : []);
          setCompletedWorksData(Array.isArray(state.works_completed) ? (state.works_completed as WorkRow[]) : []);
          setArchivedWorksData(Array.isArray(state.works_archived) ? (state.works_archived as WorkRow[]) : []);
          setPartsCurrentData(Array.isArray(state.parts_current) ? (state.parts_current as PartRow[]) : []);
          setPartsArchivedData(Array.isArray(state.parts_archived) ? (state.parts_archived as PartRow[]) : []);
          if (Array.isArray(state.client_fields) && state.client_fields.length > 0) {
            setClientFields(state.client_fields);
          }
          if (Array.isArray(state.vehicle_fields) && state.vehicle_fields.length > 0) {
            setVehicleFields(state.vehicle_fields);
          }
          setCarPhotos(Array.isArray(state.car_photos) && state.car_photos.length > 0 ? state.car_photos : initialCarPhotoItems);
          setCarDocumentsCurrent(Array.isArray(state.documents_current) ? state.documents_current : []);
          setCarDocumentsArchived(Array.isArray(state.documents_archived) ? state.documents_archived : []);
        } else {
          const generated = generateWorkRowsByOrderId(currentWorkOrderId);
          setCurrentWorksData(generated.current);
          setCompletedWorksData(generated.completed);
          setArchivedWorksData([]);
          setPartsCurrentData(partsCurrentRows);
          setPartsArchivedData([]);
          setCarPhotos(initialCarPhotoItems);
          setCarDocumentsCurrent(initialCarDocumentNames.map((name, i) => ({ id: `doc-seed-${i}`, name })));
          setCarDocumentsArchived([]);
        }
      } catch (error) {
        console.warn("Failed to hydrate work-order details state from API.", error);
      } finally {
        if (!cancelled) {
          detailsStateHydratedRef.current = true;
          setDetailsStateReady(true);
        }
      }
    }
    void hydrateDetailsState();
    return () => {
      cancelled = true;
    };
  }, [currentWorkOrderId]);

  useEffect(() => {
    if (!isWorkOrderDetailsRemoteEnabled()) return;
    if (!detailsStateHydratedRef.current) return;
    const payload: WorkOrderDetailsStateStorage = {
      work_order_id: currentWorkOrderId,
      works_current: currentWorksData,
      works_completed: completedWorksData,
      works_archived: archivedWorksData,
      parts_current: partsCurrentData,
      parts_archived: partsArchivedData,
      client_fields: clientFields,
      vehicle_fields: vehicleFields,
      car_photos: carPhotos,
      documents_current: carDocumentsCurrent,
      documents_archived: carDocumentsArchived,
    };
    void saveWorkOrderDetailsState(payload).catch((error) => {
      console.warn("Failed to save work-order details state to API.", error);
    });
  }, [
    currentWorkOrderId,
    currentWorksData,
    completedWorksData,
    archivedWorksData,
    partsCurrentData,
    partsArchivedData,
    clientFields,
    vehicleFields,
    carPhotos,
    carDocumentsCurrent,
    carDocumentsArchived,
  ]);

  useEffect(() => {
    if (!isWorkOrdersRemoteEnabled()) return;
    const currentAmountRub = parseRubAmount(orderMeta.amount ?? "");
    if (currentAmountRub === totalToPay) return;
    const nextAmount = formatCurrency(totalToPay);
    const syncTimer = window.setTimeout(() => {
      void updateWorkOrdersStorageRows([currentWorkOrderId], { amount: nextAmount })
        .then(() => {
          setOrderMeta((prev) => ({ ...prev, amount: nextAmount }));
          setAllWorkOrdersMeta((prev) =>
            prev.map((row) => (row.id === currentWorkOrderId ? { ...row, amount: nextAmount } : row)),
          );
        })
        .catch((error) => {
          console.warn("Failed to sync work-order amount with finance summary.", error);
        });
    }, 250);

    return () => {
      window.clearTimeout(syncTimer);
    };
  }, [currentWorkOrderId, orderMeta.amount, totalToPay]);

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
    if (!documentActionsModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDocumentActionsModal(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [documentActionsModal]);

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
    return () => {
      documentBlobUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      documentBlobUrlsRef.current.clear();
    };
  }, []);

  useEffect(() => {
    return () => {
      window.sessionStorage.removeItem("workFocusId");
    };
  }, []);

  useLayoutEffect(() => {
    const focusWorkId = searchParams.get("focusWorkId");
    if (!focusWorkId) return;

    const armedFocusId = window.sessionStorage.getItem("workFocusId");
    const shouldHighlight = armedFocusId === focusWorkId;

    if (shouldHighlight) {
      window.sessionStorage.removeItem("workFocusId");
      const panel = searchParams.get("panel");
      const worksScopeParam = searchParams.get("worksScope");
      const partsScopeParam = searchParams.get("partsScope");
      const documentsScopeParam = searchParams.get("documentsScope");
      if (panel === "parts") {
        setActiveCarPanel("parts");
        if (partsScopeParam === "archived") {
          setPartsScope("archived");
        } else {
          setPartsScope("current");
        }
      } else if (panel === "documents") {
        setActiveCarPanel("documents");
        if (documentsScopeParam === "archived") {
          setDocumentsScope("archived");
        } else {
          setDocumentsScope("current");
        }
      } else {
        setActiveCarPanel("orders");
        if (worksScopeParam === "archived") {
          setWorksScope("archived");
        } else if (worksScopeParam === "completed") {
          setWorksScope("completed");
        } else {
          setWorksScope("current");
        }
      }
      setHighlightedWorkId(focusWorkId);
    }

    setSearchParams((prev) => {
      const next = new URLSearchParams(prev);
      next.delete("focusWorkId");
      next.delete("panel");
      next.delete("worksScope");
      next.delete("partsScope");
      next.delete("documentsScope");
      return next;
    }, { replace: true });
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
      setAddPartQuantityInput("");
      if (addCatalogTarget === "parts") {
        if (addWorkEditPartsTarget) {
          setAddWorkCategory(findPartsCatalogCategoryForTitle(addWorkEditPartsTarget.originalTitle));
          setSelectedWorkCatalogItem(catalogPartItemFromTitle(addWorkEditPartsTarget.originalTitle));
          setAddPartQuantityInput(addWorkEditPartsTarget.originalQuantityStr);
        } else {
          setAddWorkCategory("Все запчасти");
          setSelectedWorkCatalogItem(null);
          setAddPartQuantityInput("");
        }
      } else if (addWorkEditWorksTarget) {
        setAddWorkCategory(findWorkCatalogCategoryForTitle(addWorkEditWorksTarget.originalTitle));
        setSelectedWorkCatalogItem(catalogWorkItemFromTitle(addWorkEditWorksTarget.originalTitle));
      } else {
        setAddWorkCategory("Все работы");
        setSelectedWorkCatalogItem(null);
      }
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
  }, [addWorkModalOpen, addCatalogTarget, addWorkEditWorksTarget, addWorkEditPartsTarget]);

  useLayoutEffect(() => {
    const worksEdit = addCatalogTarget === "works" && addWorkEditWorksTarget && selectedWorkCatalogItem;
    const partsEdit = addCatalogTarget === "parts" && addWorkEditPartsTarget && selectedWorkCatalogItem;
    if (!addWorkModalOpen || !addWorkModalActive || !(worksEdit || partsEdit)) return;
    const btn = addWorkCatalogSelectedBtnRef.current;
    if (!btn) return;
    const id = requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        btn.scrollIntoView({ block: "center", inline: "nearest" });
      });
    });
    return () => cancelAnimationFrame(id);
  }, [
    addWorkModalOpen,
    addWorkModalActive,
    addCatalogTarget,
    addWorkEditWorksTarget,
    addWorkEditPartsTarget,
    selectedWorkCatalogItem?.title,
    addWorkCategory,
    addWorkSearchQuery,
  ]);

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
    setAddWorkEditWorksTarget(null);
    setAddWorkEditPartsTarget(null);
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

  function updateSelectedIndexAfterRemove(sel: number | null, removedIndex: number, oldLength: number): number | null {
    if (sel === null) return null;
    if (oldLength <= 1) return null;
    const newLength = oldLength - 1;
    if (newLength === 0) return null;
    if (sel < removedIndex) return sel;
    if (sel > removedIndex) return sel - 1;
    return removedIndex < oldLength - 1 ? removedIndex : removedIndex - 1;
  }

  function removeCarPhotoAtIndex(removedIndex: number) {
    const oldList = carPhotos;
    const oldLen = oldList.length;
    if (removedIndex < 0 || removedIndex >= oldLen) return;
    const url = oldList[removedIndex];
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
    setNewlyAddedPhoto((n) => (n === url ? null : n));
    setCarPhotos((prev) => prev.filter((_, i) => i !== removedIndex));
    setSelectedPhotoIndex((sel) => updateSelectedIndexAfterRemove(sel, removedIndex, oldLen));
  }

  function navigateToWorkOrderFromCard(text: string) {
    const workOrderId = extractWorkOrderIdFromCardText(text);
    if (!workOrderId) return;
    window.sessionStorage.setItem(WORK_ORDER_LIST_FLASH_ARMED_KEY, workOrderId);
    navigate(`/work-orders?workOrder=${workOrderId}`);
  }

  function triggerDocumentUpload() {
    documentUploadInputRef.current?.click();
  }

  function handleDocumentFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const input = e.currentTarget;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    const id =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : `doc-${Date.now()}-${Math.random().toString(16).slice(2)}`;
    const blobUrl = URL.createObjectURL(file);
    documentBlobUrlsRef.current.add(blobUrl);
    setCarDocumentsCurrent((prev) => [{ id, name: file.name, blobUrl }, ...prev]);
    window.setTimeout(() => {
      emitArchiveStyleToast({
        line1: file.name,
        line2: "добавлен в раздел документов",
        navigateTo:
          id !== ""
            ? `/work-orders/${currentWorkOrderId}?panel=documents&documentsScope=current&focusWorkId=${encodeURIComponent(id)}`
            : undefined,
      });
    }, 60);
  }

  function printFinanceReceipt() {
    const escapeHtml = (raw: string) =>
      raw.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

    const carLabel = orderMeta.car ?? "—";
    const printedAt = new Date().toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" });
    const orderNo = escapeHtml(currentWorkOrderId);

    const row = (label: string, value: string) =>
      `<tr><td>${escapeHtml(label)}</td><td>${escapeHtml(value)}</td></tr>`;

    const bodyRows =
      row("Работы", formatCurrency(worksSubtotal)) +
      row("Запчасти", formatCurrency(partsSubtotal)) +
      row("Скидка 7%", `− ${formatCurrency(discountAmount)}`) +
      row("Количество работ", String(allWorks.length));

    const html = `<!DOCTYPE html><html lang="ru"><head><meta charset="utf-8"/><title>Чек №${currentWorkOrderId}</title><style>
body{font-family:ui-sans-serif,system-ui,-apple-system,"Segoe UI",Roboto,sans-serif;padding:28px;color:#111826;max-width:520px;margin:0 auto;}
h1{font-size:20px;font-weight:700;margin:0 0 6px;}
.sub{color:#6F7785;font-size:13px;line-height:1.45;margin-bottom:22px;}
table{width:100%;border-collapse:collapse;font-size:15px;}
td{padding:10px 0;border-bottom:1px solid #E2E5EA;vertical-align:top;}
td:last-child{text-align:right;font-weight:600;white-space:nowrap;}
tfoot td{border-bottom:none;padding-top:18px;font-size:18px;font-weight:700;}
@media print{body{padding:16px;}}
</style></head><body>
<h1>Чек по заказ-наряду</h1>
<div class="sub">№ ${orderNo}<br>${escapeHtml(carLabel)} · ${escapeHtml(assignedMasterFullName)}<br>${escapeHtml(printedAt)}</div>
<table><tbody>${bodyRows}</tbody><tfoot><tr><td>Итого к оплате</td><td>${escapeHtml(formatCurrency(totalToPay))}</td></tr></tfoot></table>
<p class="sub" style="margin-top:24px;margin-bottom:0;">Марс</p>
</body></html>`;

    const w = window.open("", "_blank", "noopener,noreferrer,width=640,height=720");
    if (!w) return;
    w.document.open();
    w.document.write(html);
    w.document.close();
    w.focus();
    window.setTimeout(() => {
      w.print();
    }, 200);
  }

  async function exportFinanceSummaryPdf() {
    try {
      await downloadFinanceSummaryPdf({
        orderId: currentWorkOrderId,
        carLabel: orderMeta.car ?? "—",
        masterFullName: assignedMasterFullName,
        generatedAt: new Date().toLocaleString("ru-RU", { dateStyle: "long", timeStyle: "short" }),
        worksSubtotal,
        partsSubtotal,
        discountAmount,
        totalToPay,
        worksCount: allWorks.length,
        partsCount: partsCurrentData.length,
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Неизвестная ошибка";
      emitArchiveStyleToast({
        line1: "Не удалось сформировать PDF",
        line2: msg,
      });
    }
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-black tracking-[-0.02em]">
      <div className="flex h-full w-full p-2">
        <div className="flex h-full w-full rounded-[16px] bg-black p-2 shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)]">
          <aside className="mr-2 flex w-[100px] flex-col items-center rounded-[11px] bg-black">
            <button className="mb-2 grid h-[90px] w-full place-items-center rounded-[16px] bg-[#EC1C24] text-[18px] font-semibold text-white">Марс</button>
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
                <h1 className="text-[36px] font-bold leading-[100%] tracking-[-0.02em] text-[#111826]">{`Заказ-наряд №${currentWorkOrderId}`}</h1>
                <span
                  className="rounded-[10px] px-3 py-2 text-[16px] font-medium tracking-[-0.02em]"
                  style={{ backgroundColor: currentWorkOrderStatusColor, color: "#FFFFFF" }}
                >
                  {currentWorkOrderStatus}
                </span>
                <div className="ml-auto flex items-center gap-1.5">
                  {(activeCarPanel === "orders" || activeCarPanel === "parts" || activeCarPanel === "documents") && (
                    <div className="relative">
                      <input
                        value={
                          activeCarPanel === "orders"
                            ? workSearchQuery
                            : activeCarPanel === "parts"
                              ? partsSearchQuery
                              : documentsSearchQuery
                        }
                        onChange={(e) => {
                          const v = e.target.value;
                          if (activeCarPanel === "orders") setWorkSearchQuery(v);
                          else if (activeCarPanel === "parts") setPartsSearchQuery(v);
                          else setDocumentsSearchQuery(v);
                        }}
                        className="h-12 w-[320px] rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 pr-11 text-[18px] font-medium tracking-[-0.02em] text-black outline-none placeholder:text-[#B5B5B5] [color-scheme:light] [&::-webkit-search-cancel-button]:hidden"
                        placeholder={
                          activeCarPanel === "orders"
                            ? "Поиск работы..."
                            : activeCarPanel === "parts"
                              ? "Поиск запчасти..."
                              : "Поиск документа..."
                        }
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
                      ) : activeCarPanel === "parts" && partsSearchQuery.trim() ? (
                        <button
                          type="button"
                          onClick={() => setPartsSearchQuery("")}
                          aria-label="Очистить поиск"
                          className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-black"
                        >
                          <svg viewBox="0 0 16 16" fill="none" className="h-[16px] w-[16px]" aria-hidden>
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                        </button>
                      ) : activeCarPanel === "documents" && documentsSearchQuery.trim() ? (
                        <button
                          type="button"
                          onClick={() => setDocumentsSearchQuery("")}
                          aria-label="Очистить поиск"
                          className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-[8px] text-black"
                        >
                          <svg viewBox="0 0 16 16" fill="none" className="h-[16px] w-[16px]" aria-hidden>
                            <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                          </svg>
                        </button>
                      ) : null}
                    </div>
                  )}
                  <button
                    type="button"
                    className="h-12 cursor-pointer rounded-[10px] bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.02em] text-white"
                    aria-label="Позвонить клиенту"
                    onClick={() => {
                      const phoneField = clientFields.find((f) => f.label === "Телефон");
                      const raw = phoneField?.value?.trim() ?? "";
                      const digits = raw.replace(/\D/g, "");
                      if (digits.length < 10) {
                        emitArchiveStyleToast({
                          line1: "Нет номера для звонка",
                          line2: "Проверьте поле «Телефон» в карточке клиента",
                        });
                        return;
                      }
                      const telHref = toTelHref(raw);
                      const callLink = document.createElement("a");
                      callLink.href = telHref;
                      document.body.appendChild(callLink);
                      callLink.click();
                      document.body.removeChild(callLink);
                    }}
                  >
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
                      <h1 className={`max-w-[420px] text-[52px] font-semibold leading-[0.98] tracking-[-0.03em] text-[#202636] transition-opacity duration-150 ${identityVisibilityClass}`}>
                        {displayedTab === "client" ? (
                          <>
                            <span className="block whitespace-nowrap">{displayClientFirstLine || " "}</span>
                            {displayClientSecondLine ? <span className="block">{displayClientSecondLine}</span> : <span className="block"> </span>}
                          </>
                        ) : (
                          <>
                            <span className="block whitespace-nowrap">{carNameLines.first || " "}</span>
                            {carNameLines.second ? <span className="block">{carNameLines.second}</span> : null}
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

              <section className="relative z-20 min-w-0 flex-1 rounded-t-[16px] rounded-b-none bg-white p-6">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="inline-flex w-fit items-center gap-1 rounded-full p-1">
                    {[
                      { label: "Работы", value: "orders" as const },
                      { label: "Запчасти", value: "parts" as const },
                      { label: "Документы", value: "documents" as const },
                      { label: "Фото автомобиля", value: "photos" as const },
                      { label: "Финансовая сводка", value: "finance" as const },
                    ].map((tab) => (
                      <button
                        key={tab.label}
                        type="button"
                        onClick={() => {
                          setHighlightedWorkId(null);
                          window.sessionStorage.removeItem("workFocusId");
                          setActiveCarPanel(tab.value);
                        }}
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
                            <div className="flex w-full flex-wrap items-center justify-between gap-3">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">
                                Документы{" "}
                                <span className="tabular-nums text-[#888888]">
                                  ({carDocumentsCurrent.length + carDocumentsArchived.length})
                                </span>
                              </h3>
                              <div className="ml-auto flex flex-wrap items-center pl-1">
                                <div className="flex items-center gap-6">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHighlightedWorkId(null);
                                      window.sessionStorage.removeItem("workFocusId");
                                      setDocumentsScope("current");
                                    }}
                                    className="flex cursor-pointer items-center gap-2 text-[16px] font-medium tracking-[-0.04em] text-black"
                                  >
                                    <ClientsStyleCheckboxBox checked={documentsScope === "current"} />
                                    <span>Текущие</span>
                                    <span className="tabular-nums text-[#7D7D7D]">({carDocumentsCurrent.length})</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setHighlightedWorkId(null);
                                      window.sessionStorage.removeItem("workFocusId");
                                      setDocumentsScope("archived");
                                    }}
                                    className="flex cursor-pointer items-center gap-2 text-[16px] font-medium tracking-[-0.04em] text-black"
                                  >
                                    <ClientsStyleCheckboxBox checked={documentsScope === "archived"} />
                                    <span>Архив</span>
                                    <span className="tabular-nums text-[#7D7D7D]">({carDocumentsArchived.length})</span>
                                  </button>
                                </div>
                                <input
                                  ref={documentUploadInputRef}
                                  type="file"
                                  className="hidden"
                                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                                  onChange={handleDocumentFileInputChange}
                                />
                                <button
                                  type="button"
                                  onClick={triggerDocumentUpload}
                                  aria-label="Загрузить документ"
                                  className="ml-[50px] shrink-0 cursor-pointer rounded-[10px] bg-black px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] text-white"
                                >
                                  Загрузить документ
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="hide-scrollbar min-h-0 min-w-0 max-h-[598px] space-y-4 overflow-y-auto overflow-x-hidden scroll-smooth rounded-lg bg-transparent">
                            {documentsScope === "archived" && carDocumentsArchived.length === 0 ? (
                              <div className="flex min-h-[200px] items-center justify-center rounded-[12px] bg-[#F3F3F5] px-4 py-10 text-center text-[15px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                                В архиве пока нет документов
                              </div>
                            ) : filteredDocumentsList.length === 0 ? (
                              <div className="flex min-h-[200px] items-center justify-center rounded-[12px] bg-[#F3F3F5] px-4 py-10 text-center text-[15px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                                Ничего не найдено
                              </div>
                            ) : (
                              filteredDocumentsList.map((doc) => {
                                const isArchiving = archivingDocRowId === doc.id;
                                return (
                                  <article
                                    key={doc.id}
                                    className={`flex w-full items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3 ${
                                      isArchiving ? "pointer-events-none animate-[archiveRowOut_260ms_ease_forwards]" : ""
                                    }`}
                                    style={
                                      highlightedWorkId === doc.id && !isArchiving
                                        ? { animation: "workRowHighlightBorder 4s ease-out" }
                                        : undefined
                                    }
                                    onAnimationEnd={(e) => onHighlightBorderAnimationEnd(e, doc.id)}
                                  >
                                    <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                                      <img src="/document.svg" alt="" className="h-5 w-4" />
                                    </span>
                                    <p className="min-w-0 flex-1 truncate text-[20px] font-medium leading-[1.1] tracking-[-0.02em] text-[#7D7D7D]">
                                      {doc.name}
                                    </p>
                                    <button
                                      type="button"
                                      className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[100px] bg-[#EC1C24] text-white"
                                      onClick={() =>
                                        setDocumentActionsModal({
                                          title: doc.name,
                                          docId: doc.id,
                                          scope: documentsScope === "archived" ? "documentsArchived" : "documentsCurrent",
                                        })
                                      }
                                      aria-label={`Действия: ${doc.name}`}
                                    >
                                      <MoreDotsCircleMenuIcon />
                                    </button>
                                  </article>
                                );
                              })
                            )}
                          </div>
                        </article>
                    ) : activeCarPanel === "orders" ? (
                        <article className="relative order-2 mt-[107px] min-h-0 flex-1 rounded-t-[12px] rounded-b-none bg-transparent">
                          <div className="absolute left-0 top-0 -translate-y-full pb-3">
                            <div className="flex items-center">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Ответственный мастер</h3>
                            </div>
                          </div>
                          <div className="hide-scrollbar flex min-h-0 min-w-0 max-h-[598px] flex-col gap-4 overflow-y-auto overflow-x-hidden scroll-smooth rounded-t-lg rounded-b-none bg-transparent">
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
                                <p className={`min-w-0 text-black transition-opacity duration-150 ${identityVisibilityClass}`}>{displayMasterFullName || " "}</p>
                              </div>
                              <button
                                type="button"
                                className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-[100px] bg-[#EC1C24] text-white"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setMasterActionsModalOpen(true);
                                }}
                                aria-label="Действия с ответственным мастером"
                              >
                                <MoreDotsCircleMenuIcon />
                              </button>
                            </article>

                            <div className="mt-[28px] min-h-0 min-w-0 flex-1 rounded-t-[12px] rounded-b-none bg-white">
                              <div className="flex items-center">
                                <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">
                                  Работы <span className="text-[#888888]">({totalWorksCount})</span>
                                </h3>
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
                                      <span className="tabular-nums text-[#7D7D7D]">({completedWorksData.length})</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHighlightedWorkId(null);
                                        window.sessionStorage.removeItem("workFocusId");
                                        setWorksScope("archived");
                                      }}
                                      className="flex cursor-pointer items-center gap-2 text-[16px] font-medium tracking-[-0.04em] text-black"
                                    >
                                      <ClientsStyleCheckboxBox checked={worksScope === "archived"} />
                                      <span>Архив</span>
                                      <span className="tabular-nums text-[#7D7D7D]">({archivedWorksData.length})</span>
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAddWorkEditWorksTarget(null);
                                      setAddWorkEditPartsTarget(null);
                                      setAddCatalogTarget("works");
                                      setAddWorkModalOpen(true);
                                    }}
                                    className="ml-[60px] shrink-0 cursor-pointer rounded-[10px] bg-black px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] text-white"
                                  >
                                    Добавить работу
                                  </button>
                                </div>
                              </div>
                              <div className="hide-scrollbar mt-3 min-h-0 min-w-0 max-h-[405px] overflow-y-scroll overflow-x-hidden scroll-smooth rounded-t-lg rounded-b-none bg-transparent">
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
                                      <th className="h-[45px] rounded-tl-[5px] px-3 align-middle font-medium">Название работы</th>
                                      <th className="h-[45px] px-3 align-middle font-medium">Статус</th>
                                      <th className="h-[45px] px-3 align-middle font-medium">Сумма</th>
                                      <th className="h-[45px] px-3 align-middle font-medium">Дата добавления</th>
                                      <th className="h-[45px] rounded-tr-[5px] px-3 text-center align-middle font-medium">⋮</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {worksScope === "archived" && archivedWorksData.length === 0 ? (
                                      <tr>
                                        <td
                                          colSpan={5}
                                          className="bg-white px-3 py-10 align-middle text-center text-[15px] font-medium tracking-[-0.04em] text-[#7D7D7D]"
                                        >
                                          В архиве пока нет работ
                                        </td>
                                      </tr>
                                    ) : filteredWorks.length === 0 && workSearchQuery.trim() ? (
                                      <tr>
                                        <td
                                          colSpan={5}
                                          className="bg-white px-3 py-10 align-middle text-center text-[15px] font-medium tracking-[-0.04em] text-[#7D7D7D]"
                                        >
                                          Ничего не найдено
                                        </td>
                                      </tr>
                                    ) : (
                                      filteredWorks.map(
                                        (row, index) => {
                                          const { title, statusLabel, amount, kind, addedDate, rowWorkId } = row;
                                          const dotColor =
                                            workStatusColorMap[statusLabel] ??
                                            (kind === "closed"
                                              ? "#00B515"
                                              : kind === "new"
                                                ? "#ACACAC"
                                              : kind === "progress"
                                                ? "#2E78C9"
                                                : "#FFB020");
                                          const isArchiving = archivingWorkRowId === rowWorkId;
                                          return (
                                            <tr
                                              key={`${worksScope}-${title}-${index}`}
                                              className={`h-[45px] transition hover:bg-[rgba(224,9,25,0.10)] ${index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white"} ${
                                                isArchiving ? "pointer-events-none animate-[archiveRowOut_260ms_ease_forwards]" : ""
                                              }`}
                                              style={
                                                highlightedWorkId === rowWorkId && !isArchiving
                                                  ? { animation: "workRowHighlightBorder 4s ease-out" }
                                                  : undefined
                                              }
                                              onAnimationEnd={(e) => onHighlightBorderAnimationEnd(e, rowWorkId)}
                                            >
                                              <td className="h-[45px] truncate px-3 align-middle text-black">{title}</td>
                                              <td className="h-[45px] px-3 align-middle">
                                                <span className="inline-flex items-center gap-2 font-medium text-black">
                                                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: dotColor }} />
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
                                      )
                                    )}
                                  </tbody>
                                </table>
                              </div>
                            </div>
                          </div>
                        </article>
                    ) : activeCarPanel === "parts" ? (
                        <article className="relative order-2 mt-[50px] flex min-h-0 flex-1 flex-col rounded-t-[12px] rounded-b-none bg-transparent">
                          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-t-lg rounded-b-none bg-transparent">
                            <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-t-[12px] rounded-b-none bg-white">
                              <div className="flex shrink-0 items-center">
                                <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">
                                  Запчасти{" "}
                                  <span className="text-[#888888]">
                                    ({partsCurrentData.length + partsArchivedData.length})
                                  </span>
                                </h3>
                                <div className="ml-auto flex flex-wrap items-center pl-1">
                                  <div className="flex items-center gap-6">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHighlightedWorkId(null);
                                        window.sessionStorage.removeItem("workFocusId");
                                        setPartsScope("current");
                                      }}
                                      className="flex cursor-pointer items-center gap-2 text-[16px] font-medium tracking-[-0.04em] text-black"
                                    >
                                      <ClientsStyleCheckboxBox checked={partsScope === "current"} />
                                      <span>Текущие</span>
                                      <span className="tabular-nums text-[#7D7D7D]">({partsCurrentData.length})</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setHighlightedWorkId(null);
                                        window.sessionStorage.removeItem("workFocusId");
                                        setPartsScope("archived");
                                      }}
                                      className="flex cursor-pointer items-center gap-2 text-[16px] font-medium tracking-[-0.04em] text-black"
                                    >
                                      <ClientsStyleCheckboxBox checked={partsScope === "archived"} />
                                      <span>Архив</span>
                                      <span className="tabular-nums text-[#7D7D7D]">({partsArchivedData.length})</span>
                                    </button>
                                  </div>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setAddWorkEditWorksTarget(null);
                                      setAddWorkEditPartsTarget(null);
                                      setAddCatalogTarget("parts");
                                      setAddWorkModalOpen(true);
                                    }}
                                    className="ml-[50px] shrink-0 cursor-pointer rounded-[10px] bg-black px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] text-white"
                                  >
                                    Добавить запчасть
                                  </button>
                                </div>
                              </div>
                              <div className="hide-scrollbar mt-3 flex max-h-[585px] min-h-0 min-w-0 flex-1 flex-col overflow-x-hidden overflow-y-auto scroll-smooth rounded-t-lg rounded-b-none bg-transparent">
                                <table className="w-full table-fixed border-separate border-spacing-0 whitespace-nowrap text-[16px] font-medium tracking-[-0.02em]">
                                  <colgroup>
                                    <col className="w-[30%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[18%]" />
                                    <col className="w-[20%]" />
                                    <col className="w-[6%]" />
                                  </colgroup>
                                  <thead className="sticky top-0 z-10 bg-[#F3F3F5] text-left text-[16px] font-medium tracking-[-0.02em] text-[#7D7D7D]">
                                    <tr className="h-[45px]">
                                      <th className="h-[45px] rounded-tl-[5px] px-3 align-middle font-medium">Название запчасти</th>
                                      <th className="h-[45px] px-3 align-middle font-medium">Кол-во</th>
                                      <th className="h-[45px] px-3 align-middle font-medium">Цена</th>
                                      <th className="h-[45px] px-3 align-middle font-medium">Дата добавления</th>
                                      <th className="h-[45px] rounded-tr-[5px] px-3 text-center align-middle font-medium">⋮</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {partsScope === "archived" && partsArchivedData.length === 0 ? (
                                      <tr>
                                        <td
                                          colSpan={5}
                                          className="bg-white px-3 py-10 align-middle text-center text-[15px] font-medium tracking-[-0.04em] text-[#7D7D7D]"
                                        >
                                          В архиве пока нет запчастей
                                        </td>
                                      </tr>
                                    ) : (
                                      (() => {
                                        const rows = filteredPartsRows;
                                        if (rows.length === 0) {
                                          return (
                                            <tr>
                                              <td
                                                colSpan={5}
                                                className="bg-white px-3 py-10 align-middle text-center text-[15px] font-medium tracking-[-0.04em] text-[#7D7D7D]"
                                              >
                                                Ничего не найдено
                                              </td>
                                            </tr>
                                          );
                                        }
                                        return rows.map((row, index) => {
                                          const [title, quantity, price, addedDate, partRowId] = row;
                                          const isArchiving = archivingWorkRowId === partRowId;
                                          return (
                                            <tr
                                              key={`parts-${partRowId}`}
                                              className={`h-[45px] transition hover:bg-[rgba(224,9,25,0.10)] ${index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white"} ${
                                                isArchiving ? "pointer-events-none animate-[archiveRowOut_260ms_ease_forwards]" : ""
                                              }`}
                                              style={
                                                highlightedWorkId === partRowId && !isArchiving
                                                  ? { animation: "workRowHighlightBorder 4s ease-out" }
                                                  : undefined
                                              }
                                              onAnimationEnd={(e) => onHighlightBorderAnimationEnd(e, partRowId)}
                                            >
                                              <td className="h-[45px] truncate px-3 align-middle text-black">{title}</td>
                                              <td className="h-[45px] px-3 align-middle text-black">{quantity}</td>
                                              <td className="h-[45px] px-3 align-middle text-black">{price}</td>
                                              <td className="h-[45px] px-3 align-middle text-black">{addedDate}</td>
                                              <td className="h-[45px] px-3 text-center align-middle">
                                                <button
                                                  type="button"
                                                  className="cursor-pointer rounded-md px-1.5 py-0.5 text-[16px] font-bold leading-none tracking-[-0.04em] text-[#A0A0A0] transition-colors hover:bg-black/[0.04] hover:text-[#EC1C24]"
                                                  aria-label="Действия"
                                                  onClick={() =>
                                                    setWorkActionsModal({
                                                      title,
                                                      workId: partRowId,
                                                      scope: partsScope === "archived" ? "partsArchived" : "parts",
                                                      statusLabel: workStatusById[partRowId]?.label ?? "Новый",
                                                    })
                                                  }
                                                >
                                                  ...
                                                </button>
                                              </td>
                                            </tr>
                                          );
                                        });
                                      })()
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
                            <div className="flex w-full flex-wrap items-center justify-between gap-3">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Финансовая сводка</h3>
                              <button
                                type="button"
                                onClick={() => void exportFinanceSummaryPdf()}
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
                              </div>
                            </div>
                            <button type="button" onClick={printFinanceReceipt} className="flex h-[46px] w-full items-center justify-center gap-2 rounded-[8px] border border-[#D8DDE6] bg-white text-[16px] font-semibold text-[#EC1C24]">
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
                          <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto scroll-smooth">
                            <div className="grid grid-cols-3 gap-3">
                              {carPhotos.map((photoSrc, index) => (
                                <article
                                  key={photoSrc}
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
                                  <button
                                    type="button"
                                    className="absolute right-2 top-2 z-10 flex h-9 w-9 cursor-pointer items-center justify-center rounded-full bg-black/50 text-white opacity-0 shadow-md transition-opacity hover:bg-black/65 group-hover:opacity-100"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      removeCarPhotoAtIndex(index);
                                    }}
                                    aria-label="Удалить фото"
                                  >
                                    <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px]" aria-hidden>
                                      <path
                                        d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a2 2 0 01-2 2H9a2 2 0 01-2-2V7"
                                        stroke="currentColor"
                                        strokeWidth="1.75"
                                        strokeLinecap="round"
                                        strokeLinejoin="round"
                                      />
                                      <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                                    </svg>
                                  </button>
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
                                <span className="block whitespace-nowrap">{displayMasterFirstLine || " "}</span>
                                <span className="block">{displayMasterSecondLine || " "}</span>
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
                          ) : (
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
                    {workActionsModal.scope === "parts" || workActionsModal.scope === "partsArchived"
                      ? "Действия с запчастью"
                      : "Действия с работой"}
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    {workActionsModal.title}
                  </p>
                </div>
                <ul className="p-0">
                  {(
                    workActionsModal.scope === "parts" || workActionsModal.scope === "partsArchived"
                      ? [
                          { label: "Редактировать", icon: "edit" as const, danger: false },
                          ...(workActionsModal.scope === "parts"
                            ? [{ label: "Переместить в архив", icon: "archive" as const, danger: true }]
                            : [{ label: "Вернуть в таблицу", icon: "restore" as const, danger: false }]),
                        ]
                      : [
                          { label: "Изменить статус", icon: "status" as const, danger: false },
                          { label: "Редактировать", icon: "edit" as const, danger: false },
                          ...(workActionsModal.scope === "archived"
                            ? [{ label: "Вернуть в таблицу", icon: "restore" as const, danger: false }]
                            : []),
                          ...(workActionsModal.scope !== "archived"
                            ? [{ label: "Переместить в архив", icon: "archive" as const, danger: true }]
                            : []),
                        ]
                  ).map(({ label, icon, danger }) => (
                    <li key={label}>
                      <button
                        type="button"
                        className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                          danger ? "text-[#EC1C24] hover:bg-[#EC1C24]/10" : "text-[#111826] hover:bg-[#F3F3F5]"
                        }`}
                        onClick={() => {
                          if (label === "Изменить статус" && workActionsModal) {
                            setWorkStatusPicker({
                              title: workActionsModal.title,
                              workId: workActionsModal.workId,
                              statusLabel: workActionsModal.statusLabel,
                            });
                            setWorkActionsModal(null);
                            return;
                          }
                          if (label === "Редактировать" && workActionsModal) {
                            const snap = workActionsModal;
                            if (snap.scope === "parts" || snap.scope === "partsArchived") {
                              const listScope = snap.scope === "parts" ? "current" : "archived";
                              const row =
                                listScope === "current"
                                  ? partsCurrentData.find((r) => r[4] === snap.workId)
                                  : partsArchivedData.find((r) => r[4] === snap.workId);
                              if (!row) {
                                setWorkActionsModal(null);
                                return;
                              }
                              setWorkActionsModal(null);
                              setAddWorkEditWorksTarget(null);
                              setAddCatalogTarget("parts");
                              setAddWorkEditPartsTarget({
                                partId: snap.workId,
                                listScope,
                                originalTitle: row[0],
                                originalQuantityStr: row[1],
                              });
                              setAddWorkModalOpen(true);
                              return;
                            }
                            const listScope = snap.scope;
                            const row =
                              listScope === "current"
                                ? currentWorksData.find((r) => r[5] === snap.workId)
                                : listScope === "completed"
                                  ? completedWorksData.find((r) => r[5] === snap.workId)
                                  : archivedWorksData.find((r) => r[5] === snap.workId);
                            if (!row) {
                              setWorkActionsModal(null);
                              return;
                            }
                            setWorkActionsModal(null);
                            setAddWorkEditPartsTarget(null);
                            setAddCatalogTarget("works");
                            setAddWorkEditWorksTarget({
                              workId: snap.workId,
                              listScope,
                              originalTitle: row[0],
                            });
                            setAddWorkModalOpen(true);
                            return;
                          }
                          if (label === "Вернуть в таблицу" && workActionsModal) {
                            const snap = workActionsModal;
                            if (snap.scope === "partsArchived") {
                              const moveRow = partsArchivedData.find((row) => row[4] === snap.workId);
                              if (!moveRow) {
                                setWorkActionsModal(null);
                                return;
                              }
                              const partId = moveRow[4] ?? snap.workId;
                              setWorkActionsModal(null);
                              setArchivingWorkRowId(snap.workId);
                              window.setTimeout(() => {
                                setPartsArchivedData((prev) => prev.filter((row) => row[4] !== snap.workId));
                                setPartsCurrentData((prev) => [moveRow, ...prev]);
                                setArchivingWorkRowId((current) => (current === snap.workId ? null : current));
                                emitArchiveStyleToast({
                                  line1: moveRow[0],
                                  line2: "возвращена в таблицу",
                                  navigateTo:
                                    partId !== ""
                                      ? `/work-orders/${currentWorkOrderId}?panel=parts&partsScope=current&focusWorkId=${encodeURIComponent(partId)}`
                                      : undefined,
                                });
                              }, 260);
                              return;
                            }
                            if (snap.scope !== "archived") {
                              setWorkActionsModal(null);
                              return;
                            }
                            const moveRow = archivedWorksData.find((row) => row[5] === snap.workId);
                            if (!moveRow) {
                              setWorkActionsModal(null);
                              return;
                            }
                            const workId = moveRow[5] ?? snap.workId;
                            const [, statusLabel, , kind] = moveRow;
                            const override = workStatusById[workId];
                            const effectiveKind = override?.kind ?? kind;
                            const effectiveStatus = override?.label ?? statusLabel;
                            const toCompleted =
                              effectiveKind === "closed" ||
                              effectiveStatus === "Готово" ||
                              effectiveStatus === "Закрыт";
                            setWorkActionsModal(null);
                            setArchivingWorkRowId(snap.workId);
                            window.setTimeout(() => {
                              setArchivedWorksData((prev) => prev.filter((row) => row[5] !== snap.workId));
                              if (toCompleted) {
                                setCompletedWorksData((prev) => [moveRow, ...prev]);
                              } else {
                                setCurrentWorksData((prev) => [moveRow, ...prev]);
                              }
                              setArchivingWorkRowId((current) => (current === snap.workId ? null : current));
                              emitArchiveStyleToast({
                                line1: moveRow[0],
                                line2: "возвращена в таблицу",
                                navigateTo:
                                  workId !== ""
                                    ? `/work-orders/${currentWorkOrderId}?panel=orders&worksScope=${toCompleted ? "completed" : "current"}&focusWorkId=${encodeURIComponent(workId)}`
                                    : undefined,
                              });
                            }, 260);
                            return;
                          }
                          if (label === "Переместить в архив" && workActionsModal) {
                            const snap = workActionsModal;
                            if (snap.scope === "parts") {
                              const moveRow = partsCurrentData.find((row) => row[4] === snap.workId);
                              if (moveRow) {
                                setWorkActionsModal(null);
                                setArchivingWorkRowId(snap.workId);
                                window.setTimeout(() => {
                                  setPartsCurrentData((prev) => prev.filter((row) => row[4] !== snap.workId));
                                  setPartsArchivedData((prev) => [moveRow, ...prev]);
                                  setArchivingWorkRowId((current) => (current === snap.workId ? null : current));
                                  emitArchiveStyleToast({
                                    line1: moveRow[0],
                                    line2: "перемещена в архив",
                                    navigateTo:
                                      moveRow[4] != null && moveRow[4] !== ""
                                        ? `/work-orders/${currentWorkOrderId}?panel=parts&partsScope=archived&focusWorkId=${encodeURIComponent(moveRow[4])}`
                                        : undefined,
                                  });
                                }, 260);
                                return;
                              }
                              setWorkActionsModal(null);
                              return;
                            }
                            const moveRow =
                              snap.scope === "current"
                                ? currentWorksData.find((row) => row[5] === snap.workId)
                                : snap.scope === "completed"
                                  ? completedWorksData.find((row) => row[5] === snap.workId)
                                  : undefined;
                            if (moveRow && (snap.scope === "current" || snap.scope === "completed")) {
                              setWorkActionsModal(null);
                              setArchivingWorkRowId(snap.workId);
                              window.setTimeout(() => {
                                if (snap.scope === "current") {
                                  setCurrentWorksData((prev) => prev.filter((row) => row[5] !== snap.workId));
                                } else {
                                  setCompletedWorksData((prev) => prev.filter((row) => row[5] !== snap.workId));
                                }
                                setArchivedWorksData((prev) => [moveRow, ...prev]);
                                setArchivingWorkRowId((current) => (current === snap.workId ? null : current));
                                const archivedId = moveRow[5];
                                emitArchiveStyleToast({
                                  line1: moveRow[0],
                                  line2: "перемещена в архив",
                                  navigateTo:
                                    archivedId != null && archivedId !== ""
                                      ? `/work-orders/${currentWorkOrderId}?panel=orders&worksScope=archived&focusWorkId=${encodeURIComponent(archivedId)}`
                                      : undefined,
                                });
                              }, 260);
                              return;
                            }
                            setWorkActionsModal(null);
                            return;
                          }
                          setWorkActionsModal(null);
                        }}
                      >
                        <WorkActionIcon type={icon} className={danger ? "text-[#EC1C24]" : "text-[#4B5563]"} />
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
      {documentActionsModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setDocumentActionsModal(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="document-actions-title"
                className="w-full max-w-[360px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="document-actions-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Действия с документом
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    {documentActionsModal.title}
                  </p>
                </div>
                <ul className="p-0">
                  {(
                    documentActionsModal.scope === "documentsCurrent"
                      ? [
                          { label: "Скачать документ", icon: "download" as const, danger: false },
                          { label: "Переместить в архив", icon: "archive" as const, danger: true },
                        ]
                      : [
                          { label: "Скачать документ", icon: "download" as const, danger: false },
                          { label: "Вернуть в таблицу", icon: "restore" as const, danger: false },
                        ]
                  ).map(({ label, icon, danger }) => (
                    <li key={label}>
                      <button
                        type="button"
                        className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                          danger ? "text-[#EC1C24] hover:bg-[#EC1C24]/10" : "text-[#111826] hover:bg-[#F3F3F5]"
                        }`}
                        onClick={() => {
                          const snap = documentActionsModal;
                          if (!snap) return;
                          if (label === "Скачать документ") {
                            const doc =
                              carDocumentsCurrent.find((d) => d.id === snap.docId) ??
                              carDocumentsArchived.find((d) => d.id === snap.docId);
                            if (doc) downloadCarDocument(doc);
                            setDocumentActionsModal(null);
                            return;
                          }
                          if (label === "Переместить в архив" && snap.scope === "documentsCurrent") {
                            const moveDoc = carDocumentsCurrent.find((d) => d.id === snap.docId);
                            if (!moveDoc) {
                              setDocumentActionsModal(null);
                              return;
                            }
                            const docId = moveDoc.id;
                            setDocumentActionsModal(null);
                            setArchivingDocRowId(snap.docId);
                            window.setTimeout(() => {
                              setCarDocumentsCurrent((prev) => prev.filter((d) => d.id !== snap.docId));
                              setCarDocumentsArchived((prev) => [moveDoc, ...prev]);
                              setArchivingDocRowId((current) => (current === snap.docId ? null : current));
                              emitArchiveStyleToast({
                                line1: moveDoc.name,
                                line2: "перемещён в архив",
                                navigateTo:
                                  docId !== ""
                                    ? `/work-orders/${currentWorkOrderId}?panel=documents&documentsScope=archived&focusWorkId=${encodeURIComponent(docId)}`
                                    : undefined,
                              });
                            }, 260);
                            return;
                          }
                          if (label === "Вернуть в таблицу" && snap.scope === "documentsArchived") {
                            const moveDoc = carDocumentsArchived.find((d) => d.id === snap.docId);
                            if (!moveDoc) {
                              setDocumentActionsModal(null);
                              return;
                            }
                            const docId = moveDoc.id;
                            setDocumentActionsModal(null);
                            setArchivingDocRowId(snap.docId);
                            window.setTimeout(() => {
                              setCarDocumentsArchived((prev) => prev.filter((d) => d.id !== snap.docId));
                              setCarDocumentsCurrent((prev) => [moveDoc, ...prev]);
                              setArchivingDocRowId((current) => (current === snap.docId ? null : current));
                              emitArchiveStyleToast({
                                line1: moveDoc.name,
                                line2: "возвращён в таблицу",
                                navigateTo:
                                  docId !== ""
                                    ? `/work-orders/${currentWorkOrderId}?panel=documents&documentsScope=current&focusWorkId=${encodeURIComponent(docId)}`
                                    : undefined,
                              });
                            }, 260);
                            return;
                          }
                          setDocumentActionsModal(null);
                        }}
                      >
                        <WorkActionIcon type={icon} className={danger ? "text-[#EC1C24]" : "text-[#4B5563]"} />
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
                    const selected = currentStatusLabel === status.label;
                    return (
                      <li key={status.label}>
                        <button
                          type="button"
                          className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                            selected ? "bg-[#F8F8FA] text-[#111826]" : "text-[#111826] hover:bg-[#F3F3F5]"
                          }`}
                          onClick={() => {
                            applyStatusToWorkLists(workStatusPicker.workId, status.label, status.kind);
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
                    {displayMasterFullName || " "}
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
                <ul className="max-h-[420px] space-y-2 overflow-y-auto p-2">
                  {availableMasters.map((masterName) => (
                    <li key={masterName}>
                      <button
                        type="button"
                        className={`flex min-h-[56px] w-full cursor-pointer items-center rounded-[10px] px-3 py-3 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                          switchMasterSelection === masterName
                            ? "bg-[#EC1C24] text-white"
                            : "bg-[#F3F3F5] text-[#111826] hover:bg-[#EBECF0]"
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
                    className="h-11 rounded-[10px] bg-[#ECECEF] px-4 text-[15px] font-medium tracking-[-0.04em] text-black"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={!switchMasterSelection}
                    onClick={async () => {
                      if (!switchMasterSelection) return;
                      const nextMaster = switchMasterSelection;
                      const nextMasterPhoto = masterPhotoByName[nextMaster] ?? null;
                      try {
                        await updateWorkOrdersStorageRows([currentWorkOrderId], { master: nextMaster, master_photo: nextMasterPhoto });
                        setAssignedMasterName(nextMaster);
                        setOrderMeta((prev) => ({ ...prev, master: nextMaster }));
                        setAllWorkOrdersMeta((prev) =>
                          prev.map((row) => (row.id === currentWorkOrderId ? { ...row, master: nextMaster } : row)),
                        );
                        const raw = window.localStorage.getItem(workOrderMasterOverrideStorageKey);
                        let parsed: Record<string, string> = {};
                        if (raw) {
                          try {
                            parsed = JSON.parse(raw) as Record<string, string>;
                          } catch {
                            parsed = {};
                          }
                        }
                        parsed[currentWorkOrderId] = nextMaster;
                        window.localStorage.setItem(workOrderMasterOverrideStorageKey, JSON.stringify(parsed));
                        setSwitchMasterModalOpen(false);
                      } catch (error) {
                        console.warn("Failed to update work-order master.", error);
                        emitArchiveStyleToast({
                          line1: "Не удалось сменить мастера",
                          line2: "Проверьте подключение к серверу и повторите",
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
                      <h2 id="add-work-title" className="text-[32px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">
                        {addCatalogTarget === "parts"
                          ? addWorkEditPartsTarget
                            ? "Редактировать запчасть"
                            : "Добавить запчасть"
                          : addWorkEditWorksTarget
                            ? "Редактировать работу"
                            : "Добавить работу"}
                      </h2>
                      {addCatalogTarget === "works" && addWorkEditWorksTarget ? (
                        <p className="mt-2 text-[15px] font-medium leading-[1.35] tracking-[-0.03em] text-[#6F7785]">
                          Сейчас в заказ-наряде:{" "}
                          <span className="text-[#111826]">{addWorkEditWorksTarget.originalTitle}</span>
                        </p>
                      ) : null}
                      {addCatalogTarget === "parts" && addWorkEditPartsTarget ? (
                        <p className="mt-2 text-[15px] font-medium leading-[1.35] tracking-[-0.03em] text-[#6F7785]">
                          Сейчас в заказ-наряде:{" "}
                          <span className="text-[#111826]">{addWorkEditPartsTarget.originalTitle}</span>
                          <span className="text-[#7D7D7D]">
                            {" "}
                            · кол-во: <span className="text-[#111826]">{addWorkEditPartsTarget.originalQuantityStr}</span>
                          </span>
                        </p>
                      ) : null}
                    </div>
                    <div className="hide-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 scroll-smooth">
                      <div>
                        <input
                          value={addWorkSearchQuery}
                          onChange={(e) => setAddWorkSearchQuery(e.target.value)}
                          placeholder={addCatalogTarget === "parts" ? "Поиск запчасти из справочника..." : "Поиск работы из справочника..."}
                          className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[16px] font-medium tracking-[-0.02em] text-black outline-none placeholder:text-[#B5B5B5]"
                        />
                      </div>
                      <div>
                        <div className="mb-5 flex flex-wrap gap-2 pb-1">
                          {(addCatalogTarget === "parts" ? partsCatalogSections : workCatalogSections).map((section) => (
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
                              ref={
                                selectedWorkCatalogItem?.title === item.title &&
                                ((addCatalogTarget === "works" && addWorkEditWorksTarget) ||
                                  (addCatalogTarget === "parts" && addWorkEditPartsTarget))
                                  ? addWorkCatalogSelectedBtnRef
                                  : undefined
                              }
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
                        {addCatalogTarget === "parts" ? (
                          <div className="mt-5 space-y-2">
                            <label htmlFor="add-part-quantity" className="block text-[14px] font-medium tracking-[-0.02em] text-[#6F7785]">
                              Количество
                            </label>
                            <input
                              id="add-part-quantity"
                              type="text"
                              inputMode="decimal"
                              value={addPartQuantityInput}
                              onChange={(e) => setAddPartQuantityInput(e.target.value)}
                              placeholder="Например, 1 или 1.5"
                              autoComplete="off"
                              className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[16px] font-medium tracking-[-0.02em] text-black outline-none placeholder:text-[#B5B5B5]"
                            />
                          </div>
                        ) : null}
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
                        disabled={
                          !selectedWorkCatalogItem ||
                          (addCatalogTarget === "parts" && parsePartQuantityInput(addPartQuantityInput) === null)
                        }
                        onClick={() => {
                          if (!selectedWorkCatalogItem) return;
                          const partQty = addCatalogTarget === "parts" ? parsePartQuantityInput(addPartQuantityInput) : null;
                          if (addCatalogTarget === "parts" && partQty === null) return;
                          if (addCatalogTarget === "parts" && addWorkEditPartsTarget) {
                            const { partId, listScope } = addWorkEditPartsTarget;
                            const title = selectedWorkCatalogItem.title;
                            const qtyCell = formatPartQuantityCell(partQty!);
                            const priceCell = formatPartLineTotalRub(selectedWorkCatalogItem.price, partQty!);
                            const apply = (prev: PartRow[]) =>
                              prev.map((row) => {
                                if (row[4] !== partId) return row;
                                return [title, qtyCell, priceCell, row[3], partId] as PartRow;
                              });
                            if (listScope === "current") setPartsCurrentData(apply);
                            else setPartsArchivedData(apply);
                            setHighlightedWorkId(null);
                            window.sessionStorage.removeItem("workFocusId");
                            setPartsScope(listScope);
                            setActiveCarPanel("parts");
                            setAddWorkModalOpen(false);
                            const partsScopeParam = listScope === "archived" ? "archived" : "current";
                            window.setTimeout(() => {
                              emitArchiveStyleToast({
                                line1: title,
                                line2: "обновлена в списке запчастей",
                                navigateTo:
                                  partId !== ""
                                    ? `/work-orders/${currentWorkOrderId}?panel=parts&partsScope=${partsScopeParam}&focusWorkId=${encodeURIComponent(partId)}`
                                    : undefined,
                              });
                            }, 60);
                            return;
                          }
                          if (addCatalogTarget === "works" && addWorkEditWorksTarget) {
                            const { workId, listScope } = addWorkEditWorksTarget;
                            const title = selectedWorkCatalogItem.title;
                            const amountStr = formatWorkPrice(getCatalogWorkPrice(title));
                            const updateList = (prev: WorkRow[]) =>
                              prev.map((row) => {
                                if (row[5] !== workId) return row;
                                const [, statusLabel, , kind, addedDate] = row;
                                return [title, statusLabel, amountStr, kind, addedDate, workId] as WorkRow;
                              });
                            if (listScope === "current") setCurrentWorksData(updateList);
                            else if (listScope === "completed") setCompletedWorksData(updateList);
                            else setArchivedWorksData(updateList);
                            setHighlightedWorkId(null);
                            window.sessionStorage.removeItem("workFocusId");
                            setWorksScope(listScope);
                            setActiveCarPanel("orders");
                            setAddWorkModalOpen(false);
                            const worksScopeParam =
                              listScope === "archived" ? "archived" : listScope === "completed" ? "completed" : "current";
                            window.setTimeout(() => {
                              emitArchiveStyleToast({
                                line1: title,
                                line2: "обновлена в списке работ",
                                navigateTo:
                                  workId !== ""
                                    ? `/work-orders/${currentWorkOrderId}?panel=orders&worksScope=${worksScopeParam}&focusWorkId=${encodeURIComponent(workId)}`
                                    : undefined,
                              });
                            }, 60);
                            return;
                          }
                          const newWorkId =
                            typeof crypto !== "undefined" && "randomUUID" in crypto
                              ? crypto.randomUUID()
                              : `work-${Date.now()}-${Math.random().toString(16).slice(2)}`;
                          if (addCatalogTarget === "parts") {
                            setPartsCurrentData((prev) => [
                              [
                                selectedWorkCatalogItem.title,
                                formatPartQuantityCell(partQty!),
                                formatPartLineTotalRub(selectedWorkCatalogItem.price, partQty!),
                                "07.05.2026",
                                newWorkId,
                              ],
                              ...prev,
                            ]);
                          } else {
                            setCurrentWorksData((prev) => [
                              [
                                selectedWorkCatalogItem.title,
                                "Новый",
                                formatWorkPrice(getCatalogWorkPrice(selectedWorkCatalogItem.title)),
                                "new",
                                "07.05.2026",
                                newWorkId,
                              ],
                              ...prev,
                            ]);
                          }
                          setHighlightedWorkId(null);
                          window.sessionStorage.removeItem("workFocusId");
                          if (addCatalogTarget === "parts") {
                            setActiveCarPanel("parts");
                            setPartsScope("current");
                          } else {
                            setWorksScope("current");
                          }
                          setAddWorkModalOpen(false);
                          window.setTimeout(() => {
                            emitArchiveStyleToast({
                              line1: selectedWorkCatalogItem.title,
                              line2: addCatalogTarget === "parts" ? "добавлена в блок запчастей" : "добавлена в блок работ",
                              navigateTo:
                                addCatalogTarget === "parts"
                                  ? `/work-orders/${currentWorkOrderId}?panel=parts&focusWorkId=${encodeURIComponent(newWorkId)}`
                                  : `/work-orders/${currentWorkOrderId}?panel=orders&focusWorkId=${encodeURIComponent(newWorkId)}`,
                            });
                          }, 60);
                        }}
                        className="h-11 rounded-[10px] bg-[#EC1C24] px-5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                      >
                        {addCatalogTarget === "parts"
                          ? addWorkEditPartsTarget
                            ? "Редактировать"
                            : "Добавить"
                          : addWorkEditWorksTarget
                            ? "Редактировать"
                            : "Добавить"}
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
                onClick={(e) => {
                  e.stopPropagation();
                  setSelectedPhotoIndex(null);
                }}
                className="absolute right-6 top-6 inline-flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-[28px] leading-none text-white transition hover:bg-white/25"
                aria-label="Закрыть просмотр фото"
              >
                ×
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (selectedPhotoIndex === null) return;
                  removeCarPhotoAtIndex(selectedPhotoIndex);
                }}
                className="absolute bottom-8 left-1/2 z-10 inline-flex -translate-x-1/2 cursor-pointer items-center gap-2 rounded-full bg-white/15 px-5 py-2.5 text-[15px] font-semibold tracking-[-0.02em] text-white transition hover:bg-white/25"
              >
                <svg viewBox="0 0 24 24" fill="none" className="h-[18px] w-[18px] shrink-0" aria-hidden>
                  <path
                    d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m2 0v12a2 2 0 01-2 2H9a2 2 0 01-2-2V7"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                  <path d="M10 11v6M14 11v6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" />
                </svg>
                Удалить
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
        @keyframes archiveRowOut {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </div>
  );
}
