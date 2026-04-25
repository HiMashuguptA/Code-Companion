import { useRoute, useLocation } from "wouter";
import { ArrowLeft, MapPin, Package, Phone, Truck, FileText, RotateCcw, User as UserIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  useGetOrder, useGetOrderTracking, useUpdateOrder,
  getGetOrderQueryKey, getGetOrderTrackingQueryKey
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatPrice, formatDateTime, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";
import { SHOP_CONFIG } from "@/lib/shopConfig";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useState } from "react";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41],
});

const ORDER_STEPS = ["PENDING","CONFIRMED","PROCESSING","PACKED","OUT_FOR_DELIVERY","DELIVERED"] as const;

export function OrderDetailPage() {
  const [, params] = useRoute("/orders/:orderId");
  const [, navigate] = useLocation();
  const { currentUser, dbUser } = useAuth();
  const orderId = params?.orderId ?? "";
  const qc = useQueryClient();
  const [showInvoice, setShowInvoice] = useState(false);

  const { data: order, isLoading } = useGetOrder(orderId, {
    query: { queryKey: getGetOrderQueryKey(orderId), enabled: !!orderId, refetchInterval: 10000 }
  });
  const { data: tracking } = useGetOrderTracking(orderId, {
    query: { queryKey: getGetOrderTrackingQueryKey(orderId), enabled: !!orderId && order?.status === "OUT_FOR_DELIVERY", refetchInterval: 5000 }
  });
  const updateOrder = useUpdateOrder();

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  if (isLoading) return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Skeleton className="h-8 w-48 mb-6" />
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-48 rounded-xl" />
        <Skeleton className="h-32 rounded-xl" />
      </div>
    </div>
  );

  if (!order) return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h2 className="text-xl font-semibold mb-2">Order not found</h2>
      <Button onClick={() => navigate("/orders")}>My Orders</Button>
    </div>
  );

  const currentStepIndex = ORDER_STEPS.indexOf(order.status as typeof ORDER_STEPS[number]);
  const canCancel = ["PENDING", "CONFIRMED"].includes(order.status);
  const isAdmin = dbUser?.role === "ADMIN";

  // 2-day return window
  const deliveredDate = order.status === "DELIVERED" && order.updatedAt ? new Date(order.updatedAt) : null;
  const returnEnd = deliveredDate ? new Date(deliveredDate.getTime() + 2 * 24 * 60 * 60 * 1000) : null;
  const canReturn = order.status === "DELIVERED" && returnEnd && new Date() < returnEnd;
  const isReturnable = (order.status as string) === "RETURNED" ? false : canReturn;

  const handleCancel = () => {
    updateOrder.mutate({ orderId, data: { status: "CANCELLED" } }, {
      onSuccess: () => {
        toast.success("Order cancelled");
        qc.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
      },
      onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed to cancel"),
    });
  };

  const handleReturn = () => {
    if (!confirm("Initiate return for this order? You'll receive a refund within 5–7 business days after pickup.")) return;
    updateOrder.mutate({ orderId, data: { status: "CANCELLED" } }, {
      onSuccess: () => {
        toast.success("Return initiated. Our team will pick up the item soon.");
        qc.invalidateQueries({ queryKey: getGetOrderQueryKey(orderId) });
      },
      onError: () => toast.error("Failed to initiate return"),
    });
  };

  const handlePrintInvoice = () => {
    setShowInvoice(true);
    setTimeout(() => window.print(), 100);
    setTimeout(() => setShowInvoice(false), 1000);
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/orders")} className="gap-1 mb-6 print:hidden">
        <ArrowLeft className="w-4 h-4" /> My Orders
      </Button>

      {/* Order Header */}
      <div className="bg-card border rounded-xl p-5 mb-4">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-3">
          <div>
            <h1 className="text-xl font-bold">Order #{order.id.slice(-8).toUpperCase()}</h1>
            <p className="text-sm text-muted-foreground">{formatDateTime(order.createdAt)}</p>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Badge className={`text-sm px-3 py-1 ${getOrderStatusColor(order.status)}`}>
              {getOrderStatusLabel(order.status)}
            </Badge>
            {canCancel && (
              <Button variant="outline" size="sm" onClick={handleCancel} disabled={updateOrder.isPending}
                className="text-destructive border-destructive hover:bg-destructive hover:text-destructive-foreground">
                Cancel Order
              </Button>
            )}
            {order.status === "DELIVERED" && (
              <Button variant="outline" size="sm" onClick={handlePrintInvoice} className="gap-1.5">
                <FileText className="w-3.5 h-3.5" /> Invoice
              </Button>
            )}
            {isReturnable && (
              <Button variant="outline" size="sm" onClick={handleReturn} className="gap-1.5">
                <RotateCcw className="w-3.5 h-3.5" /> Return
              </Button>
            )}
          </div>
        </div>

        {/* Progress Bar */}
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
              <div className="absolute left-0 top-0 h-1 bg-primary rounded-full transition-all"
                style={{ width: `${Math.max(0, (currentStepIndex / (ORDER_STEPS.length - 1)) * 100)}%` }} />
            </div>
          </div>
        )}

        {/* Return policy notice */}
        {order.status === "DELIVERED" && returnEnd && (
          <div className="mt-4 text-xs flex items-center gap-2 bg-blue-50 dark:bg-blue-900/10 text-blue-700 dark:text-blue-300 rounded-lg p-2">
            <RotateCcw className="w-3.5 h-3.5 shrink-0" />
            {canReturn
              ? <span>2-day return policy active. Returnable until <strong>{formatDate(returnEnd)}</strong>.</span>
              : <span>Return window expired on {formatDate(returnEnd)}.</span>
            }
          </div>
        )}
      </div>

      {/* Live Tracking Map */}
      {order.status === "OUT_FOR_DELIVERY" && tracking?.currentLat && tracking?.currentLng && (
        <div className="bg-card border rounded-xl p-4 mb-4 print:hidden">
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
            <div className="bg-muted/50 rounded-lg p-3 mt-3">
              <div className="flex items-center gap-2 text-sm mb-1">
                <UserIcon className="w-4 h-4 text-muted-foreground" />
                <span className="font-medium">{tracking.agentName}</span>
                <Badge variant="secondary" className="text-xs">Delivery Agent</Badge>
              </div>
              {tracking.agentPhone && (
                <div className="flex items-center gap-2 text-sm">
                  <Phone className="w-4 h-4 text-muted-foreground" />
                  <a href={`tel:${tracking.agentPhone}`} className="text-primary hover:underline">{tracking.agentPhone}</a>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Customer contact info — visible to admin and delivery agent */}
      {isAdmin && order.user && (
        <div className="bg-card border rounded-xl p-5 mb-4 print:hidden">
          <h2 className="font-semibold text-sm mb-3 flex items-center gap-2"><UserIcon className="w-4 h-4" /> Customer Details</h2>
          <div className="space-y-1 text-sm">
            <p><strong>Name:</strong> {order.user.name ?? "—"}</p>
            <p><strong>Email:</strong> {order.user.email}</p>
            {order.user.phone && (
              <p><strong>Phone:</strong> <a href={`tel:${order.user.phone}`} className="text-primary hover:underline">{order.user.phone}</a></p>
            )}
          </div>
        </div>
      )}

      {/* Items */}
      <div className="bg-card border rounded-xl p-5 mb-4">
        <h2 className="font-semibold mb-4">Items ({order.items?.length ?? 0})</h2>
        <div className="space-y-3">
          {order.items?.map((item: { id: string; productId: string; product?: { name?: string; images?: string[] }; quantity: number; price: number }) => (
            <div key={item.id} className="flex gap-3">
              <img src={item.product?.images?.[0] ?? "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=80"}
                alt={item.product?.name}
                className="w-14 h-14 rounded-lg object-cover"
                onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=80"; }} />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2">{item.product?.name}</p>
                <p className="text-xs text-muted-foreground">Qty: {item.quantity} × {formatPrice(item.price)}</p>
              </div>
              <p className="font-semibold text-sm shrink-0">{formatPrice(item.price * item.quantity)}</p>
            </div>
          ))}
        </div>

        <Separator className="my-4" />
        <div className="space-y-1 text-sm">
          <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatPrice(order.subtotal ?? 0)}</span></div>
          {(order.couponDiscount ?? 0) > 0 && (
            <div className="flex justify-between text-green-600"><span>Coupon</span><span>-{formatPrice(order.couponDiscount ?? 0)}</span></div>
          )}
          <div className="flex justify-between font-bold text-base"><span>Total</span><span>{formatPrice(order.total)}</span></div>
          <div className="flex justify-between text-muted-foreground"><span>Payment</span><span className="capitalize">{order.paymentMethod?.toLowerCase()?.replace("_", " ") ?? "COD"}</span></div>
        </div>
      </div>

      {/* Delivery Address */}
      {order.deliveryType === "DELIVERY" && order.deliveryAddress && (
        <div className="bg-card border rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-3">
            <MapPin className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Delivery Address</h2>
          </div>
          <div className="text-sm text-muted-foreground">
            {[order.deliveryAddress.street, order.deliveryAddress.city, order.deliveryAddress.state, order.deliveryAddress.pincode].filter(Boolean).join(", ")}
          </div>
        </div>
      )}

      {/* Pickup info */}
      {order.deliveryType === "PICKUP" && (
        <div className="bg-card border rounded-xl p-5 mb-4">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-muted-foreground" />
            <h2 className="font-semibold">Store Pickup</h2>
          </div>
          <p className="text-sm text-muted-foreground">{SHOP_CONFIG.address}</p>
          <p className="text-xs text-muted-foreground mt-1">📞 {SHOP_CONFIG.phone} · {SHOP_CONFIG.openHours}</p>
        </div>
      )}

      {/* Invoice (printable) */}
      {showInvoice && (
        <div className="fixed inset-0 bg-white z-50 p-8 overflow-auto print:relative print:p-0">
          <div className="max-w-2xl mx-auto text-black">
            <div className="border-b pb-4 mb-4">
              <h1 className="text-2xl font-bold">{SHOP_CONFIG.name}</h1>
              <p className="text-sm">{SHOP_CONFIG.address}</p>
              <p className="text-sm">📞 {SHOP_CONFIG.phone} · ✉ {SHOP_CONFIG.email}</p>
            </div>
            <div className="mb-4">
              <h2 className="text-xl font-bold">INVOICE</h2>
              <p className="text-sm">Order #{order.id.slice(-8).toUpperCase()}</p>
              <p className="text-sm">Date: {formatDateTime(order.createdAt)}</p>
            </div>
            {order.user && (
              <div className="mb-4">
                <p className="font-semibold text-sm">Bill To:</p>
                <p className="text-sm">{order.user.name ?? order.user.email}</p>
                {order.user.phone && <p className="text-sm">{order.user.phone}</p>}
                {order.deliveryAddress && (
                  <p className="text-sm">{[order.deliveryAddress.street, order.deliveryAddress.city, order.deliveryAddress.state, order.deliveryAddress.pincode].filter(Boolean).join(", ")}</p>
                )}
              </div>
            )}
            <table className="w-full text-sm border-collapse mb-4">
              <thead className="border-b">
                <tr><th className="text-left py-2">Item</th><th className="text-right py-2">Qty</th><th className="text-right py-2">Price</th><th className="text-right py-2">Total</th></tr>
              </thead>
              <tbody>
                {order.items?.map((it: { id: string; product?: { name?: string }; quantity: number; price: number }) => (
                  <tr key={it.id} className="border-b">
                    <td className="py-2">{it.product?.name}</td>
                    <td className="text-right py-2">{it.quantity}</td>
                    <td className="text-right py-2">{formatPrice(it.price)}</td>
                    <td className="text-right py-2">{formatPrice(it.price * it.quantity)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="font-bold">
                <tr><td colSpan={3} className="text-right py-2">Total</td><td className="text-right py-2">{formatPrice(order.total)}</td></tr>
              </tfoot>
            </table>
            <p className="text-xs text-center mt-8">Thank you for shopping with {SHOP_CONFIG.name}!</p>
          </div>
        </div>
      )}
    </div>
  );
}
