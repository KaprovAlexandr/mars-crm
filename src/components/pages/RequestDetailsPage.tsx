import { Sidebar } from "@/components/layout/Sidebar";
import { requestWorks } from "@/lib/mock/request-details-page";
import { requestsSidebarItems } from "@/lib/mock/requests-page";

export function RequestDetailsPage() {
  return (
    <div className="h-screen overflow-hidden bg-white text-[#1f1f1f]">
      <div className="flex h-full">
        <Sidebar items={requestsSidebarItems} />
        <main className="flex min-h-0 flex-1 flex-col p-3">
          <header className="mb-2 flex h-12 items-center px-1">
            <button type="button" className="mr-2 text-[#6D7480]">←</button>
            <h1 className="text-[36px] leading-none font-semibold tracking-tight text-[#1f1f1f]">Заявка №943837</h1>
            <span className="ml-3 rounded-md bg-[#E7F2F8] px-3 py-1 text-[11px] font-medium text-[#6A95B0]">Диагностика</span>
            <button className="ml-auto h-8 rounded-md bg-[#d51a21] px-3 text-[12px] font-medium text-white transition hover:bg-[#bd171d]">
              Завершить заявку
            </button>
          </header>

          <section className="mb-2 grid grid-cols-4 gap-2 rounded-xl border border-[#E6E7E9] bg-[#fafafa] p-3">
            <div>
              <p className="mb-1 text-[11px] text-[#9AA1AB]">Готовность</p>
              <div className="relative h-4 w-[220px] overflow-hidden rounded-[3px] bg-[#E9F5EF]">
                <div className="absolute inset-y-0 left-0 w-[20%] bg-[#BFE6D5]" />
                <span className="relative z-10 flex h-full items-center justify-center text-[11px] font-medium text-[#2F6F58]">20%</span>
              </div>
            </div>
            <div>
              <p className="text-[11px] text-[#9AA1AB]">Создана</p>
              <p className="mt-1 text-[14px] font-medium text-[#2F3136]">◷ 03.08.2025</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9AA1AB]">Обновлена</p>
              <p className="mt-1 text-[14px] font-medium text-[#2F3136]">◷ 08.08.2025</p>
            </div>
            <div>
              <p className="text-[11px] text-[#9AA1AB]">Сумма</p>
              <p className="mt-1 text-[14px] font-medium text-[#2F3136]">▣ 3500Р</p>
            </div>
          </section>

          <div className="min-h-0 flex-1">
            <div className="grid h-full grid-cols-12 gap-2">
              <section className="col-span-4 rounded-xl border border-[#E6E7E9] bg-[#fafafa] p-4">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-[26px] leading-none font-semibold tracking-[-0.01em] text-[#2A2A2A]">О клиенте</h2>
                  <button className="text-[#B1B8C2]">✎</button>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">ФИО</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">Смирнова Наталья Викторовна</p>
                  </div>
                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Тип клиента</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">Физ.лицо</p>
                  </div>

                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Телефон</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">+7 (909) 999-99-99</p>
                  </div>
                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Статус</p>
                    <p className="h-5 leading-none">
                      <span className="inline-flex h-5 items-center rounded-[4px] bg-[#E6F6EC] px-2 text-[11px] leading-none font-normal text-[#37A46B]">
                        Постоянный
                      </span>
                    </p>
                  </div>

                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Email</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">natalya@gmail.com</p>
                  </div>
                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">История обращений</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">3 заявки с 2023 года</p>
                  </div>

                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Адрес</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">г. Москва, ул. Пушкина, д. 15, кв. 42</p>
                  </div>
                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Комментарий</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">Не звонить после 19:00</p>
                  </div>

                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Для связи</p>
                    <div className="flex items-center gap-2">
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2EA9FF] text-white">
                        <svg viewBox="0 0 24 24" fill="none" className="h-2.5 w-2.5">
                          <path d="M19 5L5 11.2L11 12.8L12.8 19L19 5Z" fill="currentColor" />
                        </svg>
                      </span>
                      <span className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#2EC866] text-white">
                        <svg viewBox="0 0 24 24" fill="none" className="h-2.5 w-2.5">
                          <path d="M16.7 14.2C16.4 14 14.9 13.3 14.6 13.2C14.3 13.1 14.1 13 13.9 13.3C13.7 13.6 13.2 14.1 13.1 14.2C12.9 14.3 12.8 14.3 12.5 14.2C12.2 14 11.4 13.8 10.6 13.1C10 12.5 9.6 11.8 9.5 11.5C9.4 11.2 9.5 11.1 9.6 10.9C9.8 10.8 9.9 10.6 10 10.4C10.1 10.3 10.1 10.1 10.2 10C10.3 9.9 10.2 9.7 10.2 9.6C10.1 9.5 9.5 8 9.3 7.6C9.1 7.2 8.9 7.3 8.8 7.3H8.3C8.1 7.3 7.9 7.4 7.7 7.6C7.5 7.8 7 8.3 7 9.4C7 10.5 7.8 11.6 8 11.9C8.2 12.1 9.5 14.2 11.6 15.1C13.7 16 13.7 15.7 14.2 15.7C14.7 15.7 15.8 15.2 16.1 14.7C16.4 14.3 16.4 14 16.3 13.9C16.1 13.8 17 14.4 16.7 14.2Z" fill="currentColor" />
                        </svg>
                      </span>
                    </div>
                  </div>
                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Источник заявки</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">Реклама баннера</p>
                  </div>
                </div>
              </section>

              <section className="col-span-4 rounded-xl border border-[#E6E7E9] bg-[#fafafa] p-4">
                <div className="mb-5 flex items-center justify-between">
                  <h2 className="text-[26px] leading-none font-semibold tracking-[-0.01em] text-[#2A2A2A]">Об автомобиле</h2>
                  <div className="flex items-center gap-3">
                    <button className="text-[#B1B8C2]">✎</button>
                    <button className="text-[12px] font-medium text-[#76A6C6]">Все сведения</button>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-x-6 gap-y-4">
                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Марка и модель</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#58A4D6]">Hyundai Solaris</p>
                  </div>
                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Пробег</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">87 500 км</p>
                  </div>

                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Гос.номер</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">M456OT799 ⛓</p>
                  </div>
                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Тип кузова</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">Седан</p>
                  </div>

                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">VIN</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">KMHC81BDXXU123456 ⛓</p>
                  </div>
                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Тип топлива</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">Бензин</p>
                  </div>

                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Год выпуска</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">2019</p>
                  </div>
                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Трансмиссия</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">АКПП</p>
                  </div>

                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Цвет</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">Серебристый</p>
                  </div>
                  <div className="min-h-[38px]">
                    <p className="mb-2 text-[11px] leading-none font-normal text-[#A6ADB6]">Комментарий</p>
                    <p className="text-[12px] leading-[1.2] font-medium text-[#2E3035]">Царапина на бампере..Показать</p>
                  </div>
                </div>
              </section>

              <section className="col-span-4 flex min-h-0 flex-col rounded-xl border border-[#E6E7E9] bg-[#fafafa] p-4">
                <h2 className="mb-5 text-[26px] leading-none font-semibold tracking-[-0.01em] text-[#2A2A2A]">Быстрые действия</h2>
                <div className="flex flex-1 flex-col">
                  <div className="space-y-2">
                    <button className="flex h-8 w-full items-center rounded-md border border-[#E6E7E9] bg-white px-3 text-[12px] text-[#4E5158]">✎&nbsp;&nbsp;Редактировать статус заявки</button>
                    <button className="flex h-8 w-full items-center rounded-md border border-[#E6E7E9] bg-white px-3 text-[12px] text-[#4E5158]">◌&nbsp;&nbsp;Добавить комментарий</button>
                    <button className="flex h-8 w-full items-center rounded-md border border-[#E6E7E9] bg-white px-3 text-[12px] text-[#4E5158]">☎&nbsp;&nbsp;Позвонить клиенту</button>
                  </div>
                  <button className="mt-2 self-start px-1 text-[12px] font-medium text-[#76A6C6]">Все действия</button>
                  <button className="mt-auto h-8 w-full rounded-md border border-[#E94046]/20 bg-[#E94046]/10 text-[12px] font-medium text-[#E94046]">Отменить заявку</button>
                </div>
              </section>

              <section className="col-span-8 flex min-h-0 flex-col rounded-xl border border-[#E6E7E9] bg-[#fafafa] p-4">
                <h2 className="mb-5 text-[26px] leading-none font-semibold tracking-[-0.01em] text-[#2A2A2A]">Работы</h2>
                <div className="mb-3 grid grid-cols-2 overflow-hidden rounded-md border border-[#E6E7E9] text-[11px]">
                  <button className="border-r border-[#E94046]/20 bg-[#E94046]/10 py-1.5 text-center font-medium text-[#E94046]">
                    Текущие&nbsp;&nbsp;8
                  </button>
                  <button className="bg-white py-1.5 text-center font-medium text-[#8F96A0]">
                    Завершённые&nbsp;&nbsp;27
                  </button>
                </div>
                <div className="min-h-0 flex-1 overflow-y-auto pr-1">
                  <div className="flex min-h-full flex-col gap-1.5">
                  {requestWorks.map((work) => (
                    <div key={work.name} className="flex flex-1 items-center rounded-md border border-[#ECEDEF] bg-white px-3 py-2">
                      <span className="mr-2 inline-flex h-4 w-4 items-center justify-center rounded-full bg-[#F4F6F8] text-[10px] text-[#9AA1AB]">
                        {work.icon}
                      </span>
                      <p className="text-[13px] font-medium leading-[1.2] text-[#2E3035]">{work.name}</p>
                      <span className="ml-2 text-[12px] text-[#A3A9B1]">{work.state}</span>
                      <span className="ml-auto text-[13px] font-semibold text-[#2E3035]">{work.amount}</span>
                    </div>
                  ))}
                  </div>
                </div>
              </section>

              <section className="col-span-4 grid h-full min-h-0 grid-rows-[auto_1fr] gap-2">
                <article className="rounded-xl border border-[#E6E7E9] bg-[#fafafa] p-4">
                  <div className="mb-5 flex items-center justify-between">
                    <h2 className="text-[26px] leading-none font-semibold tracking-[-0.01em] text-[#2A2A2A]">Ответственный мастер</h2>
                    <button className="text-[#B1B8C2]">⋮</button>
                  </div>
                  <div className="flex items-start gap-2">
                    <img src="https://i.pravatar.cc/80?img=41" alt="Мастер" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                    <div>
                      <p className="text-[12px] font-medium text-[#2E3035]">Журавлёв Михаил</p>
                      <p className="text-[11px] text-[#9AA1AB]">Диагност</p>
                    </div>
                    <span className="ml-auto rounded-md bg-[#E5F5EC] px-2 py-0.5 text-[11px] text-[#2E8B57]">Доступен</span>
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-x-4 text-[11px]">
                    <div>
                      <p className="text-[#9AA1AB]">Телефон</p>
                      <p className="mt-1 text-[12px] font-medium text-[#2E3035]">+7 (915) 234-56-78</p>
                    </div>
                    <div>
                      <p className="text-[#9AA1AB]">Email</p>
                      <p className="mt-1 text-[12px] font-medium text-[#2E3035]">zhuravlev.m@yandex.ru</p>
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-end gap-2 text-[16px]">
                    <span className="text-[#2EA9FF]">🟦</span>
                    <span className="text-[#2EC866]">🟢</span>
                  </div>
                  <button className="mt-2 h-8 w-full rounded-md border border-[#E4E5E7] bg-white text-[12px] text-[#5C616A]">Позвонить</button>
                </article>

                <article className="h-full rounded-xl border border-[#E6E7E9] bg-[#fafafa] p-4">
                  <h2 className="mb-5 text-[26px] leading-none font-semibold tracking-[-0.01em] text-[#2A2A2A]">Финансовая сводка</h2>
                  <div className="space-y-2 text-[12px]">
                    <div className="flex justify-between text-[#9AA1AB]"><span>Стоимость работ</span><span className="font-medium text-[#2E3035]">13 320 ₽</span></div>
                    <div className="flex justify-between text-[#9AA1AB]"><span>Скидка (10%)</span><span className="font-medium text-[#2E8B57]">-780 ₽</span></div>
                    <div className="border-t border-[#ECEDEF]" />
                    <div className="flex justify-between"><span className="font-semibold text-[#2E3035]">Итого</span><span className="font-semibold text-[#2E3035]">12 420 ₽</span></div>
                    <div className="flex justify-between text-[#9AA1AB]"><span>Оплачено</span><span className="font-medium text-[#2E8B57]">5 800 ₽</span></div>
                    <div className="flex justify-between text-[#9AA1AB]"><span>К доплате</span><span className="font-medium text-[#d51a21]">6 620 ₽</span></div>
                  </div>
                </article>
              </section>
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
