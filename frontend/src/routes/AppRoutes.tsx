import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import LoginPage from "../pages/Auth/LoginPage/LoginPage";
import SignUpPage from "../pages/Auth/SignUpPage/SignUpPage";
import { useAuth } from "../context/AuthContext";
import { HomePage } from "../pages/HomePage/HomePage";
import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { AboutPage } from "../pages/AboutPage/AboutPage";
import { AccountPage } from "../pages/AccountPage/AccountPage";
import { IncidentCreatePage } from "../pages/Incidents/IncidentCreatePage";
import { IncidentDetailsPage } from "../pages/Incidents/IncidentDetailsPage";
import { TeamsPage } from "../pages/Teams/TeamsPage";

function PrivateRoute({ children }: { children: ReactNode }) {
  const { accessToken } = useAuth();
  const location = useLocation();

  if (!accessToken) {
    const next = encodeURIComponent(location.pathname + location.search);
    return <Navigate to={`/login?next=${next}`} replace />;
  }
  return <>{children}</>;
}

export default function AppRoutes() {
  return (
    <Routes>
      {/* públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      {/* privadas */}
      <Route
        element={
          <PrivateRoute>
            <AppLayout />
          </PrivateRoute>
        }
      >
        <Route path="/" element={<HomePage />} />
        <Route path="/about" element={<AboutPage />} />
        <Route path="/account" element={<AccountPage />} />
        <Route path="/teams" element={<TeamsPage />} />
        <Route path="/incidents/new" element={<IncidentCreatePage />} />
        <Route path="/incidents/:id" element={<IncidentDetailsPage />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
