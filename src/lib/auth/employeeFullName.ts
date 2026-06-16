import { normalizeAuthEmail } from "@/lib/auth/employeeRole";

function emailLocalPart(email: string): string {
  return normalizeAuthEmail(email).split("@")[0] ?? "";
}

function scoreEmployeeFullName(name: string, email: string): number {
  const trimmed = name.trim();
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

export function looksLikeLoginAlias(fullName: string, email: string | null | undefined): boolean {
  const trimmed = fullName.trim();
  if (!trimmed) return true;
  return scoreEmployeeFullName(trimmed, email ?? "") < 0;
}

/** Выбирает наиболее похожее на ФИО имя среди кандидатов. */
export function pickBetterEmployeeFullName(
  email: string | null | undefined,
  ...candidates: Array<string | null | undefined>
): string {
  const key = normalizeAuthEmail(email);
  const ranked = candidates
    .map((value) => (typeof value === "string" ? value.trim() : ""))
    .filter(Boolean)
    .sort((a, b) => scoreEmployeeFullName(b, key) - scoreEmployeeFullName(a, key));

  if (ranked[0]) return ranked[0];
  return emailLocalPart(key) || key || "Пользователь";
}
