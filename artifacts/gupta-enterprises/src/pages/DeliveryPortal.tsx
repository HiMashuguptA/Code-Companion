import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { Truck, MapPin, Package, CheckCircle, Navigation } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";
import { useListOrders, useUpdateOrder, useUpdateDeliveryLocation, getListOrdersQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatDateTime, formatPrice, getOrderStatusColor, getOrderStatusLabel } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

function LocationPicker({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onSelect(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function DeliveryPortal() {
  const [, navigate] = useLocation();
  const { dbUser } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [agentPos, setAgentPos] = useState<[number, number]>([28.6139, 77.209]);
  const [isTrackingLive, setIsTrackingLive] = useState(false);

  const params = { status: "OUT_FOR_DELIVERY", limit: 20 };
  const { data: deliveries, isLoading } = useListOrders(params, {
    query: { queryKey: getListOrdersQueryKey(params) }
  });

  const { data: confirmedOrders } = useListOrders({ status: "CONFIRMED", limit: 20 });
  const { data: packedOrders } = useListOrders({ status: "PACKED", limit: 20 });

  const updateStatus = useUpdateOrder;
  const updateLocation = useUpdateDeliveryLocation;

  useEffect(() => {
    if (!isTrackingLive || !selectedOrderId) return;
    const watchId = navigator.geolocation.watchPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setAgentPos([latitude, longitude]);
        updateLocation(selectedOrderId).mutate({ data: { lat: latitude, lng: longitude } });
      },
      err => console.error("Geolocation error", err),
      { enableHighAccuracy: true }
    );
    return () => navigator.geolocation.clearWatch(watchId);
  }, [isTrackingLive, selectedOrderId]);

  const handleStartDelivery = (orderId: string) => {
    const mutation = updateStatus(orderId);
    mutation.mutate({ data: { status: "OUT_FOR_DELIVERY" } }, {
      onSuccess: () => {
        toast.success("Order marked as out for delivery");
        setSelectedOrderId(orderId);
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey(params) });
      },
      onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed"),
    });
  };

  const handleMarkDelivered = (orderId: string) => {
    const mutation = updateStatus(orderId);
    mutation.mutate({ data: { status: "DELIVERED" } }, {
      onSuccess: () => {
        toast.success("Order marked as delivered");
        setSelectedOrderId(null);
        setIsTrackingLive(false);
        queryClient.invalidateQueries({ queryKey: getListOrdersQueryKey(params) });
      },
    });
  };

  const handleUpdateLocation = () => {
    if (!selectedOrderId) return;
    navigator.geolocation.getCurrentPosition(
      pos => {
        const { latitude, longitude } = pos.coords;
        setAgentPos([latitude, longitude]);
        updateLocation(selectedOrderId).mutate({ data: { lat: latitude, lng: longitude } });
        toast.success("Location updated");
      },
      () => {
        toast.info("Click on map to set location manually");
      }
    );
  };

  if (dbUser?.role !== "DELIVERY_AGENT" && dbUser?.role !== "ADMIN") {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">This portal is for delivery agents only.</p>
        <Button onClick={() => navigate("/")}>Go Home</Button>
      </div>
    );
  }

  const allOrders = [
    ...(deliveries?.orders ?? []),
    ...(packedOrders?.orders ?? []),
  ];

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-6">
        <Truck className="w-6 h-6 text-primary" />
        <h1 className="text-2xl font-bold">Delivery Portal</h1>
        {selectedOrderId && (
          <Badge className="bg-orange-100 text-orange-700 animate-pulse">Active Delivery</Badge>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Orders List */}
        <div className="space-y-3">
          <h2 className="font-semibold text-base mb-3">Active Orders</h2>

          {isLoading ? (
            <div className="space-y-2">
              {[1,2,3].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
            </div>
          ) : allOrders.length === 0 ? (
            <div className="text-center py-12 bg-card border rounded-xl">
              <Package className="w-10 h-10 mx-auto mb-2 text-muted-foreground opacity-30" />
              <p className="text-muted-foreground">No active deliveries</p>
            </div>
          ) : (
            allOrders.map(order => (
              <div key={order.id} className={`bg-card border-2 rounded-xl p-4 transition-colors ${selectedOrderId === order.id ? "border-primary" : "border-border"}`}>
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="text-sm font-bold">#{order.id}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(order.createdAt)}</p>
                  </div>
                  <Badge className={`text-xs ${getOrderStatusColor(order.status)}`}>
                    {getOrderStatusLabel(order.status)}
                  </Badge>
                </div>

                {/* Customer */}
                <p className="text-xs text-muted-foreground mb-1">
                  Customer: {(order.user as { name?: string; email?: string })?.name ?? (order.user as { email?: string })?.email}
                </p>

                {/* Address */}
                {order.deliveryAddress && (
                  <div className="flex items-start gap-1 text-xs text-muted-foreground mb-2">
                    <MapPin className="w-3 h-3 shrink-0 mt-0.5" />
                    <span>{(() => {
                      const a = order.deliveryAddress as { street?: string; city?: string; pincode?: string };
                      return [a.street, a.city, a.pincode].filter(Boolean).join(", ");
                    })()}</span>
                  </div>
                )}

                <p className="text-xs font-semibold mb-3">{formatPrice(order.total)} · {(order.items as unknown[]).length} items</p>

                <div className="flex gap-2">
                  {order.status === "PACKED" && (
                    <Button size="sm" className="flex-1 gap-1.5 text-xs" onClick={() => handleStartDelivery(order.id)}>
                      <Truck className="w-3.5 h-3.5" /> Start Delivery
                    </Button>
                  )}
                  {order.status === "OUT_FOR_DELIVERY" && (
                    <>
                      <Button size="sm" variant="outline" className="gap-1.5 text-xs"
                        onClick={() => { setSelectedOrderId(order.id); handleUpdateLocation(); setIsTrackingLive(!isTrackingLive); }}>
                        <Navigation className="w-3.5 h-3.5" />
                        {isTrackingLive && selectedOrderId === order.id ? "Stop Live" : "Live Track"}
                      </Button>
                      <Button size="sm" className="flex-1 gap-1.5 text-xs bg-green-600 hover:bg-green-700" onClick={() => handleMarkDelivered(order.id)}>
                        <CheckCircle className="w-3.5 h-3.5" /> Mark Delivered
                      </Button>
                    </>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Map */}
        <div className="bg-card border rounded-xl p-4">
          <h2 className="font-semibold text-base mb-3">Location</h2>
          <div className="h-80 rounded-xl overflow-hidden mb-3">
            <MapContainer center={agentPos} zoom={13} style={{ height: "100%", width: "100%" }}>
              <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" />
              <LocationPicker onSelect={(lat, lng) => {
                setAgentPos([lat, lng]);
                if (selectedOrderId) {
                  updateLocation(selectedOrderId).mutate({ data: { lat, lng } });
                  toast.success("Location updated on map");
                }
              }} />
              <Marker position={agentPos} icon={markerIcon} />
            </MapContainer>
          </div>
          <div className="text-xs text-muted-foreground text-center">
            {selectedOrderId
              ? "Click on map to update your location manually, or use Live Track"
              : "Select an active delivery to update location"}
          </div>
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 gap-1.5"
            onClick={handleUpdateLocation}
            disabled={!selectedOrderId}
          >
            <Navigation className="w-4 h-4" /> Use Current GPS Location
          </Button>
        </div>
      </div>
    </div>
  );
}
