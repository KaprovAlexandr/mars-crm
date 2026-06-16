import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { isFirebaseConfigured, logoutCurrentUser, watchAuthState } from "@/lib/auth/firebaseAuth";
import { resolveUserFullName, syncUserDisplayName } from "@/lib/auth/userFullName";

type FeedbackForm = {
  name: string;
  phone: string;
  company: string;
  message: string;
};

const INITIAL_FORM: FeedbackForm = {
  name: "",
  phone: "",
  company: "",
  message: "",
};

const PRODUCT_METRICS = [
  { label: "Скорость обработки заявок", value: "+42%" },
  { label: "Снижение потерь времени", value: "-31%" },
  { label: "Рост повторных клиентов", value: "+27%" },
] as const;

const PRODUCT_FEATURES = [
  {
    title: "Единый поток заявок",
    text: "Звонки, сайт и мессенджеры в одном интерфейсе без потери лидов.",
  },
  {
    title: "Умный журнал записи",
    text: "Автоматический подбор слотов и контроль загрузки по боксам и мастерам.",
  },
  {
    title: "Контроль команды",
    text: "Статусы работ, действия сотрудников и аналитика в реальном времени.",
  },
  {
    title: "Финансовая прозрачность",
    text: "Выручка, маржинальность и динамика услуг на одном дашборде.",
  },
] as const;

/** В шапке: «Фамилия Имя» из displayName (первые два слова), без многоточия; иначе e-mail. */
function shortNameForHeader(displayName: string | null, email: string | null): string {
  const raw = displayName?.trim();
  if (raw) {
    const parts = raw.split(/\s+/).filter(Boolean);
    if (parts.length === 0) return "";
    if (parts.length <= 2) return parts.join(" ");
    return `${parts[0]} ${parts[1]}`;
  }
  return email?.trim() ?? "";
}

export function PromoLandingPage() {
  const navigate = useNavigate();
  const [form, setForm] = useState<FeedbackForm>(INITIAL_FORM);
  const [sent, setSent] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [sessionUserEmail, setSessionUserEmail] = useState<string | null>(null);
  const [sessionUserName, setSessionUserName] = useState<string | null>(null);
  const [firebaseReady, setFirebaseReady] = useState(false);

  useEffect(() => {
    if (!isFirebaseConfigured()) {
      setFirebaseReady(false);
      return;
    }
    setFirebaseReady(true);
    const unsubscribe = watchAuthState((user) => {
      setSessionUserEmail(user?.email ?? null);
      if (!user) {
        setSessionUserName(null);
        return;
      }
      setSessionUserName(resolveUserFullName(user, user.email));
      void syncUserDisplayName(user).then((name) => setSessionUserName(name));
    });
    return () => unsubscribe();
  }, []);

  function openAuth(mode: "register" | "login") {
    setMobileMenuOpen(false);
    navigate(mode === "register" ? "/register" : "/auth");
  }

  async function handleLogout() {
    try {
      await logoutCurrentUser();
    } catch {
      // ignore logout errors
    } finally {
      setSessionUserEmail(null);
      setSessionUserName(null);
    }
  }

  const headerUserLabel = shortNameForHeader(sessionUserName, sessionUserEmail);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
    setForm(INITIAL_FORM);
    window.setTimeout(() => setSent(false), 4000);
  }

  return (
    <div className="min-h-screen bg-white text-[#111111] font-['Inter'] tracking-[-0.04em]">
      <div className="relative overflow-hidden">
        <header className="w-full border-b border-black">
          <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-4 py-5 sm:px-6">
            <div className="text-[16px] font-semibold text-black sm:text-[18px] md:w-[240px]">CRM система</div>
            <nav className="hidden items-center gap-6 md:flex" aria-label="Навигация по лендингу">
              <a href="#hero" className="text-[14px] font-medium text-black transition-opacity hover:opacity-70">
                Главная
              </a>
              <a href="#features" className="text-[14px] font-medium text-black transition-opacity hover:opacity-70">
                Возможности
              </a>
              <a href="#feedback" className="text-[14px] font-medium text-black transition-opacity hover:opacity-70">
                Контакты
              </a>
            </nav>
            <button
              type="button"
              className="inline-flex h-10 w-10 items-center justify-center rounded-[10px] border border-black/15 bg-black text-white md:hidden"
              aria-label="Открыть меню"
              onClick={() => setMobileMenuOpen(true)}
            >
              ☰
            </button>
            <div className="hidden min-w-0 md:flex md:w-[240px] md:max-w-[240px]">
              {sessionUserEmail ? (
                <div className="flex w-full flex-nowrap items-center justify-between gap-3">
                  <span className="min-w-0 flex-1 whitespace-nowrap rounded-[10px] border border-[#D8DFEB] bg-[#F6F8FC] px-3 py-2 text-center text-[13px] text-[#3C4352]">
                    {headerUserLabel}
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="shrink-0 rounded-[10px] border border-[#D8DFEB] bg-white px-4 py-2 text-[13px] font-semibold text-[#2C3240] transition-colors hover:bg-[#F3F6FB]"
                  >
                    Выйти
                  </button>
                </div>
              ) : (
                <div className="flex w-full flex-nowrap items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => openAuth("register")}
                    disabled={!firebaseReady}
                    className="shrink-0 rounded-[10px] bg-[#EC1C24] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Регистрация
                  </button>
                  <button
                    type="button"
                    onClick={() => openAuth("login")}
                    disabled={!firebaseReady}
                    className="shrink-0 rounded-[10px] bg-[#1A1F2B] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Авторизация
                  </button>
                </div>
              )}
            </div>
          </div>
        </header>

        <section id="hero" className="relative mx-auto max-w-6xl px-4 pt-12 pb-12 sm:px-6 sm:pt-16 sm:pb-14">
          {!firebaseReady ? (
            <p className="mb-3 text-right text-[12px] text-[#D45A5A]">
              Firebase не настроен. Добавьте `VITE_FIREBASE_*` переменные в `.env`.
            </p>
          ) : null}
          <div className="inline-flex items-center rounded-full border border-[#D9DEE8] bg-[#F7F9FC] px-4 py-1.5 text-[12px] font-medium tracking-[0.08em] text-[#4E5667]">
            CRM ПЛАТФОРМА ДЛЯ АВТОСЕРВИСОВ
          </div>
          <h1 className="mt-6 max-w-4xl text-[34px] font-semibold leading-[1.04] tracking-[-0.04em] text-black sm:text-[42px] lg:text-[50px]">
            CRM система: управляйте автосервисом как техпродуктом: быстрее, точнее, прибыльнее.
          </h1>
          <p className="mt-6 max-w-2xl text-[16px] leading-relaxed text-[#5A6375] sm:text-[18px]">
            От первой заявки до закрытого заказ-наряда. Система синхронизирует отдел продаж, мастеров и руководство в едином
            контуре данных.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#feedback"
              className="rounded-[12px] bg-[#EC1C24] px-5 py-3 text-[15px] font-semibold text-white transition-transform duration-300 hover:-translate-y-0.5 max-sm:w-full max-sm:text-center"
            >
              Получить демо
            </a>
            <a
              href="#features"
              className="rounded-[12px] bg-black px-5 py-3 text-[15px] font-semibold text-white transition-opacity hover:opacity-90 max-sm:w-full max-sm:text-center"
            >
              Смотреть возможности
            </a>
          </div>
        </section>

        <section className="relative mx-auto grid max-w-6xl grid-cols-1 gap-4 px-4 pb-10 sm:px-6 md:grid-cols-3">
          {PRODUCT_METRICS.map((item) => (
            <article
              key={item.label}
              className="rounded-[16px] border border-[#DFE4ED] bg-white p-5 transition-colors hover:bg-[#F8FAFD]"
            >
              <p className="text-[13px] text-[#6B7385]">{item.label}</p>
              <p className="mt-2 text-[32px] font-semibold tracking-[-0.03em] text-[#1E2738]">{item.value}</p>
            </article>
          ))}
        </section>
      </div>

      <section id="features" className="mx-auto max-w-6xl px-4 py-12 sm:px-6 sm:py-14">
        <div className="mb-7 flex items-end justify-between gap-4 max-sm:flex-col max-sm:items-start">
          <h2 className="text-[28px] font-semibold tracking-[-0.03em] text-[#1A1F2B] sm:text-[32px]">Что получает автосервис</h2>
          <p className="max-w-[420px] text-right text-[14px] text-[#6B7385] max-sm:text-left">Минималистичный интерфейс, технологичный UX и быстрый старт команды.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PRODUCT_FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className="group rounded-[16px] border border-[#DFE4ED] bg-white p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#B8C2D6]"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="mb-4 h-[2px] w-14 bg-[#EC1C24]" />
              <h3 className="text-[22px] font-semibold tracking-[-0.02em] text-[#1A1F2B]">{feature.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-[#5A6375]">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="feedback" className="mx-auto max-w-6xl px-4 pb-16 sm:px-6 sm:pb-20">
        <div className="grid grid-cols-1 gap-6 rounded-[20px] border border-[#DFE4ED] bg-white p-6 md:grid-cols-[1.2fr_1fr] md:p-8">
          <div>
            <h2 className="text-[28px] font-semibold leading-[1.05] tracking-[-0.03em] text-[#1A1F2B] sm:text-[34px]">Запросить персональную презентацию</h2>
            <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-[#5A6375]">
              Оставьте контакты и расскажите о вашем сервисе. Подготовим сценарий внедрения CRM под вашу загрузку и процессы.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[13px] text-[#6B7385]">
              <span className="rounded-full border border-[#D9DEE8] px-3 py-1">15 минут на бриф</span>
              <span className="rounded-full border border-[#D9DEE8] px-3 py-1">Без обязательств</span>
              <span className="rounded-full border border-[#D9DEE8] px-3 py-1">Пилот за 3 дня</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 rounded-[14px] border border-[#DFE4ED] bg-[#F8FAFD] p-4">
            <input
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ваше имя"
              className="h-11 w-full rounded-[10px] border border-[#D3DAE8] bg-white px-3 text-[14px] text-[#1A1F2B] outline-none placeholder:text-[#97A1B4] focus:border-[#2C4A85]"
            />
            <input
              required
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Телефон"
              className="h-11 w-full rounded-[10px] border border-[#D3DAE8] bg-white px-3 text-[14px] text-[#1A1F2B] outline-none placeholder:text-[#97A1B4] focus:border-[#2C4A85]"
            />
            <input
              value={form.company}
              onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
              placeholder="Название автосервиса"
              className="h-11 w-full rounded-[10px] border border-[#D3DAE8] bg-white px-3 text-[14px] text-[#1A1F2B] outline-none placeholder:text-[#97A1B4] focus:border-[#2C4A85]"
            />
            <textarea
              value={form.message}
              onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              placeholder="Коротко о задаче"
              className="min-h-[100px] w-full resize-none rounded-[10px] border border-[#D3DAE8] bg-white px-3 py-2.5 text-[14px] text-[#1A1F2B] outline-none placeholder:text-[#97A1B4] focus:border-[#2C4A85]"
            />
            <button
              type="submit"
              className="h-11 w-full rounded-[10px] bg-[#1A1F2B] text-[14px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Отправить заявку
            </button>
            {sent ? <p className="text-[13px] text-[#2C4A85]">Спасибо! Мы свяжемся с вами в ближайшее время.</p> : null}
          </form>
        </div>
      </section>
      <footer className="w-full bg-black py-8">
        <div className="mx-auto w-full max-w-6xl px-4 sm:px-6">
          <div className="flex w-full flex-col items-start justify-between gap-4 sm:flex-row sm:items-start">
            <div className="flex flex-col items-start sm:min-h-[96px]">
              <p className="text-[14px] font-medium text-white">CRM система</p>
              <div className="mt-auto flex flex-col items-start leading-tight">
                <p className="text-[12px] text-white/75">@2026 Капров А. Н.</p>
                <p className="text-[12px] text-white/75">Права защищены.</p>
              </div>
            </div>
            <div className="flex flex-col items-start gap-2">
              <a href="#hero" className="text-[13px] text-white transition-opacity hover:opacity-70">
                Главная
              </a>
              <a href="#features" className="text-[13px] text-white transition-opacity hover:opacity-70">
                Возможности
              </a>
              <a href="#feedback" className="text-[13px] text-white transition-opacity hover:opacity-70">
                Контакты
              </a>
            </div>
            <a
              href="#feedback"
              className="rounded-[10px] bg-[#EC1C24] px-4 py-2 text-[13px] font-semibold text-white transition-opacity hover:opacity-90"
            >
              Получить демо
            </a>
          </div>
        </div>
      </footer>
      {mobileMenuOpen ? (
        <>
          <button
            type="button"
            aria-label="Закрыть меню"
            className="fixed inset-0 z-[280] bg-black/55 backdrop-blur-[2px] md:hidden"
            onClick={() => setMobileMenuOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Меню разделов"
            className="fixed inset-y-0 right-0 z-[290] flex w-[min(300px,calc(100vw-40px))] max-w-full flex-col rounded-l-[16px] border-l border-white/10 bg-[#0a0c10] shadow-[-12px_0_40px_-12px_rgba(0,0,0,0.85)] md:hidden"
          >
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-4 py-3">
              <p className="text-[17px] font-semibold tracking-[-0.04em] text-white">Меню</p>
              <button
                type="button"
                className="grid h-11 w-11 place-items-center rounded-[12px] text-[22px] text-white transition-colors hover:bg-white/10"
                aria-label="Закрыть меню"
                onClick={() => setMobileMenuOpen(false)}
              >
                ×
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4">
              <div className="flex flex-col gap-2 text-[16px]">
                <a
                  href="#hero"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-[12px] px-3 py-3 text-white transition-colors hover:bg-white/10"
                >
                  Главная
                </a>
                <a
                  href="#features"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-[12px] px-3 py-3 text-white transition-colors hover:bg-white/10"
                >
                  Возможности
                </a>
                <a
                  href="#feedback"
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-[12px] px-3 py-3 text-white transition-colors hover:bg-white/10"
                >
                  Контакты
                </a>
              </div>
              <div className="mt-6 flex flex-col gap-3">
                <button
                  type="button"
                  onClick={() => openAuth("register")}
                  disabled={!firebaseReady}
                  className="rounded-[10px] bg-[#EC1C24] px-4 py-3 text-[14px] font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Регистрация
                </button>
                <button
                  type="button"
                  onClick={() => openAuth("login")}
                  disabled={!firebaseReady}
                  className="rounded-[10px] bg-white px-4 py-3 text-[14px] font-semibold text-black transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Авторизация
                </button>
              </div>
            </div>
          </div>
        </>
      ) : null}
    </div>
  );
}
