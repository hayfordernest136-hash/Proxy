import { useEffect, useState } from "react";
import { apiFetch, setOnUnauthorized } from "@/lib/api";
import { useNavigate } from "@tanstack/react-router";

export function useSession() {
  const [user, setUser] = useState<any | null | undefined>(undefined);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Register the onUnauthorized handler to clear session
    setOnUnauthorized(() => {
      setUser(null);
      setLoading(false);
    });

    (async () => {
      try {
        const body = await apiFetch<{ user: any | null }>("/api/auth/me");
        setUser(body?.user ?? null);
      } catch (e: any) {
        setUser(null);
        if (e?.statusCode === 0) {
          setError("Unable to connect to the server. Please try again later.");
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return { session: null, user, loading, error };
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
