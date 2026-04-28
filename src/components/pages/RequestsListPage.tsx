import { useNavigate } from "react-router-dom";

type RequestTableRow = {
  id: string;
  status: "Новая заявка" | "В архиве" | "Отменена" | "Ожидание" | "Просрочена";
  client: string;
  car: string;
  plate: string;
  master: string;
  masterPhoto: string;
  receiveDate: string;
  progress: number;
  amount: string;
};

const requestStatusColorMap: Record<RequestTableRow["status"], string> = {
  "Новая заявка": "#00B515",
  "В архиве": "#ACACAC",
  Отменена: "#E00919",
  Ожидание: "#F39D00",
  Просрочена: "#E00919",
};

const requestRows: RequestTableRow[] = [
  { id: "294894", status: "Новая заявка", client: "Иванов Артём Сергеевич", car: "Toyota Corolla", plate: "A123BC777", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", receiveDate: "03.08.2024", progress: 0, amount: "1200" },
  { id: "593423", status: "В архиве", client: "Смирнова Наталья Викторовна", car: "Hyundai Solaris", plate: "M456KX199", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", receiveDate: "05.08.2024", progress: 100, amount: "3 500" },
  { id: "839022", status: "Отменена", client: 'ООО "Сад"', car: "LADA Vesta", plate: "O789EH750", master: "Кириллов О.", masterPhoto: "https://i.pravatar.cc/80?img=14", receiveDate: "08.08.2024", progress: 30, amount: "7 900" },
  { id: "847952", status: "Новая заявка", client: "ИП Лебедев Максим Олегович", car: "Kia Rio", plate: "T321OP197", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", receiveDate: "13.08.2024", progress: 0, amount: "14 500" },
  { id: "495783", status: "Ожидание", client: 'ООО "ЭкоМобил"', car: "Renault Duster", plate: "Y654HC777", master: "Тимофеев А.", masterPhoto: "https://i.pravatar.cc/80?img=47", receiveDate: "15.08.2024", progress: 60, amount: "22 300" },
  { id: "987384", status: "В архиве", client: "Белов Алексей Игоревич", car: "Ford Focus", plate: "P111MP178", master: "Романова Л.", masterPhoto: "https://i.pravatar.cc/80?img=5", receiveDate: "17.08.2024", progress: 100, amount: "5 700" },
  { id: "284750", status: "Ожидание", client: "Фролова Алина Андреевна", car: "Volkswagen Polo", plate: "A888MM799", master: "Егоров П.", masterPhoto: "https://i.pravatar.cc/80?img=61", receiveDate: "20.08.2024", progress: 80, amount: "38 900" },
  { id: "847597", status: "Новая заявка", client: "Белов Алексей Игоревич", car: "Nissan Qashqai", plate: "E222CC750", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", receiveDate: "22.08.2024", progress: 0, amount: "11 200" },
  { id: "658472", status: "Просрочена", client: 'ООО "ГрузСервис"', car: "Skoda Octavia", plate: "X333OP777", master: "Власова Д.", masterPhoto: "https://i.pravatar.cc/80?img=49", receiveDate: "26.08.2024", progress: 20, amount: "63 000" },
  { id: "309845", status: "В архиве", client: 'ООО "ТехноТрак"', car: "Mitsubishi Outlander", plate: "B999EK177", master: "Токарев Ф.", masterPhoto: "https://i.pravatar.cc/80?img=52", receiveDate: "28.08.2024", progress: 100, amount: "88 750" },
  { id: "208476", status: "Ожидание", client: "Гаврилова Ирина Михайловна", car: "Subaru Forester", plate: "K111CX190", master: "Захарова И.", masterPhoto: "https://i.pravatar.cc/80?img=58", receiveDate: "30.08.2024", progress: 40, amount: "2 800" },
  { id: "989923", status: "Новая заявка", client: 'ООО "ЭкспрессТранс"', car: "Mercedes-Benz Sprinter", plate: "Y777AY197", master: "Фролов А.", masterPhoto: "https://i.pravatar.cc/80?img=53", receiveDate: "02.09.2024", progress: 0, amount: "19 990" },
];

function SidebarIcon({ type }: { type: "home" | "cube" | "layers" | "chat" | "pie" | "grid" | "doc" | "user" }) {
  const cls = "h-[28px] w-[28px]";
  if (type === "home") return <svg viewBox="0 0 24 24" fill="none" className={cls}><path d="M4 10.5L12 4L20 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><path d="M6 9.8V20H18V9.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  if (type === "cube") return <svg viewBox="0 0 24 24" fill="none" className={cls}><path d="M12 3L4.5 7.2V16.8L12 21L19.5 16.8V7.2L12 3Z" stroke="currentColor" strokeWidth="1.8" /><path d="M4.5 7.2L12 11.4L19.5 7.2" stroke="currentColor" strokeWidth="1.8" /></svg>;
  if (type === "layers") return <svg viewBox="0 0 24 24" fill="none" className={cls}><path d="M12 4L4 8L12 12L20 8L12 4Z" stroke="currentColor" strokeWidth="1.8" /><path d="M4 12L12 16L20 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  if (type === "chat") return <svg viewBox="0 0 24 24" fill="none" className={cls}><rect x="4" y="5" width="16" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" /><path d="M9 16L7 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
  if (type === "pie") return <svg viewBox="0 0 24 24" fill="none" className={cls}><path d="M12 4V12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /><circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" /></svg>;
  if (type === "grid") return <svg viewBox="0 0 24 24" fill="none" className={cls}><rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" /><rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" /></svg>;
  if (type === "doc") return <svg viewBox="0 0 24 24" fill="none" className={cls}><path d="M7 4H14L18 8V20H7V4Z" stroke="currentColor" strokeWidth="1.8" /><path d="M14 4V8H18" stroke="currentColor" strokeWidth="1.8" /></svg>;
  return <svg viewBox="0 0 24 24" fill="none" className={cls}><circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" /><path d="M5 20C6.5 17 8.8 15.5 12 15.5C15.2 15.5 17.5 17 19 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" /></svg>;
}

export function RequestsListPage() {
  const navigate = useNavigate();

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
      <div className="flex h-full w-full p-2">
        <div className="flex h-full w-full rounded-[16px] bg-black p-2 shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)]">
          <aside className="mr-2 flex w-[100px] flex-col items-center rounded-[11px] bg-black">
            <button className="mb-2 grid h-[90px] w-full place-items-center rounded-[16px] bg-[#EC1C24] text-[18px] font-semibold text-white">Марс</button>
            <button className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] bg-white text-[#11131D]"><SidebarIcon type="home" /></button>
            <button className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><SidebarIcon type="cube" /></button>
            <button className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><SidebarIcon type="layers" /></button>
            <button className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><SidebarIcon type="chat" /></button>
            <button className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><SidebarIcon type="pie" /></button>
            <div className="mt-auto space-y-2">
              <button className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><SidebarIcon type="grid" /></button>
              <button className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><SidebarIcon type="doc" /></button>
              <button className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><SidebarIcon type="user" /></button>
            </div>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col">
            <header className="mb-2 rounded-[16px] border border-[#DDE1E7] bg-white px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[36px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">Заявки</h1>
                  <span className="text-[16px] font-medium tracking-[-0.04em] text-[#B4B4B6]">15 заявок</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <input
                    className="h-12 w-[320px] rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-[#8A8A8A] outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Найти по номеру заявки..."
                  />
                  <button className="h-12 rounded-[10px] bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white">Создать заявку</button>
                </div>
              </div>
            </header>

            <section className="flex min-h-0 flex-1 flex-col gap-5 rounded-[16px] border border-[#DDE1E7] bg-white px-5 py-5">
              <div className="flex items-center gap-[10px]">
                {[
                  { label: "Статус", active: true },
                  { label: "Мастер", active: false },
                  { label: "Дата приема", active: false },
                  { label: "Сумма", active: false },
                ].map((filter) => (
                  <button
                    key={filter.label}
                    className={`rounded-[16px] px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] ${
                      filter.active ? "bg-[#F31624] text-white" : "bg-[#ECECEF] text-[#111111]"
                    }`}
                  >
                    <span className="flex items-center justify-center gap-[12px]">
                      <span>{filter.label}</span>
                      <svg viewBox="0 0 16 16" fill="none" className={`h-[16px] w-[16px] ${filter.active ? "text-white" : "text-[#111111]"}`}>
                        <path d="M3 6L8 11L13 6" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </span>
                  </button>
                ))}
                <button className="ml-auto rounded-[16px] bg-[#ECECEF] px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] text-[#111111]">
                  Сбросить фильтры
                </button>
              </div>

              <div className="min-h-0 flex-1 overflow-hidden rounded-lg bg-white">
                <div className="h-full overflow-x-auto overflow-y-hidden">
                  <table className="min-w-full border-separate border-spacing-0 text-[16px] font-medium tracking-[-0.04em]">
                    <thead className="bg-[#F3F3F5] text-left text-[16px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                      <tr>
                        <th className="rounded-l-[5px] px-3 py-2.5 font-medium">
                          <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-[2px] border-[#D8DBDE]" />
                        </th>
                        <th className="px-4 py-2.5 font-medium">ID</th>
                        <th className="px-4 py-2.5 font-medium">Статус</th>
                        <th className="px-4 py-2.5 font-medium">Клиент</th>
                        <th className="px-4 py-2.5 font-medium">Автомобиль</th>
                        <th className="px-4 py-2.5 font-medium">Гос. номер</th>
                        <th className="px-4 py-2.5 font-medium">Мастер</th>
                        <th className="px-4 py-2.5 font-medium">Дата приёма</th>
                        <th className="px-4 py-2.5 font-medium">Готовность</th>
                        <th className="px-4 py-2.5 font-medium text-left">Сумма</th>
                        <th className="rounded-r-[5px] px-4 py-2.5 font-medium text-center">⋮</th>
                      </tr>
                    </thead>
                    <tbody>
                      {requestRows.map((row, index) => (
                        <tr
                          key={`${row.id}-${row.master}-${row.receiveDate}`}
                          onClick={() => navigate("/requests/943837")}
                          className={`cursor-pointer border-[5px] border-[#EEEDF0] transition hover:bg-[rgba(224,9,25,0.10)] ${row.id === "839022" ? "bg-[rgba(224,9,25,0.10)]" : index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white"}`}
                        >
                          <td className="px-3 py-3">
                            {row.id === "839022" ? (
                              <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[#d51a21] text-white">
                                <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5">
                                  <path d="M3 8L6.2 11L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                </svg>
                              </span>
                            ) : (
                              <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-[2px] border-[#D8DBDE]" />
                            )}
                          </td>
                          <td className="px-4 py-3 text-black">{row.id}</td>
                          <td className="px-4 py-3 font-medium">
                            <span className="inline-flex items-center gap-2 text-black font-medium">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: requestStatusColorMap[row.status] }} />
                              <span className="text-black font-medium">{row.status}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-black">{row.client}</td>
                          <td className="px-4 py-3 text-black">{row.car}</td>
                          <td className="px-4 py-3 text-black">{row.plate}</td>
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-2.5">
                              <img
                                src={row.masterPhoto}
                                alt={`Фотография ${row.master}`}
                                width={24}
                                height={24}
                                className="h-6 w-6 rounded-full object-cover"
                              />
                              <span className="text-black font-medium">{row.master}</span>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-black">{row.receiveDate}</td>
                          <td className="px-4 py-3 text-black">{row.progress}%</td>
                          <td className="px-4 py-3 text-left font-medium text-black">{row.amount} ₽</td>
                          <td className="px-4 py-3 text-center text-[#A0A0A0]">...</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="px-4 pb-1 pt-2">
                  <div className="h-1 rounded-full bg-[#EEEDF0]" />
                </div>
              </div>

              <div className="flex items-center">
                <button className="rounded-[8px] bg-white px-2 py-1 text-[20px] font-bold tracking-[-0.04em] text-black">25 / стр ▼</button>
                <div className="mx-auto block w-fit rounded-full bg-[#11131D] p-1 text-[12px]">
                  <button className="rounded-full px-5 py-2 text-[16px] font-bold tracking-[-0.04em] text-white">Действие</button>
                  <button className="rounded-full bg-white px-5 py-2 text-[16px] font-bold tracking-[-0.04em] text-[#11131D]">Сохранить</button>
                </div>
                <div className="flex items-center gap-2 text-[20px] font-bold tracking-[-0.04em] text-black">
                  <span>1 - 70 из 70</span>
                  <button>‹</button>
                  <button>›</button>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
