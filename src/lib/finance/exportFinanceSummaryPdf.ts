import type { TDocumentDefinitions } from "pdfmake/interfaces";

type PdfMakeBrowser = {
  vfs?: Record<string, string>;
  addVirtualFileSystem?: (data: Record<string, string>) => void;
  createPdf: (def: TDocumentDefinitions) => { getBlob: () => Promise<Blob> };
};

export type FinanceSummaryPdfPayload = {
  orderId: string;
  carLabel: string;
  masterFullName: string;
  generatedAt: string;
  worksSubtotal: number;
  partsSubtotal: number;
  discountAmount: number;
  totalToPay: number;
  worksCount: number;
  partsCount: number;
};

function fmtRub(n: number): string {
  return `${n.toLocaleString("ru-RU", { maximumFractionDigits: 0 })} ₽`;
}

function resolvePdfmakeVfs(vfsModule: unknown): Record<string, string> {
  if (vfsModule && typeof vfsModule === "object" && "default" in vfsModule) {
    const d = (vfsModule as { default: unknown }).default;
    if (d && typeof d === "object") {
      return d as Record<string, string>;
    }
  }
  return vfsModule as Record<string, string>;
}

export async function downloadFinanceSummaryPdf(payload: FinanceSummaryPdfPayload): Promise<void> {
  await import("pdfmake/build/pdfmake");
  const vfsModule = await import("pdfmake/build/vfs_fonts");
  const vfs = resolvePdfmakeVfs(vfsModule);

  const pdfMake =
    (typeof globalThis !== "undefined" && (globalThis as { pdfMake?: PdfMakeBrowser }).pdfMake) ||
    (typeof window !== "undefined" && (window as { pdfMake?: PdfMakeBrowser }).pdfMake);
  if (!pdfMake?.createPdf) {
    throw new Error("Генератор PDF не загрузился (pdfMake).");
  }

  // vfs_fonts.js при загрузке сам вызывает addVirtualFileSystem(vfs), если pdfMake уже есть.
  // При ESM у Vite vfs приходит как { default: { ... } } — нельзя передавать весь модуль в Buffer.
  if (!pdfMake.vfs || typeof pdfMake.vfs !== "object" || !("Roboto-Regular.ttf" in pdfMake.vfs)) {
    pdfMake.vfs = vfs;
  }

  const docDefinition: TDocumentDefinitions = {
    pageSize: "A4",
    pageMargins: [40, 48, 40, 56],
    content: [
      { text: "Финансовая сводка", style: "title" },
      { text: `Заказ-наряд № ${payload.orderId}`, style: "meta" },
      { text: `${payload.carLabel} · ${payload.masterFullName}`, style: "meta" },
      { text: payload.generatedAt, style: "metaSmall" },
      { text: "", margin: [0, 0, 0, 18] },
      {
        columns: [
          {
            width: "*",
            stack: [
              { text: "Стоимость работ", style: "cardLabel" },
              { text: fmtRub(payload.worksSubtotal), style: "cardValue" },
            ],
          },
          {
            width: "*",
            stack: [
              { text: "Стоимость запчастей", style: "cardLabel" },
              { text: fmtRub(payload.partsSubtotal), style: "cardValue" },
            ],
          },
          {
            width: "*",
            stack: [
              { text: "Количество работ", style: "cardLabel" },
              { text: String(payload.worksCount), style: "cardValue" },
            ],
          },
        ],
        columnGap: 10,
      },
      { text: "", margin: [0, 0, 0, 16] },
      {
        table: {
          widths: ["*", "auto"],
          body: [
            [
              { text: "Показатель", style: "th", fillColor: "#f3f3f5" },
              { text: "Сумма", style: "th", alignment: "right", fillColor: "#f3f3f5" },
            ],
            [{ text: "Работы", style: "td" }, { text: fmtRub(payload.worksSubtotal), style: "tdNum" }],
            [{ text: "Запчасти (текущие, без архива)", style: "td" }, { text: fmtRub(payload.partsSubtotal), style: "tdNum" }],
            [{ text: "Скидка 7%", style: "td" }, { text: `− ${fmtRub(payload.discountAmount)}`, style: "tdDiscount" }],
            [
              { text: "Итого к оплате", style: "tdTotalLabel" },
              { text: fmtRub(payload.totalToPay), style: "tdTotalValue" },
            ],
          ],
        },
        layout: {
          hLineWidth: () => 1,
          hLineColor: () => "#e2e5ea",
          vLineWidth: () => 0,
          paddingLeft: () => 10,
          paddingRight: () => 10,
          paddingTop: () => 8,
          paddingBottom: () => 8,
        },
      },
      {
        text: `Активных позиций запчастей в расчёте: ${payload.partsCount}`,
        style: "footnote",
        margin: [0, 14, 0, 0],
      },
    ],
    styles: {
      title: { fontSize: 20, bold: true, color: "#111826" },
      meta: { fontSize: 11, color: "#4a4f59", margin: [0, 4, 0, 0] },
      metaSmall: { fontSize: 9, color: "#6f7785", margin: [0, 6, 0, 0] },
      cardLabel: { fontSize: 9, color: "#6f7785", margin: [0, 0, 0, 4] },
      cardValue: { fontSize: 18, bold: true, color: "#ec1c24" },
      th: { bold: true, fontSize: 10, color: "#111826" },
      td: { fontSize: 11, color: "#111826" },
      tdNum: { fontSize: 11, bold: true, alignment: "right", color: "#111826" },
      tdDiscount: { fontSize: 11, bold: true, alignment: "right", color: "#ec1c24" },
      tdTotalLabel: { fontSize: 13, bold: true, color: "#111826" },
      tdTotalValue: { fontSize: 14, bold: true, alignment: "right", color: "#111826" },
      footnote: { fontSize: 9, color: "#6f7785" },
    },
    defaultStyle: {
      font: "Roboto",
    },
    footer: (currentPage, pageCount) => ({
      text: `Марс · стр. ${currentPage} / ${pageCount}`,
      alignment: "center",
      fontSize: 8,
      color: "#888888",
      margin: [40, 4, 40, 0],
    }),
  };

  const pdfDoc = pdfMake.createPdf(docDefinition);
  const blob = await pdfDoc.getBlob();
  const fileName = `finansovaya-svodka-zn-${payload.orderId}.pdf`;
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    URL.revokeObjectURL(url);
  }
}
