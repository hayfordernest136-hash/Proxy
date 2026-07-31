import { createFileRoute, Outlet, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { Loader2 } from "lucide-react";

import { useSession } from "@/hooks/useSession";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  const { user, loading } = useSession();
  const isAdmin = user?.role === "admin";
  const isLoading = loading;
  const navigate = useNavigate();

  useEffect(() => {
    if (!isLoading && isAdmin === false) navigate({ to: "/dashboard", replace: true });
  }, [isAdmin, isLoading, navigate]);

  if (isLoading || !isAdmin) {
    return (
      <div className="grid min-h-screen place-items-center">
        <Loader2 className="size-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return <Outlet />;
}
