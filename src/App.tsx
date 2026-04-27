import { Navigate, Route, Routes } from "react-router-dom";
import { RequestDetailsPage } from "@/components/pages/RequestDetailsPage";
import { RequestsListPage } from "@/components/pages/RequestsListPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<RequestsListPage />} />
      <Route path="/requests/:id" element={<RequestDetailsPage />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
