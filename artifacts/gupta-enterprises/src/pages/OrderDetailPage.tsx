import { useParams, useLocation } from "wouter";
import { ArrowLeft, MapPin, Package, Phone, Truck } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { useGetOrder, useGetOrderTracking, useUpdateOrder } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatPrice, formatDateTime, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

const ORDER_STEPS = [
  "PENDING", "CONFIRMED", "PROCESSING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED"
] as const;

export function OrderDetailPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();

  const { data: order, isLoading, refetch } = useGetOrder(orderId!, { query: { enabled: !!orderId } });
  const { data: tracking } = useGetOrderTracking(orderId!, { query: { enabled: !!orderId && order?.status === "OUT_FOR_DELIVERY" } });
  const cancelOrder = useUpdateOrder(orderId!);

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl">
        <Skeleton className="h-8 w-48 mb-6" />
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl" />
          <Skeleton className="h-48 rounded-xl" />
          <Skeleton className="h-32 rounded-xl" />
        </div>
      </div>
    );
  }

  if (!order) return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h2 className="text-xl font-semibold mb-2">Order not found</h2>
      <Button onClick={() => navigate("/orders")}>My Orders</Button>
    </div>
  );

  const currentStepIndex = ORDER_STEPS.indexOf(order.status as typeof ORDER_STEPS[number]);
  const canCancel = ["PENDING", "CONFIRMED"].includes(order.status);

  const handleCancel = () => {
    cancelOrder.mutate({ data: { status: "CANCELLED" } }, {
      onSuccess: () => { toast.success("Order cancelled"); refetch(); },
      onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed to cancel"),
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/orders")} className="gap-1 mb-6">
        <ArrowLeft className="w-4 h-4" /> My Orders
      </Button>

      {/* Header */}
      <div className="bg-card border rounded-xl p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold">Order #{order.id}</h1>
            <p className="text-sm text-muted-foreground">{formatDateTime(order.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2">
            <Badge className={`text-sm px-3 py-1 ${getOrderStatusColor(order.status)}`}>
              {getOrderStatusLabel(order.status)}
            </Badge>
            {canCancel && (
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={cancelOrder.isPending} className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
                Cancel
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar (for delivery orders) */}
        {order.deliveryType === "DELIVERY" && order.status !== "CANCELLED" && (
          <div className="mt-4">
            <div className="flex justify-between mb-1">
              {ORDER_STEPS.map((step, i) => (
                <div key={step} className="flex flex-col items-center flex-1">
                  <div className={`w-3 h-3 rounded-full mb-1 ${i <= currentStepIndex ? "bg-primary" : "bg-muted-foreground/30"}`} />
                  <span className="text-xs text-center hidden md:block text-muted-foreground leading-tight">
                    {getOrderStatusLabel(step)}
                  </span>
                </div>
              ))}
            </div>
            <div className="relative h-1 bg-muted rounded-full">
              <div
                className="absolute left-0 top-0 h-1 bg-primary rounded-full transition-all"
                style={{ width: `${Math.max(0, (currentStepIndex / (ORDER_STEPS.length - 1)) * 100)}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Live Tracking Map */}
      {order.status === "OUT_FOR_DELIVERY" && tracking?.currentLat && tracking?.currentLng && (
        <div className="bg-card border rounded-xl p-4 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <Truck className="w-4 h-4 text-primary" />
            <h2 className="font-semibold">Live Tracking</h2>
            <Badge className="bg-green-100 text-green-700 animate-pulse">Live</Badge>
          </div>
          <div className="h-52 rounded-xl overflow-hidden">
            <MapContainer center={[tracking.currentLat, tracking.currentLng]} zoom={14} style={{ height: "100%", width: "100%" }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" />
              <Marker position={[tracking.currentLat, tracking.currentLng]} icon={markerIcon}>
                <Popup>Delivery Agent</Popup>
              </Marker>
            </MapContainer>
          </div>
          {tracking.agentName && (
            <div className="flex items-center gap-2 mt-3 text-sm">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span>Agent: {tracking.agentName}</span>
              {tracking.agentPhone && <a href={`tel:${tracking.agentPhone}`} className="text-primary hover:underline">{tracking.agentPhone}</a>}
            </div>
          )}
        </div>
      )}

      {/* Items */}
      <div className="bg-card border rounded-xl p-5 mb-4">
        <h2 className="font-semibold mb-4">Items ({(order.items as unknown[]).length})</h2>
        <div className="space-y-3">
          {(order.items as Array<{ id: string; productId: string; product?: { name: string; images: string[] }; quantity: number; price: number }>).map(item => (
            <div key={item.id} className="flex gap-3">
              <img
                src={item.product?.images?.[0] ?? "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=80"}
                alt={item.product?.name}
                className="w-14 h-14 rounded-lg object-cover"
                onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=80"; }}
              />
              <div className="flex-1">
                <p className="text-sm font-medium">{item.product?.name}</p>
                <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {formatPrice(item.price)}</p>
              </div>
              <p className="font-semibold text-sm">{formatPrice(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>

        <Separator className="my-4" />
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground">
            <span>Subtotal</span><span>{formatPrice(order.subtotal ?? 0)}</span>
          </div>
          {(order.couponDiscount ?? 0) > 0 && (
            <div className="flex justify-between text-green-600">
              <span>Coupon Discount</span><span>-{formatPrice(order.couponDiscount)}</span>
            </div>
          )}
          <div className="flex justify-between font-bold text-base">
            <span>Total</span><span>{formatPrice(order.total)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground">
            <span>Payment</span><span className="capitalize">{order.paymentMethod?.toLowerCase()?.replace("_", " ") ?? "COD"}</span>
          </div>
        </div>
      </div>

      {/* Delivery Address */}
      {order.deliveryType === "DELIVERY" && order.deliveryAddress && (
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Delivery Address</h2>
          </div>
          <div className="text-sm text-muted-foreground">
            {(() => {
              const addr = order.deliveryAddress as { street?: string; city?: string; state?: string; pincode?: string };
              return [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(", ");
            })()}
          </div>
        </div>
      )}

      {order.deliveryType === "PICKUP" && (
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Store Pickup</h2>
          </div>
          <p className="text-sm text-muted-foreground">123 Market Road, Delhi - 110001</p>
        </div>
      )}
    </div>
  );
}
