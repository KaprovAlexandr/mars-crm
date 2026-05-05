export type MarsShellSidebarIconType =
  | "home"
  | "cube"
  | "layers"
  | "chat"
  | "pie"
  | "grid"
  | "doc"
  | "user"
  | "settings";

/** Иконки узкой чёрной колонки (страницы «Марс»). */
export function MarsShellSidebarIcon({ type }: { type: MarsShellSidebarIconType }) {
  const cls = "h-[28px] w-[28px]";
  if (type === "home") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path d="M4 10.5L12 4L20 10.5" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M6 9.8V20H18V9.8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "cube") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path d="M12 3L4.5 7.2V16.8L12 21L19.5 16.8V7.2L12 3Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4.5 7.2L12 11.4L19.5 7.2" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (type === "layers") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path d="M12 4L4 8L12 12L20 8L12 4Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M4 12L12 16L20 12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "chat") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <rect x="4" y="5" width="16" height="11" rx="3" stroke="currentColor" strokeWidth="1.8" />
        <path d="M9 16L7 19" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      </svg>
    );
  }
  if (type === "pie") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path d="M12 4V12H20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (type === "grid") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <rect x="4" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="13" y="4" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="4" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
        <rect x="13" y="13" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (type === "doc") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path d="M7 4H14L18 8V20H7V4Z" stroke="currentColor" strokeWidth="1.8" />
        <path d="M14 4V8H18" stroke="currentColor" strokeWidth="1.8" />
      </svg>
    );
  }
  if (type === "settings") {
    return (
      <svg viewBox="0 0 24 24" fill="none" className={cls}>
        <path
          d="M12 15a3 3 0 100-6 3 3 0 000 6Z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 01-2.83 2.83l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06a1.65 1.65 0 00.33-1.82 1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 8a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 008 4.6a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06a1.65 1.65 0 00-.33 1.82V8c.26.604.852 1 1.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cls}>
      <circle cx="12" cy="8" r="3" stroke="currentColor" strokeWidth="1.8" />
      <path d="M5 20C6.5 17 8.8 15.5 12 15.5C15.2 15.5 17.5 17 19 20" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
