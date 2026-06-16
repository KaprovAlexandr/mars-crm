/** Часовой пояс журнала записей (стенное время сервиса). */
export const JOURNAL_WALL_CLOCK_TIMEZONE = "Europe/Moscow";

const NAIVE_ISO_RE = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2}:\d{2})$/;

/** YYYY-MM-DDTHH:mm:ss без смещения часового пояса для UI журнала. */
export function formatJournalWallClockDateTime(value: string | Date | null | undefined): string {
  if (value == null) return "";
  if (typeof value === "string") {
    const trimmed = value.trim();
    const naive = NAIVE_ISO_RE.exec(trimmed);
    if (naive) return `${naive[1]}T${naive[2]}`;
  }

  const parsed = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(parsed.getTime())) return typeof value === "string" ? value : "";

  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: JOURNAL_WALL_CLOCK_TIMEZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  }).formatToParts(parsed);

  const pick = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "00";
  return `${pick("year")}-${pick("month")}-${pick("day")}T${pick("hour")}:${pick("minute")}:${pick("second")}`;
}

export function journalDateTimeSqlValue(paramIndex: number): string {
  return `($${paramIndex}::timestamp AT TIME ZONE '${JOURNAL_WALL_CLOCK_TIMEZONE}')`;
}

export function journalDateTimeSelectExpr(column: string): string {
  return `to_char(${column} AT TIME ZONE '${JOURNAL_WALL_CLOCK_TIMEZONE}', 'YYYY-MM-DD"T"HH24:MI:SS') as ${column}`;
}
