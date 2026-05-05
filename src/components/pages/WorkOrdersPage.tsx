import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import { CURRENT_USER_ROLE } from "@/lib/session/currentUser";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type WorkOrderRow = {
  id: string;
  client: string;
  car: string;
  plate: string;
  master: string;
  masterPhoto: string;
  status: "Новый" | "В работе" | "Ожидание запчастей" | "Готово" | "Закрыт" | "Отказ клиента";
  amount: string;
  dueDate: string;
};

const workOrderStatusColorMap: Record<WorkOrderRow["status"], string> = {
  Новый: "#ACACAC",
  "В работе": "#2E78C9",
  "Ожидание запчастей": "#F39D00",
  Готово: "#00B515",
  Закрыт: "#222222",
  "Отказ клиента": "#EC1C24",
};

const workOrderRows: WorkOrderRow[] = [
  { id: "294894", client: "Иванов Артём Сергеевич", car: "BMW M5 F90", plate: "А123ВС777", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "18 500 ₽", dueDate: "03.08.2024" },
  { id: "593423", client: "Смирнова Наталья Викторовна", car: "Kia Rio", plate: "М456КХ199", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", status: "Новый", amount: "12 300 ₽", dueDate: "05.08.2024" },
  { id: "839022", client: 'ООО "Сад"', car: "Lada Priora", plate: "О789ЕН750", master: "Кириллов О.", masterPhoto: "https://i.pravatar.cc/80?img=14", status: "Ожидание запчастей", amount: "25 800 ₽", dueDate: "08.08.2024" },
  { id: "847952", client: "ИП Лебедев Максим Олегович", car: "Toyota Camry", plate: "Т321ОР197", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", status: "В работе", amount: "9 700 ₽", dueDate: "13.08.2024" },
  { id: "495783", client: 'ООО "ЭкоМобил"', car: "Skoda Octavia", plate: "У654НС777", master: "Тимофеев А.", masterPhoto: "https://i.pravatar.cc/80?img=47", status: "Закрыт", amount: "31 400 ₽", dueDate: "15.08.2024" },
  { id: "987384", client: "Белов Алексей Игоревич", car: "Hyundai Solaris", plate: "В222ОО177", master: "Романова Л.", masterPhoto: "https://i.pravatar.cc/80?img=5", status: "Новый", amount: "7 200 ₽", dueDate: "17.08.2024" },
  { id: "284750", client: "Фролова Алина Андреевна", car: "Renault Duster", plate: "Р988РР799", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "В работе", amount: "14 900 ₽", dueDate: "20.08.2024" },
  { id: "847597", client: "Журавлёв Михаил Дмитриевич", car: "VW Polo", plate: "С555КК77", master: "Кузнецов Е.", masterPhoto: "https://i.pravatar.cc/80?img=52", status: "Закрыт", amount: "22 000 ₽", dueDate: "22.08.2024" },
  { id: "658472", client: 'ООО "ГрузСервис"', car: "MAN TGS", plate: "Е100ХХ750", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "56 700 ₽", dueDate: "24.08.2024" },
  { id: "309845", client: 'ООО "ТехноТрак"', car: "Mercedes Actros", plate: "Н777АА116", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", status: "Готово", amount: "43 900 ₽", dueDate: "26.08.2024" },
  { id: "208476", client: "Гаврилова Ирина Михайловна", car: "Mazda 6", plate: "У001УР199", master: "Захарова И.", masterPhoto: "https://i.pravatar.cc/80?img=58", status: "Ожидание запчастей", amount: "17 600 ₽", dueDate: "28.08.2024" },
  { id: "989923", client: 'ООО "ЭкспрессТранс"', car: "Ford Transit", plate: "Р454КХ799", master: "Тимофеев А.", masterPhoto: "https://i.pravatar.cc/80?img=47", status: "Закрыт", amount: "28 300 ₽", dueDate: "30.08.2024" },
  { id: "923117", client: "Кузнецов Павел Андреевич", car: "Nissan X-Trail", plate: "Х878ТТ177", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "19 400 ₽", dueDate: "01.09.2024" },
  { id: "731550", client: 'ООО "Магистраль"', car: "Scania R450", plate: "М320СС97", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", status: "Отказ клиента", amount: "63 200 ₽", dueDate: "03.09.2024" },
  { id: "615004", client: "Орлова Анна Вячеславовна", car: "Kia Sportage", plate: "Р600РО177", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", status: "Закрыт", amount: "11 800 ₽", dueDate: "05.09.2024" },
  { id: "771208", client: "Савельев Кирилл Романович", car: "Audi A6", plate: "А701АА77", master: "Кузнецов Е.", masterPhoto: "https://i.pravatar.cc/80?img=52", status: "В работе", amount: "35 100 ₽", dueDate: "06.09.2024" },
  { id: "842661", client: "Павлова Ольга Дмитриевна", car: "Skoda Kodiaq", plate: "Н442НР799", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", status: "Ожидание запчастей", amount: "21 500 ₽", dueDate: "07.09.2024" },
  { id: "904552", client: 'ООО "ЛогистикПлюс"', car: "DAF XF", plate: "Р909РЕ750", master: "Тимофеев А.", masterPhoto: "https://i.pravatar.cc/80?img=47", status: "Готово", amount: "47 000 ₽", dueDate: "08.09.2024" },
  { id: "956740", client: "Тихонов Максим Сергеевич", car: "BMW X5", plate: "Е212ЕР199", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", status: "В работе", amount: "39 600 ₽", dueDate: "09.09.2024" },
  { id: "118390", client: "Егорова Мария Игоревна", car: "Toyota RAV4", plate: "К811КК777", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", status: "Закрыт", amount: "13 200 ₽", dueDate: "10.09.2024" },
];

function shiftRuDate(dateString: string, daysDelta: number): string {
  const match = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(dateString.trim());
  if (!match) return dateString;
  const day = Number(match[1]);
  const month = Number(match[2]) - 1;
  const year = Number(match[3]);
  const date = new Date(year, month, day);
  if (Number.isNaN(date.getTime())) return dateString;
  date.setDate(date.getDate() + daysDelta);
  const dd = String(date.getDate()).padStart(2, "0");
  const mm = String(date.getMonth() + 1).padStart(2, "0");
  const yy = date.getFullYear();
  return `${dd}.${mm}.${yy}`;
}

export function WorkOrdersPage() {
  const navigate = useNavigate();
  const isManager = CURRENT_USER_ROLE === "manager";
  const [searchParams, setSearchParams] = useSearchParams();
  const highlightWorkOrderId = searchParams.get("workOrder");
  const workOrderRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const workOrderScrollKey = useRef<string>("");
  const [rows] = useState<WorkOrderRow[]>(() => workOrderRows.map((r) => ({ ...r })));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedRowIds, setSelectedRowIds] = useState<Set<string>>(() => new Set());
  const [openFilter, setOpenFilter] = useState<"status" | "master" | "dueDate" | null>(null);
  const [statusFilter, setStatusFilter] = useState<Set<WorkOrderRow["status"]>>(
    () => new Set(["Новый", "В работе", "Ожидание запчастей", "Готово", "Закрыт", "Отказ клиента"]),
  );
  const [masterFilter, setMasterFilter] = useState<Set<string>>(
    () => new Set([...new Set(workOrderRows.map((r) => r.master))]),
  );
  const [dateFromInput, setDateFromInput] = useState("");
  const [dateToInput, setDateToInput] = useState("");
  const [awaitingPaymentOnly, setAwaitingPaymentOnly] = useState(false);
  const [archiveOnly, setArchiveOnly] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [paginationWindowStart, setPaginationWindowStart] = useState<1 | 4>(1);
  const [sortState, setSortState] = useState<
    | { key: "id" | "status" | "client" | "car" | "plate" | "master" | "dueDate" | "amount"; dir: "asc" | "desc" }
    | null
  >(null);

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

  useLayoutEffect(() => {
    const wid = searchParams.get("workOrder");
    if (!wid) {
      workOrderScrollKey.current = "";
      return;
    }
    if (!rows.some((r) => r.id === wid)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("workOrder");
          return next;
        },
        { replace: true },
      );
      workOrderScrollKey.current = "";
      return;
    }
    if (workOrderScrollKey.current === wid) return;
    workOrderScrollKey.current = wid;
    const raf = window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        workOrderRowRefs.current[wid]?.scrollIntoView({ behavior: "smooth", block: "center" });
      });
    });
    const tid = window.setTimeout(() => {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("workOrder");
          return next;
        },
        { replace: true },
      );
      workOrderScrollKey.current = "";
    }, 9000);
    return () => {
      window.cancelAnimationFrame(raf);
      window.clearTimeout(tid);
    };
  }, [searchParams, rows, setSearchParams]);

  const TOTAL_WORK_ORDERS_SHOWN = 127;
  const PAGE_SIZE = 12;
  const PAGINATION_TOTAL_PAGES = 7;

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
        const byCar = row.car.toLowerCase().includes(qText);
        const byId = row.id.includes(qDigits);
        if (!byClient && !byCar && !byId) return false;
      }
      if (awaitingPaymentOnly && row.status !== "Готово") return false;
      if (archiveOnly && row.status !== "Закрыт" && row.status !== "Отказ клиента") return false;
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

  const workOrdersCountLabel = useMemo(() => {
    const n = rows.length;
    const mod10 = n % 10;
    const mod100 = n % 100;
    let word = "заказ-нарядов";
    if (mod10 === 1 && mod100 !== 11) word = "заказ-наряд";
    else if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 > 20)) word = "заказ-наряда";
    return `${n} ${word}`;
  }, [rows.length]);

  const totalPages = PAGINATION_TOTAL_PAGES;
  const currentPageSafe = Math.min(currentPage, totalPages);
  const pageStart = (currentPageSafe - 1) * PAGE_SIZE;
  const pagedRows = sortedRows.slice(pageStart, pageStart + PAGE_SIZE);
  const pageEnd = Math.min(pageStart + pagedRows.length, sortedRows.length);
  const paginationItems: Array<number | "ellipsis"> = [paginationWindowStart, paginationWindowStart + 1, paginationWindowStart + 2, "ellipsis", totalPages];
  const paginationActiveIndex =
    currentPageSafe === totalPages ? 4 : currentPageSafe >= paginationWindowStart && currentPageSafe <= paginationWindowStart + 2 ? currentPageSafe - paginationWindowStart : 0;
  const allPageRowsSelected = pagedRows.length > 0 && pagedRows.every((r) => selectedRowIds.has(r.id));
  const awaitingPaymentCount = rows.filter((r) => r.status === "Готово").length;
  const archiveCount = rows.filter((r) => r.status === "Закрыт" || r.status === "Отказ клиента").length;

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  useEffect(() => {
    setPaginationWindowStart(currentPageSafe >= 4 ? 4 : 1);
  }, [currentPageSafe]);

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
    setSearchQuery("");
    setAwaitingPaymentOnly(false);
    setArchiveOnly(false);
    setSelectedRowIds(new Set());
    setOpenFilter(null);
    setStatusFilter(new Set(["Новый", "В работе", "Ожидание запчастей", "Готово", "Закрыт", "Отказ клиента"]));
    setMasterFilter(new Set([...new Set(workOrderRows.map((r) => r.master))]));
    setDateFromInput("");
    setDateToInput("");
  }

  const panelBase = "absolute left-0 top-full z-30 mt-2 min-w-[240px] rounded-[10px] border border-[#DDE1E7] bg-white p-3 shadow-lg";

  function checkboxBox(checked: boolean) {
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

  const noActiveFilters = !searchQuery.trim() && !awaitingPaymentOnly && !archiveOnly && !dateFromInput.trim() && !dateToInput.trim();

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
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
              <button onClick={() => navigate("/profile")} className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="user" /></button>
            </div>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col">
            <header className="mb-2 rounded-[16px] border border-[#DDE1E7] bg-white px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[36px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">Заказ-наряды</h1>
                  <span className="text-[16px] font-medium tracking-[-0.04em] text-[#B4B4B6]">{workOrdersCountLabel}</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <input
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-12 w-[320px] rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-[#8A8A8A] outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Найти по номеру заказ-наряда..."
                  />
                  <button
                    type="button"
                    className="h-12 rounded-[10px] bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white"
                  >
                    Создать заказ-наряд
                  </button>
                </div>
              </div>
            </header>

            <section className="flex min-h-0 flex-1 flex-col gap-5 rounded-[16px] border border-[#DDE1E7] bg-white px-5 py-5">
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
                          openFilter === id ? "bg-[#EC1C24] text-white" : "bg-[#ECECEF] text-[#111111]"
                        }`}
                      >
                        <span className="flex items-center justify-center gap-[12px]">
                          <span>{label}</span>
                          <svg viewBox="0 0 16 16" fill="none" className={`h-[16px] w-[16px] ${openFilter === id ? "text-white" : "text-[#111111]"}`}>
                            <path d="M3 6L8 11L13 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                          </svg>
                        </span>
                      </button>
                      {openFilter === "status" && (
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
                              {checkboxBox(statusFilter.has(s))}
                              {s}
                            </span>
                          ))}
                        </div>
                      )}
                      {openFilter === "master" && (
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
                              {checkboxBox(masterFilter.has(m))}
                              {m}
                            </span>
                          ))}
                        </div>
                      )}
                      {openFilter === "dueDate" && (
                        <div className={panelBase}>
                          <p className="mb-2 text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">Дата приема</p>
                          <div className="flex flex-col gap-2">
                            <label className="text-[13px] text-[#7D7D7D]">С</label>
                            <input value={dateFromInput} onChange={(e) => setDateFromInput(e.target.value)} className="h-10 rounded-[8px] border border-[#E4E5E7] bg-white px-2 text-[15px] outline-none" placeholder="дд.мм.гггг" />
                            <label className="text-[13px] text-[#7D7D7D]">По</label>
                            <input value={dateToInput} onChange={(e) => setDateToInput(e.target.value)} className="h-10 rounded-[8px] border border-[#E4E5E7] bg-white px-2 text-[15px] outline-none" placeholder="дд.мм.гггг" />
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                  <div className="flex flex-wrap items-center gap-6 pl-1 sm:pl-3">
                    <span className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-[16px] font-medium tracking-[-0.04em]" onClick={() => setAwaitingPaymentOnly((v) => !v)}>
                      {checkboxBox(awaitingPaymentOnly)}
                      <span className="text-black">Готово к выдаче </span>
                      <span className="text-[#7D7D7D] tabular-nums">({awaitingPaymentCount})</span>
                    </span>
                    <span className="flex shrink-0 cursor-pointer select-none items-center gap-2 text-[16px] font-medium tracking-[-0.04em]" onClick={() => setArchiveOnly((v) => !v)}>
                      {checkboxBox(archiveOnly)}
                      <span className="text-black">Архив </span>
                      <span className="text-[#7D7D7D] tabular-nums">({archiveCount})</span>
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={resetFilters}
                  disabled={noActiveFilters}
                  className="inline-flex shrink-0 cursor-pointer items-center rounded-[10px] border-2 border-[#EC1C24] bg-white px-[16px] py-[12px] text-[16px] font-medium leading-none tracking-[-0.04em] text-[#EC1C24] box-border disabled:cursor-default disabled:border-[#D0D2D7] disabled:text-[#A5A8B1]"
                >
                  Сбросить фильтры
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-white">
                <div className="h-full overflow-x-auto overflow-y-hidden">
                  <table className="min-w-full table-fixed border-separate border-spacing-0 whitespace-nowrap text-[16px] font-medium tracking-[-0.04em]">
                    <colgroup>
                      <col className="w-[4%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[18%]" />
                      <col className="w-[15%]" />
                      <col className="w-[10%]" />
                      <col className="w-[13%]" />
                      <col className="w-[10%]" />
                      <col className="w-[5%]" />
                      <col className="w-[3%]" />
                    </colgroup>
                    <thead className="bg-[#F3F3F5] text-left text-[16px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                      <tr>
                        <th className="rounded-l-[5px] px-4 py-2.5 font-medium">
                          <button type="button" onClick={toggleSelectAllOnPage} className="inline-flex items-center">
                            {checkboxBox(allPageRowsSelected)}
                          </button>
                        </th>
                        <th className="px-4 py-2.5 font-medium"><span className="inline-flex items-center gap-2">ID<button type="button" onClick={() => toggleSort("id")}><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-4 py-2.5 font-medium"><span className="inline-flex items-center gap-2">Статус<button type="button" onClick={() => toggleSort("status")}><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-4 py-2.5 font-medium"><span className="inline-flex items-center gap-2">Клиент<button type="button" onClick={() => toggleSort("client")}><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-4 py-2.5 font-medium"><span className="inline-flex items-center gap-2">Автомобиль<button type="button" onClick={() => toggleSort("car")}><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-4 py-2.5 font-medium"><span className="inline-flex items-center gap-2">Гос. номер<button type="button" onClick={() => toggleSort("plate")}><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-4 py-2.5 font-medium"><span className="inline-flex items-center gap-2">Мастер<button type="button" onClick={() => toggleSort("master")}><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-4 py-2.5 font-medium"><span className="inline-flex items-center gap-2">Дата приема<button type="button" onClick={() => toggleSort("dueDate")}><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="px-4 py-2.5 font-medium"><span className="inline-flex items-center gap-2">Сумма<button type="button" onClick={() => toggleSort("amount")}><svg viewBox="0 0 28 28" fill="none" className="h-[14px] w-[14px] text-current"><path d="M5.9375 1.25L5.9375 26.25M5.9375 1.25L10.625 5.41667M5.9375 1.25L1.25 5.41667M26.25 22.0833L21.5625 26.25M21.5625 26.25L16.875 22.0833M21.5625 26.25L21.5625 1.25" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg></button></span></th>
                        <th className="rounded-r-[5px] px-4 py-2.5 font-medium text-center">⋮</th>
                      </tr>
                    </thead>
                    <tbody>
                      {pagedRows.map((row, index) => (
                        <tr
                          key={row.id}
                          ref={(el) => {
                            workOrderRowRefs.current[row.id] = el;
                          }}
                          className={`border-[5px] border-[#EEEDF0] transition hover:bg-[rgba(224,9,25,0.10)] ${
                            index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white"
                          } ${highlightWorkOrderId === row.id ? "relative z-[2] shadow-[inset_0_0_0_2px_#EC1C24] ring-2 ring-[#EC1C24]/90" : ""}`}
                        >
                          <td className="px-4 py-3" onClick={(e) => e.stopPropagation()}>
                            <span
                              className="inline-flex cursor-pointer select-none items-center"
                              role="checkbox"
                              aria-checked={selectedRowIds.has(row.id)}
                              aria-label={`Выбрать заказ-наряд ${row.id}`}
                              onClick={() => toggleRowSelection(row.id)}
                            >
                              {checkboxBox(selectedRowIds.has(row.id))}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-black">{row.id}</td>
                          <td className="px-4 py-3 font-medium">
                            <span className="inline-flex max-w-full items-center gap-2 text-black">
                              <span
                                className="h-2.5 w-2.5 shrink-0 rounded-full"
                                style={{ backgroundColor: workOrderStatusColorMap[row.status] }}
                              />
                              <span className="min-w-0 truncate text-[16px] font-medium text-black">{row.status}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-black">{row.client}</td>
                          <td className="px-4 py-3 text-black">{row.car}</td>
                          <td className="px-4 py-3 text-black">{row.plate}</td>
                          <td className="px-4 py-3 text-black">
                            <span className="inline-flex max-w-full items-center gap-1.5">
                              <img
                                src={row.masterPhoto}
                                alt=""
                                className="h-[1em] w-[1em] shrink-0 rounded-full object-cover ring-1 ring-black/10"
                              />
                              <span className="min-w-0 truncate">{row.master}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-black">{shiftRuDate(row.dueDate, -1)}</td>
                          <td className="px-4 py-3 text-black">{row.amount}</td>
                          <td className="px-4 py-3 text-center text-[#A0A0A0]">...</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 pb-1 pt-2"><div className="h-1 rounded-full bg-[#EEEDF0]" /></div>
              </div>

              <div className="relative flex items-center justify-between">
                <button className="rounded-[8px] bg-white px-2 py-1 text-[20px] font-bold tracking-[-0.04em] text-black">
                  {selectedRowIds.size} / заказ-нарядов
                </button>
                <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2">
                  <div className="pointer-events-auto flex items-center gap-2">
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
                          <button key={`ellipsis-${idx}`} type="button" onClick={() => { if (paginationWindowStart === 1) { setPaginationWindowStart(4); setCurrentPage(4); } }} className="relative z-10 inline-flex h-[40px] w-[48px] items-center justify-center text-[16px] font-bold tracking-[-0.02em] text-white/90 transition-colors hover:text-white">...</button>
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
                <div className="flex items-center gap-2 text-[20px] font-bold tracking-[-0.04em] text-black">
                  <span>
                    {sortedRows.length === 0 ? `0 из ${TOTAL_WORK_ORDERS_SHOWN}` : `${pageStart + 1} — ${pageEnd} из ${TOTAL_WORK_ORDERS_SHOWN}`}
                  </span>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
