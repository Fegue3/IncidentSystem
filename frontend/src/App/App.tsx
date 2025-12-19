/**
 * @file App.tsx
 * @module App/App
 *
 * @summary
 *  - Router “mínimo” (fallback 404) — útil em setups simples.
 *
 * @description
 *  - Define rotas públicas:
 *    - `/` -> HomePage
 *    - `/404` -> NotFoundPage
 *    - `*` -> redirect para `/404`
 *
 * @notes
 *  - No teu projeto, já existe `AppRoutes.tsx` (mais completo com PrivateRoute e layout).
 *    Este ficheiro pode ser:
 *    1) removido, ou
 *    2) mantido apenas como fallback em protótipos, ou
 *    3) adaptado para renderizar `<AppRoutes />`.
 *
 * @dependencies
 *  - `react-router-dom`: Routes/Route/Navigate
 */

import { Navigate, Route, Routes } from "react-router-dom";
import { HomePage } from "../pages/HomePage/HomePage";
import { NotFoundPage } from "../pages/NotFoundPage/NotFoundPage";
import "./App.css";

/**
 * Componente raiz de rotas (versão simples).
 */
export default function App() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />
      <Route path="/404" element={<NotFoundPage />} />
      <Route path="*" element={<Navigate to="/404" replace />} />
    </Routes>
  );
}
