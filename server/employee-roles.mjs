/** Роли сотрудников на сервере — зеркало `src/lib/auth/employeeRole.ts`. */
export const ROLE_BY_EMAIL = {
  "sasharicky99@gmail.com": "manager",
  "sanejkstrronger@gmail.com": "head",
  "n0zicsgo@gmail.com": "master",
  "angel16yoo@gmail.com": "administrator",
};

export const EMPLOYEE_FULL_NAME_BY_EMAIL = {
  "sanejkstrronger@gmail.com": "Капров Александр Николаевич",
  "sasharicky99@gmail.com": "Алексеев Дмитрий Сергеевич",
  "n0zicsgo@gmail.com": "Журавлёв Михаил Дмитриевич",
  "angel16yoo@gmail.com": "Орлова Анна Вячеславовна",
  "sdvikkikishm@icloud.com": "Шустрова Александра Семеновна",
};

const OPTIONAL_ROLE_ENV = [
  ["FIREBASE_ROLE_EMAIL_ADMIN", "administrator"],
  ["VITE_FIREBASE_ROLE_EMAIL_ADMIN", "administrator"],
  ["FIREBASE_ROLE_EMAIL_MASTER", "master"],
  ["VITE_FIREBASE_ROLE_EMAIL_MASTER", "master"],
];

for (const [envKey, role] of OPTIONAL_ROLE_ENV) {
  const email = (process.env[envKey] ?? "").trim().toLowerCase();
  if (email) ROLE_BY_EMAIL[email] = role;
}

export function normalizeAuthEmail(email) {
  return (email ?? "").trim().toLowerCase();
}

export function getEmployeeFullName(email) {
  const key = normalizeAuthEmail(email);
  if (!key) return "";
  return EMPLOYEE_FULL_NAME_BY_EMAIL[key] ?? "";
}

export function resolveEmployeeRoleFromEmail(email, overrides = {}) {
  const key = normalizeAuthEmail(email);
  if (!key) return "pending";
  if (overrides[key]) return overrides[key];
  if (ROLE_BY_EMAIL[key]) return ROLE_BY_EMAIL[key];
  return "pending";
}

export function canAccessSettings(email, overrides = {}) {
  const role = resolveEmployeeRoleFromEmail(email, overrides);
  return role === "head" || role === "administrator";
}

export function formatRuDateTimeFromDate(date) {
  const d = date instanceof Date ? date : new Date(date);
  if (Number.isNaN(d.getTime())) return "";
  return `${String(d.getDate()).padStart(2, "0")}.${String(d.getMonth() + 1).padStart(2, "0")}.${d.getFullYear()}, ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

function emailLocalPart(email) {
  return normalizeAuthEmail(email).split("@")[0] ?? "";
}

function scoreEmployeeFullName(name, email) {
  const trimmed = String(name ?? "").trim();
  if (!trimmed) return -1000;

  let score = 0;
  if (/[а-яё]/i.test(trimmed)) score += 100;
  const words = trimmed.split(/\s+/).filter(Boolean).length;
  score += words * 20;
  if (words >= 3) score += 30;

  const local = emailLocalPart(email);
  const normalized = trimmed.toLocaleLowerCase("ru-RU");
  if (normalized === local.toLocaleLowerCase("ru-RU")) score -= 200;
  if (normalized === normalizeAuthEmail(email)) score -= 200;

  score += Math.min(trimmed.length, 40);
  return score;
}

export function looksLikeLoginAlias(fullName, email) {
  const trimmed = String(fullName ?? "").trim();
  if (!trimmed) return true;
  return scoreEmployeeFullName(trimmed, email ?? "") < 0;
}

export function pickBetterEmployeeFullName(email, ...candidates) {
  const key = normalizeAuthEmail(email);
  const mapped = getEmployeeFullName(key);
  if (mapped) return mapped;

  const ranked = candidates
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .sort((a, b) => scoreEmployeeFullName(b, key) - scoreEmployeeFullName(a, key));

  if (ranked[0]) return ranked[0];
  return emailLocalPart(key) || key || "Пользователь";
}
