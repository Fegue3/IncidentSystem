import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import LoginPage from "../pages/Auth/LoginPage/LoginPage";
import SignUpPage from "../pages/Auth/SignUpPage/SignUpPage";
import { useAuth } from "../context/AuthContext";
import { HomePage } from "../pages/HomePage/HomePage";
import { AppLayout } from "../layouts/AppLayout/AppLayout";
import { AboutPage } from "../pages/AboutPage/AboutPage";
import { AccountPage } from "../pages/AccountPage/AccountPage";

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
      {/* Rotas públicas */}
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />

      {/* Rotas privadas com layout comum */}
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
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
