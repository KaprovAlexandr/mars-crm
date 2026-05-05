import { NotificationsModal } from "@/components/layout/NotificationsModal";
import { useState } from "react";

function BellIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden>
      <path
        d="M18 8a6 6 0 10-12 0c0 7-3 9-3 9h18s-3-2-3-9"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M13.73 21a2 2 0 01-3.46 0" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

type NavRailNotificationsProps = {
  /** Подпись для скринридеров */
  "aria-label"?: string;
  /** Вариант кнопки: нижняя колонка (как остальные иконки) или компакт для шапки */
  variant?: "rail" | "compact";
};

export function NavRailNotifications({
  "aria-label": ariaLabel = "Уведомления",
  variant = "rail",
}: NavRailNotificationsProps) {
  const [open, setOpen] = useState(false);

  const railBtn =
    "grid h-12 w-12 place-items-center rounded-[10px] text-[#8C93A5] transition hover:bg-white/10 hover:text-[#B8C0D0]";
  const compactBtn =
    "inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#E6E7E9] bg-white text-[#6D7480] transition hover:bg-[#fafafa]";

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={variant === "compact" ? compactBtn : railBtn}
        aria-label={ariaLabel}
        title={ariaLabel}
      >
        <BellIcon className={variant === "compact" ? "h-[20px] w-[20px]" : "h-[28px] w-[28px]"} />
      </button>
      <NotificationsModal open={open} onClose={() => setOpen(false)} />
    </>
  );
}
