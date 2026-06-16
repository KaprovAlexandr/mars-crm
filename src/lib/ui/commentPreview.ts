/** Одна строка превью: обрезка + пробел + «...» */
export function previewComment(text: string, maxChars = 22): string {
  const t = text.replace(/\s+/g, " ").trim();
  if (t.length <= maxChars) return t;
  return `${t.slice(0, maxChars).trimEnd()} ...`;
}

/** Подсказка справа от курсора; maxWidth ужимается у правого края окна. */
export function clampCommentTooltipPos(
  clientX: number,
  clientY: number,
  fullText: string,
): { x: number; y: number; maxWidth: number } {
  if (typeof window === "undefined") return { x: clientX + 14, y: clientY + 14, maxWidth: 360 };
  const gap = 14;
  const preferredMaxW = 360;
  const tooltipMaxH = Math.min(280, window.innerHeight - 24);
  const charsPerLine = 40;
  const lineH = 22;
  const verticalPad = 22;
  const lines = Math.max(1, Math.ceil(fullText.length / charsPerLine));
  const estH = Math.min(tooltipMaxH, lines * lineH + verticalPad);

  const x = Math.max(8, clientX + gap);
  const maxWidth = Math.min(preferredMaxW, Math.max(80, window.innerWidth - x - 8));

  let y = clientY + gap;
  if (y + estH > window.innerHeight - 8) {
    y = clientY - estH - gap;
  }
  y = Math.max(8, Math.min(y, window.innerHeight - estH - 8));
  return { x, y, maxWidth };
}
