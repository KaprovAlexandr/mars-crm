/** Из ввода с маской / вставки — только национальные 10 цифр (без +7). */
export function extractNational10DigitsFromMaskedInput(input: string): string {
  let d = input.replace(/\D/g, "");
  if (d.startsWith("8")) d = "7" + d.slice(1);
  if (d.startsWith("7")) d = d.slice(1);
  return d.slice(0, 10);
}

/** Маска «+ 7 (___) ___-__-__» — с пробелами; цифры слева направо; пустые позиции «_» (ввод только цифр). */
export function formatRu7PhoneMask(national10: string): string {
  const d = national10.replace(/\D/g, "").slice(0, 10);
  const x = (i: number) => (i < d.length ? d[i]! : "_");
  return `+ 7 (${x(0)}${x(1)}${x(2)}) ${x(3)}${x(4)}${x(5)}-${x(6)}${x(7)}-${x(8)}${x(9)}`;
}

/** Индекс каретки в строке маски: первая позиция следующей цифры (первый «_»), иначе конец строки. */
export function nextRuPhoneMaskCaretIndex(mask: string): number {
  const i = mask.indexOf("_");
  return i === -1 ? mask.length : i;
}

/** 10 цифр для сравнения с телефоном клиента в базе. */
export function national10FromAnyPhoneString(phone: string): string {
  return extractNational10DigitsFromMaskedInput(phone);
}

/**
 * После изменения поля с маской: если пользователь стёр символ маски (например «_»),
 * извлечённые цифры не меняются — снимаем последнюю цифру номера.
 * `prevMaskedDisplay` — значение до изменения (`formatRu7PhoneMask(prevNational10)`), если нет `inputType` (часть мобильных клавиатур).
 */
export function national10AfterMaskedFieldInput(
  prevNational10: string,
  prevMaskedDisplay: string,
  rawFieldValue: string,
  inputType: string | undefined,
): string {
  const prev = prevNational10.replace(/\D/g, "").slice(0, 10);
  const extracted = extractNational10DigitsFromMaskedInput(rawFieldValue);
  if (extracted !== prev) return extracted;
  if (prev.length === 0) return prev;
  const explicitBack =
    inputType === "deleteContentBackward" || inputType === "deleteWordBackward";
  const unknownBack =
    inputType === undefined && rawFieldValue.length < prevMaskedDisplay.length;
  if (explicitBack || unknownBack) return prev.slice(0, -1);
  return prev;
}

/** Сохранение в карточке клиента: полностью заполненный номер. */
export function displayRuPhoneComplete(national10: string): string {
  const d = national10.replace(/\D/g, "").slice(0, 10);
  if (d.length !== 10) return formatRu7PhoneMask(d);
  return `+ 7 (${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6, 8)}-${d.slice(8, 10)}`;
}
