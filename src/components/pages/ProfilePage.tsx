import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import { CURRENT_USER_ROLE } from "@/lib/session/currentUser";
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

const privateProfileFields = [
  { key: "passportSeries", label: "Паспорт (серия)", value: "40 12" },
  { key: "passportNumber", label: "Паспорт (номер)", value: "345678" },
  { key: "inn", label: "ИНН", value: "12-28-087306-08" },
  { key: "snils", label: "СНИЛС", value: "112-233-445 95" },
] as const;

const employeeKpiCards = [
  { title: "Выручка сотрудника", value: "185 000 ₽ за месяц", note: "↑ +12 (+10%) за неделю" },
  { title: "Выработка (нормо-часы)", value: "120 ч / 160 ч", note: "↑ +12 (+10%) за неделю" },
  { title: "Загрузка (%)", value: "75%", note: "↑ +12 (+10%) за неделю" },
  { title: "Кол-во заказов", value: "18 заказов", note: "↑ +12 (+10%) за неделю" },
  { title: "Зарплата (расчёт)", value: "42 500 ₽", note: "↑ +12 (+10%) за неделю" },
  { title: "Доп. продажи (очень важно)", value: "+25 000 ₽", note: "↑ +12 (+10%) за неделю" },
];

export function ProfilePage() {
  const navigate = useNavigate();
  const isManager = CURRENT_USER_ROLE === "manager";

  return (
    <div className="h-screen w-screen overflow-hidden bg-black tracking-[-0.04em]">
      <div className="flex h-full w-full p-2">
        <div className="flex h-full w-full rounded-[16px] bg-black p-2">
          <aside className="mr-2 flex w-[100px] flex-col items-center rounded-[11px] bg-black">
            <button className="mb-2 grid h-[90px] w-full place-items-center rounded-[16px] bg-[#EC1C24] text-[18px] font-semibold text-white">Марс</button>
            <button onClick={() => navigate("/dashboard")} className="mb-2 grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="home" /></button>
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
                  <span className="text-[16px] font-medium tracking-[-0.04em] text-[#B4B4B6]">Сотрудник</span>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <input
                    className="h-12 w-[320px] rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-[#8A8A8A] outline-none placeholder:text-[#B5B5B5]"
                    placeholder="Поиск по профилю..."
                  />
                  <button className="h-12 rounded-[10px] bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white">
                    Редактировать
                  </button>
                </div>
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
                    {publicProfileFields.map((field) => (
                      <div key={field.label} className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3">
                        <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">{field.label}</p>
                        <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">{field.value}</p>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="mt-[50px]">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                    {privateProfileFields.map((field) => (
                      <div key={field.key} className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3">
                        <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">{field.label}</p>
                        <p className="mt-1 min-w-0 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">
                          <span className="truncate">{field.value}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
                <button className="absolute bottom-4 left-4 grid h-12 w-12 place-items-center rounded-[10px] bg-[#F3F3F5] text-[#8C909C]">
                  <svg viewBox="0 0 24 24" fill="none" className="h-[28px] w-[28px]">
                    <path d="M9.5 3.5H14.5L15.3 5.65C15.58 5.74 15.86 5.86 16.13 6L18.23 5.13L20.73 7.63L19.86 9.73C20 10 20.12 10.28 20.21 10.56L22.36 11.34V14.34L20.21 15.12C20.12 15.4 20 15.68 19.86 15.95L20.73 18.05L18.23 20.55L16.13 19.68C15.86 19.82 15.58 19.94 15.3 20.03L14.5 22.18H9.5L8.72 20.03C8.44 19.94 8.16 19.82 7.89 19.68L5.79 20.55L3.29 18.05L4.16 15.95C4.02 15.68 3.9 15.4 3.81 15.12L1.66 14.34V11.34L3.81 10.56C3.9 10.28 4.02 10 4.16 9.73L3.29 7.63L5.79 5.13L7.89 6C8.16 5.86 8.44 5.74 8.72 5.65L9.5 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <circle cx="12" cy="12.84" r="2.8" stroke="currentColor" strokeWidth="1.8" />
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
                  {[
                    { label: "KPI", active: true },
                    { label: "Рейтинг сотрудников", active: false },
                  ].map((tab) => (
                    <button
                      key={tab.label}
                      type="button"
                      className={`rounded-full px-4 py-2 text-[14px] font-medium tracking-[-0.02em] text-black ${
                        tab.active ? "bg-[#F8F8FA]" : "bg-transparent"
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <div className="mt-[107px] grid grid-cols-2 gap-3">
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
              </section>
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
