import { useState } from "react";
import { Search, Users, Shield, Truck, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListUsers, useUpdateUser, getListUsersQueryKey } from "@workspace/api-client-react";
import type { User as ApiUser } from "@workspace/api-client-react";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const roleIcons = {
  ADMIN: Shield,
  DELIVERY_AGENT: Truck,
  USER: User,
};

const roleColors: Record<string, string> = {
  ADMIN: "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300",
  DELIVERY_AGENT: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300",
  USER: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
};

export function AdminUsers() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: users, isLoading } = useListUsers({
    query: { queryKey: getListUsersQueryKey() }
  });
  const updateUser = useUpdateUser();

  const handleRoleChange = (userId: string, role: string) => {
    updateUser.mutate({ userId, data: { role: role as ApiUser["role"] } }, {
      onSuccess: () => {
        toast.success("User role updated");
        qc.invalidateQueries({ queryKey: getListUsersQueryKey() });
      },
      onError: () => toast.error("Failed to update user role"),
    });
  };

  const filtered = (users ?? []).filter((u: ApiUser) =>
    !search ||
    u.name?.toLowerCase().includes(search.toLowerCase()) ||
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Users</h1>
        <Badge variant="secondary" className="gap-1.5">
          <Users className="w-3.5 h-3.5" /> {users?.length ?? 0} total
        </Badge>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Search by name or email..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}</div>
      ) : !filtered.length ? (
        <div className="text-center py-16">
          <Users className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">{search ? "No users match your search" : "No users found"}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((u: ApiUser) => {
            const RoleIcon = roleIcons[u.role as keyof typeof roleIcons] ?? User;
            return (
              <div key={u.id} className="bg-card border rounded-xl p-4 flex items-center gap-4">
                <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold shrink-0">
                  {(u.name ?? u.email ?? "U")[0]?.toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{u.name ?? "—"}</p>
                  <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  <p className="text-xs text-muted-foreground">Joined {formatDate(u.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge className={roleColors[u.role] ?? ""}>
                    <RoleIcon className="w-3 h-3 mr-1" />{u.role.replace("_", " ")}
                  </Badge>
                  <Select value={u.role} onValueChange={v => handleRoleChange(u.id, v)}>
                    <SelectTrigger className="h-7 text-xs w-36">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="USER" className="text-xs">User</SelectItem>
                      <SelectItem value="DELIVERY_AGENT" className="text-xs">Delivery Agent</SelectItem>
                      <SelectItem value="ADMIN" className="text-xs">Admin</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
