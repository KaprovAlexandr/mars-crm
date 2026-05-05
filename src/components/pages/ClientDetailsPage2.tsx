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
  { label: "ФИО", value: "Смирнова Наталья Викторовна" },
  { label: "Тип клиента", value: "Физ.лицо" },
  { label: "Телефон", value: "+7 (909) 999-99-99" },
  { label: "Статус", value: "Постоянный" },
  { label: "Email", value: "natalya@gmail.com" },
  { label: "История обращений", value: "3 заявки с 2023 года" },
  { label: "Адрес", value: "г. Москва, ул. Пушкина, д. 15, кв. 42" },
  { label: "Комментарий", value: "Не звонить после 19:00" },
  { label: "Для связи", value: "Telegram, WhatsApp" },
  { label: "Источник заявки", value: "Реклама баннера" },
];

const carProfileFields = [
  { label: "Марка и модель", value: "Hyundai Solaris" },
  { label: "Пробег", value: "87 500 км" },
  { label: "Гос.номер", value: "M456OT799 ⛓" },
  { label: "Тип кузова", value: "Седан" },
  { label: "VIN", value: "KMHC81BDXKU123456 ⛓" },
  { label: "Тип топлива", value: "Бензин" },
  { label: "Год выпуска", value: "2019" },
  { label: "Трансмиссия", value: "АКПП" },
  { label: "Цвет", value: "Серебристый" },
  { label: "Комментарий", value: "Царапина на бампере...Показать" },
];

const clientCars = [
  { name: "BMW M5 F90", orders: 8, amount: 120000, main: true },
  { name: "Lada Priora", orders: 4, amount: 28000, main: false },
  { name: "Kia Rio", orders: 6, amount: 74500, main: false },
  { name: "Skoda Octavia", orders: 5, amount: 91200, main: false },
  { name: "Renault Duster", orders: 3, amount: 39900, main: false },
  { name: "VW Polo", orders: 2, amount: 18700, main: false },
];

const carDocumentItems = [
  "Акт приёма-передачи автомобиля.pdf",
  "Заказ-наряд.pdf",
  "Диагностический протокол.docx",
  "Дефектовочная ведомость.docx",
  "Согласование цены.pdf",
  "Акт выполненных работ.pdf",
  "Кассовый чек.pdf",
  "Гарантийный талон.pdf",
];

const carPhotoItems = [
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

export function ClientDetailsPage2() {
  const navigate = useNavigate();
  const isManager = CURRENT_USER_ROLE === "manager";
  const [activeTab, setActiveTab] = useState<"client" | "car">("client");
  const [activeClientPanel, setActiveClientPanel] = useState<"main" | "cars">("main");
  const [activeCarPanel, setActiveCarPanel] = useState<"orders" | "documents" | "photos">("documents");
  const visibleFields = activeTab === "client" ? publicProfileFields : carProfileFields;
  const totalOrders = clientCars.reduce((sum, car) => sum + car.orders, 0);
  const totalAmount = clientCars.reduce((sum, car) => sum + car.amount, 0);
  const averageCheck = totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0;
  const formatCurrency = (value: number) => `${value.toLocaleString("ru-RU")} ₽`;

  return (
    <div className="h-screen w-screen overflow-hidden bg-black tracking-[-0.02em]">
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
            <header className="mb-2 rounded-[16px] bg-white px-5 py-5">
              <div className="flex items-center gap-3">
                <h1 className="text-[36px] font-bold leading-[100%] tracking-[-0.02em] text-[#111826]">Клиент №23912</h1>
                <div className="ml-auto flex items-center gap-1.5">
                  <input
                    className="h-12 w-[320px] rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.02em] text-[#8A8A8A] outline-none placeholder:text-[#B5B5B5]"
                    placeholder={activeTab === "client" ? "Поиск автомобиля клиента..." : "Поиск заказ-наряда..."}
                  />
                  <button className="h-12 rounded-[10px] bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.02em] text-white">
                    Позвонить клиенту
                  </button>
                  <button className="h-12 rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-4 text-[18px] font-medium tracking-[-0.02em] text-[#111826]">
                    Создать заказ-наряд
                  </button>
                </div>
              </div>
            </header>

            <section className="flex min-h-0 flex-1 gap-2">
              <section className="relative w-[40%] min-w-[360px] rounded-[16px] bg-white p-6">
                <div>
                  <div
                    style={{ transitionDelay: "0ms" }}
                    className="flex items-start justify-between gap-4 transition-all duration-350 ease-out"
                  >
                    <div>
                      <h1 className="max-w-[420px] text-[52px] font-semibold leading-[0.98] tracking-[-0.03em] text-[#202636]">
                        {activeTab === "client" ? (
                          <>
                            <span className="block whitespace-nowrap">Иванов Александр</span>
                            <span className="block">Сергеевич</span>
                          </>
                        ) : (
                          <>
                            <span className="block whitespace-nowrap">BMW M5 F90</span>
                            <span className="block">Competition</span>
                          </>
                        )}
                      </h1>
                    </div>
                    <button className="grid h-12 w-12 place-items-center rounded-[10px] bg-[#F3F3F5] text-[#8C909C]">
                      <svg viewBox="0 0 24 24" fill="none" className="h-[28px] w-[28px]">
                        <path d="M9.5 3.5H14.5L15.3 5.65C15.58 5.74 15.86 5.86 16.13 6L18.23 5.13L20.73 7.63L19.86 9.73C20 10 20.12 10.28 20.21 10.56L22.36 11.34V14.34L20.21 15.12C20.12 15.4 20 15.68 19.86 15.95L20.73 18.05L18.23 20.55L16.13 19.68C15.86 19.82 15.58 19.94 15.3 20.03L14.5 22.18H9.5L8.72 20.03C8.44 19.94 8.16 19.82 7.89 19.68L5.79 20.55L3.29 18.05L4.16 15.95C4.02 15.68 3.9 15.4 3.81 15.12L1.66 14.34V11.34L3.81 10.56C3.9 10.28 4.02 10 4.16 9.73L3.29 7.63L5.79 5.13L7.89 6C8.16 5.86 8.44 5.74 8.72 5.65L9.5 3.5Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                        <circle cx="12" cy="12.84" r="2.8" stroke="currentColor" strokeWidth="1.8" />
                      </svg>
                    </button>
                  </div>
                  <div className="mt-[50px]">
                    <div className="grid grid-cols-2 gap-x-3 gap-y-4">
                      {visibleFields.map((field, index) => (
                        <div
                          key={field.label}
                          style={{
                            transitionDelay:
                              activeTab === "client"
                                ? `${index * 24}ms`
                                : `${(visibleFields.length - 1 - index) * 18}ms`,
                            transitionDuration: activeTab === "client" ? "350ms" : "240ms",
                          }}
                          className="h-[68px] rounded-[10px] bg-[#F3F3F5] px-4 py-3 transition-all duration-350 ease-out"
                        >
                          <p className="text-[11px] tracking-[0.04em] text-[#A4ABBA]">{field.label}</p>
                          <p className="mt-1 text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352]">{field.value}</p>
                        </div>
                      ))}
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

              <section className="min-w-0 flex-1 rounded-[16px] bg-white p-6">
                <div className="flex h-full min-h-0 flex-col">
                  <div className="inline-flex w-fit items-center gap-1 rounded-full p-1">
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
                          <div className="mt-[107px] grid grid-cols-3 gap-3">
                            {[
                              ["Заказ-наряды", String(totalOrders), "за всё время"],
                              ["Общая сумма", formatCurrency(totalAmount), "за всё время"],
                              ["Средний чек", formatCurrency(averageCheck), "за всё время"],
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

                          <article className="relative mt-[40px] min-h-0 w-full overflow-hidden rounded-t-[12px] rounded-b-none bg-transparent">
                            <div className="mb-3 flex items-center">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Текущая активность</h3>
                            </div>
                            <div className="hide-scrollbar h-[420px] min-w-0 space-y-4 overflow-y-auto overflow-x-hidden rounded-t-[10px] rounded-b-none bg-transparent pr-1 pb-4">
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
                                    <button className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EC1C24] text-white">
                                      <img src="/go_to.svg" alt="" className="h-[17px] w-5" />
                                    </button>
                                  </article>
                                );
                              })}
                            </div>
                          </article>
                        </>
                      ) : (
                        <article className="relative order-2 mt-[107px] min-h-0 flex-1 rounded-[12px] bg-transparent">
                          <div className="absolute left-0 top-0 -translate-y-full pb-3">
                            <div className="flex items-center">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Автомобили клиента</h3>
                            </div>
                          </div>
                          <div className="hide-scrollbar min-h-0 min-w-0 max-h-[598px] space-y-4 overflow-y-auto overflow-x-hidden rounded-lg bg-transparent pr-1">
                            {clientCarListItems.map((item) => {
                              const [model, orders] = item.split(" — ");
                              return (
                              <article key={item} className="flex items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                                  <img src="/car2.svg" alt="" className="h-5 w-6" />
                                </span>
                                <p className="text-[20px] font-medium leading-[1.1] tracking-[-0.02em] text-[#7D7D7D]">
                                  <span className="text-[#111826]">{model}</span>
                                  {orders ? ` — ${orders}` : ""}
                                </p>
                                <button className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EC1C24] text-white">
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
                        <article className="relative order-2 mt-[107px] min-h-0 flex-1 rounded-[12px] bg-transparent">
                          <div className="absolute left-0 top-0 -translate-y-full pb-3">
                            <div className="flex items-center">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Документы</h3>
                            </div>
                          </div>
                          <div className="hide-scrollbar min-h-0 min-w-0 max-h-[598px] space-y-4 overflow-y-auto overflow-x-hidden rounded-lg bg-transparent pr-1">
                            {carDocumentItems.map((item) => (
                              <article key={item} className="flex items-center gap-3 rounded-[12px] bg-[#F3F3F5] px-4 py-3">
                                <span className="inline-flex h-6 w-6 shrink-0 items-center justify-center">
                                  <img src="/document.svg" alt="" className="h-5 w-4" />
                                </span>
                                <p className="text-[20px] font-medium leading-[1.1] tracking-[-0.02em] text-[#7D7D7D]">{item}</p>
                                <button className="ml-auto inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#EC1C24] text-white">
                                  <img src="/download.svg" alt="" className="h-[19px] w-[18px]" />
                                </button>
                              </article>
                            ))}
                          </div>
                        </article>
                      ) : activeCarPanel === "orders" ? (
                        <article className="relative order-2 mt-[107px] min-h-0 flex-1 rounded-[12px] bg-transparent">
                          <div className="absolute left-0 top-0 -translate-y-full pb-3">
                            <div className="flex items-center">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">История заказ-нарядов</h3>
                            </div>
                          </div>
                          <div className="h-full min-h-0 min-w-0 rounded-lg bg-transparent">
                          <div
                            className="hide-scrollbar min-h-0 min-w-0 max-h-[598px] overflow-y-auto overflow-x-hidden rounded-lg bg-transparent"
                          >
                          <table className="min-w-full table-fixed border-separate border-spacing-0 whitespace-nowrap text-[16px] font-medium tracking-[-0.02em]">
                          <colgroup>
                            <col className="w-[4%]" />
                            <col className="w-[12%]" />
                            <col className="w-[10%]" />
                            <col className="w-[26%]" />
                            <col className="w-[10%]" />
                            <col className="w-[10%]" />
                            <col className="w-[12%]" />
                            <col className="w-[16%]" />
                          </colgroup>
                          <thead className="sticky top-0 z-10 bg-[#F3F3F5] text-left text-[16px] font-medium tracking-[-0.02em] text-[#7D7D7D]">
                            <tr>
                              <th className="rounded-l-[5px] px-3 py-2.5 font-medium">
                                <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-[2px] border-[#D8DBDE]" />
                              </th>
                              <th className="px-3 py-2.5 font-medium">№ наряда</th>
                              <th className="px-3 py-2.5 font-medium">Дата</th>
                              <th className="px-3 py-2.5 font-medium">Работы</th>
                              <th className="px-3 py-2.5 font-medium">Сумма</th>
                              <th className="px-3 py-2.5 font-medium">Оплачено</th>
                              <th className="px-3 py-2.5 font-medium">Статус</th>
                              <th className="rounded-r-[5px] px-3 py-2.5 font-medium">Мастер</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ["ZN-20491", "12.07.2025", "Диагностика подвески, Замена колодок", "18 500 ₽", "18 500 ₽", "Закрыт", "Журавлев М."],
                              ["ZN-20412", "23.04.2025", "ТО-80 000 км, Замена масла", "12 300 ₽", "12 300 ₽", "Закрыт", "Кузнецов Е."],
                              ["ZN-19923", "15.02.2025", "Замена передних амортизаторов", "25 800 ₽", "25 800 ₽", "Закрыт", "Алексеев Д."],
                              ["ZN-19211", "05.12.2024", "Диагностика двигателя", "1 500 ₽", "1 500 ₽", "Закрыт", "Кузнецов Е."],
                              ["ZN-18543", "18.10.2024", "Замена тормозной жидкости", "2 200 ₽", "2 200 ₽", "Закрыт", "Журавлев М."],
                              ["ZN-18102", "21.09.2024", "Замена свечей зажигания", "4 700 ₽", "4 700 ₽", "Закрыт", "Алексеев Д."],
                              ["ZN-17881", "11.08.2024", "Диагностика АКПП", "3 900 ₽", "3 900 ₽", "Закрыт", "Кузнецов Е."],
                              ["ZN-17450", "30.07.2024", "Замена передних колодок", "6 300 ₽", "6 300 ₽", "Закрыт", "Журавлев М."],
                              ["ZN-17112", "14.06.2024", "Замена аккумулятора", "9 200 ₽", "9 200 ₽", "Закрыт", "Алексеев Д."],
                              ["ZN-16798", "02.05.2024", "ТО-60 000 км", "14 100 ₽", "14 100 ₽", "Закрыт", "Кузнецов Е."],
                              ["ZN-16377", "19.03.2024", "Замена ремня ГРМ", "22 400 ₽", "22 400 ₽", "Закрыт", "Журавлев М."],
                              ["ZN-16004", "08.02.2024", "Промывка радиатора", "5 800 ₽", "5 800 ₽", "Закрыт", "Алексеев Д."],
                              ["ZN-15831", "18.01.2024", "Замена фильтра салона", "1 900 ₽", "1 900 ₽", "Закрыт", "Кузнецов Е."],
                              ["ZN-15490", "22.12.2023", "Проверка тормозной системы", "3 400 ₽", "3 400 ₽", "Закрыт", "Журавлев М."],
                              ["ZN-15122", "06.11.2023", "Замена рулевых наконечников", "7 600 ₽", "7 600 ₽", "Закрыт", "Алексеев Д."],
                              ["ZN-14811", "28.09.2023", "Компьютерная диагностика", "2 100 ₽", "2 100 ₽", "Закрыт", "Кузнецов Е."],
                              ["ZN-14579", "14.08.2023", "Замена охлаждающей жидкости", "3 200 ₽", "3 200 ₽", "Закрыт", "Журавлев М."],
                              ["ZN-14105", "01.07.2023", "Замена задних колодок", "6 100 ₽", "6 100 ₽", "Закрыт", "Алексеев Д."],
                              ["ZN-13744", "17.05.2023", "ТО-40 000 км", "11 800 ₽", "11 800 ₽", "Закрыт", "Кузнецов Е."],
                              ["ZN-13326", "09.03.2023", "Чистка дроссельной заслонки", "4 300 ₽", "4 300 ₽", "Закрыт", "Журавлев М."],
                            ].map((row, index) => (
                              <tr
                                key={row[0]}
                                className={`transition hover:bg-[rgba(224,9,25,0.10)] ${index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white"}`}
                              >
                                <td className="px-3 py-2.5">
                                  {row[0] === "ZN-19923" ? (
                                    <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[#d51a21] text-white">
                                      <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5">
                                        <path d="M3 8L6.2 11L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                      </svg>
                                    </span>
                                  ) : (
                                    <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-[2px] border-[#D8DBDE]" />
                                  )}
                                </td>
                                <td className="px-3 py-2.5 text-[#E00919]">{row[0]}</td>
                                <td className="px-3 py-2.5 text-black">{row[1]}</td>
                                <td className="truncate px-3 py-2.5 text-black">{row[2]}</td>
                                <td className="px-3 py-2.5 text-black">{row[3]}</td>
                                <td className="px-3 py-2.5 text-black">{row[4]}</td>
                                <td className="px-3 py-2.5">
                                  <span className="inline-flex items-center gap-2 font-medium text-black">
                                    <span className="h-2.5 w-2.5 rounded-full bg-[#00B515]" />
                                    <span className="text-black font-medium">{row[5]}</span>
                                  </span>
                                </td>
                                <td className="truncate px-3 py-2.5 text-black">{row[6]}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                          </div>
                          </div>
                        </article>
                      ) : (
                        <article className="relative mt-[107px] min-h-0 flex-1 rounded-[12px] bg-transparent">
                          <div className="absolute left-0 top-0 -translate-y-full pb-3">
                            <div className="flex items-center">
                              <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Фото автомобиля</h3>
                            </div>
                          </div>
                          <div className="grid grid-cols-3 gap-3">
                            {carPhotoItems.map((photoSrc, index) => (
                              <article
                                key={index}
                                className="relative aspect-[4/3] w-full overflow-hidden rounded-[10px] bg-[#F3F3F5]"
                              >
                                <img src={photoSrc} alt="BMW M5 F90 Competition" className="h-full w-full object-cover" />
                              </article>
                            ))}
                          </div>
                          <button className="mt-3 flex h-[46px] w-full items-center justify-center gap-2 rounded-[8px] border border-[#D8DDE6] bg-white text-[16px] font-semibold text-[#EC1C24]">
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
      </div>
    </div>
  );
}
