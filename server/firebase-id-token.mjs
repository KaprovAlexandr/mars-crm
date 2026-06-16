/** Проверка Firebase ID token без service account (Identity Toolkit REST API). */
function resolveFirebaseWebApiKey() {
  const raw =
    (process.env.VITE_FIREBASE_API_KEY ?? "").trim() ||
    (process.env.FIREBASE_WEB_API_KEY ?? "").trim();
  return raw.replace(/^['"]|['"]$/g, "");
}

export async function verifyFirebaseIdToken(idToken) {
  const token = typeof idToken === "string" ? idToken.trim() : "";
  if (!token) {
    throw new Error("Укажите idToken.");
  }

  const apiKey = resolveFirebaseWebApiKey();
  if (!apiKey) {
    throw new Error("Не задан VITE_FIREBASE_API_KEY для проверки токена.");
  }

  const response = await fetch(
    `https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=${encodeURIComponent(apiKey)}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ idToken: token }),
    },
  );

  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    const message =
      typeof data?.error?.message === "string" ? data.error.message : "Недействительный idToken.";
    throw new Error(message);
  }

  const user = Array.isArray(data.users) ? data.users[0] : null;
  const email = typeof user?.email === "string" ? user.email.trim().toLowerCase() : "";
  if (!email) {
    throw new Error("У аккаунта нет e-mail.");
  }

  const displayName =
    typeof user?.displayName === "string" && user.displayName.trim() ? user.displayName.trim() : "";

  return { email, displayName };
}
