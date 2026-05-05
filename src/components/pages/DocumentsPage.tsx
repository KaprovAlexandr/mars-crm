import { MarsShellSidebarIcon } from "@/components/icons/MarsShellSidebarIcon";
import { NavRailNotifications } from "@/components/layout/NavRailNotifications";
import { CURRENT_USER_ROLE } from "@/lib/session/currentUser";
import { useRef } from "react";
import { useNavigate } from "react-router-dom";

type DocRow = {
  name: string;
  size: string;
  added: string;
  client: string;
  status: "Подписан" | "На проверке" | "Архивирован" | "Действует" | "На согласовании";
};

const recentDocs = [
  { title: "Счет на оплату #981", date: "07.08.2025", ext: "DOC" },
  { title: "Коммерческое предложение", date: "11.08.2025", ext: "XLS" },
  { title: "Акт сверки за июль 2025", date: "11.08.2025", ext: "XLS" },
  { title: "Приложение к договору", date: "03.08.2024", ext: "PDF" },
  { title: "Договор оказания услуг", date: "12.08.2025", ext: "DOC" },
  { title: "Счет на предоплату #452", date: "14.08.2025", ext: "DOC" },
  { title: "Отчет по закупкам Q2", date: "19.08.2025", ext: "XLS" },
  { title: "Доп. соглашение №4", date: "20.08.2025", ext: "PDF" },
  { title: "Акт приема-передачи", date: "21.08.2025", ext: "DOC" },
  { title: "Сводная таблица оплат", date: "24.08.2025", ext: "XLS" },
  { title: "Доверенность", date: "27.08.2025", ext: "PDF" },
  { title: "Реестр контрагентов", date: "30.08.2025", ext: "XLS" },
];

const docFormatIconMap: Record<string, string> = {
  DOC: "/doc-format.png",
  XLS: "/xls-format.png",
  PDF: "/pdf-format.png",
};

const docRows: DocRow[] = [
  { name: "Договор сотрудничества.pdf", size: "1.2 MB", added: "03.08.2024", client: "Иванов Артём Сергеевич", status: "Подписан" },
  { name: "Лизинг page.pdf", size: "850 KB", added: "05.08.2024", client: "Смирнова Наталья Викторовна", status: "На проверке" },
  { name: "Счет №23 от 09.08.pdf", size: "740 KB", added: "06.08.2024", client: 'ООО "Сад"', status: "На согласовании" },
  { name: "Акт выполненных работ.docx", size: "950 KB", added: "08.08.2024", client: "ИП Лебедев Максим Олегович", status: "Действует" },
  { name: "Гарантийное письмо.pdf", size: "490 KB", added: "15.08.2024", client: 'ООО "ЭкоМобил"', status: "Подписан" },
  { name: "Условия поставки.docx", size: "810 KB", added: "20.08.2024", client: "Белов Алексей Игоревич", status: "Архивирован" },
  { name: "Акт передачи авто.pdf", size: "680 KB", added: "30.08.2024", client: 'ООО "ТехноТрак"', status: "На проверке" },
  { name: "Дополнительное соглашение №2.pdf", size: "560 KB", added: "02.09.2024", client: "Гаврилова Ирина Михайловна", status: "Подписан" },
  { name: "Спецификация к договору.xlsx", size: "1.1 MB", added: "05.09.2024", client: 'ООО "ГрузСервис"', status: "Действует" },
  { name: "Счет-фактура №119.pdf", size: "430 KB", added: "07.09.2024", client: 'ООО "Магистраль"', status: "На согласовании" },
  { name: "Отчет по закупкам Q3.xlsx", size: "980 KB", added: "09.09.2024", client: "Журавлёв Михаил Дмитриевич", status: "Архивирован" },
  { name: "Приложение к контракту.docx", size: "720 KB", added: "12.09.2024", client: "Орлова Анна Вячеславовна", status: "На проверке" },
  { name: "Реестр платежей сентябрь.pdf", size: "640 KB", added: "15.09.2024", client: 'ООО "ЭкспрессТранс"', status: "Подписан" },
  { name: "Акт сверки взаиморасчетов.pdf", size: "590 KB", added: "18.09.2024", client: "Кузнецов Павел Андреевич", status: "Действует" },
  { name: "Доверенность представителя.pdf", size: "320 KB", added: "20.09.2024", client: "Фролова Алина Андреевна", status: "На проверке" },
];

const statusStyle: Record<DocRow["status"], string> = {
  Подписан: "#00B515",
  "На проверке": "#F39D00",
  Архивирован: "#E00919",
  Действует: "#2E78C9",
  "На согласовании": "#D17E00",
};

export function DocumentsPage() {
  const navigate = useNavigate();
  const isManager = CURRENT_USER_ROLE === "manager";
  const recentDocsScrollRef = useRef<HTMLDivElement | null>(null);

  return (
    <div className="h-screen w-screen overflow-hidden bg-black">
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
              <button onClick={() => navigate("/profile")} className="grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5]"><MarsShellSidebarIcon type="user" /></button>
            </div>
          </aside>

          <main className="flex min-h-0 flex-1 flex-col">
            <header className="mb-2 rounded-[16px] border border-[#DDE1E7] bg-white px-5 py-5">
              <div className="flex items-center gap-3">
                <div className="flex items-baseline gap-2">
                  <h1 className="text-[36px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">Документы</h1>
                </div>
                <div className="ml-auto flex items-center gap-1.5">
                  <input
                    placeholder="Поиск по названию или дате"
                    className="h-12 w-[320px] rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[18px] font-medium tracking-[-0.04em] text-[#8A8A8A] outline-none placeholder:text-[#B5B5B5]"
                  />
                  <button className="h-12 rounded-[10px] bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white">Добавить документ</button>
                </div>
              </div>
            </header>

            <section className="flex min-h-0 flex-1 flex-col rounded-[16px] border border-[#DDE1E7] bg-white px-5 py-5">
              <div className="mt-2 overflow-hidden">
                <div
                  ref={recentDocsScrollRef}
                  onWheel={(event) => {
                    if (!recentDocsScrollRef.current) return;
                    event.preventDefault();
                    recentDocsScrollRef.current.scrollLeft += event.deltaY;
                  }}
                  className="hide-scrollbar overflow-x-auto overflow-y-hidden"
                >
                  <div className="flex gap-2 pb-1">
                  {recentDocs.map((doc) => (
                    <article key={doc.title} className="basis-[19.2%] shrink-0 rounded-[10px] bg-[#F3F3F5] p-3 text-center">
                      <div className="flex justify-center">
                        <img src={docFormatIconMap[doc.ext] ?? "/file.svg"} alt={doc.ext} className="h-20 w-20 object-contain" />
                      </div>
                      <p className="mt-2 line-clamp-2 text-center text-[12px] font-medium text-[#2E3444]">{doc.title}</p>
                      <p className="mt-1 text-center text-[11px] text-[#8F96A6]">{doc.date}</p>
                    </article>
                  ))}
                  </div>
                </div>
              </div>

              <div className="mt-3 flex items-center gap-[10px]">
                {[
                  { label: "Тут документы", active: true },
                  { label: "Период", active: false },
                  { label: "Клиент", active: false },
                  { label: "Все фильтры", active: false },
                ].map((filter) => (
                  <button
                    key={filter.label}
                    className={`rounded-[10px] px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] ${
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
                <button className="ml-auto rounded-[10px] bg-[#ECECEF] px-[16px] py-[14px] text-[16px] font-medium leading-none tracking-[-0.04em] text-[#111111]">
                  Сбросить фильтры
                </button>
              </div>

              <div className="mt-3 min-h-0 flex-1 overflow-hidden rounded-lg bg-white">
                <div className="h-full overflow-x-auto overflow-y-hidden">
                  <table className="min-w-full table-fixed border-separate border-spacing-0 whitespace-nowrap text-[16px] font-medium tracking-[-0.04em]">
                    <colgroup>
                      <col className="w-[4%]" />
                      <col className="w-[30%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[27%]" />
                      <col className="w-[14%]" />
                      <col className="w-[3%]" />
                    </colgroup>
                    <thead className="bg-[#F3F3F5] text-left text-[16px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                      <tr>
                        <th className="rounded-l-[5px] px-3 py-2.5 font-medium">
                          <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-[2px] border-[#D8DBDE]" />
                        </th>
                        <th className="px-4 py-2.5 font-medium">Название</th>
                        <th className="px-4 py-2.5 font-medium">Размер</th>
                        <th className="px-4 py-2.5 font-medium">Добавлен</th>
                        <th className="px-4 py-2.5 font-medium">Клиент</th>
                        <th className="px-4 py-2.5 font-medium">Статус</th>
                        <th className="rounded-r-[5px] px-4 py-2.5 font-medium text-center">⋮</th>
                      </tr>
                    </thead>
                    <tbody>
                      {docRows.map((row, index) => (
                        <tr
                          key={row.name}
                          className={`border-[5px] border-[#EEEDF0] transition hover:bg-[rgba(224,9,25,0.10)] ${index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white"}`}
                        >
                          <td className="px-3 py-3">
                            <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-[2px] border-[#D8DBDE]" />
                          </td>
                          <td className="px-4 py-3 text-black">{row.name}</td>
                          <td className="px-4 py-3 text-black">{row.size}</td>
                          <td className="px-4 py-3 text-black">{row.added}</td>
                          <td className="px-4 py-3 text-black">{row.client}</td>
                          <td className="px-4 py-3 font-medium">
                            <span className="inline-flex items-center gap-2 font-medium text-black">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusStyle[row.status] }} />
                              <span className="font-medium text-black">{row.status}</span>
                            </span>
                          </td>
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
            </section>
          </main>
        </div>
      </div>
    </div>
  );
}
