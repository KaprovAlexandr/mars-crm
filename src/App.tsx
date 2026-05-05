import { Navigate, Route, Routes } from "react-router-dom";
import { InAppArchiveToastHost } from "@/components/layout/InAppArchiveToastHost";
import { ClientDetailsPage2 } from "@/components/pages/ClientDetailsPage2";
import { BookingJournalPage } from "@/components/pages/BookingJournalPage";
import { ClientsPage } from "@/components/pages/ClientsPage";
import { DashboardPage } from "@/components/pages/DashboardPage";
import { DashboardOwnerPage } from "@/components/pages/DashboardOwnerPage";
import { DocumentsPage } from "@/components/pages/DocumentsPage";
import { ProfilePage } from "@/components/pages/ProfilePage";
import { RequestDetailsPage } from "@/components/pages/RequestDetailsPage";
import { RequestsListPage } from "@/components/pages/RequestsListPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { WorkOrdersPage } from "@/components/pages/WorkOrdersPage";

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/" element={<RequestsListPage />} />
        <Route path="/dashboard" element={<DashboardPage />} />
        <Route path="/dashboard-owner" element={<DashboardOwnerPage />} />
        <Route path="/documents" element={<DocumentsPage />} />
        <Route path="/profile" element={<ProfilePage />} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/clients" element={<ClientsPage />} />
        <Route path="/journal" element={<BookingJournalPage />} />
        <Route path="/work-orders" element={<WorkOrdersPage />} />
        <Route path="/clients/:id" element={<ClientDetailsPage2 />} />
        <Route path="/requests/:id" element={<RequestDetailsPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InAppArchiveToastHost />
    </>
  );
}
