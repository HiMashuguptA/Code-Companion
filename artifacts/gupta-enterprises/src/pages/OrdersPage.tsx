import { useState } from "react";
import { useLocation } from "wouter";
import { Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useListOrders, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatPrice, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";

export function OrdersPage() {
  const [, navigate] = useLocation();
  const { currentUser, isLoading: authLoading } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>("ALL");

  const { data, isLoading } = useListOrders(undefined, {
    query: { 
      queryKey: getListOrdersQueryKey(), 
      enabled: !!currentUser, 
      retry: false,
      refetchInterval: 2000,
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    }
  });

  // Show skeleton while auth is loading
  if (authLoading || (isLoading && !data)) return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Skeleton className="h-8 w-40 mb-6" />
      <div className="flex gap-2 flex-wrap mb-6">{[1,2,3,4,5].map(i => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}</div>
      <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
    </div>
  );

  // Show sign in page only after auth loading completes and no user
  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-semibold mb-2">Sign in to view your orders</h2>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  const orders = data?.orders ?? [];
  const statuses = ["ALL", "PENDING", "CONFIRMED", "PROCESSING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
  const filtered = statusFilter === "ALL" ? orders : orders.filter((o) => o.status === statusFilter);

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>

      <div className="flex gap-2 flex-wrap mb-6">
        {statuses.map(s => (
          <button key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-all border ${statusFilter === s ? "bg-primary text-primary-foreground border-primary" : "border-border hover:border-primary/50"}`}>
            {s === "ALL" ? "All" : getOrderStatusLabel(s)}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : !filtered.length ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h2 className="text-xl font-semibold mb-2">{orders.length === 0 ? "No orders yet" : "No orders match the filter"}</h2>
          {orders.length === 0 && (
            <Button onClick={() => navigate("/products")} className="mt-4">Start Shopping</Button>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((order) => (
            <button key={order.id} onClick={() => navigate(`/orders/${order.id}`)}
              className="w-full bg-card border rounded-xl p-4 hover:shadow-md transition-all text-left group">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <p className="font-medium text-sm">Order #{order.id.slice(-8).toUpperCase()}</p>
                  <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                </div>
                <div className="flex items-center gap-2">
                  <Badge className={getOrderStatusColor(order.status)}>{getOrderStatusLabel(order.status)}</Badge>
                  <ChevronRight className="w-4 h-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
                </div>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="flex -space-x-2">
                  {order.items?.slice(0, 3).map((item: { id: string; product?: { images?: string[]; name?: string } }) => (
                    <img key={item.id}
                      src={item.product?.images?.[0] ?? "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=60"}
                      alt={item.product?.name ?? "Product"}
                      className="w-9 h-9 rounded-lg object-cover border-2 border-background" />
                  ))}
                  {(order.items?.length ?? 0) > 3 && (
                    <div className="w-9 h-9 rounded-lg bg-muted border-2 border-background flex items-center justify-center text-xs font-medium">
                      +{(order.items?.length ?? 0) - 3}
                    </div>
                  )}
                </div>
                <span className="font-semibold">{formatPrice(order.total)}</span>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
