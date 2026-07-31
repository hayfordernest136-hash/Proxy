import { useEffect, useState } from "react";
import { apiFetch, setOnUnauthorized } from "@/lib/api";

function clearStoredAuthToken() {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem("auth-token");
  }
}
import { useNavigate } from "@tanstack/react-router";

export function useSession() {
  const [user, setUser] = useState<any | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refreshSession = async () => {
    try {
      const body = await apiFetch<{ user: any | null }>('/api/auth/me');
      setUser(body?.user ?? null);
      setError(null);
      return body?.user ?? null;
    } catch (e: any) {
      setUser(null);
      if (e?.statusCode === 0) {
        setError('Unable to connect to the server. Please try again later.');
      }
      return null;
    }
  };

  useEffect(() => {
    setOnUnauthorized(() => {
      clearStoredAuthToken();
      setUser(null);
      setLoading(false);
    });

    (async () => {
      const result = await refreshSession();
      if (result === null && !error) {
        setUser(null);
      }
      setLoading(false);
    })();
  }, []);

  return { session: null, user, loading, error, refreshSession };
}

/**
 * Hook for components that need to redirect on session expiry.
 * Use this in layout components to handle auth redirects.
 */
export function useAuthRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    setOnUnauthorized(() => {
      navigate({ to: "/auth", search: { mode: "login" }, replace: true });
    });
  }, [navigate]);
}
