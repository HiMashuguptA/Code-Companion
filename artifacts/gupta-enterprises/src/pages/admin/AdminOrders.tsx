import { useState } from "react";
import { Package, ChevronRight } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  useListOrders, useUpdateOrder,
  getListOrdersQueryKey
} from "@workspace/api-client-react";
import type { Order } from "@workspace/api-client-react";
import { formatPrice, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const ORDER_STATUSES = ["PENDING","CONFIRMED","PROCESSING","PACKED","OUT_FOR_DELIVERY","DELIVERED","CANCELLED","PICKUP_READY"] as const;

export function AdminOrders() {
  const [, navigate] = useLocation();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data, isLoading } = useListOrders({ status: statusFilter !== "ALL" ? statusFilter : undefined }, {
    query: { queryKey: getListOrdersQueryKey({ status: statusFilter !== "ALL" ? statusFilter : undefined }) }
  });
  const updateOrder = useUpdateOrder();

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateOrder.mutate({ orderId, data: { status: newStatus as Order["status"] } }, {
      onSuccess: () => {
        toast.success("Order status updated");
        qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
      onError: () => toast.error("Failed to update order"),
    });
  };

  const orders = data?.orders ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Orders</h1>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-44">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Statuses</SelectItem>
            {ORDER_STATUSES.map(s => (
              <SelectItem key={s} value={s}>{getOrderStatusLabel(s)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
      ) : !orders.length ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">No orders found</p>
        </div>
      ) : (
        <div className="space-y-3">
          {orders.map((order: Order) => (
            <div key={order.id} className="bg-card border rounded-xl p-4">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="font-medium text-sm">#{order.id.slice(-8).toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(order.items?.length ?? 0)} item{(order.items?.length ?? 0) !== 1 ? "s" : ""} · {formatPrice(order.total)}
                  </p>
                </div>
                <div className="flex items-center gap-2 flex-wrap justify-end">
                  <Badge className={getOrderStatusColor(order.status)}>{getOrderStatusLabel(order.status)}</Badge>
                  <Select value={order.status} onValueChange={v => handleStatusChange(order.id, v)}>
                    <SelectTrigger className="h-7 text-xs w-40">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {ORDER_STATUSES.map(s => (
                        <SelectItem key={s} value={s} className="text-xs">{getOrderStatusLabel(s)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/orders/${order.id}`)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
