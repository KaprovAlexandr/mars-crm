import { AccessRestrictedPage } from "@/components/pages/AccessRestrictedPage";

export function AwaitingAccessPage() {
  return (
    <AccessRestrictedPage
      titleLines={["Доступ к CRM", "временно недоступен"]}
      description="Доступ к разделам CRM появится после того, как администратор назначит вам роль."
    />
  );
}
