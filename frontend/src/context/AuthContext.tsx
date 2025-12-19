/**
 * @file AuthContext.tsx
 * @module context/AuthContext
 *
 * @summary
 *  - Contexto de autenticação do frontend (estado + ações login/register/logout).
 *
 * @description
 *  - Centraliza o estado de autenticação (`user`, `accessToken`, `refreshToken`) e expõe
 *    operações para iniciar sessão, registar e terminar sessão.
 *  - Persiste o estado em `localStorage` através dos helpers em `services/api.ts`.
 *
 * @dependencies
 *  - `AuthAPI` (services/api.ts): chamadas ao backend para `/auth/login` e `/auth/register`.
 *  - `getAuth/setAuth/clearAuth` (services/api.ts): persistência e limpeza do estado no localStorage.
 *
 * @security
 *  - Tokens são persistidos em `localStorage` (conveniência). Atenção ao risco de XSS.
 *  - Refresh automático (token) é tratado em `services/api.ts` (não aqui).
 *
 * @errors
 *  - `useAuth()` lança `Error` se for usado fora de `<AuthProvider />`.
 *
 * @example
 *  - Envolver a app:
 *    <AuthProvider><BrowserRouter>...</BrowserRouter></AuthProvider>
 *
 *  - Consumir:
 *    const { user, login, logout } = useAuth();
 */

import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthAPI, getAuth, setAuth, clearAuth } from "../services/api";

/**
 * Estado mínimo de autenticação persistido no browser.
 * - `user`: utilizador autenticado (ou null).
 * - `accessToken`: token Bearer para requests autenticadas.
 * - `refreshToken`: token para renovar `accessToken` (se suportado no backend).
 */
type AuthState = {
  user: { id: string; email: string; name?: string } | null;
  accessToken: string | null;
  refreshToken: string | null;
};

/**
 * Contrato do contexto exposto à UI.
 * Inclui o estado (`AuthState`) e as ações (login/register/logout).
 */
type AuthContextType = AuthState & {
  /**
   * Inicia sessão e atualiza estado + persistência.
   *
   * @param email Email do utilizador.
   * @param password Password do utilizador.
   * @throws Error se credenciais inválidas ou erro de rede/backend.
   */
  login: (email: string, password: string) => Promise<void>;

  /**
   * Regista um utilizador.
   * - Se o backend devolver tokens no registo, fica autenticado de imediato.
   * - Caso contrário, faz fallback para `login(email,password)`.
   *
   * @param name Nome do utilizador.
   * @param email Email do utilizador.
   * @param password Password do utilizador.
   * @throws Error se email já existir, validação falhar, ou erro de rede/backend.
   */
  register: (name: string, email: string, password: string) => Promise<void>;

  /**
   * Termina sessão: limpa storage e limpa estado em memória.
   */
  logout: () => void;
};

/**
 * Contexto de autenticação.
 * Nota: inicializa com `null` para obrigar a usar `useAuth()` dentro do Provider.
 */
const AuthContext = createContext<AuthContextType | null>(null);

/**
 * Provider do AuthContext.
 *
 * Responsabilidades:
 * - Inicializar estado a partir do `localStorage` (`getAuth()`).
 * - Persistir o estado sempre que muda (`setAuth()`).
 * - Implementar ações de autenticação (login/register/logout).
 *
 * Side effects:
 * - Escreve no `localStorage` sempre que o estado muda.
 */
export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  // Inicializa do storage para manter sessão entre refreshes.
  const [state, setState] = useState<AuthState>(() => getAuth());

  // Mantém o storage sincronizado com o estado em memória.
  useEffect(() => {
    setAuth(state);
  }, [state]);

  /**
   * Efetua login via backend e atualiza o estado local.
   */
  const login = async (email: string, password: string) => {
    const data = await AuthAPI.login(email, password);

    // Protege contra respostas parciais (fallback para null).
    setState({
      user: data.user ?? null,
      accessToken: data.accessToken ?? null,
      refreshToken: data.refreshToken ?? null,
    });
  };

  /**
   * Registo + autenticação.
   * Alguns backends podem não devolver tokens no register -> fallback para login.
   */
  const register = async (name: string, email: string, password: string) => {
    const data = await AuthAPI.register(name, email, password);
    const gotTokens = data?.accessToken || data?.refreshToken;

    if (gotTokens) {
      setState({
        user: data.user ?? null,
        accessToken: data.accessToken ?? null,
        refreshToken: data.refreshToken ?? null,
      });
    } else {
      await login(email, password);
    }
  };

  /**
   * Logout local: limpa storage e limpa estado.
   * (Se existisse endpoint de logout/revogar tokens, seria chamado aqui.)
   */
  const logout = () => {
    clearAuth();
    setState({ user: null, accessToken: null, refreshToken: null });
  };

  // Valor exposto aos consumidores do contexto.
  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

/**
 * Hook para consumir o AuthContext com garantia de provider.
 *
 * @throws Error se usado fora de `<AuthProvider />`.
 */
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
