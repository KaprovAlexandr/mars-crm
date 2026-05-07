import { useState } from "react";

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

export function PromoLandingPage() {
  const [form, setForm] = useState<FeedbackForm>(INITIAL_FORM);
  const [sent, setSent] = useState(false);

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSent(true);
    setForm(INITIAL_FORM);
    window.setTimeout(() => setSent(false), 4000);
  }

  return (
    <div className="min-h-screen bg-[#07090F] text-white">
      <div className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 opacity-70">
          <div className="promo-glow-1 absolute -top-28 -left-16 h-72 w-72 rounded-full bg-[#8B5CF6]/35 blur-3xl" />
          <div className="promo-glow-2 absolute top-12 right-[-80px] h-72 w-72 rounded-full bg-[#06B6D4]/30 blur-3xl" />
          <div className="promo-grid absolute inset-0" />
        </div>

        <section className="relative mx-auto max-w-6xl px-6 pt-16 pb-14">
          <div className="inline-flex items-center rounded-full border border-white/20 bg-white/5 px-4 py-1.5 text-[12px] font-medium tracking-[0.08em] text-white/80">
            CRM ПЛАТФОРМА ДЛЯ АВТОСЕРВИСОВ
          </div>
          <h1 className="mt-6 max-w-4xl text-[50px] font-semibold leading-[1.02] tracking-[-0.04em]">
            Управляйте автосервисом как техпродуктом:
            <span className="bg-gradient-to-r from-[#A78BFA] to-[#22D3EE] bg-clip-text text-transparent"> быстрее, точнее, прибыльнее.</span>
          </h1>
          <p className="mt-6 max-w-2xl text-[18px] leading-relaxed text-white/75">
            От первой заявки до закрытого заказ-наряда. Система синхронизирует отдел продаж, мастеров и руководство в едином
            контуре данных.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <a
              href="#feedback"
              className="rounded-[12px] bg-white px-5 py-3 text-[15px] font-semibold text-[#0D1321] transition-transform duration-300 hover:-translate-y-0.5"
            >
              Получить демо
            </a>
            <a
              href="#features"
              className="rounded-[12px] border border-white/30 bg-white/5 px-5 py-3 text-[15px] font-semibold text-white backdrop-blur-sm transition-colors hover:bg-white/10"
            >
              Смотреть возможности
            </a>
          </div>
        </section>

        <section className="relative mx-auto grid max-w-6xl grid-cols-1 gap-4 px-6 pb-10 md:grid-cols-3">
          {PRODUCT_METRICS.map((item) => (
            <article
              key={item.label}
              className="rounded-[16px] border border-white/15 bg-white/[0.04] p-5 backdrop-blur-md transition-colors hover:bg-white/[0.07]"
            >
              <p className="text-[13px] text-white/65">{item.label}</p>
              <p className="mt-2 text-[32px] font-semibold tracking-[-0.03em]">{item.value}</p>
            </article>
          ))}
        </section>
      </div>

      <section id="features" className="mx-auto max-w-6xl px-6 py-14">
        <div className="mb-7 flex items-end justify-between gap-4">
          <h2 className="text-[32px] font-semibold tracking-[-0.03em]">Что получает автосервис</h2>
          <p className="max-w-[420px] text-right text-[14px] text-white/60">Минималистичный интерфейс, технологичный UX и быстрый старт команды.</p>
        </div>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {PRODUCT_FEATURES.map((feature, index) => (
            <article
              key={feature.title}
              className="group rounded-[16px] border border-white/15 bg-[#0D111A] p-6 transition-all duration-300 hover:-translate-y-0.5 hover:border-[#A78BFA]/50"
              style={{ animationDelay: `${index * 120}ms` }}
            >
              <div className="mb-4 h-[2px] w-14 bg-gradient-to-r from-[#A78BFA] to-[#22D3EE]" />
              <h3 className="text-[22px] font-semibold tracking-[-0.02em]">{feature.title}</h3>
              <p className="mt-3 text-[15px] leading-relaxed text-white/70">{feature.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section id="feedback" className="mx-auto max-w-6xl px-6 pb-20">
        <div className="grid grid-cols-1 gap-6 rounded-[20px] border border-white/15 bg-[#0B101A] p-6 md:grid-cols-[1.2fr_1fr] md:p-8">
          <div>
            <h2 className="text-[34px] font-semibold leading-[1.05] tracking-[-0.03em]">Запросить персональную презентацию</h2>
            <p className="mt-4 max-w-[560px] text-[15px] leading-relaxed text-white/70">
              Оставьте контакты и расскажите о вашем сервисе. Подготовим сценарий внедрения CRM под вашу загрузку и процессы.
            </p>
            <div className="mt-6 flex flex-wrap gap-2 text-[13px] text-white/60">
              <span className="rounded-full border border-white/20 px-3 py-1">15 минут на бриф</span>
              <span className="rounded-full border border-white/20 px-3 py-1">Без обязательств</span>
              <span className="rounded-full border border-white/20 px-3 py-1">Пилот за 3 дня</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3 rounded-[14px] border border-white/10 bg-white/[0.02] p-4">
            <input
              required
              value={form.name}
              onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))}
              placeholder="Ваше имя"
              className="h-11 w-full rounded-[10px] border border-white/15 bg-[#0F1522] px-3 text-[14px] text-white outline-none placeholder:text-white/40 focus:border-[#A78BFA]/70"
            />
            <input
              required
              value={form.phone}
              onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
              placeholder="Телефон"
              className="h-11 w-full rounded-[10px] border border-white/15 bg-[#0F1522] px-3 text-[14px] text-white outline-none placeholder:text-white/40 focus:border-[#A78BFA]/70"
            />
            <input
              value={form.company}
              onChange={(e) => setForm((prev) => ({ ...prev, company: e.target.value }))}
              placeholder="Название автосервиса"
              className="h-11 w-full rounded-[10px] border border-white/15 bg-[#0F1522] px-3 text-[14px] text-white outline-none placeholder:text-white/40 focus:border-[#A78BFA]/70"
            />
            <textarea
              value={form.message}
              onChange={(e) => setForm((prev) => ({ ...prev, message: e.target.value }))}
              placeholder="Коротко о задаче"
              className="min-h-[100px] w-full resize-none rounded-[10px] border border-white/15 bg-[#0F1522] px-3 py-2.5 text-[14px] text-white outline-none placeholder:text-white/40 focus:border-[#A78BFA]/70"
            />
            <button
              type="submit"
              className="h-11 w-full rounded-[10px] bg-gradient-to-r from-[#8B5CF6] to-[#06B6D4] text-[14px] font-semibold transition-opacity hover:opacity-90"
            >
              Отправить заявку
            </button>
            {sent ? <p className="text-[13px] text-[#67E8F9]">Спасибо! Мы свяжемся с вами в ближайшее время.</p> : null}
          </form>
        </div>
      </section>

      <style>
        {`
          .promo-grid {
            background-image:
              linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px),
              linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px);
            background-size: 38px 38px;
            mask-image: radial-gradient(circle at center, black 30%, transparent 75%);
          }
          .promo-glow-1 {
            animation: promoFloatA 8s ease-in-out infinite;
          }
          .promo-glow-2 {
            animation: promoFloatB 9s ease-in-out infinite;
          }
          @keyframes promoFloatA {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(18px); }
          }
          @keyframes promoFloatB {
            0%, 100% { transform: translateY(0px); }
            50% { transform: translateY(-14px); }
          }
        `}
      </style>
    </div>
  );
}
