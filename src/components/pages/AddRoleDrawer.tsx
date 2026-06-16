import {
  createEmptyRoleAccess,
  ROLE_ACCESS_SECTIONS,
  type RoleAccessPermissions,
} from "@/lib/settings/roleAccessSections";
import { useEffect, useRef, useState, type TransitionEvent } from "react";
import { createPortal } from "react-dom";

function ClientsStyleCheckboxBox({ checked }: { checked: boolean }) {
  if (checked) {
    return (
      <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] bg-[#d51a21] text-white">
        <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5 shrink-0" aria-hidden>
          <path d="M3 8L6.2 11L13 4.5" stroke="currentColor" strokeWidth="2.75" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
    );
  }
  return <span className="inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-[3px] border-[2px] border-[#D8DBDE]" />;
}

function formatRuDateTimeNow(date = new Date()): string {
  return `${String(date.getDate()).padStart(2, "0")}.${String(date.getMonth() + 1).padStart(2, "0")}.${date.getFullYear()}, ${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export type AddRolePayload = {
  roleName: string;
  description: string;
  access: RoleAccessPermissions;
  createdOrUpdatedAt: string;
};

export type RoleDrawerInitialValues = {
  roleName: string;
  description: string;
  access: RoleAccessPermissions;
};

type AddRoleDrawerProps = {
  open: boolean;
  mode?: "add" | "edit";
  initialValues?: RoleDrawerInitialValues | null;
  onOpenChange: (open: boolean) => void;
  onSave: (payload: AddRolePayload) => void;
};

export function AddRoleDrawer({ open, mode = "add", initialValues = null, onOpenChange, onSave }: AddRoleDrawerProps) {
  const isEditMode = mode === "edit";
  const [mounted, setMounted] = useState(false);
  const [active, setActive] = useState(false);
  const [roleName, setRoleName] = useState("");
  const [description, setDescription] = useState("");
  const [access, setAccess] = useState<RoleAccessPermissions>(() => createEmptyRoleAccess());
  const [nameError, setNameError] = useState("");
  const exitingRef = useRef(false);
  const exitFallbackRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  function finishExit() {
    setMounted(false);
    if (exitFallbackRef.current) {
      clearTimeout(exitFallbackRef.current);
      exitFallbackRef.current = null;
    }
  }

  function handleDrawerTransitionEnd(e: TransitionEvent<HTMLDivElement>) {
    if (e.propertyName !== "transform") return;
    if (e.target !== e.currentTarget) return;
    if (exitingRef.current) {
      exitingRef.current = false;
      finishExit();
    }
  }

  useEffect(() => {
    if (open) {
      exitingRef.current = false;
      if (exitFallbackRef.current) {
        clearTimeout(exitFallbackRef.current);
        exitFallbackRef.current = null;
      }
      if (isEditMode && initialValues) {
        setRoleName(initialValues.roleName);
        setDescription(initialValues.description);
        setAccess({ ...initialValues.access });
      } else {
        setRoleName("");
        setDescription("");
        setAccess(createEmptyRoleAccess());
      }
      setNameError("");
      setMounted(true);
      setActive(false);
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          window.setTimeout(() => setActive(true), 90);
        });
      });
      function onKey(e: KeyboardEvent) {
        if (e.key === "Escape") onOpenChange(false);
      }
      window.addEventListener("keydown", onKey);
      return () => {
        cancelAnimationFrame(id);
        window.removeEventListener("keydown", onKey);
      };
    }
    exitingRef.current = true;
    setActive(false);
  }, [open, onOpenChange, isEditMode, initialValues]);

  useEffect(() => {
    if (!open && mounted) {
      exitFallbackRef.current = setTimeout(finishExit, 700);
      return () => {
        if (exitFallbackRef.current) {
          clearTimeout(exitFallbackRef.current);
          exitFallbackRef.current = null;
        }
      };
    }
  }, [open, mounted]);

  function toggleAccess(key: keyof RoleAccessPermissions) {
    setAccess((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  function handleSave() {
    const trimmedName = roleName.trim();
    if (!trimmedName) {
      setNameError("Укажите название роли.");
      return;
    }
    onSave({
      roleName: trimmedName,
      description: description.trim(),
      access,
      createdOrUpdatedAt: formatRuDateTimeNow(),
    });
    onOpenChange(false);
  }

  if (!mounted || typeof document === "undefined") return null;

  return createPortal(
    <div
      className={`fixed inset-0 z-[292] bg-black/35 transition-[opacity] ${active ? "opacity-100" : "opacity-0"}`}
      style={{ transitionDuration: "400ms", transitionTimingFunction: "cubic-bezier(0.45, 0, 0.55, 1)" }}
      role="presentation"
      onClick={() => onOpenChange(false)}
    >
      <div className="ml-auto flex h-full max-h-screen justify-end" onClick={(e) => e.stopPropagation()}>
        <div
          className="relative flex h-full shrink-0"
          style={{
            transform: active ? "translate3d(0, 0, 0)" : "translate3d(100%, 0, 0)",
            transition: "transform 480ms cubic-bezier(0.45, 0, 0.55, 1)",
            willChange: "transform",
            backfaceVisibility: "hidden",
            WebkitBackfaceVisibility: "hidden",
          }}
          onTransitionEnd={handleDrawerTransitionEnd}
        >
          <button
            type="button"
            onClick={() => onOpenChange(false)}
            className="absolute right-full top-8 z-10 mr-3 flex h-11 w-11 shrink-0 items-center justify-center rounded-[10px] border border-[#E8E8E8] bg-white text-[#111111] shadow-[0_8px_24px_-4px_rgba(0,0,0,0.18)] transition hover:bg-[#F7F7F7]"
            aria-label={isEditMode ? "Закрыть окно редактирования роли" : "Закрыть окно добавления роли"}
          >
            <svg viewBox="0 0 24 24" fill="none" className="h-5 w-5" aria-hidden>
              <path d="M6 6L18 18M18 6L6 18" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
            </svg>
          </button>
          <aside
            role="dialog"
            aria-modal="true"
            aria-labelledby="role-drawer-title"
            className="flex h-full w-[min(900px,58vw)] min-w-[380px] max-w-[min(1040px,calc(100vw-48px))] flex-col border-l border-[#E6E6E6] bg-white tracking-[-0.04em] shadow-[-16px_0_48px_-12px_rgba(0,0,0,0.2)]"
          >
            <div className="border-b border-[#EEEDF0] px-6 py-5">
              <h2 id="role-drawer-title" className="text-[32px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826]">
                {isEditMode ? "Редактировать роль" : "Добавить роль"}
              </h2>
            </div>

            <div className="hide-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto px-6 py-5 scroll-smooth">
              <label className="block">
                <span className="mb-2 block text-[14px] font-medium text-[#7D7D7D]">
                  Название роли <span className="text-[#EC1C24]">*</span>
                </span>
                <input
                  value={roleName}
                  onChange={(e) => {
                    setRoleName(e.target.value);
                    if (nameError) setNameError("");
                  }}
                  placeholder="Например, Оператор склада"
                  className="h-12 w-full rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 text-[16px] font-medium tracking-[-0.02em] text-black outline-none placeholder:text-[#B5B5B5]"
                />
                {nameError ? <p className="mt-2 text-[13px] font-medium text-[#C62828]">{nameError}</p> : null}
              </label>

              <label className="block">
                <span className="mb-2 block text-[14px] font-medium text-[#7D7D7D]">Описание</span>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Кратко опишите назначение роли"
                  className="min-h-[120px] w-full resize-y rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 py-3 text-[16px] font-medium tracking-[-0.02em] text-black outline-none placeholder:text-[#B5B5B5]"
                />
              </label>

              <div>
                <h3 className="mb-4 text-[18px] font-bold tracking-[-0.04em] text-[#111826]">Права доступа</h3>
                <div className="space-y-3">
                  {ROLE_ACCESS_SECTIONS.map((section) => (
                    <span
                      key={section.key}
                      className="flex cursor-pointer select-none items-center gap-3 text-[16px] font-medium tracking-[-0.04em] text-[#111826]"
                      onClick={() => toggleAccess(section.key)}
                      role="checkbox"
                      aria-checked={access[section.key]}
                    >
                      <ClientsStyleCheckboxBox checked={access[section.key]} />
                      {section.label}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between border-t border-[#EEEDF0] px-6 py-4">
              <button
                type="button"
                onClick={() => onOpenChange(false)}
                className="h-11 rounded-[10px] bg-[#ECECEF] px-4 text-[15px] font-medium text-black"
              >
                Отменить
              </button>
              <button
                type="button"
                onClick={handleSave}
                className="h-11 rounded-[10px] bg-[#EC1C24] px-5 text-[15px] font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
                disabled={!roleName.trim()}
              >
                {isEditMode ? "Сохранить изменения" : "Сохранить роль"}
              </button>
            </div>
          </aside>
        </div>
      </div>
    </div>,
    document.body,
  );
}
