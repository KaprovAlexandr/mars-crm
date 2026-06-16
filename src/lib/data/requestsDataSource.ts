import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/supabaseClient";
import { getApiBaseUrl, getDataProviderKind } from "./provider";

const REQUESTS_TABLE = "requests";

export type RequestSource = "Сайт" | "Звонок" | "Визит";
export type RequestStatus = "Новая" | "В запись" | "В обработке" | "Отказ";

export type RequestsStorageRow = {
  id: string;
  status: RequestStatus;
  client: string;
  phone: string;
  manager: string | null;
  manager_photo: string | null;
  source: RequestSource;
  created_at: string;
  last_activity_at: string;
  archived: boolean;
  comment: string;
};

type UpdateRequestsPatch = Partial<{
  status: RequestStatus;
  client: string;
  phone: string;
  manager: string | null;
  manager_photo: string | null;
  source: RequestSource;
  last_activity_at: string;
  archived: boolean;
  comment: string;
}>;

export function isRequestsRemoteEnabled(): boolean {
  const kind = getDataProviderKind();
  if (kind === "supabase") return isSupabaseConfigured();
  if (kind === "api") return true;
  return false;
}

export async function listRequestsStorageRows(): Promise<RequestsStorageRow[]> {
  const kind = getDataProviderKind();
  if (kind === "supabase") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(REQUESTS_TABLE)
      .select("id,status,client,phone,manager,manager_photo,source,created_at,last_activity_at,archived,comment")
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });
    if (error) throw error;
    return (data ?? []) as RequestsStorageRow[];
  }
  const response = await fetch(`${getApiBaseUrl()}/api/requests`);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API list requests failed: ${response.status} ${details}`);
  }
  return (await response.json()) as RequestsStorageRow[];
}

export async function insertRequestStorageRow(row: RequestsStorageRow): Promise<RequestsStorageRow> {
  const kind = getDataProviderKind();
  if (kind === "supabase") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(REQUESTS_TABLE)
      .insert(row)
      .select("id,status,client,phone,manager,manager_photo,source,created_at,last_activity_at,archived,comment")
      .single();
    if (error) throw error;
    return data as RequestsStorageRow;
  }
  const response = await fetch(`${getApiBaseUrl()}/api/requests`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API create request failed: ${response.status} ${details}`);
  }
  return (await response.json()) as RequestsStorageRow;
}

export async function updateRequestsStorageRows(requestIds: string[], patch: UpdateRequestsPatch): Promise<void> {
  if (requestIds.length === 0) return;
  const kind = getDataProviderKind();
  if (kind === "supabase") {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(REQUESTS_TABLE).update(patch).in("id", requestIds);
    if (error) throw error;
    return;
  }
  const response = await fetch(`${getApiBaseUrl()}/api/requests/bulk-update`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids: requestIds, patch }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API update requests failed: ${response.status} ${details}`);
  }
}

function todayIsoDate(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

/** После подтверждения записи из заявки — статус «В запись». */
export async function markRequestAsBooked(requestId: string): Promise<void> {
  const id = requestId.trim();
  if (!id || !isRequestsRemoteEnabled()) return;
  await updateRequestsStorageRows([id], {
    status: "В запись",
    last_activity_at: todayIsoDate(),
  });
}

