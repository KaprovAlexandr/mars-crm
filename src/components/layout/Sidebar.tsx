import { SidebarIcon } from "@/components/icons/SidebarIcon";
import { SidebarItem } from "@/types/crm";

interface SidebarProps {
  items: SidebarItem[];
}

export function Sidebar({ items }: SidebarProps) {
  return (
    <aside className="hidden w-64 border-r border-[#DFE1E4] bg-[#F2F2F2] lg:flex lg:flex-col">
      <div className="px-5 pt-4">
        <img src="/header-logo.svg" alt="Логотип" width={148} height={33} className="h-10 w-auto" />
      </div>
      <nav className="mt-6 space-y-0.5 px-0 text-[13px]">
        {items.map((item) => (
          <button
            key={item.label}
            type="button"
            className={`group flex w-full items-center gap-2.5 px-6 py-2 text-left transition ${
              item.active ? "bg-[#d51a21] text-white" : "text-[#7D7D7D] hover:bg-white/70"
            }`}
          >
            <span className="inline-flex h-4 w-4 items-center justify-center text-current">
              <SidebarIcon type={item.icon} />
            </span>
            <span>{item.label}</span>
          </button>
        ))}
      </nav>
      <button
        type="button"
        className="mx-3 mt-3 rounded-full bg-transparent px-3 py-2 text-[13px] font-medium text-[#676767] transition hover:bg-white/70"
      >
        + Создать заявку
      </button>
      <div className="mt-auto border-t border-[#E1E1E1] px-3 py-4">
        <button
          type="button"
          className="mb-2 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-[#7D7D7D] hover:bg-white/70"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 stroke-[1.8]">
              <path d="M6 12H18" stroke="currentColor" strokeLinecap="round" />
              <path d="M12 6V18" stroke="currentColor" strokeLinecap="round" />
            </svg>
          </span>
          Служба поддержки
        </button>
        <button
          type="button"
          className="mb-2 flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] text-[#7D7D7D] hover:bg-white/70"
        >
          <span className="inline-flex h-4 w-4 items-center justify-center">
            <svg viewBox="0 0 24 24" fill="none" className="h-4 w-4 stroke-[1.8]">
              <path d="M12 3V6" stroke="currentColor" strokeLinecap="round" />
              <path d="M12 18V21" stroke="currentColor" strokeLinecap="round" />
              <path d="M4.2 7.2L6.3 9.3" stroke="currentColor" strokeLinecap="round" />
              <path d="M17.7 14.7L19.8 16.8" stroke="currentColor" strokeLinecap="round" />
              <path d="M3 12H6" stroke="currentColor" strokeLinecap="round" />
              <path d="M18 12H21" stroke="currentColor" strokeLinecap="round" />
            </svg>
          </span>
          Уведомления
        </button>
        <div className="flex items-center gap-2.5 px-3 py-1">
          <img
            src="https://i.pravatar.cc/80?img=12"
            alt="Фотография Алексеев Дмитрий"
            width={24}
            height={24}
            className="h-6 w-6 rounded-full object-cover"
          />
          <span className="text-[12px] text-[#7D7D7D]">Алексеев Дмитрий</span>
        </div>
      </div>
    </aside>
  );
}
