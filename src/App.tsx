import { Navigate, Outlet, Route, Routes, useLocation, useParams } from "react-router-dom";
import { InAppArchiveToastHost } from "@/components/layout/InAppArchiveToastHost";
import { ClientDetailsPage2 } from "@/components/pages/ClientDetailsPage2";
import { AuthLandingPage } from "@/components/pages/AuthLandingPage";
import { PrivacyPolicyPage } from "@/components/pages/PrivacyPolicyPage";
import { BookingJournalPage } from "@/components/pages/BookingJournalPage";
import { AwaitingAccessPage } from "@/components/pages/AwaitingAccessPage";
import { BlockedAccessPage } from "@/components/pages/BlockedAccessPage";
import { ClientsPage } from "@/components/pages/ClientsPage";
import { DashboardPage } from "@/components/pages/DashboardPage";
import { DashboardOwnerPage } from "@/components/pages/DashboardOwnerPage";
import { DocumentsPage } from "@/components/pages/DocumentsPage";
import { ProfilePage } from "@/components/pages/ProfilePage";
import { RequestDetailsPage } from "@/components/pages/RequestDetailsPage";
import { RequestsListPage } from "@/components/pages/RequestsListPage";
import { SettingsPage } from "@/components/pages/SettingsPage";
import { PromoLandingPage } from "@/components/pages/PromoLandingPage";
import { TestRequestFormPage } from "@/components/pages/TestRequestFormPage";
import { WorkOrdersPage } from "@/components/pages/WorkOrdersPage";
import { WorkOrdersDetailsPage } from "@/components/pages/WorkOrdersDetailsPage";
import { useEmployeeRole } from "@/lib/auth/AuthRoleContext";
import { canAccessRoute, redirectPathWhenDenied } from "@/lib/auth/employeeRole";

function ClientDetailsKeyedRoute() {
  const { id } = useParams();
  return <ClientDetailsPage2 key={String(id ?? "")} />;
}

function AppProtectedLayout() {
  const { pathname } = useLocation();
  const { access, authReady, role, firebaseUser, blocked } = useEmployeeRole();

  if (!authReady) {
    return (
      <div className="flex min-h-dvh items-center justify-center bg-black text-[15px] font-medium tracking-[-0.04em] text-white">
        Загрузка…
      </div>
    );
  }

  if (!firebaseUser) {
    return <Navigate to="/" replace />;
  }

  if (!canAccessRoute(pathname, access)) {
    return <Navigate to={redirectPathWhenDenied(role, blocked)} replace />;
  }

  return <Outlet />;
}

export default function App() {
  return (
    <>
      <Routes>
        <Route path="/auth" element={<AuthLandingPage />} />
        <Route path="/register" element={<AuthLandingPage />} />
        <Route path="/privacy" element={<PrivacyPolicyPage />} />
        <Route path="/" element={<PromoLandingPage />} />
        <Route path="/promo" element={<Navigate to="/" replace />} />
        <Route path="/test-request-form" element={<TestRequestFormPage />} />

        <Route element={<AppProtectedLayout />}>
          <Route path="awaiting-access" element={<AwaitingAccessPage />} />
          <Route path="blocked-access" element={<BlockedAccessPage />} />
          <Route path="requests" element={<RequestsListPage />} />
          <Route path="dashboard" element={<DashboardPage />} />
          <Route path="dashboard-owner" element={<DashboardOwnerPage />} />
          <Route path="documents" element={<DocumentsPage />} />
          <Route path="profile" element={<ProfilePage />} />
          <Route path="settings" element={<SettingsPage />} />
          <Route path="clients" element={<ClientsPage />} />
          <Route path="clients/:id" element={<ClientDetailsKeyedRoute />} />
          <Route path="journal" element={<BookingJournalPage />} />
          <Route path="work-orders/:id" element={<WorkOrdersDetailsPage />} />
          <Route path="work-orders" element={<WorkOrdersPage />} />
          <Route path="requests/:id" element={<RequestDetailsPage />} />
        </Route>

        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
      <InAppArchiveToastHost />
    </>
  );
}
