import { useState } from "react";
import { Search, Users, Shield, Truck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListUsers, useUpdateUser, getListUsersQueryKey } from "@workspace/api-client-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const ROLES = ["USER", "ADMIN", "DELIVERY_AGENT"] as const;

const roleConfig: Record<string, { label: string; icon: typeof User; color: string }> = {
  USER: { label: "Customer", icon: User, color: "bg-green-100 text-green-700 dark:bg-green-900/20 dark:text-green-400" },
  ADMIN: { label: "Admin", icon: Shield, color: "bg-purple-100 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400" },
  DELIVERY_AGENT: { label: "Delivery Agent", icon: Truck, color: "bg-blue-100 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400" },
};

export function AdminUsers() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const params = { search: search || undefined, page, limit: 20 };
  const { data, isLoading } = useListUsers(params, {
    query: { queryKey: getListUsersQueryKey(params) }
  });
  const updateRole = useUpdateUser;

  const handleRoleChange = (userId: string, newRole: string) => {
    const mutation = updateRole(userId);
    mutation.mutate({ data: { role: newRole } }, {
      onSuccess: () => {
        toast.success("User role updated");
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey(params) });
      },
      onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed"),
    });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Users</h1>
        <div className="text-sm text-muted-foreground">{data?.total ?? 0} total users</div>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search users by name or email..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {data?.users.map(user => {
            const { label, icon: RoleIcon, color } = roleConfig[user.role] ?? roleConfig.USER;
            return (
              <div key={user.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary shrink-0">
                  {user.photoUrl ? (
                    <img src={user.photoUrl} alt={user.name ?? ""} className="w-9 h-9 rounded-full object-cover" />
                  ) : (
                    (user.name ?? user.email ?? "U")[0]?.toUpperCase()
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium line-clamp-1">{user.name ?? <span className="text-muted-foreground">No name</span>}</p>
                  <p className="text-xs text-muted-foreground line-clamp-1">{user.email}</p>
                  <p className="text-xs text-muted-foreground">Joined: {formatDate(user.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={`text-xs ${color}`}>{label}</Badge>
                  <Select value={user.role} onValueChange={v => handleRoleChange(user.id, v)}>
                    <SelectTrigger className="w-36 text-xs h-7">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ROLES.map(r => (
                        <SelectItem key={r} value={r} className="text-xs">{roleConfig[r].label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}

          {!data?.users.length && (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No users found</p>
            </div>
          )}

          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="flex items-center text-sm text-muted-foreground px-2">{page} / {data.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
