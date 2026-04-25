import { Link, useLocation } from "wouter";
import { ArrowRight, ShieldCheck, Truck, RefreshCw, MapPin, Phone, Mail, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useListProducts, useListCategories, getListProductsQueryKey, getListCategoriesQueryKey } from "@workspace/api-client-react";
import type { Product, Category } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/utils";
import { ProductCard } from "@/components/ProductCard";
import { SHOP_CONFIG } from "@/lib/shopConfig";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const shopIcon = L.divIcon({
  html: `<div style="background:#f97316;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">
    <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" width="12" height="12"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </div>`,
  iconSize: [24, 24], iconAnchor: [12, 12], className: "",
});

export function HomePage() {
  const [, navigate] = useLocation();

  const { data: productsData, isLoading: productsLoading } = useListProducts({ limit: 8 }, {
    query: { 
      queryKey: getListProductsQueryKey({ limit: 8 }),
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false
    }
  });
  const { data: categories, isLoading: categoriesLoading } = useListCategories({
    query: { 
      queryKey: getListCategoriesQueryKey(),
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false
    }
  });

  const featuredProducts = productsData?.products ?? [];
  // Ensure categories is an array
  const categoriesArray = Array.isArray(categories) ? categories : (categories ? [categories] : []);

  return (
    <div>
      {/* Hero */}
      <section className="relative overflow-hidden bg-gradient-to-br from-saffron-50 via-amber-50 to-orange-100 dark:from-saffron-950 dark:via-orange-950 dark:to-amber-950 py-20 px-4">
        <div className="absolute inset-0 opacity-5">
          <div className="absolute top-10 left-10 w-64 h-64 rounded-full bg-primary blur-3xl" />
          <div className="absolute bottom-10 right-10 w-64 h-64 rounded-full bg-amber-400 blur-3xl" />
        </div>
        <div className="container mx-auto max-w-4xl text-center relative">
          <Badge className="mb-4 bg-primary/10 text-primary border-primary/20 hover:bg-primary/20">
            🎉 Since {SHOP_CONFIG.since} · Trusted by Kohima
          </Badge>
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold mb-4 leading-tight">
            Kohima's Favourite<br />
            <span className="text-primary">Stationery Store</span>
          </h1>
          <p className="text-lg text-muted-foreground mb-2 max-w-2xl mx-auto">
            Quality pens, notebooks, art supplies, and office stationery — delivered to your doorstep within {SHOP_CONFIG.deliveryRadiusKm}km of {SHOP_CONFIG.city}.
          </p>
          <p className="text-sm text-muted-foreground mb-8">
            📍 {SHOP_CONFIG.address}
          </p>
          <div className="flex flex-wrap gap-3 justify-center">
            <Button size="lg" className="gap-2 shadow-lg shadow-primary/20" onClick={() => navigate("/products")}>
              Shop Now <ArrowRight className="w-5 h-5" />
            </Button>
            <Button size="lg" variant="outline" onClick={() => navigate("/products?sort=newest")}>
              New Arrivals
            </Button>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { icon: Truck, label: "Free Delivery", sub: `On orders over ₹500 (within ${SHOP_CONFIG.deliveryRadiusKm}km)` },
            { icon: ShieldCheck, label: "Genuine Products", sub: "All brands verified authentic" },
            { icon: RefreshCw, label: "Easy Returns", sub: "7-day hassle-free returns" },
            { icon: MapPin, label: `${SHOP_CONFIG.city} Based`, sub: `Serving Nagaland since ${SHOP_CONFIG.since}` },
          ].map(({ icon: Icon, label, sub }) => (
            <div key={label} className="text-center p-4 bg-card border rounded-xl">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center mx-auto mb-3">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <p className="font-semibold text-sm">{label}</p>
              <p className="text-xs text-muted-foreground mt-1">{sub}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Flipkart-style Categories with images */}
      <section className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">Shop by Category</h2>
          <Link href="/products">
            <Button variant="ghost" size="sm" className="gap-1">All <ArrowRight className="w-3.5 h-3.5" /></Button>
          </Link>
        </div>
        {categoriesLoading ? (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
          </div>
        ) : (
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {categoriesArray.slice(0, 6).map((cat: Category) => (
              <Link key={cat.id} href={`/products?category=${cat.id}`}>
                <div className="bg-card border rounded-xl overflow-hidden hover:shadow-md hover:border-primary/40 transition-all cursor-pointer group">
                  <div className="aspect-square bg-muted relative overflow-hidden">
                    {cat.image && cat.image.startsWith("http") ? (
                      <img src={cat.image} alt={cat.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-4xl">{cat.icon ?? "📦"}</div>
                    )}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <p className="absolute bottom-2 left-2 right-2 text-white text-xs font-semibold line-clamp-2 drop-shadow">{cat.name}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Refer & Earn promo strip */}
      <section className="container mx-auto px-4 py-3">
        <Link href="/refer">
          <div className="bg-gradient-to-r from-saffron-500 via-orange-500 to-amber-500 text-white rounded-2xl p-5 flex items-center justify-between gap-4 shadow-lg cursor-pointer hover:shadow-xl transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <span className="text-2xl">🎁</span>
              </div>
              <div>
                <p className="font-bold text-base sm:text-lg leading-tight">Refer a friend, get ₹100 each</p>
                <p className="text-xs opacity-90 mt-0.5">Share your code · both earn on first order</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="shrink-0 gap-1">Get Code <ArrowRight className="w-4 h-4" /></Button>
          </div>
        </Link>
      </section>

      {/* Featured Products */}
      <section className="container mx-auto px-4 py-6">
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-xl font-bold">Featured Products</h2>
          <Link href="/products">
            <Button variant="ghost" size="sm" className="gap-1">View All <ArrowRight className="w-3.5 h-3.5" /></Button>
          </Link>
        </div>
        {productsLoading ? (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-64 rounded-xl" />)}
          </div>
        ) : !featuredProducts.length ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>No products available yet. Check back soon!</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {featuredProducts.map((p: Product) => <ProductCard key={p.id} product={p as never} />)}
          </div>
        )}
      </section>

      {/* About & Contact */}
      <section className="container mx-auto px-4 py-10">
        <div className="grid md:grid-cols-2 gap-6">
          {/* About */}
          <div className="bg-card border rounded-2xl p-6">
            <h2 className="text-xl font-bold mb-3">About Gupta Enterprises</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Established in {SHOP_CONFIG.since} by <strong>{SHOP_CONFIG.ownerName}</strong>, Gupta Enterprises has been Kohima's trusted destination for quality stationery, art supplies, and office essentials. Located at Khedi Market, New NST — right opposite Hotel Galaxy.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2">
                <Phone className="w-4 h-4 text-primary shrink-0" />
                <a href={`tel:${SHOP_CONFIG.phone}`} className="hover:text-primary transition-colors">+91 {SHOP_CONFIG.phone}</a>
              </div>
              <div className="flex items-center gap-2">
                <Mail className="w-4 h-4 text-primary shrink-0" />
                <a href={`mailto:${SHOP_CONFIG.email}`} className="hover:text-primary transition-colors">{SHOP_CONFIG.email}</a>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <span className="text-muted-foreground">{SHOP_CONFIG.address}</span>
              </div>
              <div className="flex items-center gap-2">
                <Clock className="w-4 h-4 text-primary shrink-0" />
                <span className="text-muted-foreground">{SHOP_CONFIG.openHours}</span>
              </div>
            </div>
          </div>

          {/* Map */}
          <div className="bg-card border rounded-2xl overflow-hidden">
            <div className="h-64">
              <MapContainer center={[SHOP_CONFIG.lat, SHOP_CONFIG.lng]} zoom={15} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" />
                <Marker position={[SHOP_CONFIG.lat, SHOP_CONFIG.lng]} icon={shopIcon}>
                  <Popup>
                    <strong>Gupta Enterprises</strong><br />
                    {SHOP_CONFIG.address}
                  </Popup>
                </Marker>
              </MapContainer>
            </div>
            <div className="p-4">
              <p className="font-medium text-sm">{SHOP_CONFIG.name}</p>
              <p className="text-xs text-muted-foreground">{SHOP_CONFIG.address}</p>
              <Button variant="link" size="sm" className="px-0 mt-1 text-xs gap-1"
                onClick={() => window.open(`https://www.google.com/maps?q=${SHOP_CONFIG.lat},${SHOP_CONFIG.lng}`, "_blank")}>
                <MapPin className="w-3 h-3" /> Get Directions
              </Button>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}
