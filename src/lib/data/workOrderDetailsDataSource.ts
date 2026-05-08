import { getApiBaseUrl, getDataProviderKind } from "./provider";

type WorkRow = [string, string, string, "progress" | "wait" | "closed" | "new", string, string?];
type PartRow = [string, string, string, string, string];
type EditableField = { label: string; value: string };
type CarDocumentRow = { id: string; name: string; blobUrl?: string };

export type WorkOrderDetailsStateStorage = {
  work_order_id: string;
  works_current: WorkRow[];
  works_completed: WorkRow[];
  works_archived: WorkRow[];
  parts_current: PartRow[];
  parts_archived: PartRow[];
  client_fields?: EditableField[];
  vehicle_fields?: EditableField[];
  car_photos?: string[];
  documents_current?: CarDocumentRow[];
  documents_archived?: CarDocumentRow[];
};

export function isWorkOrderDetailsRemoteEnabled(): boolean {
  return getDataProviderKind() === "api";
}

export async function loadWorkOrderDetailsState(workOrderId: string): Promise<WorkOrderDetailsStateStorage | null> {
  if (!isWorkOrderDetailsRemoteEnabled()) return null;
  const response = await fetch(`${getApiBaseUrl()}/api/work-order-details/${encodeURIComponent(workOrderId)}/state`);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API load work-order details failed: ${response.status} ${details}`);
  }
  return (await response.json()) as WorkOrderDetailsStateStorage | null;
}

export async function saveWorkOrderDetailsState(payload: WorkOrderDetailsStateStorage): Promise<void> {
  if (!isWorkOrderDetailsRemoteEnabled()) return;
  const response = await fetch(
    `${getApiBaseUrl()}/api/work-order-details/${encodeURIComponent(payload.work_order_id)}/state`,
    {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    },
  );
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API save work-order details failed: ${response.status} ${details}`);
  }
}

