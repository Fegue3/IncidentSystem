import React, { createContext, useContext, useEffect, useState } from "react";
import { AuthAPI, getAuth, setAuth, clearAuth } from "../services/api";

type AuthState = {
  user: { id: string; email: string; name?: string } | null;
  accessToken: string | null;
  refreshToken: string | null;
};

type AuthContextType = AuthState & {
  login: (email: string, password: string) => Promise<void>;
  register: (name: string, email: string, password: string) => Promise<void>;
  logout: () => void;
};

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [state, setState] = useState<AuthState>(() => getAuth());

  useEffect(() => {
    setAuth(state);
  }, [state]);

  const login = async (email: string, password: string) => {
    const data = await AuthAPI.login(email, password);
    setState({
      user: data.user ?? null,
      accessToken: data.accessToken ?? null,
      refreshToken: data.refreshToken ?? null,
    });
  };

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

  const logout = () => {
    clearAuth();
    setState({ user: null, accessToken: null, refreshToken: null });
  };

  const value: AuthContextType = {
    ...state,
    login,
    register,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
};
