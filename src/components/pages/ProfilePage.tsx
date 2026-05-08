import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import { CURRENT_USER_ROLE } from "@/lib/session/currentUser";
import { useState } from "react";
import { useNavigate } from "react-router-dom";

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
  { label: "Дата рождения", value: "14.02.1992" },
  { label: "Пол", value: "Мужской" },
  { label: "Гражданство", value: "Российская Федерация" },
  { label: "Телефон", value: "+7 (911) 123-45-67" },
  { label: "E-mail", value: "example@post.ru" },
  { label: "Должность", value: "Менеджер по работе с клиентами" },
  { label: "График работы", value: "5/2, 09:00 - 18:00" },
  { label: "Статус", value: "В отпуске" },
];

const employeeKpiCards = [
  { title: "Выручка сотрудника", value: "185 000 ₽ за месяц", note: "↑ +12 (+10%) за неделю" },
  { title: "Выработка (нормо-часы)", value: "120 ч / 160 ч", note: "↑ +12 (+10%) за неделю" },
  { title: "Загрузка (%)", value: "75%", note: "↑ +12 (+10%) за неделю" },
  { title: "Кол-во заказов", value: "18 заказов", note: "↑ +12 (+10%) за неделю" },
  { title: "Зарплата (расчёт)", value: "42 500 ₽", note: "↑ +12 (+10%) за неделю" },
  { title: "Доп. продажи (очень важно)", value: "+25 000 ₽", note: "↑ +12 (+10%) за неделю" },
];
const employeeTableRows = [
  { id: "E-001", fio: "Капров Александр Николаевич", role: "Менеджер", status: "В отпуске", schedule: "5/2, 09:00 - 18:00" },
  { id: "E-014", fio: "Журавлёв Михаил Дмитриевич", role: "Мастер", status: "На смене", schedule: "2/2, 08:00 - 20:00" },
  { id: "E-023", fio: "Семёнова Елена Петровна", role: "Администратор", status: "На смене", schedule: "5/2, 10:00 - 19:00" },
  { id: "E-031", fio: "Кузнецов Евгений Игоревич", role: "Мастер", status: "Выходной", schedule: "2/2, 08:00 - 20:00" },
];

export function ProfilePage() {
  const navigate = useNavigate();
  const isManager = CURRENT_USER_ROLE === "manager";
  const [isEditingFields, setIsEditingFields] = useState(false);
  const [publicFields, setPublicFields] = useState(() => publicProfileFields.map((f) => ({ ...f })));
  const [activeRightTab, setActiveRightTab] = useState<"kpi" | "staff">("kpi");

  return (
    <div className="h-screen w-screen overflow-hidden bg-black tracking-[-0.04em]">
      <div className="flex h-full w-full p-2">
        <div className="flex h-full w-full rounded-[16px] bg-black p-2">
          <aside className="mr-2 flex w-[100px] flex-col items-center rounded-[11px] bg-black">
            <button className="mb-2 grid h-[90px] w-full place-items-center rounded-[16px] bg-[#EC1C24] text-[18px] font-semibold text-white">Марс</button>
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
              <button className="grid h-12 w-12 place-items-center rounded-[10px] bg-white text-[#11131D]"><MarsShellSidebarIcon type="user" /></button>
            </div>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col">
            <header className="mb-2 rounded-[16px] border border-[#DDE1E7] bg-white px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[36px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">Профиль</h1>
                  <span className="text-[16px] font-bold tracking-[-0.04em] text-[#888888]">(менеджер)</span>
                </div>
                <div className="ml-auto h-12" />
              </div>
            </header>
            <section className="flex min-h-0 flex-1 gap-2">
              <section className="relative w-[40%] min-w-[360px] rounded-[16px] border border-[#DDE1E7] bg-white p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="max-w-[420px] text-[52px] font-semibold leading-[0.98] tracking-[-0.03em] text-[#202636]">
                      <span className="block whitespace-nowrap">Капров Александр</span>
                      <span className="block">Николаевич</span>
                    </h1>
                  </div>
                  <img
                    src="https://i.pravatar.cc/160?img=11"
                    alt="Фото профиля"
                    className="h-[72px] w-[72px] rounded-full object-cover"
                  />
                </div>
                <div className="mt-[50px]">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                    {publicFields.map((field, index) => (
                      <div
                        key={field.label}
                        style={{ transitionDelay: `${index * 24}ms`, transitionDuration: "350ms" }}
                        className={`h-[68px] rounded-[10px] border-2 px-4 py-3 transition-all duration-350 ease-out ${
                          isEditingFields ? "border-[#EC1C24] bg-white" : "border-transparent bg-[#F3F3F5]"
                        }`}
                      >
                        <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">{field.label}</p>
                        {isEditingFields ? (
                          <input
                            value={field.value}
                            onChange={(e) => {
                              const nextValue = e.target.value;
                              setPublicFields((prev) =>
                                prev.map((item) => (item.label === field.label ? { ...item, value: nextValue } : item)),
                              );
                            }}
                            className="mt-1 block w-full bg-transparent text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352] outline-none"
                          />
                        ) : (
                          <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">{field.value}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingFields((v) => !v)}
                  className={`absolute bottom-4 left-4 grid h-12 w-12 cursor-pointer place-items-center rounded-[10px] ${
                    isEditingFields ? "bg-[#EC1C24] text-white" : "bg-[#F3F3F5] text-[#8C909C]"
                  }`}
                  aria-label="Редактировать поля"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-[28px] w-[28px]">
                    <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M12.5 7l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <button className="absolute bottom-4 right-4 grid h-12 w-12 place-items-center rounded-[10px] bg-[#F3F3F5] text-[#8C909C]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-[28px] w-[28px]">
                    <path d="M10 4.5H6.5C5.4 4.5 4.5 5.4 4.5 6.5V17.5C4.5 18.6 5.4 19.5 6.5 19.5H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M14 8.5L18 12L14 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 12H18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </section>

              <section className="min-w-0 flex-1 rounded-[16px] border border-[#DDE1E7] bg-white p-6">
                <div className="inline-flex w-fit items-center gap-1 rounded-full p-1">
                  <button
                    type="button"
                    onClick={() => setActiveRightTab("kpi")}
                    className={`rounded-full px-4 py-2 text-[14px] font-medium tracking-[-0.02em] text-black ${
                      activeRightTab === "kpi" ? "bg-[#F8F8FA]" : "bg-transparent"
                    }`}
                  >
                    KPI
                  </button>
                  <button
                    type="button"
                    onClick={() => setActiveRightTab("staff")}
                    className={`rounded-full px-4 py-2 text-[14px] font-medium tracking-[-0.02em] text-black ${
                      activeRightTab === "staff" ? "bg-[#F8F8FA]" : "bg-transparent"
                    }`}
                  >
                    Таблица сотрудников
                  </button>
                </div>

                {activeRightTab === "kpi" ? (
                  <article className="relative mt-[152px]">
                    <div className="absolute left-0 top-0 -translate-y-full pb-3">
                      <div className="flex items-center">
                        <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Моя эффективность</h3>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                      {employeeKpiCards.map((card) => (
                        <article key={card.title} className="flex h-[128px] flex-col rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                          <div>
                            <p className="text-[16px] font-medium leading-none tracking-[-0.04em] text-[#1D2330]">{card.title}</p>
                          </div>
                          <div className="mt-auto">
                            <p className="text-[32px] font-medium leading-none tracking-[-0.04em] text-[#E00919]">{card.value}</p>
                            {card.note ? <p className="mt-1 text-[13px] font-medium tracking-[-0.04em] text-[#6F7785]">{card.note}</p> : null}
                          </div>
                        </article>
                      ))}
                    </div>
                  </article>
                ) : (
                  <article className="relative mt-[152px] min-h-0 flex-1 rounded-[12px] bg-transparent">
                    <div className="absolute left-0 top-0 -translate-y-full pb-3">
                      <div className="flex items-center">
                        <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Таблица сотрудников</h3>
                      </div>
                    </div>
                    <div className="overflow-hidden rounded-[12px] border border-[#EEEDF0]">
                      <table className="w-full table-fixed border-separate border-spacing-0 text-left text-[14px] tracking-[-0.02em] text-[#111826]">
                        <thead className="bg-[#F8F8FA] text-[13px] font-semibold text-[#6F7785]">
                          <tr>
                            <th className="px-4 py-3">ID</th>
                            <th className="px-4 py-3">ФИО</th>
                            <th className="px-4 py-3">Роль</th>
                            <th className="px-4 py-3">Статус</th>
                            <th className="px-4 py-3">График</th>
                          </tr>
                        </thead>
                        <tbody>
                          {employeeTableRows.map((row, index) => (
                            <tr key={row.id} className={index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white"}>
                              <td className="px-4 py-3 font-medium">{row.id}</td>
                              <td className="px-4 py-3">{row.fio}</td>
                              <td className="px-4 py-3">{row.role}</td>
                              <td className="px-4 py-3">{row.status}</td>
                              <td className="px-4 py-3">{row.schedule}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  </article>
                )}
              </section>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
