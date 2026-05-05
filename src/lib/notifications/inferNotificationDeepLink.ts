import type { NotificationDeepLink, NotificationItem } from "@/lib/notifications/notificationTypes";

/** Определить цель перехода из явного поля или из текста заголовка/описания. */
export function inferNotificationDeepLink(n: Pick<NotificationItem, "title" | "description" | "deepLink">): NotificationDeepLink | null {
  if (n.deepLink) return n.deepLink;
  const blob = `${n.title}\n${n.description}`;

  const requestPatterns = [
    /новая заявка с сайта\s*№\s*([^\s(]+)/i,
    /назначена заявка\s*№\s*([^\s(]+)/i,
    /вас назначили на заявку\s*№\s*([^\s)]+)/i,
    /заявк[аеи]\s*№\s*([^\s)]+)/i,
    /заявке\s*№\s*([^\s)]+)/i,
    /сообщение в заявке\s*№\s*([^\s)]+)/i,
  ];
  for (const re of requestPatterns) {
    const m = re.exec(blob);
    if (m?.[1]) return { kind: "request", requestId: m[1].trim() };
  }

  const bookingPatterns = [/скоро запись\s*№\s*([^\s(]+)/i, /новая запись\s*№\s*([^\s(]+)/i];
  for (const re of bookingPatterns) {
    const m = re.exec(blob);
    if (m?.[1]) return { kind: "booking", bookingId: m[1].trim() };
  }

  const woPay = /заказ-наряд ожидает оплату\s*№\s*([^\s(]+)/i.exec(blob);
  if (woPay?.[1]) return { kind: "workOrder", workOrderId: woPay[1].trim() };
  const wo = /заказ-наряд\s*№\s*([^\s)]+)/i.exec(blob);
  if (wo?.[1]) return { kind: "workOrder", workOrderId: wo[1].trim() };

  return null;
}

export function buildNotificationNavigatePath(link: NotificationDeepLink): string {
  switch (link.kind) {
    case "request":
      return `/?request=${encodeURIComponent(link.requestId)}`;
    case "booking":
      return `/journal?booking=${encodeURIComponent(link.bookingId)}`;
    case "workOrder":
      return `/work-orders?workOrder=${encodeURIComponent(link.workOrderId)}`;
  }
}
