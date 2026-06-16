import { workOrderRows } from "@/components/pages/WorkOrdersPage";
import type { WorkOrderMetricsRow } from "@/lib/clients/clientOrdersMetrics";
import {
  isWorkOrdersRemoteEnabled,
  listWorkOrdersStorageRows,
  type WorkOrderStorageRow,
} from "@/lib/data/workOrdersDataSource";

export const WORK_ORDERS_ROWS_PERSIST_KEY = "workOrdersRowsPersistedV1";

function toMetricsRow(row: { client: string; amount: string }): WorkOrderMetricsRow {
  return { client: row.client, amount: row.amount };
}

function mapStorageRow(row: WorkOrderStorageRow): WorkOrderMetricsRow {
  return { client: row.client, amount: row.amount };
}

export function getWorkOrdersForMetrics(): WorkOrderMetricsRow[] {
  if (typeof window === "undefined") {
    return workOrderRows.map(toMetricsRow);
  }
  try {
    const raw = window.localStorage.getItem(WORK_ORDERS_ROWS_PERSIST_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Array<{ client: string; amount: string }>;
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.map(toMetricsRow);
      }
    }
  } catch {
    // fallback to defaults below
  }
  return workOrderRows.map(toMetricsRow);
}

export async function fetchWorkOrdersForMetrics(): Promise<WorkOrderMetricsRow[]> {
  if (!isWorkOrdersRemoteEnabled()) {
    return getWorkOrdersForMetrics();
  }
  const rows = await listWorkOrdersStorageRows();
  return rows.map(mapStorageRow);
}
