import { createContext } from "react";

import type { AuthSessionResponse, AuthUser } from "../api";

export type AuthStatus = "loading" | "authenticated" | "anonymous";

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthUser | null;
  setAuthenticatedSession: (session: AuthSessionResponse) => void;
  moduleKeys: string[];
  manageableModuleKeys: string[];
  refreshModuleAccess: () => Promise<void>;
  clearSession: () => void;
  logout: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | undefined>(undefined);
