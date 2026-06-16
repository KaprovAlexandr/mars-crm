import { MarsAppShellSidebar } from "@/components/layout/MarsAppShellSidebar";
import { workOrderRows } from "@/components/pages/WorkOrdersPage";
import { INITIAL_JOURNAL_BOOKINGS, INITIAL_JOURNAL_CARD_META } from "@/lib/booking-journal/mockJournalData";
import { requestsData } from "@/lib/mock/requests-page";
import { emitArchiveStyleToast } from "@/lib/notifications/inAppArchiveToastBus";
import { REQUEST_LIST_FLASH_ARMED_KEY, WORK_ORDER_LIST_FLASH_ARMED_KEY, BOOKING_LIST_FLASH_ARMED_KEY } from "@/lib/notifications/inferNotificationDeepLink";
import { useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import { useNavigate, useParams } from "react-router-dom";
import { clientsData } from "@/lib/mock/clients-page";
import {
  loadClientDetailState,
  saveClientDetailState,
  type ManualCarDraft,
  isClientDetailStateRemoteEnabled,
} from "@/lib/data/clientDetailsDataSource";
import { getClientStorageRowById, isClientsRemoteEnabled } from "@/lib/data/clientsDataSource";
import {
  parseCarPhotosByModel,
  resolveCarPhotosForModel,
} from "@/lib/clients/defaultCarPhotos";

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
  { label: "ФИО", value: "" },
  { label: "Тип клиента", value: "Физ.лицо" },
  { label: "Телефон", value: "" },
  { label: "E-mail", value: "" },
  { label: "Дата последнего визита", value: "" },
  { label: "Комментарий", value: "" },
];

const carProfileFields = [
  { label: "Марка и модель", value: "" },
  { label: "Пробег", value: "" },
  { label: "Гос.номер", value: "" },
  { label: "Тип кузова", value: "" },
  { label: "VIN", value: "" },
  { label: "Тип топлива", value: "" },
  { label: "Год выпуска", value: "" },
  { label: "Трансмиссия", value: "" },
  { label: "Цвет", value: "" },
  { label: "Комментарий", value: "" },
];

const clientCars = [
  { name: "BMW M5 F90", orders: 8, amount: 120000, main: true },
  { name: "Lada Priora", orders: 4, amount: 28000, main: false },
  { name: "BMW M5 Competition", orders: 6, amount: 74500, main: false },
  { name: "Skoda Octavia", orders: 5, amount: 91200, main: false },
  { name: "Renault Duster", orders: 3, amount: 39900, main: false },
  { name: "VW Polo", orders: 2, amount: 18700, main: false },
];

const carDocumentItems = [
  { id: "doc-1", name: "Акт приёма-передачи автомобиля.pdf" },
  { id: "doc-2", name: "Заказ-наряд.pdf" },
  { id: "doc-3", name: "Диагностический протокол.docx" },
  { id: "doc-4", name: "Дефектовочная ведомость.docx" },
  { id: "doc-5", name: "Согласование цены.pdf" },
  { id: "doc-6", name: "Акт выполненных работ.pdf" },
  { id: "doc-7", name: "Кассовый чек.pdf" },
  { id: "doc-8", name: "Гарантийный талон.pdf" },
];

function hydrateCarPhotosByModelFromLegacy(
  byModelRaw: unknown,
  legacyPhotos: string[],
  selectedModel: string,
): Record<string, string[]> {
  const byModel = parseCarPhotosByModel(byModelRaw);
  if (Object.keys(byModel).length > 0) return byModel;
  if (legacyPhotos.length === 0) return {};

  const looksBmw = legacyPhotos.some((url) => url.includes("bmwm5"));
  const looksCamry = legacyPhotos.some((url) => url.includes("toyota-camry"));
  if (looksBmw) return { "BMW M5": legacyPhotos };
  if (looksCamry) return { "Toyota Camry": legacyPhotos };

  const modelKey = normalizeCarModel(selectedModel);
  return modelKey ? { [modelKey]: legacyPhotos } : {};
}

function normalizeRuFio(value: string): string {
  return value.trim().toLowerCase().replace(/ё/g, "е").replace(/\s+/g, " ");
}

function parseJournalStartTime(value: string | undefined): Date | null {
  if (!value?.trim()) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed;
}

/** В «Текущей активности» показываем запись только если она сегодня или в будущем. */
function isJournalBookingTodayOrFuture(startTime: string | undefined, now = new Date()): boolean {
  const bookingAt = parseJournalStartTime(startTime);
  if (!bookingAt) return false;
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const bookingDay = new Date(bookingAt.getFullYear(), bookingAt.getMonth(), bookingAt.getDate());
  return bookingDay.getTime() >= todayStart.getTime();
}

function normalizeCarModel(value: string): string {
  const base = value.split(/\s{2,}/)[0] ?? value;
  return base.trim();
}

function normalizeCarKey(value: string): string {
  return normalizeCarModel(value).toLowerCase().replace(/\s+/g, " ").trim();
}

function isPlaceholderCarModel(model: string): boolean {
  const t = model.trim();
  if (!t) return true;
  return t === "—" || t === "-" || t === "–";
}

function carMatchesSelectedCar(rowCar: string, selectedCar: string): boolean {
  const rowKey = normalizeCarKey(rowCar);
  const selectedKey = normalizeCarKey(selectedCar);
  if (!rowKey || !selectedKey) return false;
  if (rowKey === selectedKey) return true;
  return rowKey.includes(selectedKey) || selectedKey.includes(rowKey);
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

function WorkActionIcon({
  type,
  className,
}: {
  type: "archive" | "restore" | "download";
  className?: string;
}) {
  const cls = className ?? "";
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
  if (type === "archive") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={`h-[22px] w-[22px] shrink-0 ${cls}`} aria-hidden>
        <path
          d="M4 8h16M6.5 8V19h11V8M9 5h6"
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

type ClientActivityItem = {
  type: "Заказ-наряд" | "Заявка" | "Запись";
  text: string;
  icon: string;
  targetKind: "workOrder" | "request" | "booking";
  targetId: string;
};

type JournalActivitySnapshotRow = {
  id: string;
  clientTitle: string;
  startTime: string;
  car?: string;
};

type ClientCarListItem = {
  model: string;
  ordersCount: number;
};

type CarOrderHistoryItem = {
  id: string;
  text: string;
  icon: string;
};
type CarDocumentItem = {
  id: string;
  name: string;
};
type DocumentActionsModalState = {
  title: string;
  docId: string;
  scope: "documentsCurrent" | "documentsArchived";
};
const JOURNAL_ROWS_ACTIVITY_STORAGE_KEY = "journalRowsActivitySnapshot";
const WORK_ORDERS_ROWS_PERSIST_KEY = "workOrdersRowsPersistedV1";
const CLIENT_DETAILS_PAGE_PERSIST_KEY_PREFIX = "clientDetailsPage2PersistedV1";
const CLIENT_CARS_SHARED_STORAGE_KEY = "clientCarsSharedByFioV1";
const EMPTY_MANUAL_CAR_DRAFT: ManualCarDraft = {
  model: "",
  mileage: "",
  plate: "",
  bodyType: "",
  vin: "",
  fuelType: "",
  year: "",
  transmission: "",
  color: "",
};
type ClientDetailsPagePersistedState = {
  activeTab: "client" | "car";
  activeClientPanel: "main" | "cars";
  activeCarPanel: "orders" | "documents" | "photos";
  clientFields: Array<{ label: string; value: string }>;
  vehicleFields: Array<{ label: string; value: string }>;
  selectedClientCarModel: string;
  manualClientCars: string[];
  manualCarDetailsByModel: Record<string, ManualCarDraft>;
  documentsScope: "current" | "archived";
  carDocumentsCurrent: CarDocumentItem[];
  carDocumentsArchived: CarDocumentItem[];
  carPhotosByModel: Record<string, string[]>;
};
type SharedClientCarsStorage = Record<string, Array<{ car: string; plate: string }>>;

function detailsPersistKeyByClientId(clientId: string): string {
  return `${CLIENT_DETAILS_PAGE_PERSIST_KEY_PREFIX}:${clientId}`;
}

function readClientDetailsPagePersistedState(clientId: string): ClientDetailsPagePersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(detailsPersistKeyByClientId(clientId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<ClientDetailsPagePersistedState>;
    if (!parsed || typeof parsed !== "object") return null;
    const documentsScope: ClientDetailsPagePersistedState["documentsScope"] =
      parsed.documentsScope === "archived" ? "archived" : "current";
    const carDocsCurrent = Array.isArray(parsed.carDocumentsCurrent)
      ? (parsed.carDocumentsCurrent as CarDocumentItem[]).map((item) =>
          typeof item?.id === "string" && typeof item?.name === "string"
            ? { id: item.id, name: item.name }
            : { id: `doc-${crypto.randomUUID?.() ?? Math.random()}`, name: "" },
        )
      : null;
    const carDocsArchived = Array.isArray(parsed.carDocumentsArchived)
      ? (parsed.carDocumentsArchived as CarDocumentItem[]).map((item) =>
          typeof item?.id === "string" && typeof item?.name === "string"
            ? { id: item.id, name: item.name }
            : { id: `doc-arch-${crypto.randomUUID?.() ?? Math.random()}`, name: "" },
        )
      : null;
    const carPhotosByModelStored =
      parsed.carPhotosByModel && typeof parsed.carPhotosByModel === "object"
        ? parseCarPhotosByModel(parsed.carPhotosByModel)
        : null;
    const carPhotosStored = Array.isArray(parsed.carPhotos)
      ? (parsed.carPhotos as string[]).filter((u) => typeof u === "string")
      : [];
    const selectedModelStored =
      typeof parsed.selectedClientCarModel === "string" ? parsed.selectedClientCarModel : "";
    const carPhotosByModel =
      carPhotosByModelStored && Object.keys(carPhotosByModelStored).length > 0
        ? carPhotosByModelStored
        : hydrateCarPhotosByModelFromLegacy(null, carPhotosStored, selectedModelStored);
    return {
      activeTab: parsed.activeTab === "car" ? "car" : "client",
      activeClientPanel: parsed.activeClientPanel === "cars" ? "cars" : "main",
      activeCarPanel: parsed.activeCarPanel === "orders" || parsed.activeCarPanel === "photos" ? parsed.activeCarPanel : "documents",
      clientFields: Array.isArray(parsed.clientFields) ? parsed.clientFields : publicProfileFields.map((f) => ({ ...f })),
      vehicleFields: Array.isArray(parsed.vehicleFields) ? parsed.vehicleFields : carProfileFields.map((f) => ({ ...f })),
      selectedClientCarModel: typeof parsed.selectedClientCarModel === "string" ? parsed.selectedClientCarModel : "",
      manualClientCars: Array.isArray(parsed.manualClientCars) ? parsed.manualClientCars : [],
      manualCarDetailsByModel:
        parsed.manualCarDetailsByModel && typeof parsed.manualCarDetailsByModel === "object"
          ? (parsed.manualCarDetailsByModel as Record<string, ManualCarDraft>)
          : {},
      documentsScope,
      carDocumentsCurrent:
        carDocsCurrent && carDocsCurrent.length > 0 ? carDocsCurrent : carDocumentItems.map((item) => ({ ...item })),
      carDocumentsArchived: carDocsArchived ?? [],
      carPhotosByModel,
    };
  } catch {
    return null;
  }
}

type ClientOverview = {
  id: string;
  fullName: string;
  phone: string;
  lastVisit: string;
  totalAmount: string;
  email?: string;
  inn?: string;
  clientType?: string;
  car?: string;
  plate?: string;
};

function clientTypeLabelFromKind(kind: string | undefined): string {
  if (kind === "company") return "Юр. лицо";
  if (kind === "entrepreneur") return "ИП";
  return "Физ. лицо";
}

function nonEmptyText(s: string | undefined | null): string | undefined {
  const t = (s ?? "").trim();
  return t.length > 0 ? t : undefined;
}

function legacyEmailFromBaseFields(baseFields: Array<{ label: string; value: string }>): string | undefined {
  for (const f of baseFields) {
    const lab = f.label.trim().toLowerCase().replace(/\u2011/g, "-");
    if ((lab === "e-mail" || lab === "email") && f.value.trim()) return f.value.trim();
  }
  return undefined;
}

function mergeClientFieldsFromCrm(client: ClientOverview, baseFields: Array<{ label: string; value: string }>) {
  const fromPrev = (label: string) => baseFields.find((field) => field.label === label)?.value ?? "";
  const email =
    nonEmptyText(client.email) ?? nonEmptyText(fromPrev("E-mail")) ?? nonEmptyText(legacyEmailFromBaseFields(baseFields)) ?? "";
  const typeLabel = client.clientType ? clientTypeLabelFromKind(client.clientType) : fromPrev("Тип клиента") || "Физ. лицо";
  return [
    { label: "ФИО", value: client.fullName },
    { label: "Тип клиента", value: typeLabel },
    { label: "Телефон", value: client.phone },
    { label: "E-mail", value: email },
    { label: "Дата последнего визита", value: client.lastVisit },
    { label: "Комментарий", value: fromPrev("Комментарий") },
  ];
}

function mergeVehicleFieldsFromCrm(
  client: Pick<ClientOverview, "car" | "plate">,
  baseFields: Array<{ label: string; value: string }>,
): Array<{ label: string; value: string }> {
  const car = (client.car ?? "").trim();
  const plate = (client.plate ?? "").trim();
  return baseFields.map((f) => {
    if (f.label === "Марка и модель" && car) return { ...f, value: car };
    if (f.label === "Гос.номер" && plate) return { ...f, value: plate };
    return f;
  });
}

/** Данные из формы «Добавить клиента»; подмешиваем к ответу API, если в БД ещё пусто или GET закэширован. */
function overlayCreateBootstrapOnOverview(clientId: string, apiClient: ClientOverview | null): ClientOverview | null {
  const boot = readClientOverviewBootstrap(clientId);
  if (!boot) return apiClient;
  if (!apiClient) return boot;
  return {
    id: apiClient.id,
    fullName: nonEmptyText(apiClient.fullName) ? apiClient.fullName : boot.fullName,
    phone: nonEmptyText(apiClient.phone) ? apiClient.phone : boot.phone,
    lastVisit: nonEmptyText(apiClient.lastVisit) ? apiClient.lastVisit : boot.lastVisit,
    totalAmount: nonEmptyText(apiClient.totalAmount) ? apiClient.totalAmount : boot.totalAmount,
    email: nonEmptyText(apiClient.email) ?? nonEmptyText(boot.email),
    inn: nonEmptyText(apiClient.inn) ?? nonEmptyText(boot.inn),
    clientType: nonEmptyText(apiClient.clientType) ?? nonEmptyText(boot.clientType),
    car: nonEmptyText(apiClient.car) ?? nonEmptyText(boot.car),
    plate: nonEmptyText(apiClient.plate) ?? nonEmptyText(boot.plate),
  };
}

function readClientOverviewBootstrap(clientId: string): ClientOverview | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(`marsClientOverviewBootstrap:${clientId}`);
    if (!raw) return null;
    const o = JSON.parse(raw) as Partial<ClientOverview>;
    if (!o || o.id !== clientId) return null;
    return {
      id: clientId,
      fullName: String(o.fullName ?? ""),
      phone: String(o.phone ?? ""),
      lastVisit: String(o.lastVisit ?? ""),
      totalAmount: String(o.totalAmount ?? "0 ₽"),
      email: o.email ? String(o.email) : undefined,
      inn: o.inn ? String(o.inn) : undefined,
      clientType: o.clientType ? String(o.clientType) : undefined,
      car: o.car ? String(o.car) : undefined,
      plate: o.plate ? String(o.plate) : undefined,
    };
  } catch {
    return null;
  }
}

function mapStoredDocuments(raw: unknown): CarDocumentItem[] {
  if (!Array.isArray(raw)) return [];
  return raw.map((entry, idx) => {
    if (entry && typeof entry === "object" && "id" in entry && "name" in entry) {
      const cast = entry as { id?: unknown; name?: unknown };
      const id = typeof cast.id === "string" ? cast.id : `doc-${idx}`;
      const name = typeof cast.name === "string" ? cast.name : "";
      return { id, name };
    }
    return { id: `doc-${idx}`, name: "" };
  });
}

function normalizeManualDetailsFromRemote(raw: unknown): Record<string, ManualCarDraft> {
  if (!raw || typeof raw !== "object") return {};
  const out: Record<string, ManualCarDraft> = {};
  for (const [key, entry] of Object.entries(raw)) {
    if (!entry || typeof entry !== "object") {
      out[key] = { ...EMPTY_MANUAL_CAR_DRAFT };
      continue;
    }
    const e = entry as Record<string, unknown>;
    out[key] = {
      model: typeof e.model === "string" ? e.model : "",
      mileage: typeof e.mileage === "string" ? e.mileage : "",
      plate: typeof e.plate === "string" ? e.plate : "",
      bodyType: typeof e.bodyType === "string" ? e.bodyType : "",
      vin: typeof e.vin === "string" ? e.vin : "",
      fuelType: typeof e.fuelType === "string" ? e.fuelType : "",
      year: typeof e.year === "string" ? e.year : "",
      transmission: typeof e.transmission === "string" ? e.transmission : "",
      color: typeof e.color === "string" ? e.color : "",
    };
  }
  return out;
}

function getWorkOrdersSource(): typeof workOrderRows {
  if (typeof window === "undefined") return workOrderRows;
  const raw = window.localStorage.getItem(WORK_ORDERS_ROWS_PERSIST_KEY);
  if (!raw) return workOrderRows;
  try {
    const parsed = JSON.parse(raw) as typeof workOrderRows;
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : workOrderRows;
  } catch {
    return workOrderRows;
  }
}

export function ClientDetailsPage2() {
  const navigate = useNavigate();
  const { id: routeClientId } = useParams();
  const clientId = String(routeClientId ?? "").trim();
  const [persistedSnapshot] = useState<ClientDetailsPagePersistedState | null>(() =>
    isClientDetailStateRemoteEnabled() ? null : readClientDetailsPagePersistedState(clientId),
  );
  const [remoteSaveReady, setRemoteSaveReady] = useState(() => !isClientDetailStateRemoteEnabled());
  const [activeTab, setActiveTab] = useState<"client" | "car">(persistedSnapshot?.activeTab ?? "client");
  const [displayedTab, setDisplayedTab] = useState<"client" | "car">(persistedSnapshot?.activeTab ?? "client");
  const [leftContentPhase, setLeftContentPhase] = useState<"idle" | "out" | "in">("idle");
  const [activeClientPanel, setActiveClientPanel] = useState<"main" | "cars">(persistedSnapshot?.activeClientPanel ?? "main");
  const [activeCarPanel, setActiveCarPanel] = useState<"orders" | "documents" | "photos">(persistedSnapshot?.activeCarPanel ?? "documents");
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [clientFields, setClientFields] = useState(() => persistedSnapshot?.clientFields ?? publicProfileFields.map((f) => ({ ...f })));
  const [vehicleFields, setVehicleFields] = useState(() => persistedSnapshot?.vehicleFields ?? carProfileFields.map((f) => ({ ...f })));
  const [selectedClientCarModel, setSelectedClientCarModel] = useState(persistedSnapshot?.selectedClientCarModel ?? "");
  const [manualClientCars, setManualClientCars] = useState<string[]>(persistedSnapshot?.manualClientCars ?? []);
  const [manualCarDetailsByModel, setManualCarDetailsByModel] = useState<Record<string, ManualCarDraft>>(
    persistedSnapshot?.manualCarDetailsByModel ?? {},
  );
  const [isAddCarModalOpen, setIsAddCarModalOpen] = useState(false);
  const [newCarDraft, setNewCarDraft] = useState<ManualCarDraft>(EMPTY_MANUAL_CAR_DRAFT);
  const [carDocumentsCurrent, setCarDocumentsCurrent] = useState<CarDocumentItem[]>(
    () => persistedSnapshot?.carDocumentsCurrent ?? carDocumentItems.map((item) => ({ ...item })),
  );
  const [carDocumentsArchived, setCarDocumentsArchived] = useState<CarDocumentItem[]>(() => persistedSnapshot?.carDocumentsArchived ?? []);
  const [documentsScope, setDocumentsScope] = useState<"current" | "archived">(() => persistedSnapshot?.documentsScope ?? "current");
  const [archivingDocRowId, setArchivingDocRowId] = useState<string | null>(null);
  const [documentActionsModal, setDocumentActionsModal] = useState<DocumentActionsModalState | null>(null);
  const documentUploadInputRef = useRef<HTMLInputElement>(null);
  const [carPhotosByModel, setCarPhotosByModel] = useState<Record<string, string[]>>(
    () => persistedSnapshot?.carPhotosByModel ?? {},
  );
  const [newlyAddedPhoto, setNewlyAddedPhoto] = useState<string | null>(null);
  const [selectedPhotoIndex, setSelectedPhotoIndex] = useState<number | null>(null);
  const [addPhotoModalOpen, setAddPhotoModalOpen] = useState(false);
  const [newPhotoUrl, setNewPhotoUrl] = useState("");
  const [newPhotoPreview, setNewPhotoPreview] = useState("");
  const visibleCarPhotos = useMemo(
    () => resolveCarPhotosForModel(selectedClientCarModel, carPhotosByModel),
    [selectedClientCarModel, carPhotosByModel],
  );
  const selectedCarPhotoAlt = selectedClientCarModel.trim()
    ? `Фото автомобиля ${normalizeCarModel(selectedClientCarModel)}`
    : "Фото автомобиля";
  const visibleFields = displayedTab === "client" ? clientFields : vehicleFields;
  const leftContentMotionClass = useMemo(() => {
    if (leftContentPhase === "out") return "animate-[workOrderLeftOut_180ms_ease_forwards]";
    if (leftContentPhase === "in") return "animate-[workOrderLeftIn_240ms_cubic-bezier(0.22,1,0.36,1)_forwards]";
    return "";
  }, [leftContentPhase]);
  const profileClientFio = (clientFields.find((f) => f.label === "ФИО")?.value ?? "").trim();
  const profileClientNameWords = profileClientFio.split(/\s+/).filter(Boolean);
  const profileClientFirstLine = profileClientNameWords.slice(0, 2).join(" ");
  const profileClientSecondLine = profileClientNameWords.slice(2).join(" ");
  const normalizedProfileClientFio = normalizeRuFio(profileClientFio);
  const formatCurrency = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;
  const clientOrdersMetrics = useMemo(() => {
    if (!normalizedProfileClientFio) {
      return { totalOrders: 0, totalAmount: 0, averageCheck: 0 };
    }
    const workOrdersSource = getWorkOrdersSource();
    const relatedOrders = workOrdersSource.filter((row) => {
      const rowClient = normalizeRuFio(row.client);
      return rowClient === normalizedProfileClientFio || rowClient.includes(normalizedProfileClientFio);
    });
    const totalOrders = relatedOrders.length;
    const totalAmount = relatedOrders.reduce((sum, row) => {
      const amount = Number((row.amount ?? "").replace(/[^\d]/g, ""));
      return sum + (Number.isFinite(amount) ? amount : 0);
    }, 0);
    const averageCheck = totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0;
    return { totalOrders, totalAmount, averageCheck };
  }, [normalizedProfileClientFio]);
  const clientActivityItems = useMemo<ClientActivityItem[]>(() => {
    if (!normalizedProfileClientFio) return [];
    const workOrdersSource = getWorkOrdersSource();
    const fromWorkOrders = workOrdersSource
      .filter((row) => {
        const rowClient = normalizeRuFio(row.client);
        return rowClient === normalizedProfileClientFio || rowClient.includes(normalizedProfileClientFio);
      })
      .map((row) => ({
        type: "Заказ-наряд",
        text: `Заказ-наряд №${row.id} · ${row.car}`,
        icon: "/group87.svg",
        targetKind: "workOrder",
        targetId: row.id,
      }));

    const fromRequests = requestsData
      .filter((row) => {
        const rowClient = normalizeRuFio(row.client);
        return rowClient === normalizedProfileClientFio || rowClient.includes(normalizedProfileClientFio);
      })
      .map((row) => ({
        type: "Заявка",
        text: `Заявка · ${row.date}`,
        icon: "/order.svg",
        targetKind: "request",
        targetId: row.id,
      }));

    const fallbackJournalRows: JournalActivitySnapshotRow[] = Object.entries(INITIAL_JOURNAL_CARD_META).map(([id, meta]) => {
      const booking = INITIAL_JOURNAL_BOOKINGS.find((b) => b.id === id);
      return {
        id,
        clientTitle: meta.clientTitle,
        startTime: booking?.startTime ?? "",
        car: meta.car,
      };
    });
    let journalRowsForActivity = fallbackJournalRows;
    if (typeof window !== "undefined") {
      const raw = window.sessionStorage.getItem(JOURNAL_ROWS_ACTIVITY_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as JournalActivitySnapshotRow[];
          if (Array.isArray(parsed) && parsed.length > 0) {
            journalRowsForActivity = parsed;
          }
        } catch {
          // keep fallback rows
        }
      }
    }

    const fromJournal = journalRowsForActivity
      .filter((row) => {
        const rowClient = normalizeRuFio(row.clientTitle ?? "");
        const matchesClient = rowClient === normalizedProfileClientFio || rowClient.includes(normalizedProfileClientFio);
        if (!matchesClient) return false;
        return isJournalBookingTodayOrFuture(row.startTime);
      })
      .map((row) => {
        const hhmm = row.startTime?.slice(11, 16) ?? "--:--";
        const ddmm = row.startTime?.slice(8, 10) && row.startTime?.slice(5, 7)
          ? `${row.startTime.slice(8, 10)}.${row.startTime.slice(5, 7)}`
          : "--.--";
        return {
          type: "Запись",
          text: `Запись · ${ddmm} ${hhmm}`,
          icon: "/zapis.svg",
          targetKind: "booking",
          targetId: row.id,
        };
      });

    return [...fromWorkOrders, ...fromRequests, ...fromJournal];
  }, [normalizedProfileClientFio]);

  const clientCarListItems = useMemo<ClientCarListItem[]>(() => {
    if (!normalizedProfileClientFio) return [];
    const counts = new Map<string, number>();
    const workOrdersSource = getWorkOrdersSource();

    const addCar = (rawCar: string, incrementOrder: boolean) => {
      const model = normalizeCarModel(rawCar);
      if (!model || isPlaceholderCarModel(model)) return;
      const prev = counts.get(model) ?? 0;
      counts.set(model, incrementOrder ? prev + 1 : prev);
    };

    for (const row of workOrdersSource) {
      const rowClient = normalizeRuFio(row.client);
      if (rowClient === normalizedProfileClientFio || rowClient.includes(normalizedProfileClientFio)) {
        addCar(row.car, true);
      }
    }
    for (const row of requestsData) {
      const rowClient = normalizeRuFio(row.client);
      if (rowClient === normalizedProfileClientFio || rowClient.includes(normalizedProfileClientFio)) {
        addCar(row.car, false);
      }
    }
    const fallbackJournalRows: JournalActivitySnapshotRow[] = Object.values(INITIAL_JOURNAL_CARD_META).map((meta) => ({
      id: "",
      clientTitle: meta.clientTitle,
      startTime: "",
      car: meta.car,
    }));
    let journalRowsForCars = fallbackJournalRows;
    if (typeof window !== "undefined") {
      const raw = window.sessionStorage.getItem(JOURNAL_ROWS_ACTIVITY_STORAGE_KEY);
      if (raw) {
        try {
          const parsed = JSON.parse(raw) as JournalActivitySnapshotRow[];
          if (Array.isArray(parsed) && parsed.length > 0) journalRowsForCars = parsed;
        } catch {
          // keep fallback
        }
      }
    }
    for (const row of journalRowsForCars) {
      const rowClient = normalizeRuFio(row.clientTitle ?? "");
      if (rowClient === normalizedProfileClientFio || rowClient.includes(normalizedProfileClientFio)) {
        addCar(row.car ?? "", false);
      }
    }
    for (const car of manualClientCars) {
      addCar(car, false);
    }

    return Array.from(counts.entries())
      .map(([model, ordersCount]) => ({ model, ordersCount }))
      .sort((a, b) => b.ordersCount - a.ordersCount || a.model.localeCompare(b.model, "ru"));
  }, [manualClientCars, normalizedProfileClientFio]);

  const carOrderHistoryItems = useMemo<CarOrderHistoryItem[]>(() => {
    if (!normalizedProfileClientFio || !selectedClientCarModel) return [];
    const workOrdersSource = getWorkOrdersSource();
    return workOrdersSource
      .filter((row) => {
        const rowClient = normalizeRuFio(row.client);
        if (!(rowClient === normalizedProfileClientFio || rowClient.includes(normalizedProfileClientFio))) return false;
        return carMatchesSelectedCar(row.car, selectedClientCarModel);
      })
      .map((row) => ({
        id: row.id,
        text: `Заказ-наряд №${row.id} · ${row.status}`,
        icon: "/group87.svg",
      }));
  }, [normalizedProfileClientFio, selectedClientCarModel]);

  useEffect(() => {
    let cancelled = false;

    async function fetchClientOverview(): Promise<ClientOverview | null> {
      let client: ClientOverview | null = null;
      if (isClientsRemoteEnabled()) {
        try {
          const row = await getClientStorageRowById(clientId);
          if (row) {
            client = {
              id: row.id,
              fullName: row.full_name,
              phone: row.phone,
              lastVisit: row.last_visit,
              totalAmount: row.total_amount,
              email: nonEmptyText(row.email),
              inn: nonEmptyText(row.inn),
              clientType: nonEmptyText(row.client_type),
              car: nonEmptyText(row.car),
              plate: nonEmptyText(row.plate),
            };
          }
        } catch (error) {
          console.warn("Failed to load client details by id from API.", error);
        }
      }
      if (!client) {
        const local = clientsData.find((row) => row.id === clientId);
        if (local) {
          client = {
            id: local.id,
            fullName: local.fullName,
            phone: local.phone,
            lastVisit: local.lastVisit,
            totalAmount: local.totalAmount,
            clientType: local.clientType === "Юр.лицо" ? "company" : "person",
          };
        }
      }
      if (!client) {
        client = readClientOverviewBootstrap(clientId);
      } else {
        client = overlayCreateBootstrapOnOverview(clientId, client);
      }
      return client;
    }

    async function run() {
      if (!clientId) return;

      if (isClientDetailStateRemoteEnabled()) {
        setRemoteSaveReady(false);
        let overview: ClientOverview | null = null;
        let detailRow: Awaited<ReturnType<typeof loadClientDetailState>> = null;
        try {
          const tuple = await Promise.all([fetchClientOverview(), loadClientDetailState(clientId)]);
          overview = tuple[0];
          detailRow = tuple[1];
        } catch (error) {
          console.warn("Failed to hydrate client card from API.", error);
          overview = await fetchClientOverview();
        }
        if (cancelled) return;

        if (detailRow) {
          const baseClientFields =
            Array.isArray(detailRow.client_fields) && detailRow.client_fields.length > 0
              ? detailRow.client_fields.map((f) => ({ label: String(f.label ?? ""), value: String(f.value ?? "") }))
              : publicProfileFields.map((f) => ({ ...f }));
          const baseVehicleFieldsRaw =
            Array.isArray(detailRow.vehicle_fields) && detailRow.vehicle_fields.length > 0
              ? detailRow.vehicle_fields.map((f) => ({ label: String(f.label ?? ""), value: String(f.value ?? "") }))
              : carProfileFields.map((f) => ({ ...f }));
          const baseVehicleFields = overview
            ? mergeVehicleFieldsFromCrm(overview, baseVehicleFieldsRaw)
            : baseVehicleFieldsRaw;
          const manualsList = Array.isArray(detailRow.manual_client_cars)
            ? detailRow.manual_client_cars.filter((x): x is string => typeof x === "string")
            : [];
          let manuals = normalizeManualDetailsFromRemote(detailRow.manual_car_details_by_model);
          const bootCarName = nonEmptyText(overview?.car);
          const bootPlate = nonEmptyText(overview?.plate);
          let mergedManualList = manualsList;
          if (bootCarName && mergedManualList.length === 0) {
            mergedManualList = [bootCarName];
          }
          if (bootCarName && bootPlate) {
            const existing = manuals[bootCarName];
            if (!existing || !nonEmptyText(existing.plate)) {
              manuals = {
                ...manuals,
                [bootCarName]: { ...EMPTY_MANUAL_CAR_DRAFT, ...(existing ?? {}), model: bootCarName, plate: bootPlate },
              };
            }
          }
          const savedSel =
            typeof detailRow.selected_client_car_model === "string" ? detailRow.selected_client_car_model.trim() : "";
          const effectiveSel = nonEmptyText(savedSel) ?? bootCarName ?? "";

          setActiveTab(detailRow.active_tab === "car" ? "car" : "client");
          setDisplayedTab(detailRow.active_tab === "car" ? "car" : "client");
          setActiveClientPanel(detailRow.active_client_panel === "cars" ? "cars" : "main");
          setActiveCarPanel(
            detailRow.active_car_panel === "orders" || detailRow.active_car_panel === "photos"
              ? detailRow.active_car_panel
              : "documents",
          );
          setSelectedClientCarModel(effectiveSel);
          setManualClientCars(mergedManualList);
          setManualCarDetailsByModel(manuals);

          const docsCurrent = mapStoredDocuments(detailRow.documents_current);
          const docsArchived = mapStoredDocuments(detailRow.documents_archived);
          setCarDocumentsCurrent(
            docsCurrent.length > 0 ? docsCurrent : carDocumentItems.map((item) => ({ ...item })),
          );
          setCarDocumentsArchived(docsArchived);
          setDocumentsScope(detailRow.documents_scope === "archived" ? "archived" : "current");
          const legacyPhotos = Array.isArray(detailRow.car_photos)
            ? detailRow.car_photos.filter((u): u is string => typeof u === "string")
            : [];
          setCarPhotosByModel(
            hydrateCarPhotosByModelFromLegacy(detailRow.car_photos_by_model, legacyPhotos, effectiveSel),
          );

          const nextClientFields = overview ? mergeClientFieldsFromCrm(overview, baseClientFields) : baseClientFields;
          setClientFields(nextClientFields);
          setVehicleFields(baseVehicleFields);
        } else if (overview) {
          setClientFields(mergeClientFieldsFromCrm(overview, publicProfileFields.map((f) => ({ ...f }))));
          setVehicleFields(mergeVehicleFieldsFromCrm(overview, carProfileFields.map((f) => ({ ...f }))));
          const bc = nonEmptyText(overview.car);
          const bp = nonEmptyText(overview.plate);
          if (bc) {
            setManualClientCars([bc]);
            if (bp) {
              setManualCarDetailsByModel({ [bc]: { ...EMPTY_MANUAL_CAR_DRAFT, model: bc, plate: bp } });
            }
            setSelectedClientCarModel(bc);
          }
        }

        if (!cancelled) {
          setRemoteSaveReady(true);
        }
        return;
      }

      const overview = await fetchClientOverview();
      if (!overview || cancelled) return;
      setClientFields((prev) => mergeClientFieldsFromCrm(overview, prev));
      setVehicleFields((prev) => mergeVehicleFieldsFromCrm(overview, prev));
      const bc = nonEmptyText(overview.car);
      const bp = nonEmptyText(overview.plate);
      if (bc) {
        setManualClientCars((prev) => (prev.length > 0 ? prev : [bc]));
        if (bp) {
          setManualCarDetailsByModel((m) => {
            if (Object.keys(m).length > 0) return m;
            return { [bc]: { ...EMPTY_MANUAL_CAR_DRAFT, model: bc, plate: bp } };
          });
        }
        setSelectedClientCarModel((sel) => nonEmptyText(sel) ?? bc);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [clientId]);

  useEffect(() => {
    if (!selectedClientCarModel) return;
    const workOrdersSource = getWorkOrdersSource();
    const byClientAndCar = workOrdersSource.filter((row) => {
      const rowClient = normalizeRuFio(row.client);
      if (!(rowClient === normalizedProfileClientFio || rowClient.includes(normalizedProfileClientFio))) return false;
      return carMatchesSelectedCar(row.car, selectedClientCarModel);
    });
    const latest = byClientAndCar[0];
    const details = manualCarDetailsByModel[selectedClientCarModel];
    setVehicleFields((prev) =>
      prev.map((field) => {
        if (field.label === "Марка и модель") return { ...field, value: selectedClientCarModel };
        if (field.label === "Гос.номер") {
          const fromOrders = (details?.plate || latest?.plate || "").trim();
          return { ...field, value: fromOrders || field.value };
        }
        if (field.label === "Пробег" && details?.mileage) return { ...field, value: details.mileage };
        if (field.label === "Тип кузова" && details?.bodyType) return { ...field, value: details.bodyType };
        if (field.label === "VIN" && details?.vin) return { ...field, value: details.vin };
        if (field.label === "Тип топлива" && details?.fuelType) return { ...field, value: details.fuelType };
        if (field.label === "Год выпуска" && details?.year) return { ...field, value: details.year };
        if (field.label === "Трансмиссия" && details?.transmission) return { ...field, value: details.transmission };
        if (field.label === "Цвет" && details?.color) return { ...field, value: details.color };
        return field;
      }),
    );
  }, [manualCarDetailsByModel, normalizedProfileClientFio, selectedClientCarModel]);

  useEffect(() => {
    if (clientCarListItems.length === 0) return;
    if (!clientCarListItems.some((item) => item.model === selectedClientCarModel)) {
      setSelectedClientCarModel(clientCarListItems[0].model);
    }
  }, [clientCarListItems, selectedClientCarModel]);

  function handleOpenClientActivity(item: ClientActivityItem) {
    if (item.targetKind === "workOrder") {
      window.sessionStorage.setItem(WORK_ORDER_LIST_FLASH_ARMED_KEY, item.targetId);
      navigate(`/work-orders?workOrder=${encodeURIComponent(item.targetId)}`);
      return;
    }
    if (item.targetKind === "request") {
      window.sessionStorage.setItem(REQUEST_LIST_FLASH_ARMED_KEY, item.targetId);
      navigate(`/?request=${encodeURIComponent(item.targetId)}`);
      return;
    }
    window.sessionStorage.setItem(BOOKING_LIST_FLASH_ARMED_KEY, item.targetId);
    navigate(`/journal?booking=${encodeURIComponent(item.targetId)}`);
  }

  function handleOpenCarOrderHistory(item: CarOrderHistoryItem) {
    window.sessionStorage.setItem(WORK_ORDER_LIST_FLASH_ARMED_KEY, item.id);
    navigate(`/work-orders?workOrder=${encodeURIComponent(item.id)}`);
  }

  function handleAddClientCar() {
    const next = normalizeCarModel(newCarDraft.model);
    if (!next) return;
    const nextKey = normalizeCarKey(next);
    if (clientCarListItems.some((item) => normalizeCarKey(item.model) === nextKey)) {
      setSelectedClientCarModel(next);
      setNewCarDraft(EMPTY_MANUAL_CAR_DRAFT);
      setIsAddCarModalOpen(false);
      return;
    }
    setManualClientCars((prev) => [...prev, next]);
    setManualCarDetailsByModel((prev) => ({
      ...prev,
      [next]: { ...newCarDraft, model: next },
    }));
    setSelectedClientCarModel(next);
    setNewCarDraft(EMPTY_MANUAL_CAR_DRAFT);
    setIsAddCarModalOpen(false);
  }

  function triggerDocumentUpload() {
    documentUploadInputRef.current?.click();
  }

  function handleDocumentFileInputChange(e: ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setCarDocumentsCurrent((prev) => [
      ...files.map((file, idx) => ({ id: `uploaded-${Date.now()}-${idx}`, name: file.name })),
      ...prev,
    ]);
    e.currentTarget.value = "";
  }

  function downloadCarDocument(doc: CarDocumentItem) {
    if (typeof window === "undefined") return;
    const blob = new Blob([`Документ: ${doc.name}\nСформировано из карточки клиента.`], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = doc.name || "document.txt";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

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

  function updateVisibleCarPhotos(updater: (prev: string[]) => string[]) {
    const model = selectedClientCarModel.trim();
    if (!model) return;
    const modelKey = normalizeCarModel(model);
    setCarPhotosByModel((prev) => {
      const current = resolveCarPhotosForModel(model, prev);
      const next = updater(current);
      return { ...prev, [modelKey]: next };
    });
  }

  function removeCarPhotoAtIndex(removedIndex: number) {
    const oldList = visibleCarPhotos;
    const oldLen = oldList.length;
    if (removedIndex < 0 || removedIndex >= oldLen) return;
    const url = oldList[removedIndex];
    if (url.startsWith("blob:")) {
      URL.revokeObjectURL(url);
    }
    setNewlyAddedPhoto((n) => (n === url ? null : n));
    updateVisibleCarPhotos((prev) => prev.filter((_, i) => i !== removedIndex));
    setSelectedPhotoIndex((sel) => updateSelectedIndexAfterRemove(sel, removedIndex, oldLen));
  }

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
    if (typeof window === "undefined" || !clientId) return;
    if (isClientDetailStateRemoteEnabled()) return;
    const payload: ClientDetailsPagePersistedState = {
      activeTab,
      activeClientPanel,
      activeCarPanel,
      clientFields,
      vehicleFields,
      selectedClientCarModel,
      manualClientCars,
      manualCarDetailsByModel,
      documentsScope,
      carDocumentsCurrent,
      carDocumentsArchived,
      carPhotosByModel,
    };
    try {
      window.sessionStorage.setItem(detailsPersistKeyByClientId(clientId), JSON.stringify(payload));
    } catch {
      // ignore persistence errors to avoid runtime crashes
    }
  }, [
    clientId,
    activeCarPanel,
    activeClientPanel,
    activeTab,
    carDocumentsArchived,
    carDocumentsCurrent,
    carPhotosByModel,
    clientFields,
    documentsScope,
    manualCarDetailsByModel,
    manualClientCars,
    selectedClientCarModel,
    vehicleFields,
  ]);

  useEffect(() => {
    if (!clientId || !remoteSaveReady || !isClientDetailStateRemoteEnabled()) return;
    const timer = window.setTimeout(() => {
      void saveClientDetailState({
        client_id: clientId,
        active_tab: activeTab,
        active_client_panel: activeClientPanel,
        active_car_panel: activeCarPanel,
        selected_client_car_model: selectedClientCarModel,
        client_fields: clientFields.map((f) => ({ label: f.label, value: f.value })),
        vehicle_fields: vehicleFields.map((f) => ({ label: f.label, value: f.value })),
        manual_client_cars: [...manualClientCars],
        manual_car_details_by_model: { ...manualCarDetailsByModel },
        documents_scope: documentsScope,
        documents_current: carDocumentsCurrent.map((d) => ({ id: d.id, name: d.name })),
        documents_archived: carDocumentsArchived.map((d) => ({ id: d.id, name: d.name })),
        car_photos: [...visibleCarPhotos],
        car_photos_by_model: { ...carPhotosByModel },
      }).catch((err) => {
        console.warn("Failed to save client detail state.", err);
      });
    }, 750);
    return () => window.clearTimeout(timer);
  }, [
    activeCarPanel,
    activeClientPanel,
    activeTab,
    carDocumentsArchived,
    carDocumentsCurrent,
    carPhotosByModel,
    clientFields,
    clientId,
    documentsScope,
    manualCarDetailsByModel,
    manualClientCars,
    remoteSaveReady,
    selectedClientCarModel,
    vehicleFields,
    visibleCarPhotos,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const fioKey = normalizeRuFio(profileClientFio);
    if (!fioKey) return;
    const sharedCars = manualClientCars
      .map((model) => {
        const details = manualCarDetailsByModel[model];
        return {
          car: normalizeCarModel(model),
          plate: details?.plate?.trim() ?? "",
        };
      })
      .filter((entry) => entry.car);
    try {
      const raw = window.sessionStorage.getItem(CLIENT_CARS_SHARED_STORAGE_KEY);
      const parsed = raw ? (JSON.parse(raw) as SharedClientCarsStorage) : {};
      const next: SharedClientCarsStorage = parsed && typeof parsed === "object" ? { ...parsed } : {};
      next[fioKey] = sharedCars;
      window.sessionStorage.setItem(CLIENT_CARS_SHARED_STORAGE_KEY, JSON.stringify(next));
    } catch {
      // ignore storage sync errors
    }
  }, [manualCarDetailsByModel, manualClientCars, profileClientFio]);

  useEffect(() => {
    setSelectedPhotoIndex(null);
    setNewlyAddedPhoto(null);
  }, [selectedClientCarModel]);

  useEffect(() => {
    if (selectedPhotoIndex === null) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setSelectedPhotoIndex(null);
        return;
      }
      if (e.key === "ArrowRight") {
        setSelectedPhotoIndex((prev) => (prev === null ? 0 : (prev + 1) % visibleCarPhotos.length));
        return;
      }
      if (e.key === "ArrowLeft") {
        setSelectedPhotoIndex((prev) => (prev === null ? 0 : (prev - 1 + visibleCarPhotos.length) % visibleCarPhotos.length));
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [selectedPhotoIndex, visibleCarPhotos.length]);

  return (
    <div className="h-screen w-screen overflow-hidden bg-black tracking-[-0.02em] max-lg:min-h-screen max-lg:h-auto max-lg:overflow-y-auto lg:h-screen lg:overflow-hidden">
      <div className="flex h-full w-full min-h-0 p-2 max-lg:h-auto lg:h-full">
        <div className="flex h-full min-h-0 w-full max-lg:h-auto max-lg:flex-col rounded-[16px] bg-black p-2 shadow-none lg:flex-row lg:shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)]">
          <MarsAppShellSidebar mobileLayout="requests" />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:overflow-x-hidden">
            <header className="mb-2 rounded-[16px] border border-[#DDE1E7] bg-white px-4 py-4 lg:px-5 lg:py-5">
              <div className="flex items-center gap-3 max-lg:flex-col max-lg:items-stretch max-lg:gap-3 lg:flex-row lg:items-center">
                <h1 className="max-w-full shrink-0 truncate whitespace-nowrap text-[28px] font-bold leading-[100%] tracking-[-0.02em] text-[#111826] max-sm:text-[22px] lg:text-[30px] xl:text-[36px]">{`Клиент №${clientId || "—"}`}</h1>
                <div className="ml-auto flex w-full min-w-0 max-lg:ml-0 max-lg:flex-col max-lg:gap-2 sm:max-lg:flex-row sm:max-lg:flex-wrap items-stretch sm:max-lg:items-center lg:ml-auto lg:w-auto lg:flex-row lg:items-center lg:gap-1 xl:gap-1.5">
                  <button
                    type="button"
                    className="h-12 min-h-[48px] shrink-0 cursor-pointer rounded-[10px] bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.02em] text-white max-lg:flex-1 sm:max-lg:flex-none lg:px-3 lg:text-[16px] xl:px-4 xl:text-[18px]"
                  >
                    Позвонить клиенту
                  </button>
                </div>
              </div>
            </header>

            <section className="relative flex min-h-0 flex-1 gap-2 max-lg:h-auto max-lg:flex-col lg:h-full">
              <section className="relative z-20 w-[40%] min-w-[360px] rounded-[16px] bg-white p-6 max-lg:w-full max-lg:min-w-0 max-lg:p-4 md:max-lg:pb-24 lg:p-6">
                <div className={leftContentMotionClass}>
                  <div
                    style={{ transitionDelay: "0ms" }}
                    className="flex items-start justify-between gap-4 transition-all duration-350 ease-out"
                  >
                    <div>
                      <h1 className="max-w-[420px] text-[52px] font-semibold leading-[0.98] tracking-[-0.03em] text-[#202636] max-lg:max-w-full max-sm:text-[36px] sm:max-lg:text-[44px]">
                        {displayedTab === "client" ? (
                          <>
                            <span className="block whitespace-nowrap max-sm:whitespace-normal [overflow-wrap:anywhere]">{profileClientFirstLine || "\u00A0"}</span>
                            <span className="block whitespace-normal break-words [overflow-wrap:anywhere]">{profileClientSecondLine || "\u00A0"}</span>
                          </>
                        ) : (
                          <>
                            <span className="block whitespace-nowrap max-sm:whitespace-normal [overflow-wrap:anywhere]">{selectedClientCarModel.split(" ").slice(0, 2).join(" ")}</span>
                            <span className="block whitespace-normal break-words [overflow-wrap:anywhere]">{selectedClientCarModel.split(" ").slice(2).join(" ") || "\u00A0"}</span>
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
                        const isWideClientField =
                          displayedTab === "client" &&
                          (field.label === "Комментарий" || field.label === "Дата последнего визита");
                        const isWideCarComment = displayedTab === "car" && field.label === "Комментарий";
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
                            className={`${isWideClientField || isWideCarComment ? "col-span-2 h-auto min-h-[68px] lg:h-[68px]" : "h-auto min-h-[68px] lg:h-[68px]"} rounded-[10px] border-2 px-4 py-3 transition-all duration-350 ease-out ${
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
                              <p className="mt-1 whitespace-normal break-words text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352] [overflow-wrap:anywhere]">{field.value}</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                  <div className="mt-[50px]" />
                </div>
                <div className="absolute bottom-4 left-1/2 w-[272px] -translate-x-1/2 max-sm:static max-sm:mx-auto max-sm:mt-10 max-sm:w-[216px] max-sm:translate-x-0 md:max-lg:bottom-8 inline-grid grid-cols-2 rounded-full bg-[#11131D] p-1 text-[12px] shadow-[0_8px_24px_-14px_rgba(0,0,0,0.8)]">
                  <span
                    className={`absolute left-1 top-1 bottom-1 z-0 w-[calc(50%-4px)] rounded-full bg-[#EC1C24] shadow-[0_6px_14px_-8px_rgba(236,28,36,0.85)] transition-transform duration-500 ease-[cubic-bezier(0.22,1,0.36,1)] ${
                      activeTab === "client" ? "translate-x-0" : "translate-x-full"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setActiveTab("client")}
                    className={`relative z-10 w-[132px] max-sm:w-[108px] rounded-full px-3 py-2 text-center text-[15px] max-sm:text-[14px] font-bold tracking-[-0.02em] transition-colors duration-300 ${
                      activeTab === "client" ? "text-white" : "text-white/80 hover:text-white"
                    }`}
                  >
                    Клиент
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setActiveTab("car");
                      setActiveCarPanel("orders");
                    }}
                    className={`relative z-10 w-[132px] max-sm:w-[108px] rounded-full px-3 py-2 text-center text-[15px] max-sm:text-[14px] font-bold tracking-[-0.02em] transition-colors duration-300 ${
                      activeTab === "car" ? "text-white" : "text-white/80 hover:text-white"
                    }`}
                  >
                    Автомобиль
                  </button>
                </div>
              </section>

              <section className="relative z-20 min-w-0 flex-1 rounded-[16px] bg-white p-6 max-lg:w-full max-lg:p-4 max-sm:p-2 lg:p-6">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="flex w-full flex-wrap items-center gap-1 rounded-full p-1">
                    {(activeTab === "client"
                      ? [
                          { label: "Основное", value: "main" as const },
                          { label: "Список автомобилей", value: "cars" as const },
                        ]
                      : [
                          { label: "Заказ-наряды", value: "orders" as const },
                          { label: "Документы", value: "documents" as const },
                          { label: "Фото автомобиля", value: "photos" as const },
                        ]
                    ).map((tab) => (
                      <button
                        key={tab.label}
                        type="button"
                        onClick={() => {
                          if (activeTab === "client" && "value" in tab) setActiveClientPanel(tab.value);
                          if (activeTab === "car" && "value" in tab) setActiveCarPanel(tab.value);
                        }}
                        className={`rounded-full px-4 py-2 text-[14px] font-medium tracking-[-0.02em] text-black ${
                          (activeTab === "client" && "value" in tab && activeClientPanel === tab.value) ||
                          (activeTab === "car" && "value" in tab && activeCarPanel === tab.value)
                            ? "bg-[#F8F8FA]"
                            : "bg-transparent"
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {activeTab === "client" ? (
                    <>
                      {activeClientPanel === "main" ? (
                        <>
                          <div className="mt-6 grid grid-cols-1 gap-3 max-lg:mt-8 sm:grid-cols-3 lg:mt-[107px]">
                            {[
                              ["Заказ-наряды", String(clientOrdersMetrics.totalOrders), "за всё время"],
                              ["Общая сумма", formatCurrency(clientOrdersMetrics.totalAmount), "за всё время"],
                              ["Средний чек", formatCurrency(clientOrdersMetrics.averageCheck), "за всё время"],
                            ].map(([label, value, sub]) => (
                              <article key={label} className="flex h-[128px] flex-col rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                <div>
                                  <p className="text-[16px] font-medium leading-none tracking-[-0.04em] text-[#1D2330]">{label}</p>
                                </div>
                                <div className="mt-auto">
                                  <p className="text-[44px] font-medium leading-none tracking-[-0.04em] text-[#E00919]">{value}</p>
                                  <p className="mt-1 text-[13px] font-medium tracking-[-0.04em] text-[#6F7785]">{sub}</p>
                                </div>
                              </article>
                            ))}
                          </div>

                          <article className="relative mt-6 min-h-0 w-full overflow-hidden rounded-t-[12px] rounded-b-none bg-transparent lg:mt-[40px]">
                            <div className="mb-3 flex items-center">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Текущая активность</h3>
                            </div>
                            <div className="hide-scrollbar min-h-[200px] max-h-[min(52vh,420px)] min-w-0 space-y-4 overflow-y-auto overflow-x-hidden rounded-t-[10px] rounded-b-none bg-transparent pb-4 lg:h-[420px] lg:max-h-none">
                              {clientActivityItems.map((item) => {
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
                                      onClick={() => handleOpenClientActivity(item)}
                                      className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#EC1C24] text-white"
                                    >
                                      <img src="/go_to.svg" alt="" className="h-[17px] w-5" />
                                    </button>
                                  </article>
                                );
                              })}
                            </div>
                          </article>
                        </>
                      ) : (
                        <article className="relative order-2 mt-10 min-h-0 flex-1 rounded-[12px] bg-transparent max-lg:relative max-lg:mt-8 lg:mt-[107px]">
                          <div className="absolute left-0 right-0 top-0 -translate-y-full pb-3 max-lg:static max-lg:translate-y-0 max-lg:pb-3 lg:absolute lg:-translate-y-full">
                            <div className="flex w-full flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Автомобили клиента</h3>
                              <button
                                type="button"
                                onClick={() => setIsAddCarModalOpen(true)}
                                className="w-full shrink-0 cursor-pointer rounded-[10px] bg-black px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] text-white sm:ml-[50px] sm:w-auto max-sm:ml-0"
                              >
                                Добавить автомобиль
                              </button>
                            </div>
                          </div>
                          <div className="hide-scrollbar min-h-0 min-w-0 max-h-[min(65vh,598px)] space-y-4 overflow-y-auto overflow-x-hidden rounded-lg bg-transparent lg:max-h-[598px]">
                            {clientCarListItems.map((item) => {
                              const orders = `${item.ordersCount} заказ-нарядов`;
                              return (
                              <article key={item.model} className="flex items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                                  <img src="/car2.svg" alt="" className="h-5 w-6" />
                                </span>
                                <p className="text-[20px] font-medium leading-[1.1] tracking-[-0.02em] text-[#7D7D7D]">
                                  <span className="text-[#111826]">{item.model}</span>
                                  {orders ? ` — ${orders}` : ""}
                                </p>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedClientCarModel(item.model);
                                    setActiveTab("car");
                                    setActiveCarPanel("orders");
                                  }}
                                  className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#EC1C24] text-white"
                                >
                                  <img src="/go_to.svg" alt="" className="h-[17px] w-5" />
                                </button>
                              </article>
                            );
                            })}
                          </div>
                        </article>
                      )}

                    </>
                  ) : (
                    <>
                      {activeCarPanel === "documents" ? (
                        <article className="relative order-2 mt-10 min-h-0 flex-1 rounded-[12px] bg-transparent max-lg:relative max-lg:mt-8 lg:mt-[107px]">
                          <div className="absolute left-0 right-0 top-0 -translate-y-full pb-3 max-lg:static max-lg:translate-y-0 max-lg:pb-3 lg:absolute lg:-translate-y-full">
                            <div className="flex w-full flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">
                                Документы <span className="tabular-nums text-[#888888]">({carDocumentsCurrent.length + carDocumentsArchived.length})</span>
                              </h3>
                              <div className="flex w-full flex-col gap-3 sm:ml-auto sm:w-auto sm:flex-row sm:flex-wrap sm:items-center sm:pl-1">
                                <div className="flex flex-wrap items-center gap-4 sm:gap-6">
                                  <button
                                    type="button"
                                    onClick={() => setDocumentsScope("current")}
                                    className="flex cursor-pointer items-center gap-2 text-[16px] font-medium tracking-[-0.04em] text-black"
                                  >
                                    <ClientsStyleCheckboxBox checked={documentsScope === "current"} />
                                    <span>Текущие</span>
                                    <span className="tabular-nums text-[#7D7D7D]">({carDocumentsCurrent.length})</span>
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => setDocumentsScope("archived")}
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
                                  multiple
                                  className="hidden"
                                  accept=".pdf,.doc,.docx,.txt,.png,.jpg,.jpeg,.webp,.xls,.xlsx"
                                  onChange={handleDocumentFileInputChange}
                                />
                                <button
                                  type="button"
                                  onClick={triggerDocumentUpload}
                                  className="w-full shrink-0 cursor-pointer rounded-[10px] bg-black px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] text-white sm:ml-[50px] sm:w-auto max-sm:ml-0"
                                >
                                  Загрузить документ
                                </button>
                              </div>
                            </div>
                          </div>
                          <div className="hide-scrollbar min-h-0 min-w-0 max-h-[min(65vh,598px)] space-y-4 overflow-y-auto overflow-x-hidden scroll-smooth rounded-lg bg-transparent lg:max-h-[598px]">
                            {(documentsScope === "current" ? carDocumentsCurrent : carDocumentsArchived).length === 0 ? (
                              <div className="flex min-h-[200px] items-center justify-center rounded-[12px] bg-[#F3F3F5] px-4 py-10 text-center text-[15px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                                {documentsScope === "archived" ? "В архиве пока нет документов" : "Нет документов"}
                              </div>
                            ) : (
                              (documentsScope === "current" ? carDocumentsCurrent : carDocumentsArchived).map((item) => {
                              const isArchiving = archivingDocRowId === item.id;
                              return (
                              <article
                                key={item.id}
                                className={`flex items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3 ${
                                  isArchiving ? "pointer-events-none animate-[archiveRowOut_260ms_ease_forwards]" : ""
                                }`}
                              >
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                                  <img src="/document.svg" alt="" className="h-5 w-4" />
                                </span>
                                <p className="min-w-0 flex-1 truncate text-[20px] font-medium leading-[1.1] tracking-[-0.02em] text-[#7D7D7D]">{item.name}</p>
                                <button
                                  type="button"
                                  onClick={() =>
                                    setDocumentActionsModal({
                                      title: item.name,
                                      docId: item.id,
                                      scope: documentsScope === "archived" ? "documentsArchived" : "documentsCurrent",
                                    })
                                  }
                                  className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#EC1C24] text-white"
                                >
                                  <MoreDotsCircleMenuIcon />
                                </button>
                              </article>
                            )}))}
                          </div>
                        </article>
                      ) : activeCarPanel === "orders" ? (
                        <article className="relative order-2 mt-10 min-h-0 flex-1 rounded-[12px] bg-transparent max-lg:relative max-lg:mt-8 lg:mt-[107px]">
                          <div className="absolute left-0 top-0 -translate-y-full pb-3 max-lg:static max-lg:translate-y-0 max-lg:pb-3 lg:absolute lg:-translate-y-full">
                            <div className="flex items-center">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">История заказ-нарядов</h3>
                            </div>
                          </div>
                          <div className="hide-scrollbar min-h-0 min-w-0 max-h-[min(65vh,598px)] space-y-4 overflow-y-auto overflow-x-hidden rounded-lg bg-transparent lg:max-h-[598px]">
                            {carOrderHistoryItems.map((item) => {
                              const [titlePart, ...restParts] = item.text.split(" · ");
                              const detailsPart = restParts.join(" · ");
                              return (
                                <article key={item.id} className="flex items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                  <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                                    <img src={item.icon} alt="" className="h-5 w-5" />
                                  </span>
                                  <p className="text-[20px] font-medium leading-[1.1] tracking-[-0.02em] text-[#7D7D7D]">
                                    <span className="text-[#111826]">{titlePart}</span>
                                    {detailsPart ? ` · ${detailsPart}` : ""}
                                  </p>
                                  <button
                                    type="button"
                                    onClick={() => handleOpenCarOrderHistory(item)}
                                    className="ml-auto inline-flex h-11 w-11 shrink-0 cursor-pointer items-center justify-center rounded-full bg-[#EC1C24] text-white"
                                  >
                                    <img src="/go_to.svg" alt="" className="h-[17px] w-5" />
                                  </button>
                                </article>
                              );
                            })}
                          </div>
                        </article>
                      ) : (
                        <article className="relative mt-10 flex min-h-0 flex-1 flex-col rounded-[12px] bg-transparent max-lg:relative max-lg:mt-8 lg:mt-[107px]">
                          <div className="absolute left-0 top-0 -translate-y-full pb-3 max-lg:static max-lg:translate-y-0 max-lg:pb-3 lg:absolute lg:-translate-y-full">
                            <div className="flex items-center">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Фото автомобиля</h3>
                            </div>
                          </div>
                          <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto scroll-smooth">
                            <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
                              {visibleCarPhotos.map((photoSrc, index) => (
                                <article
                                  key={`${photoSrc}-${index}`}
                                  onClick={() => setSelectedPhotoIndex(index)}
                                  className={`group relative aspect-[4/3] w-full cursor-pointer overflow-hidden rounded-[10px] bg-[#F3F3F5] transition-all duration-300 ease-out hover:-translate-y-0.5 hover:shadow-[0_10px_28px_-12px_rgba(17,24,38,0.45)] ${
                                    newlyAddedPhoto === photoSrc
                                      ? "animate-[photoCardIn_420ms_cubic-bezier(0.22,1,0.36,1)_forwards]"
                                      : ""
                                  }`}
                                >
                                  <img src={photoSrc} alt={selectedCarPhotoAlt} className="h-full w-full object-cover transition-transform duration-300 ease-out group-hover:scale-[1.03]" />
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
                  )}
                </div>
              </section>
            </section>
          </main>
        </div>
      <style>{`
        @keyframes workOrderLeftOut {
          0% { opacity: 1; transform: translateX(0); }
          100% { opacity: 0; transform: translateX(-28px); }
        }
        @keyframes workOrderLeftIn {
          0% { opacity: 0; transform: translateX(28px); }
          100% { opacity: 1; transform: translateX(0); }
        }
        @keyframes archiveRowOut {
          0% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
        @keyframes photoCardIn {
          0% { opacity: 0; transform: translateY(10px) scale(0.97); }
          100% { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
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
                      updateVisibleCarPhotos((prev) => [newPhotoPreview, ...prev]);
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
                  setSelectedPhotoIndex((prev) => (prev === null ? 0 : (prev - 1 + visibleCarPhotos.length) % visibleCarPhotos.length));
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
                  setSelectedPhotoIndex((prev) => (prev === null ? 0 : (prev + 1) % visibleCarPhotos.length));
                }}
                className="absolute right-6 top-1/2 inline-flex h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-[34px] leading-none text-white transition hover:bg-white/25"
                aria-label="Следующее фото"
              >
                ›
              </button>
              <img
                src={visibleCarPhotos[selectedPhotoIndex]}
                alt="Просмотр фото автомобиля"
                className="max-h-[calc(100vh-80px)] max-w-[calc(100vw-80px)] rounded-[12px] object-contain shadow-[0_24px_70px_-20px_rgba(0,0,0,0.8)]"
                onClick={(e) => e.stopPropagation()}
              />
            </div>,
            document.body,
          )
        : null}
      {documentActionsModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[269] flex items-center justify-center bg-black/45 p-4"
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
                            setDocumentActionsModal(null);
                            setArchivingDocRowId(snap.docId);
                            window.setTimeout(() => {
                              setCarDocumentsCurrent((prev) => prev.filter((d) => d.id !== snap.docId));
                              setCarDocumentsArchived((prev) => [moveDoc, ...prev]);
                              setArchivingDocRowId((current) => (current === snap.docId ? null : current));
                              emitArchiveStyleToast({
                                line1: moveDoc.name,
                                line2: "перемещён в архив",
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
                            setDocumentActionsModal(null);
                            setArchivingDocRowId(snap.docId);
                            window.setTimeout(() => {
                              setCarDocumentsArchived((prev) => prev.filter((d) => d.id !== snap.docId));
                              setCarDocumentsCurrent((prev) => [moveDoc, ...prev]);
                              setArchivingDocRowId((current) => (current === snap.docId ? null : current));
                              emitArchiveStyleToast({
                                line1: moveDoc.name,
                                line2: "возвращён в таблицу",
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
      {isAddCarModalOpen && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[270] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => {
                setIsAddCarModalOpen(false);
                setNewCarDraft(EMPTY_MANUAL_CAR_DRAFT);
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="add-client-car-title"
                className="w-full max-w-[560px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="add-client-car-title" className="text-[20px] font-bold tracking-[-0.04em] text-[#111826]">
                    Добавить автомобиль
                  </h2>
                </div>
                <div className="flex flex-col gap-3 p-5">
                  <input
                    value={newCarDraft.model}
                    onChange={(e) => setNewCarDraft((prev) => ({ ...prev, model: e.target.value }))}
                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Марка и модель"
                  />
                  <input
                    value={newCarDraft.mileage}
                    onChange={(e) => setNewCarDraft((prev) => ({ ...prev, mileage: e.target.value }))}
                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Пробег"
                  />
                  <input
                    value={newCarDraft.plate}
                    onChange={(e) => setNewCarDraft((prev) => ({ ...prev, plate: e.target.value }))}
                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Гос. номер"
                  />
                  <input
                    value={newCarDraft.bodyType}
                    onChange={(e) => setNewCarDraft((prev) => ({ ...prev, bodyType: e.target.value }))}
                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Тип кузова"
                  />
                  <input
                    value={newCarDraft.vin}
                    onChange={(e) => setNewCarDraft((prev) => ({ ...prev, vin: e.target.value }))}
                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                    placeholder="VIN"
                  />
                  <input
                    value={newCarDraft.fuelType}
                    onChange={(e) => setNewCarDraft((prev) => ({ ...prev, fuelType: e.target.value }))}
                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Тип топлива"
                  />
                  <input
                    value={newCarDraft.year}
                    onChange={(e) => setNewCarDraft((prev) => ({ ...prev, year: e.target.value }))}
                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Год выпуска"
                  />
                  <input
                    value={newCarDraft.transmission}
                    onChange={(e) => setNewCarDraft((prev) => ({ ...prev, transmission: e.target.value }))}
                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Трансмиссия"
                  />
                  <input
                    value={newCarDraft.color}
                    onChange={(e) => setNewCarDraft((prev) => ({ ...prev, color: e.target.value }))}
                    className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Цвет"
                  />
                </div>
                <div className="flex gap-2 border-t border-[#EEEDF0] p-5">
                  <button
                    type="button"
                    onClick={() => {
                      setIsAddCarModalOpen(false);
                      setNewCarDraft(EMPTY_MANUAL_CAR_DRAFT);
                    }}
                    className="h-11 flex-1 cursor-pointer rounded-[10px] bg-[#ECECEF] px-4 text-[15px] font-medium text-black"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    onClick={handleAddClientCar}
                    className="h-11 flex-1 cursor-pointer rounded-[10px] bg-[#EC1C24] px-5 text-[15px] font-medium text-white"
                  >
                    Добавить
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      </div>
    </div>
  );
}
