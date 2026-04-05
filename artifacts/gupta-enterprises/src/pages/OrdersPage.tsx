import { useState } from "react";
import { useLocation } from "wouter";
import { Package, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useListOrders } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatPrice, formatDateTime, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";

export function OrdersPage() {
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const [page, setPage] = useState(1);

  const { data, isLoading } = useListOrders({ page, limit: 10 }, {
    query: { enabled: !!currentUser }
  });

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-semibold mb-2">Sign in to view your orders</h2>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Skeleton className="h-8 w-32 mb-6" />
        <div className="space-y-4">
          {[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      </div>
    );
  }

  const orders = data?.orders ?? [];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>

      {orders.length === 0 ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
          <h3 className="text-lg font-semibold mb-2">No orders yet</h3>
          <p className="text-muted-foreground mb-6">Start shopping and your orders will appear here</p>
          <Button onClick={() => navigate("/products")}>Start Shopping</Button>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {orders.map(order => (
              <div key={order.id}
                className="bg-card border rounded-xl p-4 hover:shadow-sm transition-shadow cursor-pointer"
                onClick={() => navigate(`/orders/${order.id}`)}>
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <p className="text-xs text-muted-foreground">Order #{order.id}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge className={getOrderStatusColor(order.status)}>
                      {getOrderStatusLabel(order.status)}
                    </Badge>
                    <ChevronRight className="w-4 h-4 text-muted-foreground" />
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  {/* Product thumbnails */}
                  <div className="flex -space-x-2">
                    {(order.items as Array<{ product?: { images?: string[], name?: string } }>).slice(0, 3).map((item, i) => (
                      <img
                        key={i}
                        src={item.product?.images?.[0] ?? "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=60"}
                        alt={item.product?.name}
                        className="w-10 h-10 rounded-lg object-cover border-2 border-background"
                        onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=60"; }}
                      />
                    ))}
                    {(order.items as unknown[]).length > 3 && (
                      <div className="w-10 h-10 rounded-lg border-2 border-background bg-muted flex items-center justify-center text-xs font-medium">
                        +{(order.items as unknown[]).length - 3}
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-muted-foreground">
                      {(order.items as unknown[]).length} item{(order.items as unknown[]).length !== 1 ? "s" : ""}
                      {order.deliveryType && ` • ${order.deliveryType === "PICKUP" ? "Store Pickup" : "Home Delivery"}`}
                    </p>
                  </div>
                  <p className="font-bold text-base shrink-0">{formatPrice(order.total)}</p>
                </div>
              </div>
            ))}
          </div>

          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-6">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                Previous
              </Button>
              <span className="flex items-center text-sm text-muted-foreground px-2">
                {page} / {data.totalPages}
              </span>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                Next
              </Button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
