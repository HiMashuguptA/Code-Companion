import { useState } from "react";
import { Package, ChevronRight, Truck, MapPin } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  useListOrders, useUpdateOrder, useListUsers, useAssignDeliveryAgent, useGetOrderTracking,
  getListOrdersQueryKey, getListUsersQueryKey
} from "@workspace/api-client-react";
import type { Order } from "@workspace/api-client-react";
import { formatPrice, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";
import { useAuth } from "@/contexts/FirebaseContext";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const ORDER_STATUSES = ["PENDING","CONFIRMED","PROCESSING","PACKED","OUT_FOR_DELIVERY","DELIVERED","CANCELLED","PICKUP_READY"] as const;

export function AdminOrders() {
  const [, navigate] = useLocation();
  const { currentUser, isLoading: authLoading } = useAuth();
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [trackingOrder, setTrackingOrder] = useState<Order | null>(null);

  const { data, isLoading } = useListOrders({ status: statusFilter !== "ALL" ? statusFilter : undefined }, {
    query: { 
      queryKey: getListOrdersQueryKey({ status: statusFilter !== "ALL" ? statusFilter : undefined }), 
      retry: false,
      refetchInterval: 2000, // Auto-refetch every 2 seconds for real-time updates
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    }
  });
  const { data: usersResponse } = useListUsers({}, {
    query: { 
      queryKey: getListUsersQueryKey(), 
      retry: false,
      refetchInterval: 5000 // Less frequent for user list
    }
  });
  const { data: tracking } = useGetOrderTracking(trackingOrder?.id ?? "", { 
    query: { 
      queryKey: ["order-tracking", trackingOrder?.id],
      enabled: !!trackingOrder && trackingOrder.status === "OUT_FOR_DELIVERY",
      retry: false,
      refetchInterval: 3000 // Real-time tracking updates
    } 
  });
  const updateOrder = useUpdateOrder();
  const assignAgent = useAssignDeliveryAgent();

  const deliveryAgents = usersResponse && Array.isArray(usersResponse) 
    ? usersResponse.filter((u: any) => u.role === "DELIVERY_AGENT")
    : (usersResponse?.users ?? []).filter((u: any) => u.role === "DELIVERY_AGENT");

  const handleStatusChange = (orderId: string, newStatus: string) => {
    updateOrder.mutate({ orderId, data: { status: newStatus as Order["status"] } }, {
      onSuccess: () => {
        toast.success("Order status updated");
        qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
      onError: () => toast.error("Failed to update order"),
    });
  };

  const handleAssignAgent = (orderId: string, agentId: string) => {
    assignAgent.mutate({ orderId, data: { agentId } }, {
      onSuccess: () => {
        toast.success("Delivery agent assigned");
        setSelectedOrder(null);
        qc.invalidateQueries({ queryKey: getListOrdersQueryKey() });
      },
      onError: () => toast.error("Failed to assign delivery agent"),
    });
  };

  const orders = data?.orders ?? [];

  // Show skeleton while auth is loading
  if (authLoading || isLoading) return (
    <div className="space-y-4">
      <Skeleton className="h-8 w-32 mb-6" />
      <div className="space-y-3">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
    </div>
  );

  // Show sign in message if not authenticated
  if (!currentUser) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">You need to sign in as an admin to access this page</p>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

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
                  {order.deliveryType === "DELIVERY" && (order as any).deliveryAgentId && (
                    <button 
                      onClick={() => setTrackingOrder(order)}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-1 mt-1"
                    >
                      <MapPin className="w-3 h-3" /> Track Agent Location
                    </button>
                  )}
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
                  {order.deliveryType === "DELIVERY" && (
                    <Button 
                      variant="outline" 
                      size="sm" 
                      className="gap-1 text-xs"
                      onClick={() => setSelectedOrder(order)}
                    >
                      <Truck className="w-3 h-3" />
                      {(order as any).deliveryAgentId ? "Change Agent" : "Assign Agent"}
                    </Button>
                  )}
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => navigate(`/orders/${order.id}`)}>
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={!!selectedOrder} onOpenChange={(open) => !open && setSelectedOrder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Assign Delivery Agent</DialogTitle>
          </DialogHeader>
          {selectedOrder && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Order #{selectedOrder.id.slice(-8).toUpperCase()}</p>
                <p className="font-medium text-sm mt-1">{formatPrice(selectedOrder.total)}</p>
              </div>
              <div>
                <label className="text-xs font-medium text-muted-foreground block mb-2">Select Delivery Agent</label>
                {deliveryAgents.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No delivery agents available</p>
                ) : (
                  <div className="space-y-2">
                    {deliveryAgents.map((agent: any) => (
                      <Button
                        key={agent.id}
                        variant="outline"
                        className="w-full justify-start text-left"
                        onClick={() => handleAssignAgent(selectedOrder.id, agent.id)}
                      >
                        <div className="flex flex-col gap-1 items-start">
                          <span className="font-medium text-sm">{agent.name}</span>
                          <span className="text-xs text-muted-foreground">{agent.email}</span>
                        </div>
                      </Button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!trackingOrder} onOpenChange={(open) => !open && setTrackingOrder(null)}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Delivery Agent Location</DialogTitle>
          </DialogHeader>
          {trackingOrder && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-muted rounded-lg">
                <p className="text-xs text-muted-foreground">Order #{trackingOrder.id.slice(-8).toUpperCase()}</p>
                <p className="font-medium text-sm mt-1">Status: {getOrderStatusLabel(trackingOrder.status)}</p>
              </div>

              {tracking && tracking.currentLat && tracking.currentLng ? (
                <div className="space-y-3 text-sm">
                  <div className="p-2 bg-blue-50 rounded border border-blue-200">
                    <p className="text-xs text-muted-foreground mb-1">Current Location</p>
                    <p className="font-mono text-xs">
                      {tracking.currentLat.toFixed(6)}, {tracking.currentLng.toFixed(6)}
                    </p>
                  </div>

                  {tracking.destinationLat && tracking.destinationLng && (
                    <div className="p-2 bg-green-50 rounded border border-green-200">
                      <p className="text-xs text-muted-foreground mb-1">Destination</p>
                      <p className="font-mono text-xs">
                        {tracking.destinationLat.toFixed(6)}, {tracking.destinationLng.toFixed(6)}
                      </p>
                    </div>
                  )}

                  <a
                    href={`https://maps.google.com/?q=${tracking.currentLat},${tracking.currentLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="block w-full p-2 text-center text-xs font-medium text-primary hover:underline border rounded"
                  >
                    View on Google Maps
                  </a>
                </div>
              ) : (
                <div className="text-center py-4">
                  <p className="text-xs text-muted-foreground">Agent location not available yet</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
