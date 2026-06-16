import type { Booking, Box, Master, Service } from "./getAvailableSlots";
import type { Client } from "./bookingClientsSearch";

export const JOURNAL_BOXES: Box[] = [
  { id: "1", name: "Бокс №1" },
  { id: "2", name: "Бокс №2" },
  { id: "3", name: "Бокс №3" },
  { id: "4", name: "Шиномонтаж" },
];

export const JOURNAL_MASTERS: Master[] = [
  {
    id: "m1",
    name: "Журавлев М.",
    fullName: "Журавлев Михаил Дмитриевич",
    photoUrl: "https://i.pravatar.cc/80?img=41",
    boxIds: ["1"],
    workWeekdays: [1, 2, 3, 4, 5, 6],
    shiftStartMin: 8 * 60,
    shiftEndMin: 20 * 60,
  },
  {
    id: "m2",
    name: "Кузнецов Е.",
    fullName: "Кузнецов Евгений Павлович",
    photoUrl: "https://i.pravatar.cc/80?img=12",
    boxIds: ["2"],
    workWeekdays: [1, 2, 3, 4, 5],
    shiftStartMin: 8 * 60,
    shiftEndMin: 19 * 60 + 40,
  },
  {
    id: "m3",
    name: "Алексеев Д.",
    fullName: "Алексеев Дмитрий Сергеевич",
    photoUrl: "https://i.pravatar.cc/80?img=15",
    boxIds: ["3"],
    workWeekdays: [2, 3, 4, 5, 6],
    shiftStartMin: 8 * 60,
    shiftEndMin: 20 * 60,
  },
  {
    id: "m4",
    name: "Воробьев С.",
    fullName: "Воробьев Сергей Анатольевич",
    photoUrl: "https://i.pravatar.cc/80?img=32",
    boxIds: ["4"],
    workWeekdays: [1, 2, 3, 4, 5, 6],
    shiftStartMin: 8 * 60,
    shiftEndMin: 18 * 60 + 40,
  },
];

export const JOURNAL_SERVICES: Service[] = [
  { id: "exp1", name: "Замена масла и фильтров", duration: 40 },
  { id: "exp2", name: "Замена тормозных колодок", duration: 50 },
  { id: "exp3", name: "Компьютерная диагностика", duration: 40 },
  { id: "exp4", name: "Диагностика подвески", duration: 40 },
  { id: "std2", name: "Замена технических жидкостей", duration: 60 },
  { id: "std3", name: "Ремонт подвески", duration: 120 },
  { id: "std4", name: "Замена амортизаторов / стоек", duration: 120 },
  { id: "cmp1", name: "Диагностика двигателя", duration: 90 },
  { id: "cmp2", name: "Ремонт электрооборудования", duration: 180 },
  { id: "cmp3", name: "Слесарные работы", duration: 180 },
  { id: "cmp4", name: "Кузовной ремонт", duration: 240 },
  { id: "tire1", name: "Замена 2-х колес", duration: 40 },
  { id: "tire2", name: "Сезонная смена шин", duration: 60 },
  { id: "tire3", name: "Балансировка колес", duration: 40 },
  { id: "tire4", name: "Ремонт / подкачка колеса", duration: 40 },
  { id: "tire5", name: "Проверка сход-развала", duration: 40 },
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
    clientTitle: "Иванов Артём Сергеевич",
    service: "Замена масла + фильтр",
    car: "Toyota Camry  123ВС777",
    status: "Подтверждена",
    statusActor: "manager",
  },
  b2: {
    clientTitle: "Смирнов Дмитрий Олегович",
    service: "Замена тормозных колодок",
    car: "LADA Vesta  T320PT197",
    status: "Подтверждена",
    statusActor: "manager",
  },
  b3: {
    clientTitle: "Фролов Алексей Андреевич",
    service: "Диагностика ходовой",
    car: "Kia Rio  Y654CK777",
    status: "Ожидает клиента",
    statusActor: "system",
  },
  b4: {
    clientTitle: "Кузнецов Евгений Павлович",
    service: "Ремонт крыла",
    car: "Hyundai Solaris  M456KX199",
    status: "В работе",
    statusActor: "master",
  },
  b5: {
    clientTitle: "Морозов Егор Викторович",
    service: "Ремонт подвески",
    car: "Hyundai Tucson  P445TT799",
    status: "Подтверждена",
    statusActor: "manager",
  },
  b6: {
    clientTitle: "Петров Сергей Иванович",
    service: "Диагностика двигателя",
    car: "BMW X5  P111MP178",
    status: "Подтверждена",
    statusActor: "manager",
  },
  b8: {
    clientTitle: "Новикова Марина Игоревна",
    service: "Ремонт подвески",
    car: "Nissan Qashqai  E222CC750",
    status: "В работе",
    statusActor: "master",
  },
  b9: {
    clientTitle: "Сидоров Кирилл Андреевич",
    service: "Замена 2-х колес",
    car: "Kia Rio  E789EH750",
    status: "Подтверждена",
    statusActor: "manager",
  },
  b10: {
    clientTitle: "Алексеева Мария Сергеевна",
    service: "Сезонная смена шин",
    car: "Skoda Octavia  X333OP777",
    status: "Ожидает клиента",
    statusActor: "system",
  },
  b11: {
    clientTitle: "Воробьева Марина Викторовна",
    service: "Сезонная смена шин",
    car: "Nissan Qashqai  E222CC750",
    status: "Ожидает клиента",
    statusActor: "system",
  },
  b13: {
    clientTitle: "Соколов Павел Николаевич",
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
    phone: "+7 (999) 123-45-67",
    cars: [
      { id: "jc3c1", model: "BMW X5", plate: "P111MP178" },
      { id: "jc3c2", model: "Skoda Octavia", plate: "X333OP777" },
    ],
  },
  {
    id: "jc4",
    name: "Смирнов Дмитрий Олегович",
    phone: "+7 (999) 333-44-55",
    cars: [{ id: "jc4c1", model: "LADA Vesta", plate: "T320PT197" }],
  },
  {
    id: "jc5",
    name: "Фролов Алексей Андреевич",
    phone: "+7 (999) 444-55-66",
    cars: [{ id: "jc5c1", model: "Kia Rio", plate: "Y654CK777" }],
  },
  {
    id: "jc6",
    name: "Кузнецов Евгений Павлович",
    phone: "+7 (999) 555-66-77",
    cars: [{ id: "jc6c1", model: "Hyundai Solaris", plate: "M456KX199" }],
  },
  {
    id: "jc7",
    name: "Морозов Егор Викторович",
    phone: "+7 (999) 666-77-88",
    cars: [{ id: "jc7c1", model: "Hyundai Tucson", plate: "P445TT799" }],
  },
  {
    id: "jc8",
    name: "Новикова Марина Игоревна",
    phone: "+7 (999) 777-88-99",
    cars: [{ id: "jc8c1", model: "Nissan Qashqai", plate: "E222CC750" }],
  },
  {
    id: "jc9",
    name: "Сидоров Кирилл Андреевич",
    phone: "+7 (999) 101-22-33",
    cars: [{ id: "jc9c1", model: "Kia Rio", plate: "E789EH750" }],
  },
  {
    id: "jc10",
    name: "Алексеева Мария Сергеевна",
    phone: "+7 (999) 202-33-44",
    cars: [{ id: "jc10c1", model: "Skoda Octavia", plate: "X333OP777" }],
  },
  {
    id: "jc11",
    name: "Воробьева Марина Викторовна",
    phone: "+7 (999) 303-44-55",
    cars: [{ id: "jc11c1", model: "Nissan Qashqai", plate: "E222CC750" }],
  },
  {
    id: "jc12",
    name: "Соколов Павел Николаевич",
    phone: "+7 (999) 404-55-66",
    cars: [{ id: "jc12c1", model: "Hyundai Solaris", plate: "M456KX199" }],
  },
  {
    id: "jc13",
    name: "Орлова Анна Вячеславовна",
    phone: "+7 (999) 505-66-77",
    cars: [{ id: "jc13c1", model: "Volkswagen Polo", plate: "A517BC197" }],
  },
  {
    id: "16",
    name: "Капров Александр Николаевич",
    phone: "+7 (917) 113-54-73",
    cars: [{ id: "16c1", model: "BMW M5", plate: "A21213X7" }],
  },
];
