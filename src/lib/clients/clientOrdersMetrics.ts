import { normalizeRuFio } from "@/lib/clients/normalizeRuFio";

export type WorkOrderMetricsRow = {
  client: string;
  amount: string;
};

export function parseWorkOrderAmountRub(amount: string): number {
  const digits = (amount ?? "").replace(/[^\d]/g, "");
  const parsed = Number(digits);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatRubAmount(value: number): string {
  return `${value.toLocaleString("ru-RU")} ₽`;
}

/** Как в карточке клиента: заказ-наряды и сумма по ФИО из списка work orders. */
export function computeClientOrdersMetrics(
  clientFullName: string,
  workOrders: readonly WorkOrderMetricsRow[],
): { totalOrders: number; totalAmount: number; averageCheck: number } {
  const normalizedClient = normalizeRuFio(clientFullName);
  if (!normalizedClient) {
    return { totalOrders: 0, totalAmount: 0, averageCheck: 0 };
  }

  const relatedOrders = workOrders.filter((row) => {
    const rowClient = normalizeRuFio(row.client);
    return rowClient === normalizedClient || rowClient.includes(normalizedClient);
  });

  const totalOrders = relatedOrders.length;
  const totalAmount = relatedOrders.reduce((sum, row) => sum + parseWorkOrderAmountRub(row.amount), 0);
  const averageCheck = totalOrders > 0 ? Math.round(totalAmount / totalOrders) : 0;
  return { totalOrders, totalAmount, averageCheck };
}
