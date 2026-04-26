import Image from "next/image";

export default function Home() {
  const sidebarItems = [
    { label: "Дашборд", icon: "home" },
    { label: "Заявки", icon: "requests", active: true },
    { label: "Мастера", icon: "masters" },
    { label: "Автомобили", icon: "cars" },
    { label: "Клиенты", icon: "users" },
    { label: "Платежи", icon: "payments" },
    { label: "Документы", icon: "docs" },
    { label: "Отчёты", icon: "reports" },
    { label: "Настройки", icon: "settings" },
  ];

  const requests = [
    { id: "294891", status: "Новая заявка", client: "Иванов Артём Сергеевич", car: "Toyota Corolla", plate: "A123BC777", master: "Алексеев Д.", masterPhoto: "https://i.pravatar.cc/80?img=12", date: "03.08.2024", readiness: 0, amount: "1 200" },
    { id: "593423", status: "В архиве", client: "Смирнова Наталья Викторовна", car: "Hyundai Solaris", plate: "M456KX199", master: "Семёнова Е.", masterPhoto: "https://i.pravatar.cc/80?img=32", date: "05.08.2024", readiness: 100, amount: "3 500" },
    { id: "839022", status: "Отменено", client: "ООО \"Сад\"", car: "LADA Vesta", plate: "O789EH750", master: "Кириллов О.", masterPhoto: "https://i.pravatar.cc/80?img=14", date: "08.08.2024", readiness: 30, amount: "7 900" },
    { id: "847952", status: "Новая заявка", client: "ИП Лебедев Максим Олегович", car: "Kia Rio", plate: "T320P197", master: "Гусева М.", masterPhoto: "https://i.pravatar.cc/80?img=25", date: "13.08.2024", readiness: 0, amount: "14 500" },
    { id: "495783", status: "Ожидание", client: "ООО \"ЭкоМобиль\"", car: "Renault Duster", plate: "Y654HC777", master: "Тимофеева А.", masterPhoto: "https://i.pravatar.cc/80?img=47", date: "15.08.2024", readiness: 60, amount: "22 300" },
    { id: "987384", status: "В архиве", client: "Белов Алексей Игоревич", car: "Ford Focus", plate: "P111MP178", master: "Романова Н.", masterPhoto: "https://i.pravatar.cc/80?img=5", date: "17.08.2024", readiness: 100, amount: "5 700" },
    { id: "284750", status: "Ожидание", client: "Фролова Анна Андреевна", car: "Volkswagen Polo", plate: "A888MM799", master: "Егоров П.", masterPhoto: "https://i.pravatar.cc/80?img=61", date: "20.08.2024", readiness: 80, amount: "38 900" },
    { id: "847597", status: "Новая заявка", client: "Белов Алексей Игоревич", car: "Nissan Qashqai", plate: "E222CC750", master: "Журавлёв М.", masterPhoto: "https://i.pravatar.cc/80?img=41", date: "22.08.2024", readiness: 0, amount: "11 200" },
    { id: "658472", status: "Просрочено", client: "ООО \"ГрузСервис\"", car: "Skoda Octavia", plate: "X333OP777", master: "Власова Д.", masterPhoto: "https://i.pravatar.cc/80?img=49", date: "26.08.2024", readiness: 20, amount: "63 000" },
    { id: "308845", status: "В архиве", client: "ООО \"ТехноТрак\"", car: "Mitsubishi Outlander", plate: "B999EK177", master: "Токарев Ф.", masterPhoto: "https://i.pravatar.cc/80?img=52", date: "28.08.2024", readiness: 100, amount: "88 750" },
    { id: "208476", status: "Ожидание", client: "Гаврилова Ирина Михайловна", car: "Subaru Forester", plate: "K111CX190", master: "Захарова И.", masterPhoto: "https://i.pravatar.cc/80?img=58", date: "30.08.2024", readiness: 40, amount: "2 800" },
    { id: "989923", status: "Новая заявка", client: "ООО \"ЭкспрессТранс\"", car: "Mercedes-Benz Sprinter", plate: "Y777AY197", master: "Фролов А.", masterPhoto: "https://i.pravatar.cc/80?img=53", date: "02.09.2024", readiness: 0, amount: "19 900" },
    { id: "745120", status: "Ожидание", client: "Кузнецов Андрей Сергеевич", car: "Mazda CX-5", plate: "H530KP777", master: "Лавров В.", masterPhoto: "https://i.pravatar.cc/80?img=65", date: "04.09.2024", readiness: 50, amount: "16 400" },
    { id: "562014", status: "В архиве", client: "ООО \"АвтоПартнер\"", car: "Toyota Camry", plate: "M901AB799", master: "Павлова К.", masterPhoto: "https://i.pravatar.cc/80?img=45", date: "06.09.2024", readiness: 100, amount: "9 300" },
    { id: "901557", status: "Новая заявка", client: "Морозов Евгений Павлович", car: "Hyundai Tucson", plate: "P445TT799", master: "Орлова С.", masterPhoto: "https://i.pravatar.cc/80?img=34", date: "09.09.2024", readiness: 0, amount: "12 700" },
  ];

  const statusColorMap: Record<string, string> = {
    "Новая заявка": "bg-[#DDF7EA] text-[#2E8B57]",
    "В архиве": "bg-[#ECEEF0] text-[#5A6673]",
    Отменено: "bg-[#FCE4E4] text-[#BA4F4F]",
    Ожидание: "bg-[#FFF2DA] text-[#B77B27]",
    Просрочено: "bg-[#F5E7EF] text-[#A95B7E]",
  };

  const SidebarIcon = ({ type }: { type: string }) => {
    const cls = "h-4 w-4 stroke-[1.8]";
    if (type === "home") return <svg viewBox="0 0 24 24" fill="none" className={cls}><path d="M3 10.5L12 3L21 10.5" stroke="currentColor" strokeLinecap="round" /><path d="M5.5 9.5V20H18.5V9.5" stroke="currentColor" strokeLinecap="round" /></svg>;
    if (type === "requests") return <svg viewBox="0 0 24 24" fill="none" className={cls}><path d="M6 7H18" stroke="currentColor" strokeLinecap="round" /><path d="M6 12H18" stroke="currentColor" strokeLinecap="round" /><path d="M6 17H13" stroke="currentColor" strokeLinecap="round" /></svg>;
    if (type === "masters") return <svg viewBox="0 0 24 24" fill="none" className={cls}><circle cx="12" cy="8" r="3" stroke="currentColor" /><path d="M5 19C6.5 16.5 9 15 12 15C15 15 17.5 16.5 19 19" stroke="currentColor" strokeLinecap="round" /></svg>;
    if (type === "cars") return <svg viewBox="0 0 24 24" fill="none" className={cls}><path d="M4 14L6 9H18L20 14" stroke="currentColor" strokeLinecap="round" /><rect x="4" y="11" width="16" height="6" rx="2" stroke="currentColor" /><circle cx="7.5" cy="17.5" r="1" fill="currentColor" /><circle cx="16.5" cy="17.5" r="1" fill="currentColor" /></svg>;
    if (type === "users") return <svg viewBox="0 0 24 24" fill="none" className={cls}><circle cx="9" cy="9" r="3" stroke="currentColor" /><circle cx="17" cy="10" r="2" stroke="currentColor" /><path d="M3.5 19C4.8 16.8 6.7 15.5 9 15.5C11.3 15.5 13.2 16.8 14.5 19" stroke="currentColor" strokeLinecap="round" /></svg>;
    if (type === "payments") return <svg viewBox="0 0 24 24" fill="none" className={cls}><rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" /><path d="M4 10H20" stroke="currentColor" /><path d="M8 14H11" stroke="currentColor" strokeLinecap="round" /></svg>;
    if (type === "docs") return <svg viewBox="0 0 24 24" fill="none" className={cls}><path d="M7 4H14L18 8V20H7V4Z" stroke="currentColor" /><path d="M14 4V8H18" stroke="currentColor" /><path d="M9.5 12H15.5" stroke="currentColor" strokeLinecap="round" /></svg>;
    if (type === "reports") return <svg viewBox="0 0 24 24" fill="none" className={cls}><path d="M5 20V10" stroke="currentColor" strokeLinecap="round" /><path d="M12 20V6" stroke="currentColor" strokeLinecap="round" /><path d="M19 20V13" stroke="currentColor" strokeLinecap="round" /></svg>;
    return <svg viewBox="0 0 24 24" fill="none" className={cls}><path d="M12 8.5A1.5 1.5 0 1 0 12 5.5A1.5 1.5 0 0 0 12 8.5Z" fill="currentColor" /><path d="M12 18.5A1.5 1.5 0 1 0 12 15.5A1.5 1.5 0 0 0 12 18.5Z" fill="currentColor" /><path d="M18 13.5A1.5 1.5 0 1 0 18 10.5A1.5 1.5 0 0 0 18 13.5Z" fill="currentColor" /><path d="M6 13.5A1.5 1.5 0 1 0 6 10.5A1.5 1.5 0 0 0 6 13.5Z" fill="currentColor" /></svg>;
  };

  return (
    <div className="h-screen overflow-hidden bg-white text-[#1F1F1F]">
      <div className="flex h-full w-full overflow-hidden bg-white">
        <aside className="hidden w-64 border-r border-[#DFE1E4] bg-[#F2F2F2] lg:flex lg:flex-col">
          <div className="px-5 pt-4">
            <Image src="/header-logo.svg" alt="Логотип" width={148} height={33} className="h-10 w-auto" priority />
          </div>
          <nav className="mt-6 space-y-0.5 px-0 text-[13px]">
            {sidebarItems.map((item) => (
              <button key={item.label} type="button" className={`group flex w-full items-center gap-2.5 px-6 py-2 text-left transition ${item.active ? "bg-[#d51a21] text-white" : "text-[#7D7D7D] hover:bg-white/70"}`}>
                <span className="inline-flex h-4 w-4 items-center justify-center text-current"><SidebarIcon type={item.icon} /></span>
                <span>{item.label}</span>
              </button>
            ))}
          </nav>
          <button type="button" className="mx-3 mt-3 rounded-full bg-transparent px-3 py-2 text-[13px] font-medium text-[#676767] transition hover:bg-white/70">+ Создать заявку</button>
          <div className="mt-auto border-t border-[#E1E1E1] px-3 py-4">
            <button type="button" className="mb-2 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-[#7D7D7D] hover:bg-white/70"><span className="inline-flex h-4 w-4 items-center justify-center"><svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 stroke-[1.8]"><path d="M6 12H18" stroke="currentColor" strokeLinecap="round" /><path d="M12 6V18" stroke="currentColor" strokeLinecap="round" /></svg></span>Служба поддержки</button>
            <button type="button" className="mb-2 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-[#7D7D7D] hover:bg-white/70"><span className="inline-flex h-4 w-4 items-center justify-center"><svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 stroke-[1.8]"><path d="M12 3V6" stroke="currentColor" strokeLinecap="round" /><path d="M12 18V21" stroke="currentColor" strokeLinecap="round" /><path d="M4.2 7.2L6.3 9.3" stroke="currentColor" strokeLinecap="round" /><path d="M17.7 14.7L19.8 16.8" stroke="currentColor" strokeLinecap="round" /><path d="M3 12H6" stroke="currentColor" strokeLinecap="round" /><path d="M18 12H21" stroke="currentColor" strokeLinecap="round" /></svg></span>Уведомления</button>
            <div className="flex items-center gap-2.5 px-3 py-1">
              <Image src="https://i.pravatar.cc/80?img=12" alt="Фотография Алексеев Дмитрий" width={24} height={24} className="h-6 w-6 rounded-full object-cover" />
              <span className="text-[12px] text-[#7D7D7D]">Алексеев Дмитрий</span>
            </div>
          </div>
        </aside>

        <main className="relative flex min-h-0 flex-1 flex-col p-4 md:p-5">
          <header className="mb-3 flex flex-wrap items-center gap-2">
            <h1 className="text-[36px] font-semibold leading-none tracking-tight text-[#1f1f1f]">Заявки</h1>
            <span className="pt-3 text-[12px] text-[#A0A0A0]">108 заявок</span>
            <div className="ml-auto flex flex-wrap items-center gap-2">
              <div className="relative">
                <input className="h-8 w-[300px] rounded-md border border-[#E4E5E7] bg-white pl-3 pr-8 text-[12px] text-[#8A8A8A] outline-none placeholder:text-[#B5B5B5]" placeholder="Найти по номеру заявки или другое" />
                <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-[#B5B5B5]"><svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 stroke-2"><circle cx="11" cy="11" r="6.5" stroke="currentColor" /><path d="M16 16L20 20" stroke="currentColor" strokeLinecap="round" /></svg></span>
              </div>
              <button className="h-8 rounded-md bg-[#d51a21] px-3 text-[12px] font-medium text-white transition hover:bg-[#bd171d]">+ Создать заявку</button>
              <button className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#E4E5E7] text-[#8C8C8C]"><svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4"><circle cx="12" cy="5" r="1.6" /><circle cx="12" cy="12" r="1.6" /><circle cx="12" cy="19" r="1.6" /></svg></button>
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
                  {requests.map((request) => (
                    <tr key={request.id} className={`transition hover:bg-[#FAFAFB] ${request.id === "839022" ? "bg-[#fef5f6]" : "bg-white"}`}>
                      <td className="px-3 py-2">
                        {request.id === "839022" ? (
                          <span className="inline-flex h-3.5 w-3.5 items-center justify-center rounded-[3px] bg-[#d51a21] text-white">
                            <svg viewBox="0 0 16 16" fill="none" className="h-2.5 w-2.5">
                              <path
                                d="M3 8L6.2 11L13 4.5"
                                stroke="currentColor"
                                strokeWidth="2"
                                strokeLinecap="round"
                                strokeLinejoin="round"
                              />
                            </svg>
                          </span>
                        ) : (
                          <span className="inline-block h-3.5 w-3.5 rounded-[3px] border border-[#D8DBDE]" />
                        )}
                      </td>
                      <td className="px-4 py-2 text-[#2E2E2E]">#{request.id}</td>
                      <td className="px-4 py-2">
                        <span
                          className={`inline-flex w-[110px] justify-center rounded-md px-2.5 py-1 text-center text-xs font-normal ${statusColorMap[request.status]}`}
                        >
                          {request.status}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-[#2E2E2E]">{request.client}</td>
                      <td className="px-4 py-2 text-[#2E2E2E]">{request.car}</td>
                      <td className="px-4 py-2 text-[#2E2E2E]">{request.plate}</td>
                      <td className="px-4 py-2"><div className="flex items-center gap-2.5"><Image src={request.masterPhoto} alt={`Фотография ${request.master}`} width={24} height={24} className="h-6 w-6 rounded-full object-cover" /><span className="text-[#2E2E2E]">{request.master}</span></div></td>
                      <td className="px-4 py-2 text-[#2E2E2E]">{request.date}</td>
                      <td className="px-4 py-2">
                        <div className="relative h-4 w-24 overflow-hidden rounded-[3px] bg-[#E9F5EF]">
                          <div
                            className="absolute inset-y-0 left-0 bg-[#BFE6D5]"
                            style={{ width: `${request.readiness}%` }}
                          />
                          <span className="relative z-10 flex h-full items-center justify-center text-[10px] font-medium text-[#2F6F58]">
                            {request.readiness}%
                          </span>
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
                <button className="rounded-md border border-[#E4E5E7] px-2 py-1 text-[11px] text-[#7D7D7D] transition hover:bg-[#FAFAFA]">&lt;&lt;</button>
                <button className="rounded-md border border-[#E4E5E7] px-2 py-1 text-[11px] text-[#7D7D7D] transition hover:bg-[#FAFAFA]">&lt;</button>
                <button className="rounded-md px-2 py-1 text-[11px] text-[#7D7D7D]">1</button>
                <button className="rounded-md bg-[#d51a21]/10 px-2 py-1 text-[11px] text-[#d51a21]">2</button>
                <button className="rounded-md px-2 py-1 text-[11px] text-[#7D7D7D]">3</button>
                <span className="text-[11px] text-[#7D7D7D]">... 100</span>
                <button className="rounded-md border border-[#E4E5E7] px-2 py-1 text-[11px] text-[#7D7D7D] transition hover:bg-[#FAFAFA]">&gt;</button>
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
