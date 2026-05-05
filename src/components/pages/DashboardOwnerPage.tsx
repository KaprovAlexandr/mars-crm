import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import { CURRENT_USER_ROLE } from "@/lib/session/currentUser";
import { useNavigate } from "react-router-dom";

const ownerKpis = [
  { label: "Всего записей", value: "486", delta: "↑ +12 (+4%) за неделю" },
  { label: "Выполнено", value: "372", delta: "↑ +12 (+10%) за неделю" },
  { label: "Записей/день", value: "16.5", delta: "↑ +1.2 (+1%) за неделю" },
  { label: "Общий доход", value: "5 842 000 ₽", delta: "↑ +5 600 ₽ (+4%) за неделю" },
  { label: "Средний чек", value: "15 704 ₽", delta: "↑ +12 (+4%) за неделю" },
  { label: "Чистая прибыль", value: "1 462 000 ₽", delta: "↑ +12 (+10%) за неделю" },
  { label: "Рентабельность", value: "25.0%", delta: "↑ +1.2 (+1%) за неделю" },
  { label: "Конверсия", value: "76.5%", delta: "↑ +5 600 ₽ (+4%) за неделю" },
];

const revenueSeries = [20, 23, 22, 18, 18, 24, 23, 22, 24, 26, 33, 34, 35, 36, 31, 27, 28, 28, 26, 27, 28, 29];

const workTypeRows = [
  { label: "Замена масла", value: 120, percent: "30%", color: "#3A8DDE" },
  { label: "Диагностика", value: 65, percent: "15%", color: "#D2D5DC" },
  { label: "Замена тормозных колодок", value: 50, percent: "20%", color: "#48BFD2" },
  { label: "Ремонт подвески", value: 40, percent: "10%", color: "#31A56E" },
  { label: "Замена аккумулятора", value: 70, percent: "19%", color: "#8D5BCF" },
  { label: "Проверка давления в шинах", value: 60, percent: "15%", color: "#D19237" },
];

export function DashboardOwnerPage() {
  const navigate = useNavigate();
  const isManager = CURRENT_USER_ROLE === "manager";

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
      <div className="flex h-full w-full p-2">
        <div className="flex h-full w-full rounded-[16px] bg-black p-2">
          <aside className="mr-2 flex w-[100px] flex-col items-center rounded-[11px] bg-black">
            <button className="mb-2 grid h-[90px] w-full place-items-center rounded-[16px] bg-[#EC1C24] text-[18px] font-semibold text-white">Марс</button>
            <button className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] bg-white text-[#11131D]"><MarsShellSidebarIcon type="home" /></button>
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
              <div className="flex items-center">
                <h1 className="text-[36px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">Дашборд руководителя</h1>
                <button className="ml-auto h-12 rounded-[10px] bg-[#E00919] px-4 text-[16px] font-medium tracking-[-0.04em] text-white">
                  Сформировать отчет
                </button>
              </div>
            </header>

            <section className="flex min-h-0 flex-1 flex-col gap-4 rounded-[16px] border border-[#DDE1E7] bg-white px-5 py-5">
              <div className="rounded-[10px] bg-[#F3F3F5] px-4 py-4">
                <div className="grid grid-cols-4 gap-3">
                {ownerKpis.map((kpi) => (
                  <article key={kpi.label} className="rounded-[12px] bg-white px-4 py-3">
                    <p className="text-[20px] font-medium tracking-[-0.04em] text-[#171717]">{kpi.label}</p>
                    <p className="mt-3 text-[52px] font-medium leading-none tracking-[-0.04em] text-[#E00919]">{kpi.value}</p>
                    <p className="mt-2 text-[14px] font-medium text-[#8D8D95]">{kpi.delta}</p>
                  </article>
                ))}
                </div>
              </div>

              <div className="grid min-h-0 flex-1 grid-cols-[50%_50%] gap-3 overflow-hidden">
                <article className="flex min-h-0 flex-col rounded-[10px] bg-[#F3F3F5] px-4 py-4">
                  <div className="mb-3 flex items-center justify-between">
                    <h2 className="text-[20px] font-semibold text-[#111]">График</h2>
                    <div className="flex items-center gap-2">
                      <button className="rounded-[8px] bg-[#d51a21] px-3 py-1 text-[12px] font-medium text-white">Месяц</button>
                      <button className="rounded-[8px] bg-white px-3 py-1 text-[12px] font-medium text-[#444]">Квартал</button>
                      <button className="rounded-[8px] bg-white px-3 py-1 text-[12px] font-medium text-[#444]">Год</button>
                    </div>
                  </div>
                  <div className="min-h-0 flex-1 rounded-[10px] bg-white p-3">
                    <svg viewBox="0 0 980 280" className="h-full w-full">
                      <defs>
                        <linearGradient id="ownerArea" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="#E00919" stopOpacity="0.22" />
                          <stop offset="100%" stopColor="#E00919" stopOpacity="0.04" />
                        </linearGradient>
                      </defs>
                      <g>
                        {[0, 1, 2, 3, 4].map((i) => (
                          <line key={i} x1="40" y1={30 + i * 50} x2="940" y2={30 + i * 50} stroke="#ECEDEF" />
                        ))}
                        <text x="10" y="235" className="fill-[#8C93A3] text-[11px]">5</text>
                        <text x="10" y="185" className="fill-[#8C93A3] text-[11px]">15</text>
                        <text x="10" y="135" className="fill-[#8C93A3] text-[11px]">25</text>
                        <text x="10" y="85" className="fill-[#8C93A3] text-[11px]">35</text>
                        <text x="10" y="35" className="fill-[#8C93A3] text-[11px]">45</text>
                      </g>

                      {(() => {
                        const stepX = 900 / (revenueSeries.length - 1);
                        const points = revenueSeries
                          .map((v, idx) => {
                            const x = 40 + idx * stepX;
                            const y = 240 - ((v - 5) / 40) * 210;
                            return `${x},${y}`;
                          })
                          .join(" ");
                        const area = `40,240 ${points} 940,240`;
                        const focusIndex = 14;
                        const fx = 40 + focusIndex * stepX;
                        const fy = 240 - ((revenueSeries[focusIndex] - 5) / 40) * 210;
                        return (
                          <>
                            <rect x={fx - 34} y="25" width="68" height="215" fill="#E00919" opacity="0.06" />
                            <polygon points={area} fill="url(#ownerArea)" />
                            <polyline points={points} fill="none" stroke="#E00919" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                            <circle cx={fx} cy={fy} r="4.5" fill="#E00919" />
                            <line x1={fx} y1={fy + 7} x2={fx} y2={212} stroke="#E00919" strokeDasharray="4 4" />
                            <rect x={fx - 84} y={fy - 64} width="130" height="52" rx="8" fill="#2E2E33" />
                            <text x={fx - 74} y={fy - 43} className="fill-white text-[11px]">05 августа, 2025</text>
                            <text x={fx - 74} y={fy - 24} className="fill-white text-[11px]">31 100 ₽</text>
                          </>
                        );
                      })()}

                      <g className="fill-[#8C93A3] text-[11px]">
                        <text x="90" y="265">03.08</text>
                        <text x="230" y="265">04.08</text>
                        <text x="370" y="265">05.08</text>
                        <text x="510" y="265">06.08</text>
                        <text x="650" y="265">07.08</text>
                        <text x="790" y="265">08.08</text>
                        <text x="900" y="265">09.08</text>
                      </g>
                    </svg>
                  </div>
                </article>

                <article className="min-h-0 rounded-[10px] bg-[#F3F3F5] px-4 py-4">
                  <h2 className="mb-3 text-[20px] font-semibold text-[#111]">Типы работ</h2>
                  <div className="flex h-[calc(100%-44px)] min-h-0 rounded-[10px] bg-white p-4">
                    <div className="flex w-[46%] min-w-[260px] items-center justify-center">
                      <div className="relative h-[210px] w-[210px]">
                        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
                          <circle cx="60" cy="60" r="46" fill="none" stroke="#EEF0F4" strokeWidth="6" />
                          <circle cx="60" cy="60" r="46" fill="none" stroke="#3A8DDE" strokeWidth="6" strokeLinecap="round" strokeDasharray="95 289" strokeDashoffset="0" />
                          <circle cx="60" cy="60" r="46" fill="none" stroke="#D2D5DC" strokeWidth="6" strokeLinecap="round" strokeDasharray="38 289" strokeDashoffset="-101" />
                          <circle cx="60" cy="60" r="46" fill="none" stroke="#48BFD2" strokeWidth="6" strokeLinecap="round" strokeDasharray="57 289" strokeDashoffset="-145" />
                          <circle cx="60" cy="60" r="46" fill="none" stroke="#31A56E" strokeWidth="6" strokeLinecap="round" strokeDasharray="31 289" strokeDashoffset="-208" />
                          <circle cx="60" cy="60" r="46" fill="none" stroke="#8D5BCF" strokeWidth="6" strokeLinecap="round" strokeDasharray="54 289" strokeDashoffset="-245" />
                          <circle cx="60" cy="60" r="46" fill="none" stroke="#D19237" strokeWidth="6" strokeLinecap="round" strokeDasharray="44 289" strokeDashoffset="-305" />
                        </svg>
                        <div className="absolute inset-0 grid place-items-center text-center">
                          <div>
                            <p className="text-[34px] font-semibold leading-none text-[#222]">427</p>
                            <p className="mt-1 text-[11px] text-[#9A9EA8]">Всего заявок</p>
                          </div>
                        </div>
                      </div>
                    </div>
                    <div className="min-w-0 flex-1 pt-3">
                      <div className="space-y-3">
                        {workTypeRows.map((row) => (
                          <div key={row.label} className="grid grid-cols-[10px_1fr_auto_auto] items-center gap-2">
                            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: row.color }} />
                            <span className="truncate text-[12px] text-[#4A4F59]">{row.label}</span>
                            <span className="text-[12px] text-[#8E949F]">{row.value}</span>
                            <span className="text-[12px] text-[#8E949F]">{row.percent}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </article>
              </div>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
