import { MarsAppShellSidebar } from "@/components/layout/MarsAppShellSidebar";
import { AuthStyleExitOverlay } from "@/components/ui/AuthStyleExitOverlay";
import { ProfilePhotoFace } from "@/components/ui/ProfilePhotoFace";
import { useEmployeeRole } from "@/lib/auth/AuthRoleContext";
import { ROLE_LABELS, type EmployeeRole } from "@/lib/auth/employeeRole";
import { logoutCurrentUser, updateCurrentUserProfilePhoto } from "@/lib/auth/firebaseAuth";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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

const PUBLIC_PROFILE_FIELDS_TEMPLATE = [
  { label: "Дата рождения", value: "14.02.1992" },
  { label: "Пол", value: "Мужской" },
  { label: "Гражданство", value: "Российская Федерация" },
  { label: "Телефон", value: "+7 (911) 123-45-67" },
  { label: "E-mail", value: "example@post.ru" },
  { label: "Должность", value: "Менеджер по работе с клиентами" },
  { label: "График работы", value: "5/2, 09:00 - 18:00" },
  { label: "Статус", value: "В отпуске" },
];

function buildPublicFieldsFromAuth(role: EmployeeRole, email: string | null) {
  const position = ROLE_LABELS[role];
  const emailStr = email?.trim() ?? "";
  return PUBLIC_PROFILE_FIELDS_TEMPLATE.map((f) => {
    if (f.label === "E-mail") return { ...f, value: emailStr || "—" };
    if (f.label === "Должность") return { ...f, value: position };
    return { ...f };
  });
}

/** Две строки крупного заголовка: всё кроме последнего слова / последнее слово (удобно для ФИО из 3 слов). */
function splitDisplayNameForHero(displayName: string): [string, string] {
  const parts = displayName.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return ["", ""];
  if (parts.length === 1) return [parts[0], ""];
  if (parts.length === 2) return [parts[0], parts[1]];
  return [parts.slice(0, -1).join(" "), parts[parts.length - 1] ?? ""];
}

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
  const { role, fullName, firebaseUser, email } = useEmployeeRole();
  const roleTitle = ROLE_LABELS[role];
  const displayName = fullName;

  const [heroLine1, heroLine2] = useMemo(() => splitDisplayNameForHero(displayName), [displayName]);
  const photoUrlFromAuth = firebaseUser?.photoURL?.trim() ?? "";
  const [localPhotoUrl, setLocalPhotoUrl] = useState<string | null>(null);
  const displayedPhotoSrc = localPhotoUrl ?? (photoUrlFromAuth || null);

  const [isEditingFields, setIsEditingFields] = useState(false);
  const [publicFields, setPublicFields] = useState(() => buildPublicFieldsFromAuth("manager", null));
  const [photoError, setPhotoError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [exitOverlay, setExitOverlay] = useState(false);

  const finishExitToPromo = useCallback(async () => {
    navigate("/promo", { replace: true });
    try {
      await logoutCurrentUser();
    } catch {
      // ignore
    }
  }, [navigate]);

  useEffect(() => {
    setPublicFields(buildPublicFieldsFromAuth(role, email));
    setIsEditingFields(false);
    setLocalPhotoUrl(null);
    setPhotoError("");
  }, [role, email, fullName]);

  async function handlePhotoFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file || !isEditingFields) return;
    if (!file.type.startsWith("image/")) {
      setPhotoError("Выберите файл изображения.");
      return;
    }
    if (file.size > 8 * 1024 * 1024) {
      setPhotoError("Файл слишком большой (макс. 8 МБ).");
      return;
    }
    setPhotoError("");
    setPhotoBusy(true);
    try {
      await updateCurrentUserProfilePhoto(file);
      setLocalPhotoUrl(null);
    } catch (err) {
      console.warn("updateProfile photo failed", err);
      setPhotoError("Не удалось сохранить фото в аккаунте. Попробуйте файл меньшего размера.");
    } finally {
      setPhotoBusy(false);
    }
  }

  function handleExitClick() {
    if (exitOverlay) return;
    setExitOverlay(true);
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-black tracking-[-0.04em] max-lg:min-h-screen max-lg:h-auto max-lg:overflow-y-auto lg:h-screen lg:overflow-hidden">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp,image/gif"
        className="sr-only"
        aria-hidden
        onChange={(e) => void handlePhotoFileChange(e)}
      />

      <div className="flex h-full w-full min-h-0 p-2 max-lg:h-auto lg:h-full">
        <div className="flex h-full min-h-0 w-full max-lg:h-auto max-lg:flex-col rounded-[16px] bg-black p-2 shadow-none lg:flex-row lg:shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)]">
          <MarsAppShellSidebar mobileLayout="requests" />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:overflow-x-hidden">
            <header className="mb-2 rounded-[16px] border border-[#DDE1E7] bg-white px-4 py-4 lg:px-5 lg:py-5">
              <div className="flex items-center gap-3 max-lg:flex-col max-lg:items-stretch max-lg:gap-2 lg:flex-row lg:items-center">
                <div className="flex items-baseline gap-2 whitespace-nowrap">
                  <h1 className="text-[28px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826] lg:text-[36px]">Профиль</h1>
                  <span className="text-[16px] font-bold tracking-[-0.04em] text-[#888888]">({roleTitle.toLowerCase()})</span>
                </div>
                <div className="ml-auto h-12" />
              </div>
            </header>
            <section className="flex min-h-0 flex-1 gap-2 max-lg:h-auto max-lg:flex-col lg:h-full">
              <section className="relative w-[40%] min-w-[360px] rounded-[16px] border border-[#DDE1E7] bg-white p-6 max-lg:w-full max-lg:min-w-0 max-lg:p-4 max-sm:pb-24 md:max-lg:pb-28 lg:p-6">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h1 className="max-w-[420px] text-[38px] font-semibold leading-[0.98] tracking-[-0.03em] text-[#202636] max-sm:text-[30px] lg:text-[52px]">
                      <span className="block whitespace-nowrap max-sm:whitespace-normal [overflow-wrap:anywhere]">{heroLine1 || displayName}</span>
                      {heroLine2 ? <span className="block">{heroLine2}</span> : null}
                    </h1>
                  </div>
                  <div className="relative shrink-0">
                    <button
                      type="button"
                      disabled={!isEditingFields || photoBusy}
                      onClick={() => {
                        if (isEditingFields && !photoBusy) fileInputRef.current?.click();
                      }}
                      className={`relative grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-full border-2 bg-[#F3F3F5] outline-none transition-[box-shadow] ${
                        isEditingFields
                          ? "cursor-pointer border-[#EC1C24] shadow-[0_0_0_3px_rgba(236,28,36,0.15)] hover:shadow-[0_0_0_4px_rgba(236,28,36,0.2)]"
                          : "cursor-default border-transparent"
                      } disabled:cursor-wait`}
                      aria-label={isEditingFields ? "Загрузить фото профиля" : "Фото профиля"}
                    >
                      <ProfilePhotoFace
                        photoSrc={displayedPhotoSrc}
                        alt={displayName ? `Фото: ${displayName}` : "Фото профиля"}
                        className="h-full w-full object-cover"
                      />
                      {isEditingFields ? (
                        <span className="pointer-events-none absolute inset-x-0 bottom-0 bg-black/55 py-1 text-center text-[10px] font-semibold tracking-[-0.04em] text-white">
                          Фото
                        </span>
                      ) : null}
                    </button>
                    {photoBusy ? (
                      <span className="absolute inset-0 grid place-items-center rounded-full bg-white/60 text-[11px] font-semibold text-[#111826]">
                        …
                      </span>
                    ) : null}
                  </div>
                </div>
                {photoError ? <p className="mt-2 text-[12px] font-medium text-[#C62828]">{photoError}</p> : null}
                {isEditingFields ? (
                  <p className="mt-1 text-[12px] font-medium tracking-[-0.04em] text-[#6F7785]">Нажмите на фото, чтобы загрузить своё изображение.</p>
                ) : null}
                <div className="mt-[50px] max-sm:mt-6">
                  <div className="grid grid-cols-2 gap-x-3 gap-y-4 max-sm:grid-cols-1">
                    {publicFields.map((field, index) => (
                      <div
                        key={field.label}
                        style={{ transitionDelay: `${index * 24}ms`, transitionDuration: "350ms" }}
                        className={`h-auto min-h-[68px] rounded-[10px] border-2 px-4 py-3 transition-all duration-350 ease-out lg:h-[68px] ${
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
                          <p className="mt-1 whitespace-normal break-words text-[16px] font-medium leading-[1.2] tracking-[-0.02em] text-[#3C4352] [overflow-wrap:anywhere]">
                            {field.value}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setIsEditingFields((v) => !v)}
                  className={`absolute bottom-4 left-4 grid h-12 w-12 cursor-pointer place-items-center rounded-[10px] max-sm:bottom-6 ${
                    isEditingFields ? "bg-[#EC1C24] text-white" : "bg-[#F3F3F5] text-[#8C909C]"
                  }`}
                  aria-label="Редактировать поля и фото"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-[28px] w-[28px]">
                    <path d="M4 20h4.5L19 9.5 14.5 5 4 15.5V20Z" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
                    <path d="M12.5 7l4.5 4.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={handleExitClick}
                  disabled={exitOverlay}
                  className="absolute bottom-4 right-4 grid h-12 w-12 cursor-pointer place-items-center rounded-[10px] bg-[#F3F3F5] text-[#8C909C] transition-opacity hover:bg-[#E8EAEF] disabled:cursor-wait disabled:opacity-50 max-sm:bottom-6"
                  aria-label="Выйти из профиля"
                >
                  <svg viewBox="0 0 24 24" fill="none" className="h-[28px] w-[28px]">
                    <path d="M10 4.5H6.5C5.4 4.5 4.5 5.4 4.5 6.5V17.5C4.5 18.6 5.4 19.5 6.5 19.5H10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                    <path d="M14 8.5L18 12L14 15.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                    <path d="M9 12H18" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
                  </svg>
                </button>
              </section>

              <section className="min-w-0 flex-1 rounded-[16px] border border-[#DDE1E7] bg-white p-6 max-lg:w-full max-lg:p-4 lg:p-6">
                <article className="relative mt-6 max-sm:mt-4">
                  <div className="mb-4 max-sm:mb-3">
                    <h3 className="text-[24px] font-semibold tracking-[-0.02em] text-[#111826]">Моя эффективность</h3>
                  </div>
                  <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
                    {employeeKpiCards.map((card) => (
                      <article key={card.title} className="flex h-auto min-h-[128px] flex-col rounded-[12px] bg-[#F3F3F5] px-4 py-3">
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
              </section>
            </section>
          </main>
        </div>
      </div>

      <AuthStyleExitOverlay active={exitOverlay} onFinished={finishExitToPromo} />
    </div>
  );
}
