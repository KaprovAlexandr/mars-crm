/** Имя менеджера «текущей сессии» (мок): совпадает с «Взять в работу» и фильтром «Мои». */
export const CURRENT_USER_DISPLAY_NAME = "Капров Александр";

/** Все варианты ФИО текущего менеджера в данных (полное, краткое, из API). */
export function isCurrentUserManager(manager: string | null | undefined): boolean {
  const normalized = (manager ?? "").trim().toLocaleLowerCase("ru-RU");
  if (!normalized) return false;
  if (normalized === CURRENT_USER_DISPLAY_NAME.toLocaleLowerCase("ru-RU")) return true;
  return normalized.startsWith("капров");
}
