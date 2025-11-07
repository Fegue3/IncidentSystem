import type { ReactNode } from "react";
import { Navigate, Route, Routes, useLocation } from "react-router-dom";
import LoginPage from "../pages/Auth/LoginPage/LoginPage";
import SignUpPage from "../pages/Auth/SignUpPage/SignUpPage";
import { useAuth } from "../context/AuthContext";
import { HomePage } from "../pages/HomePage/HomePage";

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
      <Route path="/login" element={<LoginPage />} />
      <Route path="/signup" element={<SignUpPage />} />
      <Route
        path="/"
        element={
          <PrivateRoute>
            <HomePage />
          </PrivateRoute>
        }
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}