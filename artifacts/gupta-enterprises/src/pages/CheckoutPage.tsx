import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { MapPin, Package, CreditCard, Truck, Store, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useGetCart, useCreateOrder, getGetCartQueryKey } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, useMapEvents } from "react-leaflet";
import L from "leaflet";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
});

interface MapClickHandlerProps {
  onSelect: (lat: number, lng: number) => void;
}

function MapClickHandler({ onSelect }: MapClickHandlerProps) {
  useMapEvents({ click: e => onSelect(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function CheckoutPage() {
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: cart } = useGetCart({ query: { enabled: !!currentUser } });
  const createOrder = useCreateOrder();

  const [deliveryType, setDeliveryType] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [useMap, setUseMap] = useState(false);
  const [address, setAddress] = useState({ street: "", city: "", state: "", pincode: "", lat: 0, lng: 0 });
  const [mapPos, setMapPos] = useState<[number, number]>([28.6139, 77.209]); // Default Delhi
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [ordered, setOrdered] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const handleMapClick = async (lat: number, lng: number) => {
    setMapPos([lat, lng]);
    setAddress(a => ({ ...a, lat, lng }));
    // Try reverse geocode
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await resp.json();
      const addr = data.address ?? {};
      setAddress(a => ({
        ...a,
        lat, lng,
        street: [addr.road, addr.suburb].filter(Boolean).join(", ") || a.street,
        city: addr.city || addr.town || addr.village || a.city,
        state: addr.state || a.state,
        pincode: addr.postcode || a.pincode,
      }));
    } catch (_) {}
  };

  const handlePlaceOrder = async () => {
    if (deliveryType === "DELIVERY" && (!address.street || !address.city || !address.pincode)) {
      toast.error("Please fill in all address fields");
      return;
    }

    const orderData = {
      deliveryType,
      paymentMethod,
      ...(deliveryType === "DELIVERY" && {
        deliveryAddress: {
          id: `addr-${Date.now()}`,
          street: address.street,
          city: address.city,
          state: address.state,
          pincode: address.pincode,
          lat: address.lat || undefined,
          lng: address.lng || undefined,
        }
      }),
    };

    createOrder.mutate(
      { data: orderData },
      {
        onSuccess: (order) => {
          queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
          setOrdered(true);
          setOrderId(order.id);
        },
        onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed to place order"),
      }
    );
  };

  if (ordered && orderId) {
    return (
      <div className="container mx-auto px-4 py-16 max-w-md text-center">
        <div className="mb-6 flex justify-center">
          <div className="w-20 h-20 rounded-full bg-green-100 dark:bg-green-900/20 flex items-center justify-center">
            <CheckCircle className="w-12 h-12 text-green-600" />
          </div>
        </div>
        <h1 className="text-2xl font-bold mb-2">Order Placed!</h1>
        <p className="text-muted-foreground mb-2">Your order #{orderId} has been placed successfully.</p>
        <p className="text-sm text-muted-foreground mb-8">You will receive a confirmation shortly.</p>
        <div className="flex flex-col gap-3">
          <Button onClick={() => navigate(`/orders/${orderId}`)}>Track Order</Button>
          <Button variant="outline" onClick={() => navigate("/products")}>Continue Shopping</Button>
        </div>
      </div>
    );
  }

  if (!cart?.items?.length) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">Your cart is empty</p>
        <Button onClick={() => navigate("/products")}>Shop Now</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-8">Checkout</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Delivery Type */}
          <section className="bg-card border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Delivery Method</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: "DELIVERY" as const, icon: Truck, label: "Home Delivery", sub: "2-3 business days" },
                { type: "PICKUP" as const, icon: Store, label: "Store Pickup", sub: "Ready in 2 hours" },
              ].map(({ type, icon: Icon, label, sub }) => (
                <button key={type} onClick={() => setDeliveryType(type)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${deliveryType === type ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <Icon className={`w-6 h-6 ${deliveryType === type ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-medium text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground">{sub}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Address */}
          {deliveryType === "DELIVERY" && (
            <section className="bg-card border rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <h2 className="font-semibold">Delivery Address</h2>
                <button onClick={() => setUseMap(!useMap)} className="text-sm text-primary hover:underline flex items-center gap-1">
                  <MapPin className="w-3.5 h-3.5" />
                  {useMap ? "Enter manually" : "Select on map"}
                </button>
              </div>

              {useMap && (
                <div className="h-64 rounded-xl overflow-hidden mb-4 border">
                  <MapContainer center={mapPos} zoom={13} style={{ height: "100%", width: "100%" }}>
                    <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" />
                    <MapClickHandler onSelect={handleMapClick} />
                    {address.lat && address.lng && (
                      <Marker position={[address.lat, address.lng]} icon={markerIcon} />
                    )}
                  </MapContainer>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Street Address</Label>
                  <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="123 Main Street, Area" value={address.street}
                    onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">City</Label>
                  <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="City" value={address.city}
                    onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">State</Label>
                  <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="State" value={address.state}
                    onChange={e => setAddress(a => ({ ...a, state: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">PIN Code</Label>
                  <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="110001" value={address.pincode}
                    onChange={e => setAddress(a => ({ ...a, pincode: e.target.value }))} />
                </div>
              </div>
            </section>
          )}

          {/* Payment */}
          <section className="bg-card border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Payment Method</h2>
            <div className="space-y-2">
              {[
                { id: "COD", label: "Cash on Delivery", sub: "Pay when delivered" },
                { id: "CARD", label: "Credit / Debit Card", sub: "Powered by Razorpay" },
                { id: "UPI", label: "UPI", sub: "Google Pay, PhonePe, Paytm" },
              ].map(({ id, label, sub }) => (
                <label key={id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <input type="radio" name="payment" value={id} checked={paymentMethod === id}
                    onChange={() => setPaymentMethod(id)} className="accent-primary" />
                  <div>
                    <p className="text-sm font-medium">{label}</p>
                    <p className="text-xs text-muted-foreground">{sub}</p>
                  </div>
                  <CreditCard className="w-4 h-4 ml-auto text-muted-foreground" />
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Summary */}
        <div className="bg-card border rounded-xl p-5 h-fit sticky top-24">
          <h2 className="font-semibold text-lg mb-4">Order Summary</h2>
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {cart.items.map(item => (
              <div key={item.id} className="flex items-center gap-2 text-sm">
                <img src={item.product?.images?.[0]} alt="" className="w-10 h-10 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="line-clamp-1 text-xs">{item.product?.name}</p>
                  <p className="text-xs text-muted-foreground">Qty: {item.quantity}</p>
                </div>
                <span className="shrink-0 text-xs font-medium">{formatPrice(item.price * item.quantity)}</span>
              </div>
            ))}
          </div>
          <Separator className="my-3" />
          <div className="space-y-1 text-sm mb-4">
            <div className="flex justify-between text-muted-foreground">
              <span>Subtotal</span><span>{formatPrice(cart.subtotal)}</span>
            </div>
            {cart.couponDiscount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Coupon ({cart.couponCode})</span><span>-{formatPrice(cart.couponDiscount)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery</span>
              <span className={cart.subtotal >= 500 ? "text-green-600" : ""}>
                {cart.subtotal >= 500 ? "Free" : formatPrice(50)}
              </span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold">
              <span>Total</span>
              <span>{formatPrice(cart.total + (cart.subtotal < 500 ? 50 : 0))}</span>
            </div>
          </div>

          {cart.couponCode && (
            <Badge variant="secondary" className="w-full justify-center mb-3 text-green-700 bg-green-100">
              Coupon {cart.couponCode} applied
            </Badge>
          )}

          <Button className="w-full" size="lg" onClick={handlePlaceOrder} disabled={createOrder.isPending}>
            {createOrder.isPending ? "Placing Order..." : "Place Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
