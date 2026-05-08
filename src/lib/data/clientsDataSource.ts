import { getDataProviderKind, getApiBaseUrl } from "./provider";

export type ClientStorageRow = {
  id: string;
  full_name: string;
  phone: string;
  requests_count: number;
  last_visit: string;
  total_amount: string;
};

export function isClientsRemoteEnabled(): boolean {
  return getDataProviderKind() === "api";
}

export async function listClientsStorageRows(): Promise<ClientStorageRow[]> {
  if (getDataProviderKind() !== "api") {
    throw new Error("Clients API datasource supports only api provider.");
  }
  const response = await fetch(`${getApiBaseUrl()}/api/clients`);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API list clients failed: ${response.status} ${details}`);
  }
  return (await response.json()) as ClientStorageRow[];
}

export async function insertClientStorageRow(row: ClientStorageRow): Promise<ClientStorageRow> {
  if (getDataProviderKind() !== "api") {
    throw new Error("Clients API datasource supports only api provider.");
  }
  const response = await fetch(`${getApiBaseUrl()}/api/clients`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API create client failed: ${response.status} ${details}`);
  }
  return (await response.json()) as ClientStorageRow;
}

export async function getClientStorageRowById(clientId: string): Promise<ClientStorageRow | null> {
  if (getDataProviderKind() !== "api") {
    throw new Error("Clients API datasource supports only api provider.");
  }
  const response = await fetch(`${getApiBaseUrl()}/api/clients/${encodeURIComponent(clientId)}`);
  if (response.status === 404) return null;
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API get client failed: ${response.status} ${details}`);
  }
  return (await response.json()) as ClientStorageRow;
}

