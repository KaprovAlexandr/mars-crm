import { national10FromAnyPhoneString } from "./ruPhoneMask";

export type Car = {
  id: string;
  model: string;
  plate: string;
};

export type Client = {
  id: string;
  name: string;
  phone: string;
  cars: Car[];
};

export function normalizePhoneDigits(s: string): string {
  return s.replace(/\D/g, "");
}

/** Первая часть ФИО — фамилия (как в РФ: «Иванов Артём …»). */
export function surnameFromFullName(fullName: string): string {
  const t = fullName.trim().split(/\s+/)[0];
  return t ?? "";
}

/** Точное совпадение по 10 национальным цифрам (после +7 / 8). */
export function findClientsByNationalPhone(clients: readonly Client[], national10: string): Client[] {
  const d = national10.replace(/\D/g, "").slice(0, 10);
  if (d.length < 10) return [];
  return clients.filter((c) => national10FromAnyPhoneString(c.phone) === d);
}

/** Поиск по фамилии (первое слово ФИО), подстрока без учёта регистра. */
export function findClientsBySurname(clients: readonly Client[], rawQuery: string): Client[] {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return [];
  return clients.filter((c) => {
    const surname = surnameFromFullName(c.name).toLowerCase();
    return surname.length > 0 && surname.includes(q);
  });
}
