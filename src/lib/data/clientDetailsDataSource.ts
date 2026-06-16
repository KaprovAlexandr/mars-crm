import { getApiBaseUrl, getDataProviderKind } from "./provider";

export type ManualCarDraft = {
  model: string;
  mileage: string;
  plate: string;
  bodyType: string;
  vin: string;
  fuelType: string;
  year: string;
  transmission: string;
  color: string;
};

export type ClientDetailCarDocRow = { id: string; name: string };

export type ClientDetailStatePayload = {
  client_id: string;
  active_tab: "client" | "car";
  active_client_panel: "main" | "cars";
  active_car_panel: "orders" | "documents" | "photos";
  client_fields: Array<{ label: string; value: string }>;
  vehicle_fields: Array<{ label: string; value: string }>;
  selected_client_car_model: string;
  manual_client_cars: string[];
  manual_car_details_by_model: Record<string, ManualCarDraft>;
  documents_scope: "current" | "archived";
  documents_current: ClientDetailCarDocRow[];
  documents_archived: ClientDetailCarDocRow[];
  car_photos: string[];
  car_photos_by_model?: Record<string, string[]>;
};

export function isClientDetailStateRemoteEnabled(): boolean {
  return getDataProviderKind() === "api";
}

export async function loadClientDetailState(clientId: string): Promise<ClientDetailStatePayload | null> {
  if (!isClientDetailStateRemoteEnabled()) return null;
  const response = await fetch(`${getApiBaseUrl()}/api/client-details/${encodeURIComponent(clientId)}/state`, {
    cache: "no-store",
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API load client detail state failed: ${response.status} ${details}`);
  }
  return (await response.json()) as ClientDetailStatePayload | null;
}

export async function saveClientDetailState(payload: ClientDetailStatePayload): Promise<void> {
  if (!isClientDetailStateRemoteEnabled()) return;
  const response = await fetch(`${getApiBaseUrl()}/api/client-details/${encodeURIComponent(payload.client_id)}/state`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API save client detail state failed: ${response.status} ${details}`);
  }
}
