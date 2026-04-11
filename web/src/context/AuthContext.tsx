import { createContext, useContext, useEffect, useState, useCallback, type ReactNode } from "react";
import { checkSession, logout as apiLogout, getClientId, exchangeToken } from "../api/client";

const GOOGLE_AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";

interface User {
  id: string;
  email: string;
  name: string | null;
  pictureUrl: string | null;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  handleCallback: (code: string, state: string) => Promise<void>;
}

const AuthContext = createContext<AuthState>({
  user: null,
  isAuthenticated: false,
  loading: true,
  login: async () => {},
  logout: async () => {},
  handleCallback: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [loading, setLoading] = useState(true);

  // Check session on mount
  useEffect(() => {
    checkSession()
      .then((res) => {
        if (res.authenticated) {
          setUser(res.user);
          setIsAuthenticated(true);
        }
      })
      .catch(() => {
        setUser(null);
        setIsAuthenticated(false);
      })
      .finally(() => setLoading(false));
  }, []);

  // Initiate Google OAuth — frontend builds the URL
  const login = useCallback(async () => {
    const { client_id, state } = await getClientId();
    const redirectUri = window.location.origin + "/auth/callback";
    const params = new URLSearchParams({
      client_id,
      redirect_uri: redirectUri,
      response_type: "code",
      scope: "openid email profile",
      access_type: "online",
      prompt: "select_account",
      state,
    });
    window.location.href = `${GOOGLE_AUTH_URL}?${params.toString()}`;
  }, []);

  // Handle callback — exchange code for session
  const handleCallback = useCallback(async (code: string, state: string) => {
    const redirectUri = window.location.origin + "/auth/callback";
    const res = await exchangeToken(code, redirectUri, state);
    setUser(res.user);
    setIsAuthenticated(true);
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiLogout();
    } catch {}
    setUser(null);
    setIsAuthenticated(false);
  }, []);

  return (
    <AuthContext.Provider value={{ user, isAuthenticated, loading, login, logout, handleCallback }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
