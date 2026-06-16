import { useNavigate } from "react-router-dom";

const SECTIONS = [
  {
    title: "1. Общие положения",
    paragraphs: [
      "Настоящая Политика конфиденциальности определяет порядок обработки и защиты персональных данных пользователей веб-приложения «Марс» (далее — Сервис), предназначенного для автоматизации работы автосервиса.",
      "Используя Сервис, регистрируя учётную запись или входя в неё, вы подтверждаете, что ознакомились с настоящей Политикой и соглашаетесь с её условиями.",
    ],
  },
  {
    title: "2. Оператор персональных данных",
    paragraphs: [
      "Оператором персональных данных является владелец программного продукта «Марс» — Капров А. Н.",
      "По вопросам обработки персональных данных вы можете обратиться через раздел «Служба поддержки» в Сервисе или по контактам, указанным на сайте.",
    ],
  },
  {
    title: "3. Какие данные мы обрабатываем",
    paragraphs: [
      "При регистрации и использовании Сервиса могут обрабатываться следующие категории данных:",
    ],
    list: [
      "имя и фамилия, указанные при регистрации;",
      "адрес электронной почты;",
      "данные учётной записи Firebase Authentication (в том числе при входе через Google);",
      "фотография профиля, если вы её загрузили;",
      "технические данные: IP-адрес, тип браузера, сведения об устройстве и действиях в Сервисе.",
    ],
  },
  {
    title: "4. Цели обработки данных",
    paragraphs: [
      "Персональные данные используются исключительно для обеспечения работы Сервиса, в том числе для:",
    ],
    list: [
      "создания и управления учётной записью пользователя;",
      "разграничения прав доступа сотрудников;",
      "ведения заявок, журнала записей, заказ-нарядов и клиентской базы;",
      "отправки уведомлений о событиях в Сервисе;",
      "обеспечения безопасности и предотвращения несанкционированного доступа.",
    ],
  },
  {
    title: "5. Правовые основания",
    paragraphs: [
      "Обработка персональных данных осуществляется на основании согласия пользователя, а также в случаях, когда обработка необходима для исполнения договора (пользовательского соглашения) и законных интересов оператора при соблюдении прав субъекта персональных данных.",
    ],
  },
  {
    title: "6. Передача данных третьим лицам",
    paragraphs: [
      "Для аутентификации и хранения учётных записей Сервис использует Firebase (Google LLC). Передача данных осуществляется в объёме, необходимом для работы соответствующих сервисов, и на условиях их политик конфиденциальности.",
      "Мы не продаём персональные данные и не передаём их третьим лицам в маркетинговых целях без отдельного согласия пользователя.",
    ],
  },
  {
    title: "7. Срок хранения",
    paragraphs: [
      "Персональные данные хранятся в течение срока использования Сервиса и до момента удаления учётной записи либо отзыва согласия, если иное не предусмотрено законодательством Российской Федерации.",
    ],
  },
  {
    title: "8. Права пользователя",
    paragraphs: [
      "Вы вправе запросить уточнение, блокирование или удаление своих персональных данных, отозвать согласие на обработку, а также обжаловать действия оператора в уполномоченный орган по защите прав субъектов персональных данных.",
    ],
  },
  {
    title: "9. Защита данных",
    paragraphs: [
      "Оператор принимает необходимые организационные и технические меры для защиты персональных данных от неправомерного доступа, изменения, раскрытия или уничтожения, включая использование защищённых каналов связи и разграничение доступа сотрудников.",
    ],
  },
  {
    title: "10. Изменения политики",
    paragraphs: [
      "Оператор вправе обновлять настоящую Политику. Актуальная версия всегда доступна на данной странице. Продолжение использования Сервиса после публикации изменений означает согласие с обновлённой редакцией.",
    ],
  },
] as const;

export function PrivacyPolicyPage() {
  const navigate = useNavigate();

  function goBack() {
    if (window.history.length > 1) {
      navigate(-1);
      return;
    }
    navigate("/auth");
  }

  return (
    <div className="box-border flex h-dvh min-h-dvh flex-col overflow-y-auto bg-black p-2 tracking-[-0.04em]">
      <div className="grid min-h-0 w-full flex-1 gap-2 max-lg:grid-rows-[minmax(160px,1fr)_auto] lg:grid-cols-[1.25fr_1fr] lg:grid-rows-1">
        <section className="relative min-h-0 h-full overflow-hidden rounded-[16px]">
          <img src="/auth-hero.png" alt="Мастер за диагностикой автомобиля" className="h-full min-h-full w-full object-cover" />
          <div className="absolute inset-0 bg-black/35" />
          <h1 className="absolute left-6 top-6 right-6 flex max-w-[560px] flex-col gap-1 text-[clamp(24px,4.5vw,56px)] font-semibold leading-[1.08] text-white sm:left-8 sm:top-8 sm:right-auto">
            <span className="block">Политика</span>
            <span className="block">конфиденциальности</span>
          </h1>
        </section>

        <section className="flex flex-col overflow-y-auto rounded-[16px] bg-white px-4 py-6 sm:px-6 sm:py-8 md:px-10 lg:min-h-0 lg:h-full">
          <div className="mx-auto w-full max-w-[560px]">
            <div className="mb-6 flex items-center justify-between gap-4 sm:mb-8">
              <button
                type="button"
                onClick={goBack}
                className="inline-flex cursor-pointer items-center gap-2 rounded-[10px] border border-[#EAEAEA] px-3 py-2 text-[13px] font-semibold text-[#5652CE] transition hover:bg-[#F8F8FA]"
              >
                <span aria-hidden>←</span>
                Назад
              </button>
              <div
                className="grid h-[56px] w-[64px] shrink-0 place-items-center rounded-[14px] bg-[#EC1C24] text-[15px] font-semibold text-white sm:h-[64px] sm:w-[72px] sm:text-[16px]"
                aria-label="Марс"
              >
                Марс
              </div>
            </div>

            <div className="mb-6 sm:mb-8">
              <h2 className="text-[30px] font-semibold leading-[1.15] text-[#111111] sm:text-[38px]">Политика конфиденциальности</h2>
              <p className="mt-2 text-[13px] font-medium text-[#8A8A8A]">Дата последнего обновления: 15 июня 2026 г.</p>
            </div>

            <div className="space-y-6 text-[14px] leading-[1.55] text-[#3D3D3D] sm:text-[15px]">
              {SECTIONS.map((section) => (
                <section key={section.title}>
                  <h3 className="mb-2 text-[16px] font-semibold text-[#111111] sm:text-[17px]">{section.title}</h3>
                  {section.paragraphs.map((paragraph) => (
                    <p key={paragraph} className="mb-2 last:mb-0">
                      {paragraph}
                    </p>
                  ))}
                  {"list" in section && section.list ? (
                    <ul className="mt-2 list-disc space-y-1.5 pl-5">
                      {section.list.map((item) => (
                        <li key={item}>{item}</li>
                      ))}
                    </ul>
                  ) : null}
                </section>
              ))}
            </div>

            <div className="mt-10 flex flex-wrap items-center justify-center gap-2 border-t border-[#EFEFEF] pt-6 text-[12px] text-[#C1C1C1] sm:mt-12 sm:justify-between">
              <span className="w-full text-center sm:w-auto sm:text-left">© 2026 Капров А. Н.</span>
              <div className="flex w-full flex-wrap items-center justify-center gap-4 sm:w-auto sm:justify-start sm:gap-5">
                <button type="button" onClick={() => navigate("/auth")} className="cursor-pointer hover:text-[#8A8A8A]">
                  Вход
                </button>
                <button type="button" onClick={() => navigate("/register")} className="cursor-pointer hover:text-[#8A8A8A]">
                  Регистрация
                </button>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
