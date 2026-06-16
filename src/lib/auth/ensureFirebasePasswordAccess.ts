import type { User } from "firebase/auth";
import { ensurePasswordProviderLinked, getUniversalPassword } from "@/lib/auth/firebaseAuth";
import { syncUserDisplayName } from "@/lib/auth/userFullName";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL as string | undefined)?.trim() || "http://localhost:8787";

async function syncPasswordViaApi(user: User): Promise<void> {
  try {
    const idToken = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/auth/ensure-password`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken }),
    });
    if (!response.ok) return;
  } catch {
    // API sync is optional; client-side link may still work.
  }
}

/** После Google-входа привязывает e-mail/пароль к аккаунту и синхронизирует пароль на сервере. */
export async function ensureFirebasePasswordAccess(user: User): Promise<User> {
  const universalPassword = getUniversalPassword();
  const linked = await ensurePasswordProviderLinked(user, universalPassword);
  await syncPasswordViaApi(linked);
  await syncUserDisplayName(linked);
  return linked;
}
