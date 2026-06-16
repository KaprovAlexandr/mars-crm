import { AccessRestrictedPage } from "@/components/pages/AccessRestrictedPage";

export function BlockedAccessPage() {
  return (
    <AccessRestrictedPage
      titleLines={["Вы", "заблокированы"]}
      description="Доступ к разделам CRM для вашего аккаунта ограничен администратором."
    />
  );
}
