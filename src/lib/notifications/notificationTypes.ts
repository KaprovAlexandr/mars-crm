export type NotificationSection = "today" | "yesterday";

export type NotificationDeepLink =
  | { kind: "request"; requestId: string }
  | { kind: "booking"; bookingId: string }
  | { kind: "workOrder"; workOrderId: string };

export type NotificationItem = {
  id: string;
  section: NotificationSection;
  title: string;
  description: string;
  time: string;
  unread: boolean;
  showOpenButton?: boolean;
  deepLink?: NotificationDeepLink;
};
