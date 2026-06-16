export type RegisterDraft = {
  name: string;
  email: string;
  password: string;
  confirmPassword: string;
  policyAccepted: boolean;
};

const STORAGE_KEY = "mars-auth-register-draft";

function canUseSessionStorage(): boolean {
  return typeof window !== "undefined" && typeof window.sessionStorage !== "undefined";
}

export function readRegisterDraft(): RegisterDraft | null {
  if (!canUseSessionStorage()) return null;
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<RegisterDraft>;
    if (
      typeof parsed.name !== "string" ||
      typeof parsed.email !== "string" ||
      typeof parsed.password !== "string" ||
      typeof parsed.confirmPassword !== "string" ||
      typeof parsed.policyAccepted !== "boolean"
    ) {
      return null;
    }
    return {
      name: parsed.name,
      email: parsed.email,
      password: parsed.password,
      confirmPassword: parsed.confirmPassword,
      policyAccepted: parsed.policyAccepted,
    };
  } catch {
    return null;
  }
}

export function writeRegisterDraft(draft: RegisterDraft): void {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(draft));
  } catch {
    // Ignore quota / privacy mode failures.
  }
}

export function clearRegisterDraft(): void {
  if (!canUseSessionStorage()) return;
  try {
    window.sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // Ignore storage failures.
  }
}

export function createEmptyRegisterDraft(): RegisterDraft {
  return {
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
    policyAccepted: false,
  };
}
