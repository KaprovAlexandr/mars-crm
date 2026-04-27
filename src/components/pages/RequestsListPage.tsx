import { useNavigate } from "react-router-dom";
import { Sidebar } from "@/components/layout/Sidebar";
import {
  requestsData,
  requestsSidebarItems,
  statusColorMap,
} from "@/lib/mock/requests-page";

export function RequestsListPage() {
  const navigate = useNavigate();

  return (
    <div className="h-screen overflow-hidden bg-white text-[#1F1F1F]">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <Sidebar items={requestsSidebarItems} />

        <main className="relative flex min-h-0 flex-1 flex-col p-4 md:p-5">
          <header className="mb-3 flex flex-wrap items-center gap-2">
            <h1 className="text-[36px] font-semibold leading-none tracking-tight text-[#1f1f1f]">Заявки</h1>
            <span className="pt-3 text-[12px] text-[#A0A0A0]">{requestsData.length} заявок</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative">
                <input className="h-8 w-[300px] rounded-md border border-[#E4E5E7] bg-white pl-3 pr-8 text-[12px] text-[#8A8A8A] outline-none placeholder:text-[#B5B5B5]" placeholder="Найти по номеру заявки или другое" />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#B5B5B5]"><svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 stroke-2"><circle cx="11" cy="11" r="6.5" stroke="currentColor" /><path d="M16 16L20 20" stroke="currentColor" strokeLinecap="round" /></svg></span>
              </div>
              <button className="h-8 rounded-md bg-[#d51a21] px-3 text-[12px] font-medium text-white transition hover:bg-[#bd171d]">+ Создать заявку</button>
              <button aria-label="Открыть меню действий" className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E5E7] text-[#8C8C8C]"><svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg></button>
            </div>
          </header>

          <div className="mb-3 flex flex-wrap items-center gap-2">
            {["Статус заявки 2", "Сумма", "Дата приёма", "⚙ Все фильтры"].map((filter) => (
              <button key={filter} className="h-7 rounded-md border border-[#E4E5E7] bg-white px-3 text-[12px] text-[#666] transition hover:bg-[#FAFAFA]">{filter}</button>
            ))}
            <div className="ml-auto flex gap-2">
              <button className="h-7 rounded-md border border-[#E4E5E7] bg-white px-3 text-[12px] text-[#666] transition hover:bg-[#FAFAFA]">Сбросить фильтры</button>
              <button className="h-7 rounded-md border border-[#B8D9F1] bg-[#ECF8FF] px-3 text-[12px] text-[#6CA7CE] transition hover:bg-[#e3f4ff]">Сохранить фильтры</button>
            </div>
          </div>

          <div className="mb-3 overflow-hidden rounded-lg border border-[#E6E7E9] bg-white">
            <div className="overflow-x-auto">
              <table className="min-w-full text-[12px] font-normal">
                <thead className="bg-[#FBFBFC] text-left text-[11px] tracking-[0.01em] text-[#7D7D7D]">
                  <tr>
                    <th className="px-3 py-2.5 font-normal">
                      <span className="inline-block h-3.5 w-3.5 rounded-[3px] border border-[#D8DBDE]" />
                    </th>
                    <th className="px-4 py-2.5 font-normal">ID</th><th className="px-4 py-2.5 font-normal">Статус</th><th className="px-4 py-2.5 font-normal">Клиент</th><th className="px-4 py-2.5 font-normal">Автомобиль</th><th className="px-4 py-2.5 font-normal">Гос. номер</th><th className="px-4 py-2.5 font-normal">Мастер</th><th className="px-4 py-2.5 font-normal">Дата приёма</th><th className="px-4 py-2.5 font-normal">Готовность</th><th className="px-4 py-2.5 font-normal text-right">Сумма, ₽</th><th className="px-4 py-2.5 font-normal text-center">⋮</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECEDEF]">
                  {requestsData.map((request) => (
                    <tr
                      key={request.id}
                      onClick={() => navigate(`/requests/${request.id}`)}
                      className={`cursor-pointer transition hover:bg-[#FAFAFB] ${request.id === "839022" ? "bg-[#fef5f6]" : "bg-white"}`}
                    >
                      <td className="px-3 py-2">
                        {request.id === "839022" ? (
                          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[#d51a21] text-white">
                            <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5">
                              <path d="M3 8L6.2 11L13 4.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          </span>
                        ) : (
                          <span className="inline-block h-3.5 w-3.5 rounded-[3px] border border-[#D8DBDE]" />
                        )}
                      </td>
                      <td className="px-4 py-2 text-[#2E2E2E]">#{request.id}</td>
                      <td className="px-4 py-2">
                        <span className={`inline-flex w-[110px] justify-center rounded-md px-2.5 py-1 text-center text-xs font-normal ${statusColorMap[request.status]}`}>
                          {request.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[#2E2E2E]">{request.client}</td>
                      <td className="px-4 py-2 text-[#2E2E2E]">{request.car}</td>
                      <td className="px-4 py-2 text-[#2E2E2E]">{request.plate}</td>
                      <td className="px-4 py-2"><div className="flex items-center gap-2.5"><img src={request.masterPhoto} alt={`Фотография ${request.master}`} width={24} height={24} className="h-6 w-6 rounded-full object-cover" /><span className="text-[#2E2E2E]">{request.master}</span></div></td>
                      <td className="px-4 py-2 text-[#2E2E2E]">{request.date}</td>
                      <td className="px-4 py-2">
                        <div className="relative h-4 w-24 overflow-hidden rounded-[3px] bg-[#E9F5EF]">
                          <div className="absolute inset-y-0 left-0 bg-[#BFE6D5]" style={{ width: `${request.readiness}%` }} />
                          <span className="relative z-10 flex h-full items-center justify-center text-[10px] font-medium text-[#2F6F58]">{request.readiness}%</span>
                        </div>
                      </td>
                      <td className="px-4 py-2 text-right font-normal text-[#2E2E2E]">{request.amount}</td>
                      <td className="px-4 py-2 text-center text-[#A0A0A0]">...</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="flex justify-center border-t border-[#ECEDEF] py-3">
              <button className="h-7 rounded-md border border-[#E3E4E6] bg-white px-4 text-[12px] text-[#7D7D7D] transition hover:bg-[#FAFAFA]">Показать ещё</button>
            </div>
          </div>

          <div className="mt-auto rounded-lg border border-[#E6E7E9] bg-white text-[#7D7D7D]">
            <div className="relative flex items-center gap-3 border-b border-[#ECEDEF] px-4 py-3 text-[12px]">
              <div className="flex items-center gap-3">
                <span className="text-[#555]">Выбрано: 1 из 12</span>
                <button className="text-[#7BA9D2] transition hover:text-[#6a97c0]">Отменить выбор</button>
              </div>
              <div className="pointer-events-none absolute left-1/2 -translate-x-1/2">
                <div className="pointer-events-auto flex items-center justify-center gap-2">
                  <button aria-label="Первая страница" className="rounded-md border border-[#E4E5E7] px-2 py-1 text-[11px] text-[#7D7D7D] transition hover:bg-[#FAFAFA]">&lt;&lt;</button>
                  <button aria-label="Предыдущая страница" className="rounded-md border border-[#E4E5E7] px-2 py-1 text-[11px] text-[#7D7D7D] transition hover:bg-[#FAFAFA]">&lt;</button>
                  <button className="rounded-md px-2 py-1 text-[11px] text-[#7D7D7D]">1</button>
                  <button className="rounded-md bg-[#d51a21]/10 px-2 py-1 text-[11px] text-[#d51a21]">2</button>
                  <button className="rounded-md px-2 py-1 text-[11px] text-[#7D7D7D]">3</button>
                  <span className="text-[11px] text-[#7D7D7D]">... 100</span>
                  <button aria-label="Следующая страница" className="rounded-md border border-[#E4E5E7] px-2 py-1 text-[11px] text-[#7D7D7D] transition hover:bg-[#FAFAFA]">&gt;</button>
                </div>
              </div>
              <div className="ml-auto flex items-center gap-2">
                <span className="text-[12px] text-[#555]">На странице:</span>
                <button className="rounded-md border border-[#E4E5E7] px-2 py-1 text-[12px] text-[#7D7D7D] transition hover:bg-[#FAFAFA]">12</button>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-3 px-4 py-3">
              <button className="rounded-md border border-[#E4E5E7] bg-white px-3 py-1.5 text-[12px] text-[#7D7D7D] transition hover:bg-[#FAFAFA]">Действие</button>
              <button className="cursor-not-allowed rounded-md border border-[#ECEDEF] bg-[#F9F9FA] px-3 py-1.5 text-[12px] text-[#BCBCBC]">Применить</button>
              <label className="flex items-center gap-2 text-[12px] text-[#555]"><input type="checkbox" className="h-3.5 w-3.5 accent-[#d51a21]" />Для всех</label>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
