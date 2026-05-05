import { SidebarIconType } from "@/types/crm";

interface SidebarIconProps {
  type: SidebarIconType;
  className?: string;
}

export function SidebarIcon({ type, className }: SidebarIconProps) {
  const cls = className ?? "h-4 w-4 stroke-[1.8]";

  if (type === "home") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path d="M3 10.5L12 3L21 10.5" stroke="currentColor" strokeLinecap="round" />
        <path d="M5.5 9.5V20H18.5V9.5" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "requests") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path d="M6 7H18" stroke="currentColor" strokeLinecap="round" />
        <path d="M6 12H18" stroke="currentColor" strokeLinecap="round" />
        <path d="M6 17H13" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "masters") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <circle cx="12" cy="8" r="3" stroke="currentColor" />
        <path
          d="M5 19C6.5 16.5 9 15 12 15C15 15 17.5 16.5 19 19"
          stroke="currentColor"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (type === "cars") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path d="M4 14L6 9H18L20 14" stroke="currentColor" strokeLinecap="round" />
        <rect x="4" y="11" width="16" height="6" rx="2" stroke="currentColor" />
        <circle cx="7.5" cy="17.5" r="1" fill="currentColor" />
        <circle cx="16.5" cy="17.5" r="1" fill="currentColor" />
      </svg>
    );
  }
  if (type === "users") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <circle cx="9" cy="9" r="3" stroke="currentColor" />
        <circle cx="17" cy="10" r="2" stroke="currentColor" />
        <path
          d="M3.5 19C4.8 16.8 6.7 15.5 9 15.5C11.3 15.5 13.2 16.8 14.5 19"
          stroke="currentColor"
          strokeLinecap="round"
        />
      </svg>
    );
  }
  if (type === "payments") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <rect x="4" y="6" width="16" height="12" rx="2" stroke="currentColor" />
        <path d="M4 10H20" stroke="currentColor" />
        <path d="M8 14H11" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "docs") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path d="M7 4H14L18 8V20H7V4Z" stroke="currentColor" />
        <path d="M14 4V8H18" stroke="currentColor" />
        <path d="M9.5 12H15.5" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "reports") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path d="M5 20V10" stroke="currentColor" strokeLinecap="round" />
        <path d="M12 20V6" stroke="currentColor" strokeLinecap="round" />
        <path d="M19 20V13" stroke="currentColor" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "settings") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path
          d="M12 15a3 3 0 100-6 3 3 0 000 6Z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 008 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 008 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V8c.26.604.852 1 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
          stroke="currentColor"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" fill="none" className={cls}>
      <circle cx="12" cy="12" r="5" stroke="currentColor" />
    </svg>
  );
}
