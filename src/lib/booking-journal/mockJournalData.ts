import type { Booking, Box, Master, Service } from "./getAvailableSlots";
import type { Client } from "./bookingClientsSearch";

export const JOURNAL_BOXES: Box[] = [
  { id: "1", name: "Бокс №1" },
  { id: "2", name: "Бокс №2" },
  { id: "3", name: "Бокс №3" },
  { id: "4", name: "Шиномонтаж" },
];

export const JOURNAL_MASTERS: Master[] = [
  { id: "m1", name: "Журавлев М." },
  { id: "m2", name: "Кузнецов Е." },
  { id: "m3", name: "Алексеев Д." },
  { id: "m4", name: "Воробьев С." },
];

export const JOURNAL_SERVICES: Service[] = [
  { id: "s1", name: "Замена масла + фильтр", duration: 60 },
  { id: "s2", name: "Замена тормозных колодок", duration: 80 },
  { id: "s3", name: "Диагностика ходовой", duration: 80 },
  { id: "s4", name: "Ремонт крыла", duration: 150 },
  { id: "s5", name: "Ремонт подвески", duration: 180 },
  { id: "s6", name: "Диагностика двигателя", duration: 80 },
  { id: "s7", name: "Замена стоек стабилизатора", duration: 80 },
  { id: "s8", name: "Диагностика кондиционера", duration: 90 },
  { id: "s9", name: "Замена 2-х колес", duration: 40 },
  { id: "s10", name: "Сезонная смена шин", duration: 40 },
];

/**
 * Стартовые записи на день сетки: разное время по боксам, длительности = `JOURNAL_SERVICES`,
 * между блоками соблюдён буфер 20 мин и шаг сетки 20 мин (см. `earliestFreeMinuteAfterBookingEnd`).
 */
export const INITIAL_JOURNAL_BOOKINGS: Booking[] = [
  /* Бокс №1: 60 + 80 + 80 */
  { id: "b1", boxId: "1", masterId: "m1", startTime: "2026-05-03T09:00:00", endTime: "2026-05-03T10:00:00" },
  { id: "b2", boxId: "1", masterId: "m1", startTime: "2026-05-03T10:20:00", endTime: "2026-05-03T11:40:00" },
  { id: "b3", boxId: "1", masterId: "m1", startTime: "2026-05-03T12:00:00", endTime: "2026-05-03T13:20:00" },
  /* Бокс №2: ремонт крыла → окно свободно 11:40–13:00 (внутри — 11:50) → Морозов 13:20–15:00 → диагностика */
  { id: "b4", boxId: "2", masterId: "m2", startTime: "2026-05-03T09:00:00", endTime: "2026-05-03T11:20:00" },
  { id: "b5", boxId: "2", masterId: "m2", startTime: "2026-05-03T13:20:00", endTime: "2026-05-03T15:00:00" },
  { id: "b13", boxId: "2", masterId: "m2", startTime: "2026-05-03T15:20:00", endTime: "2026-05-03T16:40:00" },
  /* Бокс №3: диагностика двигателя → свободно 11:40–15:00 → длинная запись до 19:00 */
  { id: "b6", boxId: "3", masterId: "m3", startTime: "2026-05-03T10:00:00", endTime: "2026-05-03T11:20:00" },
  { id: "b8", boxId: "3", masterId: "m3", startTime: "2026-05-03T15:20:00", endTime: "2026-05-03T19:00:00" },
  /* Шиномонтаж: три раза по 40 */
  { id: "b9", boxId: "4", masterId: "m4", startTime: "2026-05-03T09:00:00", endTime: "2026-05-03T09:40:00" },
  { id: "b10", boxId: "4", masterId: "m4", startTime: "2026-05-03T10:00:00", endTime: "2026-05-03T10:40:00" },
  { id: "b11", boxId: "4", masterId: "m4", startTime: "2026-05-03T11:00:00", endTime: "2026-05-03T11:40:00" },
];

/** Статусы записи в журнале: цвет слота и бейджа задаются в UI по этому полю. */
export type JournalBookingStatus =
  | "Подтверждена"
  | "Ожидает клиента"
  | "В работе"
  | "Завершена"
  | "Клиент не приехал"
  | "Отменена";

/** Кто выставил текущий статус (авто / менеджер / мастер). */
export type JournalStatusActor = "system" | "manager" | "master";

export type JournalCardMeta = {
  clientTitle: string;
  service: string;
  car: string;
  status?: JournalBookingStatus;
  statusActor?: JournalStatusActor;
};

/** Поля карточки журнала (не входят в тип Booking API, храним рядом в UI-состоянии). */
export const INITIAL_JOURNAL_CARD_META: Record<string, JournalCardMeta> = {
  b1: {
    clientTitle: "Иванов А.",
    service: "Замена масла + фильтр",
    car: "Toyota Camry  123ВС777",
    status: "Подтверждена",
    statusActor: "manager",
  },
  b2: {
    clientTitle: "Смирнов Д.",
    service: "Замена тормозных колодок",
    car: "LADA Vesta  T320PT197",
    status: "Подтверждена",
    statusActor: "manager",
  },
  b3: {
    clientTitle: "Фролов А.",
    service: "Диагностика ходовой",
    car: "Kia Rio  Y654CK777",
    status: "Ожидает клиента",
    statusActor: "system",
  },
  b4: {
    clientTitle: "Кузнецов Е.",
    service: "Ремонт крыла",
    car: "Hyundai Solaris  M456KX199",
    status: "В работе",
    statusActor: "master",
  },
  b5: {
    clientTitle: "Морозов Е.",
    service: "Ремонт подвески",
    car: "Hyundai Tucson  P445TT799",
    status: "Подтверждена",
    statusActor: "manager",
  },
  b6: {
    clientTitle: "Петров С.",
    service: "Диагностика двигателя",
    car: "BMW X5  P111MP178",
    status: "Подтверждена",
    statusActor: "manager",
  },
  b8: {
    clientTitle: "Новикова М.",
    service: "Ремонт подвески",
    car: "Nissan Qashqai  E222CC750",
    status: "В работе",
    statusActor: "master",
  },
  b9: {
    clientTitle: "Сидоров К.",
    service: "Замена 2-х колес",
    car: "Kia Rio  E789EH750",
    status: "Подтверждена",
    statusActor: "manager",
  },
  b10: {
    clientTitle: "Алексеева М.",
    service: "Сезонная смена шин",
    car: "Skoda Octavia  X333OP777",
    status: "Ожидает клиента",
    statusActor: "system",
  },
  b11: {
    clientTitle: "Воробьева М.",
    service: "Сезонная смена шин",
    car: "Nissan Qashqai  E222CC750",
    status: "Ожидает клиента",
    statusActor: "system",
  },
  b13: {
    clientTitle: "Соколов П.",
    service: "Диагностика ходовой",
    car: "Hyundai Solaris  M456KX199",
    status: "Завершена",
    statusActor: "system",
  },
};

export const MOCK_JOURNAL_CLIENTS: Client[] = [
  {
    id: "jc1",
    name: "Иванов Артём Сергеевич",
    phone: "+7 (999) 111-22-33",
    cars: [
      { id: "jc1c1", model: "Toyota Camry", plate: "123ВС777" },
      { id: "jc1c2", model: "LADA Vesta", plate: "T320PT197" },
    ],
  },
  {
    id: "jc2",
    name: "Смирнова Наталья Викторовна",
    phone: "+7 (999) 222-33-44",
    cars: [{ id: "jc2c1", model: "Kia Rio", plate: "Y654CK777" }],
  },
  {
    id: "jc3",
    name: "Петров Сергей Иванович",
    phone: "+79991234567",
    cars: [
      { id: "jc3c1", model: "BMW X5", plate: "P111MP178" },
      { id: "jc3c2", model: "Skoda Octavia", plate: "X333OP777" },
    ],
  },
];
