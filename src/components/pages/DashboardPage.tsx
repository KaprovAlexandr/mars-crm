import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import { CURRENT_USER_ROLE } from "@/lib/session/currentUser";
import { useNavigate } from "react-router-dom";

const statusCards = [
  { label: "Новые заявки", value: 12 },
  { label: "Просроченные заявки", value: 5 },
  { label: "В работе", value: 8 },
  { label: "Завершено", value: 27 },
];

type ManagerRequestRow = {
  id: string;
  status: "Новая заявка" | "Просроченная заявка" | "В работе" | "Завершена";
  client: string;
  car: string;
  plate: string;
  master: string;
  masterPhoto: string;
  receiveDate: string;
  progress: number;
  amount: string;
};

const managerStatusColorMap: Record<ManagerRequestRow["status"], string> = {
  "Новая заявка": "#00B515",
  "Просроченная заявка": "#E00919",
  "В работе": "#F39D00",
  Завершена: "#ACACAC",
};

const myRequests: ManagerRequestRow[] = [
  { id: "294894", status: "Новая заявка", client: "Иванов Артём Сергеевич", car: "Toyota Corolla", plate: "A123BC777", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", receiveDate: "03.08.2024", progress: 0, amount: "1200" },
  { id: "593423", status: "Завершена", client: "Смирнова Наталья Викторовна", car: "Hyundai Solaris", plate: "M456KX199", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", receiveDate: "05.08.2024", progress: 100, amount: "3 500" },
  { id: "839022", status: "Просроченная заявка", client: 'ООО "Сад"', car: "LADA Vesta", plate: "O789EH750", master: "Кириллов О.", masterPhoto: "https://i.pravatar.cc/80?img=14", receiveDate: "08.08.2024", progress: 30, amount: "7 900" },
  { id: "847952", status: "Новая заявка", client: "ИП Лебедев Максим Олегович", car: "Kia Rio", plate: "T321OP197", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", receiveDate: "13.08.2024", progress: 0, amount: "14 500" },
  { id: "495783", status: "В работе", client: 'ООО "ЭкоМобил"', car: "Renault Duster", plate: "Y654HC777", master: "Тимофеев А.", masterPhoto: "https://i.pravatar.cc/80?img=47", receiveDate: "15.08.2024", progress: 60, amount: "22 300" },
];

export function DashboardPage() {
  const navigate = useNavigate();
  const isManager = CURRENT_USER_ROLE === "manager";

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
      <div className="flex h-full w-full p-2">
        <div className="flex h-full w-full rounded-[16px] bg-black p-2">
          <aside className="mr-2 flex w-[100px] flex-col items-center rounded-[11px] bg-black">
            <button className="mb-2 grid h-[90px] w-full place-items-center rounded-[16px] bg-[#EC1C24] text-[18px] font-semibold text-white">Марс</button>
            <button className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] bg-white text-[#11131D]">
              <MarsShellSidebarIcon type="home" />
            </button>
            <button onClick={() => navigate("/")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="cube" /></button>
            <button onClick={() => navigate("/journal")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="layers" /></button>
            <button onClick={() => navigate("/work-orders")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="chat" /></button>
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
                <h1 className="text-[36px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">Дашборд менеджера</h1>
                <div className="ml-auto flex items-center gap-1.5">
                  <input
                    className="h-12 w-[320px] rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-[#8A8A8A] outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Найти по номеру заявки..."
                  />
                  <button className="h-12 rounded-[10px] bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white">Создать заявку</button>
                </div>
              </div>
            </header>

            <section className="flex min-h-0 flex-1 flex-col rounded-[16px] border border-[#DDE1E7] bg-white px-5 py-5">
              <div className="rounded-[10px] bg-[#F3F3F5] px-4 py-4">
                <div className="flex justify-between gap-5">
                {statusCards.map((card) => (
                  <article key={card.label} className="flex-1 rounded-[12px] bg-white px-4 py-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[20px] font-medium leading-none tracking-[-0.04em] text-[#111]">{card.label}</p>
                      <button className="rounded-[8px] border border-[#E4E5E7] bg-white px-2 py-1 text-[12px] font-medium text-[#666]">
                        Отфильтровать
                      </button>
                    </div>
                    <p className="mt-3 text-[70px] font-medium leading-none tracking-[-0.04em] text-[#E00919]">{card.value}</p>
                  </article>
                ))}
                </div>
              </div>

              <div className="mt-5 min-h-0 flex-1 w-full p-0">
                <h2 className="mb-3 text-[20px] font-semibold text-[#111]">Мои заявки</h2>
                <div className="overflow-hidden rounded-[10px] bg-white">
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
                      {myRequests.map((row, index) => (
                        <tr
                          key={`${row.id}-${row.master}`}
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
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: managerStatusColorMap[row.status] }} />
                              <span className="text-black font-medium">{row.status}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-black">{row.client}</td>
                          <td className="px-4 py-3 text-black">{row.car}</td>
                          <td className="px-4 py-3 text-black">{row.plate}</td>
                          <td className="px-4 py-3 font-medium">
                            <div className="flex items-center gap-2.5">
                              <img src={row.masterPhoto} alt={`Фотография ${row.master}`} width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
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
              </div>

              <div className="mt-auto flex items-center pt-5">
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
