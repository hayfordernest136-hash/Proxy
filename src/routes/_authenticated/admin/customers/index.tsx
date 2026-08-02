import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { apiFetch } from "@/lib/api";
import { formatDate } from "@/lib/format";

type AdminUser = {
  id: number;
  name: string;
  email: string;
  role: string;
  referral_code: string | null;
  referral_reward_used_at: string | null;
  created_at: string;
  successful_referral_count: number;
};

export const Route = createFileRoute("/_authenticated/admin/customers/")({
  component: AdminCustomersPage,
});

function AdminCustomersPage() {
  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: async () => await apiFetch<AdminUser[]>("/api/admin/users"),
  });

  return (
    <div className="space-y-6">
      <div>
        <p className="text-sm font-medium text-primary">Customers</p>
        <h1 className="text-3xl font-bold tracking-tight">Customer directory</h1>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Accounts</p>
            <p className="mt-2 text-2xl font-bold">{users?.length ?? "N/A"}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Active admins</p>
            <p className="mt-2 text-2xl font-bold">
              {users?.filter((u) => u.role === "admin").length ?? "N/A"}
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-5">
            <p className="text-sm text-muted-foreground">Referral rewards</p>
            <p className="mt-2 text-2xl font-bold">
              {users?.filter((u) => u.referral_reward_used_at).length ?? "N/A"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="space-y-2 p-6">
              {Array.from({ length: 5 }).map((_, index) => (
                <Skeleton key={index} className="h-12 rounded-md" />
              ))}
            </div>
          ) : users && users.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Email</TableHead>
                    <TableHead>Role</TableHead>
                    <TableHead>Referral code</TableHead>
                    <TableHead>Joined</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((user) => (
                    <TableRow key={user.id}>
                      <TableCell>{user.name}</TableCell>
                      <TableCell>{user.email}</TableCell>
                      <TableCell className="capitalize">{user.role}</TableCell>
                      <TableCell>{user.referral_code ?? "—"}</TableCell>
                      <TableCell>{formatDate(user.created_at)}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {user.referral_reward_used_at ? "Reward used" : "Active"}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <div className="p-10 text-center text-sm text-muted-foreground">
              No customers available.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
