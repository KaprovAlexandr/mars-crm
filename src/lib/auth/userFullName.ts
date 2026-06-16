import { updateProfile, type User } from "firebase/auth";
import { readRegisterDraft } from "@/lib/auth/authRegisterDraft";
import { getEmployeeFullName, normalizeAuthEmail } from "@/lib/auth/employeeRole";

const STORAGE_PREFIX = "mars-user-full-name:";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:8787";

function storageKey(email: string): string {
  return `${STORAGE_PREFIX}${normalizeAuthEmail(email)}`;
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function readLocalFullName(email: string | null | undefined): string {
  const key = normalizeAuthEmail(email);
  if (!key || !canUseLocalStorage()) return "";
  try {
    return window.localStorage.getItem(storageKey(key))?.trim() ?? "";
  } catch {
    return "";
  }
}

export function readStoredUserFullName(email: string | null | undefined): string {
  return readLocalFullName(email);
}

function writeLocalFullName(email: string, fullName: string): void {
  const key = normalizeAuthEmail(email);
  const value = fullName.trim();
  if (!key || !value || !canUseLocalStorage()) return;
  try {
    window.localStorage.setItem(storageKey(key), value);
  } catch {
    // Ignore quota / privacy mode failures.
  }
}

function readRegisterDraftFullName(email: string): string {
  const draft = readRegisterDraft();
  if (!draft) return "";
  if (normalizeAuthEmail(draft.email) !== normalizeAuthEmail(email)) return "";
  return draft.name.trim();
}

function looksLikeRegisteredFullName(name: string): boolean {
  const trimmed = name.trim();
  if (!trimmed) return false;
  if (/[а-яё]/i.test(trimmed)) return true;
  return trimmed.split(/\s+/).filter(Boolean).length >= 3;
}

async function fetchRemoteFullName(user: User): Promise<string> {
  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) return "";
    const data = (await response.json()) as { fullName?: unknown };
    return typeof data.fullName === "string" ? data.fullName.trim() : "";
  } catch {
    return "";
  }
}

async function saveRemoteFullName(user: User, fullName: string): Promise<void> {
  const value = fullName.trim();
  if (!value) return;
  try {
    const idToken = await user.getIdToken();
    await fetch(`${API_BASE_URL}/api/auth/profile`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken, fullName: value }),
    });
  } catch {
    // API sync is optional.
  }
}

/** Сохраняет ФИО локально и на сервере (если доступен API). */
export async function persistUserFullName(user: User, fullName: string): Promise<void> {
  const email = user.email;
  const value = fullName.trim();
  if (!email || !value) return;
  writeLocalFullName(email, value);
  await saveRemoteFullName(user, value);
}

/** Загружает сохранённое ФИО: localStorage → черновик регистрации → API. */
export async function loadPersistedFullName(user: User): Promise<string> {
  const email = user.email;
  if (!email) return "";

  const local = readLocalFullName(email);
  if (local) return local;

  const fromDraft = readRegisterDraftFullName(email);
  if (fromDraft) {
    writeLocalFullName(email, fromDraft);
    return fromDraft;
  }

  const remote = await fetchRemoteFullName(user);
  if (remote) {
    writeLocalFullName(email, remote);
    return remote;
  }

  const fromEmployee = getEmployeeFullName(email);
  if (fromEmployee) {
    writeLocalFullName(email, fromEmployee);
    return fromEmployee;
  }

  return "";
}

/** Сохраняет ФИО из профиля Firebase, если оно похоже на зарегистрированное. */
export async function maybePersistProfileFullName(user: User): Promise<void> {
  const email = user.email;
  if (!email || readLocalFullName(email)) return;
  const displayName = user.displayName?.trim() ?? "";
  if (!looksLikeRegisteredFullName(displayName)) return;
  await persistUserFullName(user, displayName);
}

export function resolveUserFullName(user: User | null, email: string | null | undefined, persisted?: string): string {
  const stored = persisted?.trim() || (email ? readLocalFullName(email) : "");
  if (stored) return stored;

  const fromEmployee = getEmployeeFullName(email);
  if (fromEmployee) return fromEmployee;

  const fromProfile = user?.displayName?.trim();
  if (fromProfile) return fromProfile;

  const mail = email?.trim();
  if (mail) return mail.split("@")[0] ?? mail;
  return "Пользователь";
}

/** Восстанавливает ФИО в Firebase после входа через Google. */
export async function syncUserDisplayName(user: User): Promise<string> {
  const persisted = await loadPersistedFullName(user);
  const resolved = resolveUserFullName(user, user.email, persisted);
  const targetName = persisted || getEmployeeFullName(user.email) || resolved;

  if (targetName && user.displayName?.trim() !== targetName) {
    try {
      await updateProfile(user, { displayName: targetName });
      await user.reload();
    } catch {
      // Показываем сохранённое ФИО в UI даже если updateProfile не удался.
    }
  }

  return resolved;
}
