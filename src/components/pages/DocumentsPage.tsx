import { MarsAppShellSidebar } from "@/components/layout/MarsAppShellSidebar";
import { RequestActionIconAssignLead, RequestActionIconStatus } from "@/components/icons/RequestRowModalIcons";
import {
  loadDocumentsPageState,
  persistDocumentsPageState,
  removeUploadedDocumentFile,
  storeUploadedDocumentFile,
} from "@/lib/documents/documentsPagePersistence";
import { emitArchiveStyleToast } from "@/lib/notifications/inAppArchiveToastBus";
import { DOCUMENT_LIST_FLASH_ARMED_KEY } from "@/lib/notifications/inferNotificationDeepLink";
import { useEffect, useLayoutEffect, useRef, useState, type ChangeEvent, type CSSProperties } from "react";
import { createPortal } from "react-dom";
import { useSearchParams } from "react-router-dom";

type DocRow = {
  id: string;
  name: string;
  size: string;
  added: string;
  client: string;
  status: "Подписан" | "На проверке" | "Архивирован" | "Действует" | "На согласовании";
  file?: string;
  downloadName?: string;
};

type RecentDocExt = "DOC" | "XLS" | "PDF";

type RecentDoc = {
  id: string;
  title: string;
  date: string;
  ext: RecentDocExt;
  file: string;
  downloadName: string;
};

const INITIAL_RECENT_DOCS: RecentDoc[] = [
  { id: "recent-1", title: "Счет на оплату #981", date: "07.08.2025", ext: "DOC", file: "/documents/schet-oplata-981.doc", downloadName: "Счет на оплату #981.doc" },
  { id: "recent-2", title: "Коммерческое предложение", date: "11.08.2025", ext: "DOC", file: "/documents/kommercheskoe-predlozhenie.doc", downloadName: "Коммерческое предложение.doc" },
  { id: "recent-3", title: "Акт сверки за июль 2025", date: "11.08.2025", ext: "XLS", file: "/documents/akt-sverki-iyul-2026.xls", downloadName: "Акт сверки за июль 2026.xls" },
  { id: "recent-4", title: "Приложение к договору", date: "03.08.2024", ext: "PDF", file: "/documents/prilozhenie-k-dogovoru.pdf", downloadName: "Приложение к договору.pdf" },
  { id: "recent-5", title: "Договор оказания услуг", date: "12.08.2025", ext: "DOC", file: "/documents/dogovor-okazaniya-uslug.doc", downloadName: "Договор оказания услуг.doc" },
  { id: "recent-6", title: "Счет на предоплату #452", date: "14.08.2025", ext: "DOC", file: "/documents/schet-predoplata-452.doc", downloadName: "Счет на предоплату #452.doc" },
  { id: "recent-7", title: "Доп. соглашение №4", date: "20.08.2025", ext: "PDF", file: "/documents/dop-soglashenie-4.pdf", downloadName: "Доп. соглашение №4.pdf" },
  { id: "recent-8", title: "Акт приема-передачи", date: "21.08.2025", ext: "DOC", file: "/documents/akt-priema-peredachi.doc", downloadName: "Акт приема-передачи.doc" },
  { id: "recent-9", title: "Сводная таблица оплат", date: "24.08.2025", ext: "XLS", file: "/documents/svodnaya-tablica-oplat.xlsx", downloadName: "Сводная таблица оплат.xlsx" },
  { id: "recent-10", title: "Доверенность", date: "27.08.2025", ext: "PDF", file: "/documents/doverennost.pdf", downloadName: "Доверенность.pdf" },
  { id: "recent-11", title: "Реестр контрагентов", date: "30.08.2025", ext: "XLS", file: "/documents/reestr-kontragentov.xlsx", downloadName: "Реестр контрагентов.xlsx" },
];

const docFormatIconMap: Record<RecentDocExt, string> = {
  DOC: "/doc-format.png",
  XLS: "/xls-format.png",
  PDF: "/pdf-format.png",
};

function formatRuDateToday(): string {
  const now = new Date();
  return `${String(now.getDate()).padStart(2, "0")}.${String(now.getMonth() + 1).padStart(2, "0")}.${now.getFullYear()}`;
}

function titleFromFileName(fileName: string): string {
  return fileName.replace(/\.[^.]+$/, "").trim() || fileName.trim();
}

function inferDocExt(fileName: string): RecentDocExt {
  const lower = fileName.toLowerCase();
  if (lower.endsWith(".pdf")) return "PDF";
  if (lower.endsWith(".xls") || lower.endsWith(".xlsx")) return "XLS";
  return "DOC";
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function triggerFileDownload(href: string, downloadName: string): void {
  const a = document.createElement("a");
  a.href = href;
  a.download = downloadName;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

function DocumentDownloadIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={`h-[22px] w-[22px] shrink-0 ${className ?? ""}`} aria-hidden>
      <path
        d="M12 4v11m0 0 3.5-3.5M12 15 8.5 11.5M5 20h14"
        stroke="currentColor"
        strokeWidth="1.9"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function downloadDocRow(row: DocRow): void {
  if (row.file && row.downloadName) {
    void downloadRecentDocAsset({
      id: row.id,
      title: titleFromFileName(row.downloadName),
      date: row.added,
      ext: inferDocExt(row.downloadName),
      file: row.file,
      downloadName: row.downloadName,
    }).catch(() => {});
    return;
  }

  if (typeof window === "undefined") return;
  const content = [
    `Документ: ${row.name}`,
    `Размер: ${row.size}`,
    `Дата добавления: ${row.added}`,
    `Клиент: ${row.client}`,
    `Статус: ${row.status}`,
    "",
    `Дата выгрузки: ${new Date().toLocaleString("ru-RU")}`,
    "",
    "Экспорт из раздела «Документы» CRM.",
  ].join("\n");
  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = row.name;
  link.rel = "noopener";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

async function downloadRecentDocAsset(doc: RecentDoc): Promise<void> {
  if (doc.file.startsWith("blob:")) {
    triggerFileDownload(doc.file, doc.downloadName);
    return;
  }

  const res = await fetch(new URL(doc.file, window.location.origin).href);
  if (!res.ok) throw new Error("Не удалось получить файл");
  const blob = await res.blob();
  const objectUrl = URL.createObjectURL(blob);
  triggerFileDownload(objectUrl, doc.downloadName);
  window.setTimeout(() => URL.revokeObjectURL(objectUrl), 2500);
}

const recentDocStripItemClass =
  "relative shrink-0 w-[160px] sm:w-[180px] lg:basis-[19.2%] lg:w-auto";

const recentDocStripCardClass =
  "group flex h-[172px] w-full cursor-pointer flex-col overflow-hidden rounded-[10px] border-[3px] border-transparent bg-[#F3F3F5] p-2 text-center outline-none transition-[border-color,background-color,box-shadow,opacity,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] hover:border-[#EC1C24]/35 hover:bg-white hover:shadow-[0_12px_28px_-14px_rgba(236,28,36,0.28)] focus-visible:border-[#EC1C24] focus-visible:ring-2 focus-visible:ring-[#EC1C24]/25 active:scale-[0.98]";

const STRIP_REMOVE_MS = 420;
const TABLE_ROW_ARCHIVE_MS = 260;
const STRIP_REMOVE_EASE = "cubic-bezier(0.22, 1, 0.36, 1)";
const stripItemCollapseTransition: CSSProperties = {
  transitionProperty: "width, max-width, min-width, flex-basis, opacity, margin",
  transitionDuration: `${STRIP_REMOVE_MS}ms`,
  transitionTimingFunction: STRIP_REMOVE_EASE,
};

const assignClientInputClass =
  "h-12 w-full min-w-0 rounded-[10px] border-[3px] border-[#E4E5E7] bg-white px-3 pr-11 text-[18px] font-medium tracking-[-0.04em] text-black outline-none placeholder:text-[#B5B5B5] [color-scheme:light] [&::-webkit-search-cancel-button]:hidden";

const docRows: DocRow[] = [
  { id: "table-1", name: "Договор сотрудничества.pdf", size: "1.2 MB", added: "03.08.2024", client: "Иванов Артём Сергеевич", status: "Подписан" },
  { id: "table-2", name: "Лизинг page.pdf", size: "850 KB", added: "05.08.2024", client: "Смирнова Наталья Викторовна", status: "На проверке" },
  { id: "table-3", name: "Счет №23 от 09.08.pdf", size: "740 KB", added: "06.08.2024", client: 'ООО "Сад"', status: "На согласовании" },
  { id: "table-4", name: "Акт выполненных работ.docx", size: "950 KB", added: "08.08.2024", client: "ИП Лебедев Максим Олегович", status: "Действует" },
  { id: "table-5", name: "Гарантийное письмо.pdf", size: "490 KB", added: "15.08.2024", client: 'ООО "ЭкоМобил"', status: "Подписан" },
  { id: "table-6", name: "Условия поставки.docx", size: "810 KB", added: "20.08.2024", client: "Белов Алексей Игоревич", status: "Архивирован" },
  { id: "table-7", name: "Акт передачи авто.pdf", size: "680 KB", added: "30.08.2024", client: 'ООО "ТехноТрак"', status: "На проверке" },
  { id: "table-8", name: "Дополнительное соглашение №2.pdf", size: "560 KB", added: "02.09.2024", client: "Гаврилова Ирина Михайловна", status: "Подписан" },
  { id: "table-9", name: "Спецификация к договору.xlsx", size: "1.1 MB", added: "05.09.2024", client: 'ООО "ГрузСервис"', status: "Действует" },
  { id: "table-10", name: "Счет-фактура №119.pdf", size: "430 KB", added: "07.09.2024", client: 'ООО "Магистраль"', status: "На согласовании" },
  { id: "table-11", name: "Отчет по закупкам Q3.xlsx", size: "980 KB", added: "09.09.2024", client: "Журавлёв Михаил Дмитриевич", status: "Архивирован" },
  { id: "table-12", name: "Приложение к контракту.docx", size: "720 KB", added: "12.09.2024", client: "Орлова Анна Вячеславовна", status: "На проверке" },
  { id: "table-13", name: "Реестр платежей сентябрь.pdf", size: "640 KB", added: "15.09.2024", client: 'ООО "ЭкспрессТранс"', status: "Подписан" },
  { id: "table-14", name: "Акт сверки взаиморасчетов.pdf", size: "590 KB", added: "18.09.2024", client: "Кузнецов Павел Андреевич", status: "Действует" },
  { id: "table-15", name: "Доверенность представителя.pdf", size: "320 KB", added: "20.09.2024", client: "Фролова Алина Андреевна", status: "На проверке" },
];

const statusStyle: Record<DocRow["status"], string> = {
  Подписан: "#00B515",
  "На проверке": "#F39D00",
  Архивирован: "#E00919",
  Действует: "#2E78C9",
  "На согласовании": "#D17E00",
};

const DOCUMENT_STATUS_FILTERS: DocRow["status"][] = [
  "На проверке",
  "На согласовании",
  "Подписан",
  "Действует",
  "Архивирован",
];

function getInitialDocumentsState(): { recentDocs: RecentDoc[]; tableRows: DocRow[] } {
  return loadDocumentsPageState({ recentDocs: INITIAL_RECENT_DOCS, tableRows: docRows });
}

let initialDocumentsStateCache: { recentDocs: RecentDoc[]; tableRows: DocRow[] } | null = null;

function getInitialDocumentsStateCached(): { recentDocs: RecentDoc[]; tableRows: DocRow[] } {
  if (!initialDocumentsStateCache) {
    initialDocumentsStateCache = getInitialDocumentsState();
  }
  return initialDocumentsStateCache;
}

export function DocumentsPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const recentDocsScrollRef = useRef<HTMLDivElement | null>(null);
  const uploadInputRef = useRef<HTMLInputElement | null>(null);
  const stripRemoveTimerRef = useRef<Map<string, number>>(new Map());
  const tableRemoveTimerRef = useRef<Map<string, number>>(new Map());
  const documentTableRowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const focusDocumentScrollKey = useRef("");
  const [recentDocs, setRecentDocs] = useState<RecentDoc[]>(() => getInitialDocumentsStateCached().recentDocs);
  const [tableRows, setTableRows] = useState<DocRow[]>(() => getInitialDocumentsStateCached().tableRows);
  const [exitingStripIds, setExitingStripIds] = useState<Set<string>>(() => new Set());
  const [stripExitLayout, setStripExitLayout] = useState<Record<string, CSSProperties>>({});
  const [archivingTableRowId, setArchivingTableRowId] = useState<string | null>(null);
  const [flashTableRowId, setFlashTableRowId] = useState<string | null>(null);
  const [documentActionsModal, setDocumentActionsModal] = useState<DocRow | null>(null);
  const [assignClientModalRow, setAssignClientModalRow] = useState<DocRow | null>(null);
  const [assignClientDraft, setAssignClientDraft] = useState("");
  const [statusPickerForId, setStatusPickerForId] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === "undefined") return;
    persistDocumentsPageState(recentDocs, tableRows);
  }, [recentDocs, tableRows]);

  useEffect(() => {
    return () => {
      for (const timerId of stripRemoveTimerRef.current.values()) {
        window.clearTimeout(timerId);
      }
      stripRemoveTimerRef.current.clear();
      for (const timerId of tableRemoveTimerRef.current.values()) {
        window.clearTimeout(timerId);
      }
      tableRemoveTimerRef.current.clear();
    };
  }, []);

  useLayoutEffect(() => {
    const docId = searchParams.get("document");
    if (!docId) {
      focusDocumentScrollKey.current = "";
      return;
    }
    if (!tableRows.some((row) => row.id === docId)) {
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          next.delete("document");
          return next;
        },
        { replace: true },
      );
      focusDocumentScrollKey.current = "";
      return;
    }
    if (typeof window !== "undefined") {
      window.sessionStorage.removeItem(DOCUMENT_LIST_FLASH_ARMED_KEY);
    }
    const idx = tableRows.findIndex((row) => row.id === docId);
    if (idx === -1) return;
    const scrollKey = `${docId}@${idx}`;
    if (focusDocumentScrollKey.current === scrollKey) return;
    focusDocumentScrollKey.current = scrollKey;
    setFlashTableRowId(docId);
    setSearchParams(
      (prev) => {
        const next = new URLSearchParams(prev);
        next.delete("document");
        return next;
      },
      { replace: true },
    );
    requestAnimationFrame(() => {
      documentTableRowRefs.current[docId]?.scrollIntoView({ block: "nearest", behavior: "smooth" });
    });
    const clearFlashTid = window.setTimeout(() => {
      setFlashTableRowId((prev) => (prev === docId ? null : prev));
    }, 4200);
    const clearRefsTid = window.setTimeout(() => {
      focusDocumentScrollKey.current = "";
    }, 1200);
    return () => {
      window.clearTimeout(clearFlashTid);
      window.clearTimeout(clearRefsTid);
    };
  }, [searchParams, tableRows, setSearchParams]);

  function onDocumentTableFlashAnimationEnd(event: AnimationEvent, rowId: string) {
    if (event.animationName !== "requestRowHighlightBorder") return;
    setFlashTableRowId((current) => (current === rowId ? null : current));
  }

  useEffect(() => {
    if (!documentActionsModal) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDocumentActionsModal(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [documentActionsModal]);

  useEffect(() => {
    if (!assignClientModalRow) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        setAssignClientModalRow(null);
        setAssignClientDraft("");
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [assignClientModalRow]);

  useEffect(() => {
    if (statusPickerForId && !tableRows.some((row) => row.id === statusPickerForId)) {
      setStatusPickerForId(null);
    }
  }, [tableRows, statusPickerForId]);

  useEffect(() => {
    if (!statusPickerForId) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setStatusPickerForId(null);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [statusPickerForId]);

  const statusPickerRow = statusPickerForId ? tableRows.find((row) => row.id === statusPickerForId) ?? null : null;

  function openStatusPicker(row: DocRow) {
    setStatusPickerForId(row.id);
    setDocumentActionsModal(null);
  }

  function commitDocumentStatus(status: DocRow["status"]) {
    if (!statusPickerForId) return;
    const targetId = statusPickerForId;
    setTableRows((prev) => prev.map((row) => (row.id === targetId ? { ...row, status } : row)));
    emitArchiveStyleToast({
      line1: statusPickerRow?.name ?? "Документ",
      line2: `статус: ${status}`,
    });
    setStatusPickerForId(null);
  }

  function openAssignClientModal(row: DocRow) {
    setAssignClientModalRow(row);
    setAssignClientDraft(row.client === "—" ? "" : row.client);
    setDocumentActionsModal(null);
  }

  function commitAssignClient() {
    if (!assignClientModalRow) return;
    const nextClient = assignClientDraft.trim();
    if (!nextClient) return;

    const targetId = assignClientModalRow.id;
    setTableRows((prev) => prev.map((row) => (row.id === targetId ? { ...row, client: nextClient } : row)));
    emitArchiveStyleToast({
      line1: assignClientModalRow.name,
      line2: `клиент: ${nextClient}`,
    });
    setAssignClientModalRow(null);
    setAssignClientDraft("");
  }

  function handleDocumentUpload(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    const id = `upload-${Date.now()}`;
    const objectUrl = URL.createObjectURL(file);
    const title = titleFromFileName(file.name);
    const added = formatRuDateToday();
    const newDoc: RecentDoc = {
      id,
      title,
      date: added,
      ext: inferDocExt(file.name),
      file: objectUrl,
      downloadName: file.name,
    };
    const newRow: DocRow = {
      id,
      name: file.name,
      size: formatFileSize(file.size),
      added,
      client: "—",
      status: "На проверке",
      file: objectUrl,
      downloadName: file.name,
    };

    void storeUploadedDocumentFile(id, file)
      .then(() => {
        setRecentDocs((prev) => [newDoc, ...prev]);
        setTableRows((prev) => [newRow, ...prev]);
        if (typeof window !== "undefined") {
          window.sessionStorage.setItem(DOCUMENT_LIST_FLASH_ARMED_KEY, id);
        }
        emitArchiveStyleToast({
          line1: title,
          line2: "документ добавлен",
          navigateTo: `/documents?document=${encodeURIComponent(id)}`,
        });

        requestAnimationFrame(() => {
          if (recentDocsScrollRef.current) recentDocsScrollRef.current.scrollLeft = 0;
        });
      })
      .catch(() => {
        URL.revokeObjectURL(objectUrl);
        emitArchiveStyleToast({ line1: "Не удалось сохранить документ", line2: "попробуйте другой файл" });
      });
  }

  function removeRecentDoc(id: string, wrapperEl: HTMLElement | null) {
    if (exitingStripIds.has(id)) return;

    const measuredWidth = wrapperEl?.offsetWidth ?? 160;
    const tableRowExists = tableRows.some((row) => row.id === id);

    if (tableRowExists) {
      setArchivingTableRowId(id);
    }
    setExitingStripIds((prev) => {
      const next = new Set(prev);
      next.add(id);
      return next;
    });
    setStripExitLayout((prev) => ({
      ...prev,
      [id]: {
        ...stripItemCollapseTransition,
        width: measuredWidth,
        maxWidth: measuredWidth,
        flexBasis: `${measuredWidth}px`,
        overflow: "hidden",
      },
    }));

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setStripExitLayout((prev) => ({
          ...prev,
          [id]: {
            ...stripItemCollapseTransition,
            width: 0,
            maxWidth: 0,
            minWidth: 0,
            flexBasis: 0,
            opacity: 0,
            marginRight: -8,
            overflow: "hidden",
          },
        }));
      });
    });

    if (tableRowExists) {
      const tableTimerId = window.setTimeout(() => {
        tableRemoveTimerRef.current.delete(id);
        setTableRows((prev) => prev.filter((row) => row.id !== id));
        setArchivingTableRowId((current) => (current === id ? null : current));
        setDocumentActionsModal((prev) => (prev?.id === id ? null : prev));
      }, TABLE_ROW_ARCHIVE_MS);
      tableRemoveTimerRef.current.set(id, tableTimerId);
    }

    const timerId = window.setTimeout(() => {
      stripRemoveTimerRef.current.delete(id);
      setRecentDocs((prev) => {
        const removed = prev.find((doc) => doc.id === id);
        if (removed?.file.startsWith("blob:")) URL.revokeObjectURL(removed.file);
        return prev.filter((doc) => doc.id !== id);
      });
      removeUploadedDocumentFile(id);
      setExitingStripIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      setStripExitLayout((prev) => {
        const next = { ...prev };
        delete next[id];
        return next;
      });
    }, STRIP_REMOVE_MS);

    stripRemoveTimerRef.current.set(id, timerId);
  }

  return (
    <div className="h-screen w-screen overflow-hidden bg-black max-lg:min-h-screen max-lg:h-auto max-lg:overflow-y-auto lg:h-screen lg:overflow-hidden">
      <div className="flex h-full w-full min-h-0 p-2 max-lg:h-auto lg:h-full">
        <div className="flex h-full min-h-0 w-full max-lg:h-auto max-lg:flex-col rounded-[16px] bg-black p-2 shadow-none lg:flex-row lg:shadow-[0_16px_30px_-20px_rgba(0,0,0,0.95)]">
          <MarsAppShellSidebar mobileLayout="requests" />

          <main className="flex min-h-0 min-w-0 flex-1 flex-col max-lg:overflow-x-hidden">
            <header className="mb-2 rounded-[16px] border border-[#DDE1E7] bg-white px-4 py-4 lg:px-5 lg:py-5">
              <input
                ref={uploadInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.xls,.xlsx,application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                className="sr-only"
                aria-hidden
                onChange={handleDocumentUpload}
              />
              <div className="flex max-lg:flex-col max-lg:items-stretch max-lg:gap-4 items-center gap-3 lg:flex-row lg:items-center lg:gap-3">
                <div className="flex min-w-0 items-baseline gap-2">
                  <h1 className="text-[28px] font-bold leading-[100%] tracking-[-0.04em] text-[#111826] lg:text-[36px]">Документы</h1>
                </div>
                <button
                  type="button"
                  onClick={() => uploadInputRef.current?.click()}
                  className="ml-auto h-12 min-h-[48px] shrink-0 cursor-pointer rounded-[10px] border-2 border-transparent bg-[#EC1C24] px-4 text-[18px] font-medium tracking-[-0.04em] text-white transition-colors duration-300 ease-in-out max-lg:w-full sm:max-lg:w-auto lg:px-3 lg:text-[16px] xl:px-4 xl:text-[18px]"
                >
                  Добавить документ
                </button>
              </div>
            </header>

            <section className="flex min-h-0 flex-1 flex-col gap-4 rounded-[16px] border border-[#DDE1E7] bg-white px-4 py-4 lg:gap-5 lg:px-5 lg:py-5">
              <div className="mt-2 overflow-hidden">
                <div
                  ref={recentDocsScrollRef}
                  onWheel={(event) => {
                    if (!recentDocsScrollRef.current) return;
                    event.preventDefault();
                    recentDocsScrollRef.current.scrollLeft += event.deltaY;
                  }}
                  className="hide-scrollbar overflow-x-auto overflow-y-hidden"
                >
                  <div className="flex gap-2 pb-1">
                    {recentDocs.map((doc) => {
                      const isExiting = exitingStripIds.has(doc.id);
                      return (
                        <div
                          key={doc.id}
                          data-strip-item
                          className={`relative shrink-0 overflow-hidden ${
                            isExiting ? "pointer-events-none" : recentDocStripItemClass
                          }`}
                          style={stripExitLayout[doc.id]}
                        >
                          <div
                            className={`relative transition-[transform,opacity] duration-[420ms] ease-[cubic-bezier(0.22,1,0.36,1)] ${
                              isExiting ? "-translate-x-10 scale-[0.86] opacity-0" : "translate-x-0 scale-100 opacity-100"
                            }`}
                          >
                            <button
                              type="button"
                              className={`${recentDocStripCardClass} ${isExiting ? "pointer-events-none" : ""}`}
                              aria-label={`Скачать: ${doc.title}`}
                              title="Скачать документ"
                              onClick={() => void downloadRecentDocAsset(doc).catch(() => {})}
                            >
                              <div className="flex min-h-0 flex-1 flex-col">
                                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden">
                                  <img
                                    src={docFormatIconMap[doc.ext] ?? "/file.svg"}
                                    alt=""
                                    className="h-20 w-20 object-contain transition-[height,width,transform] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:h-full group-hover:w-full group-hover:max-w-full group-hover:max-h-full group-hover:scale-[1.02]"
                                  />
                                </div>
                                <div className="max-h-[96px] shrink-0 overflow-hidden transition-[max-height,opacity,margin] duration-300 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:max-h-0 group-hover:opacity-0 group-hover:mt-0">
                                  <p className="mt-1 line-clamp-2 text-center text-[12px] font-medium leading-snug text-[#2E3444]">{doc.title}</p>
                                  <p className="mt-0.5 text-center text-[11px] text-[#8F96A6]">{doc.date}</p>
                                </div>
                              </div>
                            </button>
                            <button
                              type="button"
                              aria-label={`Удалить ${doc.title}`}
                              onClick={(event) => {
                                event.stopPropagation();
                                const wrapper = (event.currentTarget as HTMLElement).closest("[data-strip-item]") as HTMLElement | null;
                                removeRecentDoc(doc.id, wrapper);
                              }}
                              className="absolute right-1.5 top-1.5 z-10 grid h-7 w-7 cursor-pointer place-items-center rounded-full border border-[#E4E5E7] bg-white text-[#8F96A6] shadow-[0_2px_8px_rgba(0,0,0,0.08)] transition-[background-color,border-color,color,transform,opacity] duration-200 hover:border-[#EC1C24]/35 hover:bg-[#FFF5F5] hover:text-[#EC1C24] active:scale-95"
                            >
                              <svg viewBox="0 0 16 16" fill="none" className="h-3.5 w-3.5" aria-hidden>
                                <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              <div className="@container mt-3 min-h-0 min-w-0 flex-1 overflow-hidden rounded-lg bg-white max-lg:min-h-[240px] max-lg:flex-none lg:flex-1">
                <div className="journal-table-scroll relative min-h-0 min-w-0 h-full touch-pan-x touch-pan-y overflow-x-auto overflow-y-auto overscroll-x-contain [-webkit-overflow-scrolling:touch] max-lg:max-h-[min(72vh,680px)] lg:max-h-[min(78vh,800px)] xl:max-h-none">
                  <table className="w-full min-w-[1280px] table-fixed border-separate border-spacing-0 whitespace-nowrap text-[16px] font-medium tracking-[-0.04em] lg:min-w-0">
                    <colgroup>
                      <col className="w-[4%]" />
                      <col className="w-[30%]" />
                      <col className="w-[10%]" />
                      <col className="w-[12%]" />
                      <col className="w-[27%]" />
                      <col className="w-[14%]" />
                      <col className="w-[3%]" />
                    </colgroup>
                    <thead className="bg-[#F3F3F5] text-left text-[16px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                      <tr>
                        <th className="rounded-l-[5px] px-3 py-2.5 font-medium">
                          <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-[2px] border-[#D8DBDE]" />
                        </th>
                        <th className="px-4 py-2.5 font-medium">Название</th>
                        <th className="px-4 py-2.5 font-medium">Размер</th>
                        <th className="px-4 py-2.5 font-medium">Добавлен</th>
                        <th className="px-4 py-2.5 font-medium">Клиент</th>
                        <th className="px-4 py-2.5 font-medium">Статус</th>
                        <th className="rounded-r-[5px] px-4 py-2.5 font-medium text-center">⋮</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tableRows.map((row, index) => {
                        const isArchiving = archivingTableRowId === row.id;
                        const isFlashTarget = flashTableRowId === row.id;
                        const flashStyle = isFlashTarget
                          ? ({ animation: "requestRowHighlightBorder 4s ease-out" } as const)
                          : undefined;
                        return (
                        <tr
                          key={row.id}
                          ref={(element) => {
                            documentTableRowRefs.current[row.id] = element;
                          }}
                          data-document-row={row.id}
                          className={`border-[5px] border-[#EEEDF0] transition [&_td]:align-middle hover:bg-[rgba(224,9,25,0.10)] ${index % 2 === 1 ? "bg-[#F8F8FA]" : "bg-white"} ${
                            isArchiving ? "pointer-events-none animate-[archiveRowOut_260ms_ease_forwards]" : ""
                          } ${isFlashTarget ? "relative z-[2]" : ""}`}
                          style={flashStyle}
                          onAnimationEnd={(event) => onDocumentTableFlashAnimationEnd(event, row.id)}
                        >
                          <td className="px-3 py-3">
                            <span className="inline-block h-3.5 w-3.5 rounded-[3px] border-[2px] border-[#D8DBDE]" />
                          </td>
                          <td className="px-4 py-3 text-black">{row.name}</td>
                          <td className="px-4 py-3 text-black">{row.size}</td>
                          <td className="px-4 py-3 text-black">{row.added}</td>
                          <td className="px-4 py-3 text-black">{row.client}</td>
                          <td className="px-4 py-3 font-medium">
                            <span className="inline-flex items-center gap-2 font-medium text-black">
                              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: statusStyle[row.status] }} />
                              <span className="font-medium text-black">{row.status}</span>
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center align-middle" onClick={(e) => e.stopPropagation()}>
                            <button
                              type="button"
                              aria-haspopup="dialog"
                              aria-expanded={documentActionsModal?.id === row.id}
                              aria-label={`Меню действий, ${row.name}`}
                              className="cursor-pointer rounded-md px-1.5 py-0.5 text-[16px] font-bold leading-none tracking-[-0.04em] text-[#A0A0A0] transition-colors hover:bg-black/[0.04] hover:text-[#EC1C24]"
                              onClick={() => setDocumentActionsModal(row)}
                            >
                              ...
                            </button>
                          </td>
                        </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </section>
          </main>
        </div>
      </div>

      {documentActionsModal && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[260] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setDocumentActionsModal(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="document-actions-title"
                className="w-full max-w-[360px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="document-actions-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Действия с документом
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    {documentActionsModal.name}
                  </p>
                </div>
                <ul className="p-0">
                  <li>
                    <button
                      type="button"
                      className="cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] text-[#111826] transition-colors hover:bg-[#F3F3F5]"
                      onClick={() => openAssignClientModal(documentActionsModal)}
                    >
                      <RequestActionIconAssignLead className="text-[#4B5563]" />
                      Указать клиента
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] text-[#111826] transition-colors hover:bg-[#F3F3F5]"
                      onClick={() => openStatusPicker(documentActionsModal)}
                    >
                      <RequestActionIconStatus className="text-[#4B5563]" />
                      Изменить статус
                    </button>
                  </li>
                  <li>
                    <button
                      type="button"
                      className="cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] text-[#111826] transition-colors hover:bg-[#F3F3F5]"
                      onClick={() => {
                        downloadDocRow(documentActionsModal);
                        setDocumentActionsModal(null);
                      }}
                    >
                      <DocumentDownloadIcon className="text-[#4B5563]" />
                      Скачать документ
                    </button>
                  </li>
                </ul>
              </div>
            </div>,
            document.body,
          )
        : null}
      {assignClientModalRow && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[261] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => {
                setAssignClientModalRow(null);
                setAssignClientDraft("");
              }}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="document-assign-client-title"
                className="w-full max-w-[520px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="document-assign-client-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Указать клиента
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    {assignClientModalRow.name}
                  </p>
                </div>
                <div className="p-5">
                  <label htmlFor="document-assign-client-input" className="mb-2 block text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    ФИО клиента
                  </label>
                  <div className="relative w-full min-w-0">
                    <input
                      id="document-assign-client-input"
                      value={assignClientDraft}
                      onChange={(event) => setAssignClientDraft(event.target.value)}
                      className={assignClientInputClass}
                      placeholder="ФИО клиента"
                      aria-label="ФИО клиента"
                      autoFocus
                    />
                    {assignClientDraft.trim() ? (
                      <button
                        type="button"
                        onClick={() => setAssignClientDraft("")}
                        aria-label="Очистить поле"
                        className="absolute right-1.5 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 cursor-pointer items-center justify-center rounded-[8px] text-black"
                      >
                        <svg viewBox="0 0 16 16" fill="none" className="h-[16px] w-[16px]" aria-hidden>
                          <path d="M4 4L12 12M12 4L4 12" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" />
                        </svg>
                      </button>
                    ) : null}
                  </div>
                </div>
                <div className="flex gap-2 border-t border-[#EEEDF0] p-5">
                  <button
                    type="button"
                    onClick={() => {
                      setAssignClientModalRow(null);
                      setAssignClientDraft("");
                    }}
                    className="h-12 flex-1 cursor-pointer rounded-[10px] bg-[#ECECEF] px-4 text-center text-[18px] font-medium tracking-[-0.04em] text-[#111111]"
                  >
                    Отмена
                  </button>
                  <button
                    type="button"
                    disabled={!assignClientDraft.trim()}
                    onClick={commitAssignClient}
                    className="h-12 flex-1 cursor-pointer rounded-[10px] border-2 border-[#EC1C24] bg-[#EC1C24] px-4 text-center text-[18px] font-medium tracking-[-0.04em] text-white disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    Сохранить
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      {statusPickerRow && typeof document !== "undefined"
        ? createPortal(
            <div
              className="fixed inset-0 z-[262] flex items-center justify-center bg-black/45 p-4"
              role="presentation"
              onClick={() => setStatusPickerForId(null)}
            >
              <div
                role="dialog"
                aria-modal="true"
                aria-labelledby="document-status-picker-title"
                className="w-full max-w-[360px] overflow-hidden rounded-[14px] border border-[#E4E5E7] bg-white shadow-[0_24px_60px_-16px_rgba(0,0,0,0.45)]"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="border-b border-[#EEEDF0] p-5">
                  <h2 id="document-status-picker-title" className="text-[18px] font-semibold tracking-[-0.04em] text-[#111826]">
                    Изменить статус
                  </h2>
                  <p className="mt-1 truncate text-[14px] font-medium tracking-[-0.04em] text-[#7D7D7D]">
                    {statusPickerRow.name} · {statusPickerRow.client}
                  </p>
                </div>
                <ul className="p-0">
                  {DOCUMENT_STATUS_FILTERS.map((status) => {
                    const isCurrent = statusPickerRow.status === status;
                    return (
                      <li key={status}>
                        <button
                          type="button"
                          onClick={() => commitDocumentStatus(status)}
                          className={`cursor-pointer flex w-full items-center gap-3 p-5 text-left text-[16px] font-medium tracking-[-0.04em] transition-colors ${
                            isCurrent ? "bg-[#F8F8FA] text-[#111826]" : "text-[#111826] hover:bg-[#F3F3F5]"
                          }`}
                        >
                          <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusStyle[status] }} />
                          <span className="min-w-0 flex-1">{status}</span>
                          {isCurrent ? (
                            <span className="shrink-0 text-[13px] font-medium text-[#7D7D7D]">Сейчас</span>
                          ) : null}
                        </button>
                      </li>
                    );
                  })}
                </ul>
                <div className="border-t border-[#EEEDF0] p-5">
                  <button
                    type="button"
                    onClick={() => setStatusPickerForId(null)}
                    className="w-full cursor-pointer rounded-[10px] bg-[#ECECEF] p-4 text-center text-[16px] font-medium tracking-[-0.04em] text-[#111111] transition-colors hover:bg-[#E0E0E4]"
                  >
                    Отмена
                  </button>
                </div>
              </div>
            </div>,
            document.body,
          )
        : null}
      <style>
        {`
          @keyframes archiveRowOut {
            0% {
              opacity: 1;
            }
            100% {
              opacity: 0;
            }
          }
          @keyframes requestRowHighlightBorder {
            0% {
              border-color: #EEEDF0;
              box-shadow: inset 0 0 0 0 rgba(236, 28, 36, 0);
            }
            20% {
              border-color: #EC1C24;
              box-shadow: inset 0 0 0 3px #EC1C24;
            }
            70% {
              border-color: #EC1C24;
              box-shadow: inset 0 0 0 3px #EC1C24;
            }
            100% {
              border-color: #EEEDF0;
              box-shadow: inset 0 0 0 0 rgba(236, 28, 36, 0);
            }
          }
        `}
      </style>
    </div>
  );
}
