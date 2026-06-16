type RecentDocExt = "DOC" | "XLS" | "PDF";

export type PersistedRecentDoc = {
  id: string;
  title: string;
  date: string;
  ext: RecentDocExt;
  file: string;
  downloadName: string;
};

export type PersistedDocRow = {
  id: string;
  name: string;
  size: string;
  added: string;
  client: string;
  status: "Подписан" | "На проверке" | "Архивирован" | "Действует" | "На согласовании";
  file?: string;
  downloadName?: string;
};

type StoredUpload = {
  base64: string;
  mimeType: string;
  downloadName: string;
};

const DOCUMENTS_PAGE_STATE_KEY = "documentsPageStateV1";
const DOCUMENTS_UPLOADS_KEY = "documentsPageUploadsV1";

function isUploadedId(id: string): boolean {
  return id.startsWith("upload-");
}

function canUseLocalStorage(): boolean {
  return typeof window !== "undefined" && typeof window.localStorage !== "undefined";
}

function loadUploads(): Record<string, StoredUpload> {
  if (!canUseLocalStorage()) return {};
  try {
    const raw = window.localStorage.getItem(DOCUMENTS_UPLOADS_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" ? (parsed as Record<string, StoredUpload>) : {};
  } catch {
    return {};
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("Не удалось прочитать файл"));
        return;
      }
      const commaIndex = result.indexOf(",");
      resolve(commaIndex >= 0 ? result.slice(commaIndex + 1) : result);
    };
    reader.onerror = () => reject(reader.error ?? new Error("Не удалось прочитать файл"));
    reader.readAsDataURL(file);
  });
}

function base64ToBlobUrl(base64: string, mimeType: string): string {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType || "application/octet-stream" }));
}

function hydrateRecentDoc(doc: PersistedRecentDoc, uploads: Record<string, StoredUpload>): PersistedRecentDoc {
  if (!isUploadedId(doc.id)) return doc;
  const stored = uploads[doc.id];
  if (!stored) return { ...doc, file: "" };
  return {
    ...doc,
    file: base64ToBlobUrl(stored.base64, stored.mimeType),
    downloadName: stored.downloadName,
  };
}

function hydrateDocRow(row: PersistedDocRow, uploads: Record<string, StoredUpload>): PersistedDocRow {
  if (!isUploadedId(row.id)) return row;
  const stored = uploads[row.id];
  if (!stored) return { ...row, file: undefined, downloadName: undefined };
  return {
    ...row,
    file: base64ToBlobUrl(stored.base64, stored.mimeType),
    downloadName: stored.downloadName,
  };
}

function isRecentDocArray(value: unknown): value is PersistedRecentDoc[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.title === "string" &&
        typeof item.date === "string" &&
        (item.ext === "DOC" || item.ext === "XLS" || item.ext === "PDF") &&
        typeof item.downloadName === "string",
    )
  );
}

function isDocRowArray(value: unknown): value is PersistedDocRow[] {
  return (
    Array.isArray(value) &&
    value.every(
      (item) =>
        item &&
        typeof item === "object" &&
        typeof item.id === "string" &&
        typeof item.name === "string" &&
        typeof item.size === "string" &&
        typeof item.added === "string" &&
        typeof item.client === "string" &&
        typeof item.status === "string",
    )
  );
}

export function loadDocumentsPageState(defaults: {
  recentDocs: PersistedRecentDoc[];
  tableRows: PersistedDocRow[];
}): { recentDocs: PersistedRecentDoc[]; tableRows: PersistedDocRow[] } {
  if (!canUseLocalStorage()) return defaults;
  try {
    const raw = window.localStorage.getItem(DOCUMENTS_PAGE_STATE_KEY);
    if (!raw) return defaults;
    const parsed = JSON.parse(raw) as { recentDocs?: unknown; tableRows?: unknown };
    if (!isRecentDocArray(parsed.recentDocs) || !isDocRowArray(parsed.tableRows)) {
      return defaults;
    }
    const uploads = loadUploads();
    return {
      recentDocs: parsed.recentDocs.map((doc) => hydrateRecentDoc(doc, uploads)),
      tableRows: parsed.tableRows.map((row) => hydrateDocRow(row, uploads)),
    };
  } catch {
    return defaults;
  }
}

export async function storeUploadedDocumentFile(id: string, file: File): Promise<void> {
  if (!canUseLocalStorage()) return;
  const base64 = await fileToBase64(file);
  const uploads = loadUploads();
  uploads[id] = {
    base64,
    mimeType: file.type || "application/octet-stream",
    downloadName: file.name,
  };
  window.localStorage.setItem(DOCUMENTS_UPLOADS_KEY, JSON.stringify(uploads));
}

export function removeUploadedDocumentFile(id: string): void {
  if (!canUseLocalStorage() || !isUploadedId(id)) return;
  const uploads = loadUploads();
  if (!(id in uploads)) return;
  delete uploads[id];
  window.localStorage.setItem(DOCUMENTS_UPLOADS_KEY, JSON.stringify(uploads));
}

export function persistDocumentsPageState(recentDocs: PersistedRecentDoc[], tableRows: PersistedDocRow[]): void {
  if (!canUseLocalStorage()) return;
  try {
    const serializedRecent = recentDocs.map((doc) => ({
      ...doc,
      file: isUploadedId(doc.id) ? "" : doc.file,
    }));
    const serializedTable = tableRows.map((row) => ({
      ...row,
      file: isUploadedId(row.id) ? undefined : row.file,
      downloadName: isUploadedId(row.id) ? undefined : row.downloadName,
    }));
    window.localStorage.setItem(
      DOCUMENTS_PAGE_STATE_KEY,
      JSON.stringify({ recentDocs: serializedRecent, tableRows: serializedTable }),
    );
  } catch {
    // ignore quota or serialization errors
  }
}
