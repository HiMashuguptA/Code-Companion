import { useMemo, useState } from "react";
import { useLocation } from "wouter";
import { MapPin, CreditCard, Truck, Store, CheckCircle, AlertTriangle, Coins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  useGetCart, useCreateOrder, useGetMyReferralInfo,
  getGetCartQueryKey, getGetMyReferralInfoQueryKey, getListMyCoinTransactionsQueryKey,
} from "@workspace/api-client-react";
import type { CartItem } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatPrice } from "@/lib/utils";
import { SHOP_CONFIG, haversineDistanceKm } from "@/lib/shopConfig";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { MapContainer, TileLayer, Marker, Circle, useMapEvents } from "react-leaflet";
import L from "leaflet";

const markerIcon = L.icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41], iconAnchor: [12, 41],
});

const shopIcon = L.divIcon({
  html: `<div style="background:#f97316;width:20px;height:20px;border-radius:50%;border:3px solid white;box-shadow:0 2px 6px rgba(0,0,0,0.3)"></div>`,
  iconSize: [20, 20], iconAnchor: [10, 10], className: "",
});

function MapClickHandler({ onSelect }: { onSelect: (lat: number, lng: number) => void }) {
  useMapEvents({ click: e => onSelect(e.latlng.lat, e.latlng.lng) });
  return null;
}

export function CheckoutPage() {
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const queryClient = useQueryClient();

  const { data: cart } = useGetCart({
    query: {
      queryKey: getGetCartQueryKey(), enabled: !!currentUser, retry: false,
      staleTime: 1000 * 60 * 5, gcTime: 1000 * 60 * 10,
      refetchOnMount: false, refetchOnWindowFocus: false, refetchOnReconnect: false,
    },
  });
  const { data: referralInfo } = useGetMyReferralInfo({
    query: { queryKey: getGetMyReferralInfoQueryKey(), enabled: !!currentUser, retry: false },
  });
  const createOrder = useCreateOrder();

  const [deliveryType, setDeliveryType] = useState<"DELIVERY" | "PICKUP">("DELIVERY");
  const [address, setAddress] = useState({ street: "", city: "Kohima", state: "Nagaland", pincode: "797001", lat: 0, lng: 0 });
  const [contactDetails, setContactDetails] = useState({ name: "", phone: "" });
  const [mapPos, setMapPos] = useState<[number, number]>([SHOP_CONFIG.lat, SHOP_CONFIG.lng]);
  const [markerSet, setMarkerSet] = useState(false);
  const [deliverable, setDeliverable] = useState<boolean | null>(null);
  const [distanceKm, setDistanceKm] = useState<number | null>(null);
  const [paymentMethod, setPaymentMethod] = useState("COD");
  const [ordered, setOrdered] = useState(false);
  const [orderId, setOrderId] = useState<string | null>(null);

  const [useCoins, setUseCoins] = useState(false);
  const [coinsToRedeem, setCoinsToRedeem] = useState(0);

  const subtotal = cart?.subtotal ?? 0;
  const couponDiscount = cart?.couponDiscount ?? 0;
  const baseTotal = cart?.total ?? 0;
  const deliveryFee = deliveryType === "DELIVERY" && subtotal < 500 ? 50 : 0;

  const availableCoins = referralInfo?.superCoins ?? 0;
  const maxRedeemable = useMemo(() => {
    const halfOrder = Math.floor((baseTotal + deliveryFee) * 0.5);
    return Math.max(0, Math.min(availableCoins, halfOrder));
  }, [availableCoins, baseTotal, deliveryFee]);

  const effectiveCoins = useCoins ? Math.min(coinsToRedeem || 0, maxRedeemable) : 0;
  const grandTotal = Math.max(0, baseTotal + deliveryFee - effectiveCoins);
  const estimatedReward = Math.floor((baseTotal + deliveryFee - effectiveCoins) * 0.02);

  const handleMapClick = async (lat: number, lng: number) => {
    setMapPos([lat, lng]);
    setMarkerSet(true);
    const dist = haversineDistanceKm(SHOP_CONFIG.lat, SHOP_CONFIG.lng, lat, lng);
    setDistanceKm(Math.round(dist * 10) / 10);
    setDeliverable(dist <= SHOP_CONFIG.deliveryRadiusKm);
    setAddress(a => ({ ...a, lat, lng }));
    try {
      const resp = await fetch(`https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json`);
      const data = await resp.json();
      const addr = data.address ?? {};
      setAddress(a => ({
        ...a, lat, lng,
        street: [addr.road, addr.suburb].filter(Boolean).join(", ") || a.street,
        city: addr.city || addr.town || addr.village || a.city,
        state: addr.state || a.state,
        pincode: addr.postcode || a.pincode,
      }));
    } catch (_) { /* ignored */ }
  };

  const handleUseMyLocation = () => {
    navigator.geolocation.getCurrentPosition(
      pos => handleMapClick(pos.coords.latitude, pos.coords.longitude),
      () => toast.error("Location access denied. Please click on the map to select your location."),
    );
  };

  const handlePlaceOrder = async () => {
    if (!contactDetails.name || !contactDetails.phone) {
      toast.error("Please provide your name and phone number"); return;
    }
    if (!/^[6-9]\d{9}$/.test(contactDetails.phone)) {
      toast.error("Please enter a valid 10-digit phone number"); return;
    }
    if (deliveryType === "DELIVERY") {
      if (!address.street || !address.city || !address.pincode) {
        toast.error("Please fill in all address fields"); return;
      }
      if (deliverable === false) {
        toast.error(`Sorry, we only deliver within ${SHOP_CONFIG.deliveryRadiusKm}km of our shop in Kohima.`); return;
      }
      if (deliverable === null && markerSet === false) {
        toast.error("Please select your delivery location on the map"); return;
      }
    }

    const orderData = {
      deliveryType,
      paymentMethod,
      contactDetails: { name: contactDetails.name, phone: contactDetails.phone },
      coinsToRedeem: effectiveCoins,
      ...(deliveryType === "DELIVERY" && {
        deliveryAddress: {
          id: `addr-${Date.now()}`,
          street: address.street, city: address.city, state: address.state,
          pincode: address.pincode,
          lat: address.lat || undefined, lng: address.lng || undefined,
        },
      }),
    };

    createOrder.mutate({ data: orderData }, {
      onSuccess: order => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMyReferralInfoQueryKey() });
        queryClient.invalidateQueries({ queryKey: getListMyCoinTransactionsQueryKey() });
        setOrdered(true);
        setOrderId(order.id);
      },
      onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed to place order"),
    });
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
        <p className="text-muted-foreground mb-2">Order #{orderId} placed successfully.</p>
        {estimatedReward > 0 && (
          <p className="text-sm text-amber-600 mb-2 flex items-center justify-center gap-1">
            <Coins className="w-4 h-4" /> You earned {estimatedReward} Super Coins!
          </p>
        )}
        <p className="text-sm text-muted-foreground mb-8">You will receive a confirmation shortly.</p>
        <div className="flex flex-col gap-3">
          <Button onClick={() => navigate(`/orders/${orderId}`)}>Track Order</Button>
          <Button variant="outline" onClick={() => navigate("/")}>Continue Shopping</Button>
        </div>
      </div>
    );
  }

  if (!cart?.items?.length) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">Your cart is empty</p>
        <Button onClick={() => navigate("/")}>Shop Now</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-2xl font-bold mb-8">Checkout</h1>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-6">
          {/* Delivery Method */}
          <section className="bg-card border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Delivery Method</h2>
            <div className="grid grid-cols-2 gap-3">
              {[
                { type: "DELIVERY" as const, icon: Truck, label: "Home Delivery", sub: `Within ${SHOP_CONFIG.deliveryRadiusKm}km of Kohima` },
                { type: "PICKUP" as const, icon: Store, label: "Store Pickup", sub: "Ready in 2 hours" },
              ].map(({ type, icon: Icon, label, sub }) => (
                <button key={type} onClick={() => setDeliveryType(type)}
                  className={`flex flex-col items-center gap-2 p-4 rounded-xl border-2 transition-all ${deliveryType === type ? "border-primary bg-primary/5" : "border-border hover:border-primary/40"}`}>
                  <Icon className={`w-6 h-6 ${deliveryType === type ? "text-primary" : "text-muted-foreground"}`} />
                  <span className="font-medium text-sm">{label}</span>
                  <span className="text-xs text-muted-foreground text-center">{sub}</span>
                </button>
              ))}
            </div>
          </section>

          {/* Contact Details */}
          <section className="bg-card border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Contact Information</h2>
            <div className="space-y-3">
              <div>
                <Label htmlFor="name" className="text-sm">Full Name *</Label>
                <input id="name" type="text" placeholder="Enter your full name"
                  value={contactDetails.name} onChange={e => setContactDetails(p => ({ ...p, name: e.target.value }))}
                  className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
              </div>
              <div>
                <Label htmlFor="phone" className="text-sm">Phone Number *</Label>
                <input id="phone" type="tel" placeholder="10-digit phone number (6-9)"
                  value={contactDetails.phone} onChange={e => setContactDetails(p => ({ ...p, phone: e.target.value }))}
                  className="w-full mt-1.5 px-3 py-2 border rounded-lg bg-background focus:outline-none focus:ring-2 focus:ring-primary" />
                <p className="text-xs text-muted-foreground mt-1">This number will be shared with the delivery agent</p>
              </div>
            </div>
          </section>

          {deliveryType === "DELIVERY" && (
            <section className="bg-card border rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-semibold">Delivery Address</h2>
                <Button variant="outline" size="sm" className="gap-1.5 text-xs" onClick={handleUseMyLocation}>
                  <MapPin className="w-3.5 h-3.5" /> Use My Location
                </Button>
              </div>

              <p className="text-xs text-muted-foreground mb-3">
                📍 We deliver within <strong>{SHOP_CONFIG.deliveryRadiusKm}km</strong> of our shop in Kohima. Click on the map to select your location.
              </p>

              <div className="h-56 rounded-xl overflow-hidden mb-4 border">
                <MapContainer center={[SHOP_CONFIG.lat, SHOP_CONFIG.lng]} zoom={12} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" />
                  <MapClickHandler onSelect={handleMapClick} />
                  <Marker position={[SHOP_CONFIG.lat, SHOP_CONFIG.lng]} icon={shopIcon} />
                  <Circle center={[SHOP_CONFIG.lat, SHOP_CONFIG.lng]} radius={SHOP_CONFIG.deliveryRadiusKm * 1000}
                    pathOptions={{ color: "#f97316", fillColor: "#f97316", fillOpacity: 0.08, weight: 2 }} />
                  {markerSet && <Marker position={mapPos} icon={markerIcon} />}
                </MapContainer>
              </div>

              {markerSet && (
                <div className={`flex items-center gap-2 p-3 rounded-lg mb-4 text-sm ${deliverable ? "bg-green-50 dark:bg-green-900/10 text-green-700 dark:text-green-400" : "bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400"}`}>
                  {deliverable ? (
                    <><CheckCircle className="w-4 h-4 shrink-0" />
                      <span>✅ Deliverable! You're <strong>{distanceKm}km</strong> from our shop. Within our {SHOP_CONFIG.deliveryRadiusKm}km delivery zone.</span></>
                  ) : (
                    <><AlertTriangle className="w-4 h-4 shrink-0" />
                      <span>❌ Not Deliverable. You're <strong>{distanceKm}km</strong> away — outside our {SHOP_CONFIG.deliveryRadiusKm}km delivery radius from Kohima. Try Store Pickup instead.</span></>
                  )}
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <Label className="text-xs text-muted-foreground">Street Address *</Label>
                  <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="House/Flat no, Street, Area" value={address.street}
                    onChange={e => setAddress(a => ({ ...a, street: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">City</Label>
                  <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={address.city} onChange={e => setAddress(a => ({ ...a, city: e.target.value }))} />
                </div>
                <div>
                  <Label className="text-xs text-muted-foreground">PIN Code *</Label>
                  <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="797001" value={address.pincode}
                    onChange={e => setAddress(a => ({ ...a, pincode: e.target.value }))} />
                </div>
              </div>
            </section>
          )}

          {deliveryType === "PICKUP" && (
            <section className="bg-card border rounded-xl p-5">
              <h2 className="font-semibold mb-3">Store Location</h2>
              <div className="h-48 rounded-xl overflow-hidden mb-3 border">
                <MapContainer center={[SHOP_CONFIG.lat, SHOP_CONFIG.lng]} zoom={15} style={{ height: "100%", width: "100%" }}>
                  <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" />
                  <Marker position={[SHOP_CONFIG.lat, SHOP_CONFIG.lng]} icon={shopIcon} />
                </MapContainer>
              </div>
              <div className="text-sm space-y-1">
                <p className="font-medium">{SHOP_CONFIG.name}</p>
                <p className="text-muted-foreground">{SHOP_CONFIG.address}</p>
                <p className="text-muted-foreground">Open: {SHOP_CONFIG.openHours}</p>
                <p className="text-muted-foreground">📞 {SHOP_CONFIG.phone}</p>
              </div>
            </section>
          )}

          {/* Super Coins redemption */}
          {availableCoins > 0 && (
            <section className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-300/50 rounded-xl p-5">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Coins className="w-5 h-5 text-amber-500" />
                  <h2 className="font-semibold">Use Super Coins</h2>
                  <Badge variant="secondary" className="text-xs">{availableCoins} available</Badge>
                </div>
                <Switch checked={useCoins}
                  onCheckedChange={(v) => { setUseCoins(v); setCoinsToRedeem(v ? maxRedeemable : 0); }}
                  disabled={maxRedeemable <= 0} />
              </div>
              {maxRedeemable <= 0 ? (
                <p className="text-xs text-muted-foreground">Order total too small to redeem coins.</p>
              ) : useCoins ? (
                <>
                  <div className="flex items-center gap-3 mb-2">
                    <input type="range" min={0} max={maxRedeemable} value={coinsToRedeem}
                      onChange={e => setCoinsToRedeem(Number(e.target.value))}
                      className="flex-1 accent-amber-500" />
                    <div className="text-right shrink-0">
                      <p className="font-bold text-amber-600">{effectiveCoins} 🪙</p>
                      <p className="text-xs text-muted-foreground">−{formatPrice(effectiveCoins)}</p>
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground">Maximum: {maxRedeemable} coins (50% of order). 1 Coin = ₹1.</p>
                </>
              ) : (
                <p className="text-xs text-muted-foreground">Toggle on to apply up to {maxRedeemable} coins (₹{maxRedeemable} off).</p>
              )}
            </section>
          )}

          <section className="bg-card border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Payment Method</h2>
            <div className="space-y-2">
              {[
                { id: "COD", label: "Cash on Delivery", sub: "Pay when received" },
                { id: "UPI", label: "UPI / QR Code", sub: "Google Pay, PhonePe, Paytm" },
                { id: "CARD", label: "Credit / Debit Card", sub: "Visa, Mastercard" },
              ].map(({ id, label, sub }) => (
                <label key={id} className={`flex items-center gap-3 p-3 rounded-xl border-2 cursor-pointer transition-all ${paymentMethod === id ? "border-primary bg-primary/5" : "border-border hover:border-primary/30"}`}>
                  <input type="radio" name="payment" value={id} checked={paymentMethod === id} onChange={() => setPaymentMethod(id)} className="accent-primary" />
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

        <div className="bg-card border rounded-xl p-5 h-fit sticky top-24">
          <h2 className="font-semibold text-lg mb-4">Order Summary</h2>
          <div className="space-y-2 mb-4 max-h-48 overflow-y-auto">
            {cart.items.map((item: CartItem) => (
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
            <div className="flex justify-between text-muted-foreground"><span>Subtotal</span><span>{formatPrice(subtotal)}</span></div>
            {couponDiscount > 0 && (
              <div className="flex justify-between text-green-600"><span>Coupon ({cart.couponCode})</span><span>-{formatPrice(couponDiscount)}</span></div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery</span>
              <span className={deliveryFee === 0 ? "text-green-600" : ""}>{deliveryFee === 0 ? "Free" : formatPrice(deliveryFee)}</span>
            </div>
            {effectiveCoins > 0 && (
              <div className="flex justify-between text-amber-600">
                <span className="flex items-center gap-1"><Coins className="w-3.5 h-3.5" /> Super Coins ({effectiveCoins})</span>
                <span>-{formatPrice(effectiveCoins)}</span>
              </div>
            )}
            <Separator />
            <div className="flex justify-between font-bold"><span>Total</span><span>{formatPrice(grandTotal)}</span></div>
            {estimatedReward > 0 && (
              <p className="text-xs text-amber-600 flex items-center gap-1 mt-1">
                <Coins className="w-3 h-3" /> You'll earn {estimatedReward} Super Coins
              </p>
            )}
          </div>

          {deliveryType === "DELIVERY" && markerSet && !deliverable && (
            <div className="flex items-center gap-2 bg-red-50 dark:bg-red-900/10 text-red-700 dark:text-red-400 rounded-lg p-2 mb-3 text-xs">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              Location outside delivery range
            </div>
          )}

          {cart.couponCode && (
            <Badge variant="secondary" className="w-full justify-center mb-3 text-green-700 bg-green-100">
              Coupon {cart.couponCode} applied
            </Badge>
          )}

          <Button className="w-full" size="lg" onClick={handlePlaceOrder}
            disabled={createOrder.isPending || (deliveryType === "DELIVERY" && deliverable === false)}>
            {createOrder.isPending ? "Placing Order..." : "Place Order"}
          </Button>
        </div>
      </div>
    </div>
  );
}
