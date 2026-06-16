import { getDataProviderKind, getApiBaseUrl } from "./provider";

export type ClientStorageRow = {
  id: string;
  full_name: string;
  phone: string;
  requests_count: number;
  last_visit: string;
  total_amount: string;
  email?: string | null;
  client_type?: string | null;
  inn?: string | null;
  car?: string | null;
  plate?: string | null;
};

function trimStr(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** Нормализует ответ API (типы, пустые значения); подстраховка от лишних/старых полей в JSON. */
export function normalizeClientStorageRow(raw: unknown): ClientStorageRow | null {
  if (!raw || typeof raw !== "object") return null;
  const r = raw as Record<string, unknown>;
  const id = trimStr(r.id);
  if (!id) return null;
  const email = trimStr(r.email);
  return {
    id,
    full_name: trimStr(r.full_name),
    phone: trimStr(r.phone),
    requests_count: Number.isFinite(Number(r.requests_count)) ? Number(r.requests_count) : 0,
    last_visit: trimStr(r.last_visit),
    total_amount: trimStr(r.total_amount),
    email: email.length > 0 ? email : null,
    client_type: trimStr(r.client_type) || null,
    inn: trimStr(r.inn) || null,
    car: trimStr(r.car) || null,
    plate: trimStr(r.plate) || null,
  };
}

const noStore: RequestInit = { cache: "no-store" };

export function isClientsRemoteEnabled(): boolean {
  return getDataProviderKind() === "api";
}

export async function listClientsStorageRows(): Promise<ClientStorageRow[]> {
  if (getDataProviderKind() !== "api") {
    throw new Error("Clients API datasource supports only api provider.");
  }
  const response = await fetch(`${getApiBaseUrl()}/api/clients`, noStore);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API list clients failed: ${response.status} ${details}`);
  }
  const parsed = (await response.json()) as unknown;
  if (!Array.isArray(parsed)) return [];
  return parsed.map((item) => normalizeClientStorageRow(item)).filter((row): row is ClientStorageRow => row !== null);
}

export async function insertClientStorageRow(row: ClientStorageRow): Promise<ClientStorageRow> {
  if (getDataProviderKind() !== "api") {
    throw new Error("Clients API datasource supports only api provider.");
  }
  const response = await fetch(`${getApiBaseUrl()}/api/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
    ...noStore,
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API create client failed: ${response.status} ${details}`);
  }
  const created = normalizeClientStorageRow(await response.json());
  if (!created) {
    throw new Error("API create client returned an empty payload.");
  }
  return created;
}

export async function getClientStorageRowById(clientId: string): Promise<ClientStorageRow | null> {
  if (getDataProviderKind() !== "api") {
    throw new Error("Clients API datasource supports only api provider.");
  }
  const response = await fetch(`${getApiBaseUrl()}/api/clients/${encodeURIComponent(clientId)}`, noStore);
  if (response.status === 404) return null;
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API get client failed: ${response.status} ${details}`);
  }
  return normalizeClientStorageRow(await response.json());
}

