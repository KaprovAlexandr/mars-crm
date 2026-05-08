import { getSupabaseClient, isSupabaseConfigured } from "@/lib/supabase/supabaseClient";
import { getApiBaseUrl, getDataProviderKind } from "./provider";

export type JournalStorageRow = {
  id: string;
  box_id: string;
  master_id: string;
  start_time: string;
  end_time: string;
  client_title: string;
  client_phone: string | null;
  service: string;
  car: string;
  status: string | null;
  status_actor: "system" | "manager" | "master" | null;
};

const JOURNAL_TABLE = "journal_bookings";

export function isJournalRemoteEnabled(): boolean {
  const kind = getDataProviderKind();
  if (kind === "supabase") return isSupabaseConfigured();
  if (kind === "api") return true;
  return false;
}

export async function listJournalStorageRows(): Promise<JournalStorageRow[]> {
  const kind = getDataProviderKind();
  if (kind === "supabase") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(JOURNAL_TABLE)
      .select("id,box_id,master_id,start_time,end_time,client_title,client_phone,service,car,status,status_actor")
      .order("start_time", { ascending: true })
      .order("id", { ascending: true });
    if (error) throw error;
    return (data ?? []) as JournalStorageRow[];
  }
  const response = await fetch(`${getApiBaseUrl()}/api/journal-bookings`);
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API list journal bookings failed: ${response.status} ${details}`);
  }
  return (await response.json()) as JournalStorageRow[];
}

export async function insertJournalStorageRow(row: JournalStorageRow): Promise<JournalStorageRow> {
  const kind = getDataProviderKind();
  if (kind === "supabase") {
    const supabase = getSupabaseClient();
    const { data, error } = await supabase
      .from(JOURNAL_TABLE)
      .insert(row)
      .select("id,box_id,master_id,start_time,end_time,client_title,client_phone,service,car,status,status_actor")
      .single();
    if (error) throw error;
    return data as JournalStorageRow;
  }
  const response = await fetch(`${getApiBaseUrl()}/api/journal-bookings`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(row),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API create journal booking failed: ${response.status} ${details}`);
  }
  return (await response.json()) as JournalStorageRow;
}

export async function updateJournalStorageRows(
  ids: string[],
  patch: Partial<Pick<JournalStorageRow, "status" | "status_actor" | "client_title" | "car">>,
): Promise<void> {
  if (ids.length === 0) return;
  const kind = getDataProviderKind();
  if (kind === "supabase") {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(JOURNAL_TABLE).update(patch).in("id", ids);
    if (error) throw error;
    return;
  }
  const response = await fetch(`${getApiBaseUrl()}/api/journal-bookings/bulk-update`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids, patch }),
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API update journal bookings failed: ${response.status} ${details}`);
  }
}

export async function deleteJournalStorageRow(id: string): Promise<void> {
  const kind = getDataProviderKind();
  if (kind === "supabase") {
    const supabase = getSupabaseClient();
    const { error } = await supabase.from(JOURNAL_TABLE).delete().eq("id", id);
    if (error) throw error;
    return;
  }
  const response = await fetch(`${getApiBaseUrl()}/api/journal-bookings/${encodeURIComponent(id)}`, {
    method: "DELETE",
  });
  if (!response.ok) {
    const details = await response.text();
    throw new Error(`API delete journal booking failed: ${response.status} ${details}`);
  }
}

