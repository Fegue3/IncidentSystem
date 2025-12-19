/**
 * @file NotFoundPage.tsx
 * @module pages/NotFoundPage/NotFoundPage
 *
 * @summary
 *  - Página simples de “404 / Not Found”.
 *
 * @description
 *  - Renderiza uma mensagem curta para rotas não reconhecidas.
 *  - É usada tipicamente como fallback no router (ou como redirect para `/`).
 *
 * @dependencies
 *  - `./NotFoundPage.css`: estilos da mensagem.
 *
 * @security
 *  - Não aplicável (sem IO, sem auth).
 *
 * @performance
 *  - Render puro, sem estado nem efeitos.
 */

import "./NotFoundPage.css";

/**
 * Página “Não encontrado”.
 */
export function NotFoundPage() {
  return <p className="not-found">Página não encontrada.</p>;
}
