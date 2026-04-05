import { useState } from "react";
import { Package, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useListOrders, useUpdateOrder, getListOrdersQueryKey } from "@workspace/api-client-react";
import { formatPrice, formatDateTime, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const ORDER_STATUSES = [
  "ALL", "PENDING", "CONFIRMED", "PROCESSING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"
] as const;

export function AdminOrders() {
  const [, navigate] = useLocation();
  const [status, setStatus] = useState<string>("ALL");
  const [page, setPage] = useState(1);
  const queryClient = useQueryClient();

  const params = { status: status === "ALL" ? undefined : status, page, limit: 15 };
  const { data, isLoading } = useListOrders(params, {
    query: { queryKey: getListOrdersQueryKey(params) }
  });

  const updateStatus = useUpdateOrder;

  const handleStatusChange = (orderId: string, newStatus: string) => {
    const mutation = updateStatus(orderId);
    mutation.mutate(
      { data: { status: newStatus } },
      {
        onSuccess: () => {
          toast.success("Order status updated");
          queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey(params) });
        },
        onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed to update"),
      }
    );
  };

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold">Orders</h1>
        <Select value={status} onValueChange={v => { setStatus(v); setPage(1); }}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {ORDER_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{s === "ALL" ? "All Orders" : getOrderStatusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {data?.orders.map(order => (
              <div key={order.id} className="bg-card border rounded-xl p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-0 cursor-pointer" onClick={() => navigate(`/admin/orders/${order.id}`)}>
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium">#{order.id}</p>
                    <Badge className={`text-xs ${getOrderStatusColor(order.status)}`}>
                      {getOrderStatusLabel(order.status)}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-1">
                    {formatDateTime(order.createdAt)} · {(order.items as unknown[]).length} items · {formatPrice(order.total)}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(order.user as { name?: string; email?: string })?.name ?? (order.user as { email?: string })?.email}
                  </p>
                </div>
                <Select
                  value={order.status}
                  onValueChange={v => handleStatusChange(order.id, v)}
                >
                  <SelectTrigger className="w-40 text-xs h-8">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {ORDER_STATUSES.filter(s => s !== "ALL").map(s => (
                      <SelectItem key={s} value={s} className="text-xs">{getOrderStatusLabel(s)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            ))}
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="flex items-center text-sm text-muted-foreground px-2">{page} / {data.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
