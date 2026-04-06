import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Truck, MapPin, Package, CheckCircle, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import {
  useGetDeliveryOrders, useUpdateDeliveryLocation, useUpdateOrder,
  getGetDeliveryOrdersQueryKey
} from "@workspace/api-client-react";
import type { Order } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatPrice, formatDate, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41],
});

function LiveLocationTracker({ orderId }: { orderId: string }) {
  const updateLocation = useUpdateDeliveryLocation();
  const qc = useQueryClient();

  useEffect(() => {
    const update = () => {
      navigator.geolocation.getCurrentPosition(pos => {
        updateLocation.mutate({
          orderId,
          data: { lat: pos.coords.latitude, lng: pos.coords.longitude }
        }, {
          onSuccess: () => qc.invalidateQueries({ queryKey: getGetDeliveryOrdersQueryKey() }),
        });
      });
    };
    update();
    const interval = setInterval(update, 30000);
    return () => clearInterval(interval);
  }, [orderId]);

  return null;
}

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onSelect(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function DeliveryPortal() {
  const [, navigate] = useLocation();
  const { currentUser, dbUser } = useAuth();
  const qc = useQueryClient();
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [manualLoc, setManualLoc] = useState<[number, number] | null>(null);

  const { data: orders, isLoading } = useGetDeliveryOrders({
    query: { queryKey: getGetDeliveryOrdersQueryKey(), enabled: !!currentUser }
  });

  const updateLocation = useUpdateDeliveryLocation();
  const updateOrder = useUpdateOrder();

  if (!currentUser || (dbUser && dbUser.role !== "DELIVERY_AGENT" && dbUser.role !== "ADMIN")) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Truck className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-semibold mb-2">Access Restricted</h2>
        <p className="text-muted-foreground mb-4">This portal is only for delivery agents.</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const handleMarkOutForDelivery = (orderId: string) => {
    updateOrder.mutate({ orderId, data: { status: "OUT_FOR_DELIVERY" } }, {
      onSuccess: () => {
        toast.success("Order marked as Out for Delivery");
        qc.invalidateQueries({ queryKey: getGetDeliveryOrdersQueryKey() });
      },
      onError: () => toast.error("Failed to update order status"),
    });
  };

  const handleMarkDelivered = (orderId: string) => {
    updateOrder.mutate({ orderId, data: { status: "DELIVERED" } }, {
      onSuccess: () => {
        toast.success("Order marked as Delivered");
        setSelectedOrder(null);
        qc.invalidateQueries({ queryKey: getGetDeliveryOrdersQueryKey() });
      },
      onError: () => toast.error("Failed to update order status"),
    });
  };

  const handleUpdateManualLocation = (orderId: string, lat: number, lng: number) => {
    updateLocation.mutate({ orderId, data: { lat, lng } }, {
      onSuccess: () => {
        toast.success("Location updated");
        qc.invalidateQueries({ queryKey: getGetDeliveryOrdersQueryKey() });
      },
      onError: () => toast.error("Failed to update location"),
    });
  };

  const activeOrders = (orders ?? []).filter((o: Order) =>
    ["CONFIRMED", "PROCESSING", "PACKED", "OUT_FOR_DELIVERY"].includes(o.status)
  );
  const completedOrders = (orders ?? []).filter((o: Order) => o.status === "DELIVERED");

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Delivery Portal</h1>
          <p className="text-sm text-muted-foreground">Manage your deliveries</p>
        </div>
        <Badge className="bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400">
          {activeOrders.length} Active
        </Badge>
      </div>

      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}</div>
      ) : !activeOrders.length && !completedOrders.length ? (
        <div className="text-center py-16">
          <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-20" />
          <p className="text-muted-foreground">No orders assigned to you yet.</p>
        </div>
      ) : (
        <div className="grid md:grid-cols-2 gap-6">
          {/* Order list */}
          <div className="space-y-3">
            <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground">Active Orders</h2>
            {activeOrders.map((order: Order) => (
              <button key={order.id} onClick={() => setSelectedOrder(order)}
                className={`w-full bg-card border rounded-xl p-4 text-left transition-all hover:shadow-md ${selectedOrder?.id === order.id ? "border-primary" : ""}`}>
                <div className="flex justify-between items-start mb-2">
                  <p className="font-medium text-sm">#{order.id.slice(-8).toUpperCase()}</p>
                  <Badge className={getOrderStatusColor(order.status)}>{getOrderStatusLabel(order.status)}</Badge>
                </div>
                <p className="text-xs text-muted-foreground mb-1">{formatDate(order.createdAt)}</p>
                {order.deliveryAddress && (
                  <p className="text-xs text-muted-foreground flex items-start gap-1">
                    <MapPin className="w-3 h-3 mt-0.5 shrink-0" />
                    {[order.deliveryAddress.street, order.deliveryAddress.city].filter(Boolean).join(", ")}
                  </p>
                )}
                <p className="text-sm font-semibold mt-2">{formatPrice(order.total)}</p>
              </button>
            ))}

            {completedOrders.length > 0 && (
              <>
                <h2 className="font-semibold text-sm uppercase tracking-wide text-muted-foreground mt-4">Completed Today</h2>
                {completedOrders.slice(0, 5).map((order: Order) => (
                  <div key={order.id} className="bg-card border border-green-200 dark:border-green-800 rounded-xl p-4 opacity-70">
                    <div className="flex justify-between items-start">
                      <p className="font-medium text-sm">#{order.id.slice(-8).toUpperCase()}</p>
                      <div className="flex items-center gap-1 text-green-600 text-xs font-medium">
                        <CheckCircle className="w-3.5 h-3.5" /> Delivered
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground">{formatDate(order.createdAt)}</p>
                  </div>
                ))}
              </>
            )}
          </div>

          {/* Order detail */}
          {selectedOrder ? (
            <div className="bg-card border rounded-xl overflow-hidden">
              <div className="p-4 border-b">
                <div className="flex justify-between items-start mb-1">
                  <h3 className="font-semibold">Order #{selectedOrder.id.slice(-8).toUpperCase()}</h3>
                  <Badge className={getOrderStatusColor(selectedOrder.status)}>{getOrderStatusLabel(selectedOrder.status)}</Badge>
                </div>
                <p className="text-sm text-muted-foreground">{formatDate(selectedOrder.createdAt)}</p>
              </div>

              {selectedOrder.deliveryAddress && (
                <>
                  {/* Live tracking map */}
                  <div className="h-48 border-b">
                    <MapContainer
                      center={
                        selectedOrder.deliveryAddress.lat
                          ? [selectedOrder.deliveryAddress.lat, selectedOrder.deliveryAddress.lng!]
                          : [25.6708, 94.1086]
                      }
                      zoom={13}
                      style={{ height: "100%", width: "100%" }}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OSM" />
                      <MapClickHandler onSelect={(lat, lng) => {
                        setManualLoc([lat, lng]);
                        handleUpdateManualLocation(selectedOrder.id, lat, lng);
                      }} />
                      {selectedOrder.deliveryAddress.lat && (
                        <Marker position={[selectedOrder.deliveryAddress.lat, selectedOrder.deliveryAddress.lng!]} icon={markerIcon} />
                      )}
                      {manualLoc && <Marker position={manualLoc} icon={markerIcon} />}
                    </MapContainer>
                    {selectedOrder.status === "OUT_FOR_DELIVERY" && (
                      <LiveLocationTracker orderId={selectedOrder.id} />
                    )}
                  </div>

                  <div className="p-4 border-b">
                    <p className="text-xs font-medium text-muted-foreground mb-1">Delivery Address</p>
                    <p className="text-sm">{selectedOrder.deliveryAddress.street}</p>
                    <p className="text-sm text-muted-foreground">
                      {[selectedOrder.deliveryAddress.city, selectedOrder.deliveryAddress.state, selectedOrder.deliveryAddress.pincode].filter(Boolean).join(", ")}
                    </p>
                    <Button variant="link" size="sm" className="px-0 mt-1 gap-1 text-xs" onClick={() => {
                      if (selectedOrder.deliveryAddress?.lat) {
                        window.open(`https://www.google.com/maps/dir/?api=1&destination=${selectedOrder.deliveryAddress.lat},${selectedOrder.deliveryAddress.lng}`, "_blank");
                      }
                    }}>
                      <Navigation className="w-3 h-3" /> Open in Google Maps
                    </Button>
                  </div>
                </>
              )}

              <div className="p-4 border-b">
                <p className="text-xs font-medium text-muted-foreground mb-2">Items</p>
                <div className="space-y-1.5">
                  {selectedOrder.items?.map((item: { id: string; product?: { name?: string; images?: string[] }; quantity: number; price: number }) => (
                    <div key={item.id} className="flex justify-between text-sm">
                      <span className="text-muted-foreground">{item.product?.name ?? "Item"} × {item.quantity}</span>
                      <span className="font-medium">{formatPrice(item.price * item.quantity)}</span>
                    </div>
                  ))}
                </div>
                <Separator className="my-2" />
                <div className="flex justify-between font-semibold">
                  <span>Total</span>
                  <span>{formatPrice(selectedOrder.total)}</span>
                </div>
              </div>

              <div className="p-4 flex flex-col gap-2">
                {selectedOrder.status === "PACKED" && (
                  <Button onClick={() => handleMarkOutForDelivery(selectedOrder.id)} disabled={updateOrder.isPending} className="gap-2">
                    <Truck className="w-4 h-4" /> Start Delivery
                  </Button>
                )}
                {selectedOrder.status === "OUT_FOR_DELIVERY" && (
                  <Button onClick={() => handleMarkDelivered(selectedOrder.id)} disabled={updateOrder.isPending}
                    className="gap-2 bg-green-600 hover:bg-green-700">
                    <CheckCircle className="w-4 h-4" /> Mark Delivered
                  </Button>
                )}
                <Button variant="outline" size="sm" onClick={() => setSelectedOrder(null)}>Close</Button>
              </div>
            </div>
          ) : (
            <div className="bg-card border rounded-xl p-8 flex flex-col items-center justify-center text-center">
              <Package className="w-12 h-12 text-muted-foreground opacity-30 mb-3" />
              <p className="text-sm text-muted-foreground">Select an order to view details and update delivery status</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
