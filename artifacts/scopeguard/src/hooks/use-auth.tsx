import { createContext, useContext, ReactNode, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { getGetMeQueryOptions, User } from "@workspace/api-client-react";
import { useLocation } from "wouter";

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  isLoading: true,
  isAuthenticated: false,
});

const PUBLIC_PATHS = ["/login", "/register"];

export function AuthProvider({ children }: { children: ReactNode }) {
  const [, setLocation] = useLocation();
  const { data: user, isLoading, isError } = useQuery({
    ...getGetMeQueryOptions(),
    retry: false,
  });

  useEffect(() => {
    if (!isLoading && isError) {
      const path = window.location.pathname;
      if (!path.startsWith("/approve/") && !PUBLIC_PATHS.includes(path)) {
        setLocation("/login");
      }
    }
  }, [isLoading, isError, setLocation]);

  return (
    <AuthContext.Provider value={{ user: user ?? null, isLoading, isAuthenticated: !!user }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
