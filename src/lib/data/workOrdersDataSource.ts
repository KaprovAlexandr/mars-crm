import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/supabaseClient";
import { getApiBaseUrl, getDataProviderKind } from "./provider";

export type WorkOrderStatus = "Новый" | "В работе" | "Ожидание запчастей" | "Готово" | "Закрыт" | "Отказ клиента";

export type WorkOrderStorageRow = {
  id: string;
  status: WorkOrderStatus | null;
  client: string;
  car: string;
  plate: string;
  master: string;
  master_photo: string | null;
  amount: string;
  due_date: string;
  archived: boolean | null;
  urgent: boolean | null;
};

const WORK_ORDERS_TABLE = "work_orders";

export function isWorkOrdersRemoteEnabled(): boolean {
  const kind = getDataProviderKind();
  if (kind === "supabase") return isSupabaseConfigured();
  if (kind === "api") return true;
  return false;
}

export async function listWorkOrdersStorageRows(): Promise<WorkOrderStorageRow[]> {
  const kind = getDataProviderKind();
  if (kind === "supabase") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .select("id,status,client,car,plate,master,master_photo,amount,due_date,archived,urgent")
      .order("id", { ascending: false });
    if (error) throw error;
    return (data ?? []) as WorkOrderStorageRow[];
  }
  const response = await fetch(`${getApiBaseUrl()}/api/work-orders`);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API list work orders failed: ${response.status} ${details}`);
  }
  return (await response.json()) as WorkOrderStorageRow[];
}

export async function insertWorkOrderStorageRow(row: WorkOrderStorageRow): Promise<WorkOrderStorageRow> {
  const kind = getDataProviderKind();
  if (kind === "supabase") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(WORK_ORDERS_TABLE)
      .insert(row)
      .select("id,status,client,car,plate,master,master_photo,amount,due_date,archived,urgent")
      .single();
    if (error) throw error;
    return data as WorkOrderStorageRow;
  }
  const response = await fetch(`${getApiBaseUrl()}/api/work-orders`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API create work order failed: ${response.status} ${details}`);
  }
  return (await response.json()) as WorkOrderStorageRow;
}

export async function updateWorkOrdersStorageRows(ids: string[], patch: Partial<WorkOrderStorageRow>): Promise<void> {
  if (ids.length === 0) return;
  const kind = getDataProviderKind();
  if (kind === "supabase") {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(WORK_ORDERS_TABLE).update(patch).in("id", ids);
    if (error) throw error;
    return;
  }
  const response = await fetch(`${getApiBaseUrl()}/api/work-orders/bulk-update`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, patch }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API update work orders failed: ${response.status} ${details}`);
  }
}

