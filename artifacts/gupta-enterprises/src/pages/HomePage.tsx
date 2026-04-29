import { useEffect, useMemo, useState } from "react";
import { Link, useLocation } from "wouter";
import { ArrowRight, MapPin, Phone, Mail, Clock, SlidersHorizontal, X, Tag, Sparkles, Flame, Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import {
  useListProducts, useListCategories, useListProductTags,
  getListProductsQueryKey, getListCategoriesQueryKey, getListProductTagsQueryKey,
} from "@workspace/api-client-react";
import type { Product, Category } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { RecentlyViewedRail } from "@/components/RecentlyViewedRail";
import { CategoryNavBar } from "@/components/CategoryNavBar";
import { BannerSection } from "@/components/BannerSection";
import { SHOP_CONFIG } from "@/lib/shopConfig";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";

const shopIcon = L.divIcon({
  html: `<div style="background:#2874F0;width:24px;height:24px;border-radius:50%;border:3px solid white;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center">
    <svg xmlns="http://www.w3.org/2000/svg" fill="white" viewBox="0 0 24 24" width="12" height="12"><path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/></svg>
  </div>`,
  iconSize: [24, 24], iconAnchor: [12, 12], className: "",
});

type SortKey = "newest" | "price_asc" | "price_desc" | "popularity" | "discount";

export function HomePage() {
  const [location] = useLocation();
  const params = useMemo(() => new URLSearchParams(location.split("?")[1] ?? ""), [location]);

  const [search, setSearch] = useState(params.get("search") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const [selectedTags, setSelectedTags] = useState<string[]>([]);
  const [sort, setSort] = useState<SortKey>("newest");
  const [page, setPage] = useState(1);

  // Sync search query from URL on navigation (Navbar pushes /?search=...)
  useEffect(() => {
    const s = params.get("search");
    if (s !== null) setSearch(s);
    const c = params.get("category");
    if (c !== null) setCategory(c);
    setPage(1);
  }, [location]); // eslint-disable-line react-hooks/exhaustive-deps

  const baseQuery = {
    search: search || undefined,
    category: category || undefined,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    inStock: inStock || undefined,
    tags: selectedTags.length ? selectedTags.join(",") : undefined,
    sort,
    page,
    limit: 24,
  };

  const { data: gridData, isLoading: gridLoading } = useListProducts(baseQuery, {
    query: {
      queryKey: getListProductsQueryKey(baseQuery),
      staleTime: 1000 * 60 * 2,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  });

  const { data: categories, isLoading: categoriesLoading } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey(), staleTime: 1000 * 60 * 5 },
  });

  const { data: tagsData } = useListProductTags({
    query: { queryKey: getListProductTagsQueryKey(), staleTime: 1000 * 60 * 5 },
  });

  // Featured + popular rails come from a broader fetch (no filters)
  const { data: railData } = useListProducts({ limit: 60 }, {
    query: {
      queryKey: getListProductsQueryKey({ limit: 60 }),
      staleTime: 1000 * 60 * 5,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  });

  const categoriesArray = Array.isArray(categories) ? categories : [];
  const tagsArray = Array.isArray(tagsData) ? tagsData : [];
  const railProducts = (railData?.products ?? []) as Product[];

  const featuredProducts = useMemo(
    () => railProducts.filter(p => p.isFeatured).slice(0, 8),
    [railProducts],
  );
  const bestDiscounts = useMemo(
    () => [...railProducts]
      .filter(p => Number(p.discount ?? 0) > 0)
      .sort((a, b) => Number(b.discount ?? 0) - Number(a.discount ?? 0))
      .slice(0, 8),
    [railProducts],
  );
  const topSelling = useMemo(
    () => [...railProducts]
      .sort((a, b) => Number(b.salesCount ?? 0) - Number(a.salesCount ?? 0))
      .filter(p => Number(p.salesCount ?? 0) > 0)
      .slice(0, 8),
    [railProducts],
  );

  const toggleTag = (tag: string) => {
    setSelectedTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setMinPrice("");
    setMaxPrice("");
    setInStock(false);
    setSelectedTags([]);
    setSort("newest");
    setPage(1);
  };

  const hasFilters = !!(search || category || minPrice || maxPrice || inStock || selectedTags.length);

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-semibold mb-2 block">Category</Label>
        <div className="flex flex-col gap-1">
          <button
            className={`text-left text-sm px-3 py-1.5 rounded-md transition-colors ${!category ? "bg-[#2874F0] text-white" : "hover:bg-muted"}`}
            onClick={() => { setCategory(""); setPage(1); }}
          >
            All Categories
          </button>
          {categoriesArray.map((cat: Category) => (
            <button
              key={cat.id}
              className={`text-left text-sm px-3 py-1.5 rounded-md transition-colors ${category === cat.slug ? "bg-[#2874F0] text-white" : "hover:bg-muted"}`}
              onClick={() => { setCategory(cat.slug); setPage(1); }}
            >
              {cat.name}{cat.productCount !== undefined && <span className="ml-1 opacity-60">({cat.productCount})</span>}
            </button>
          ))}
        </div>
      </div>

      {tagsArray.length > 0 && (
        <div>
          <Label className="text-sm font-semibold mb-2 block flex items-center gap-1.5"><Tag className="w-3.5 h-3.5" /> Tags / Features</Label>
          <div className="flex flex-wrap gap-1.5">
            {tagsArray.slice(0, 24).map((t: { tag: string; count: number }) => {
              const active = selectedTags.includes(t.tag);
              return (
                <button
                  key={t.tag}
                  onClick={() => toggleTag(t.tag)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${active ? "bg-[#2874F0] text-white border-[#2874F0]" : "bg-background hover:border-[#2874F0]/50"}`}
                >
                  {t.tag} <span className="opacity-60">({t.count})</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      <div>
        <Label className="text-sm font-semibold mb-2 block">Price</Label>
        <div className="flex gap-2">
          <input type="number" placeholder="Min ₹"
            className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-[#2874F0]/40"
            value={minPrice} onChange={e => { setMinPrice(e.target.value); setPage(1); }} />
          <input type="number" placeholder="Max ₹"
            className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-[#2874F0]/40"
            value={maxPrice} onChange={e => { setMaxPrice(e.target.value); setPage(1); }} />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" className="w-4 h-4 rounded accent-[#2874F0]"
            checked={inStock} onChange={e => { setInStock(e.target.checked); setPage(1); }} />
          <span className="text-sm font-medium">In Stock Only</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="bg-[#f1f3f6] dark:bg-background min-h-screen">
      {/* Category strip */}
      <div className="bg-white dark:bg-card border-b">
        <CategoryNavBar />
      </div>

      {/* Top admin-managed carousel banner */}
      <BannerSection position="TOP" />

      {/* Featured / Best Discounts / Top Selling rails (only when not actively searching) */}
      {!hasFilters && (
        <div className="container mx-auto px-2 sm:px-4 space-y-3">
          {featuredProducts.length > 0 && (
            <Rail title="Featured Products" icon={<Sparkles className="w-4 h-4 text-[#2874F0]" />} products={featuredProducts} />
          )}
          {bestDiscounts.length > 0 && (
            <Rail
              title="Top Discounts"
              icon={<Flame className="w-4 h-4 text-red-500" />}
              suffix={<Badge className="bg-red-500/10 text-red-600 border-red-500/20 hover:bg-red-500/10">Up to {Math.max(...bestDiscounts.map(p => Number(p.discount ?? 0)))}% OFF</Badge>}
              products={bestDiscounts}
            />
          )}
          {topSelling.length > 0 && (
            <Rail
              title="Top Selling"
              icon={<Star className="w-4 h-4 text-amber-500" />}
              products={topSelling}
              showRank
            />
          )}
        </div>
      )}

      {/* Middle banner */}
      <BannerSection position="MIDDLE" />

      {/* Main shop area: filters + grid */}
      <section className="container mx-auto px-2 sm:px-4 py-3">
        <div className="bg-white dark:bg-card rounded-md shadow-sm flex flex-col md:flex-row">
          {/* Sidebar */}
          <aside className="hidden md:block w-60 shrink-0 border-r p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold text-sm uppercase">Filters</h3>
              {hasFilters && (
                <Button variant="link" size="sm" onClick={clearFilters} className="h-auto px-0 text-[#2874F0] text-xs">Clear all</Button>
              )}
            </div>
            <FilterContent />
          </aside>

          {/* Grid panel */}
          <div className="flex-1 min-w-0 p-3 sm:p-4">
            <div className="flex flex-wrap items-center gap-2 mb-4">
              <h2 className="font-semibold text-base">
                {search ? `Results for "${search}"` :
                  category ? `${categoriesArray.find(c => c.slug === category)?.name ?? "Category"}` :
                    "All Products"}
                <span className="ml-2 text-xs text-muted-foreground font-normal">
                  ({gridData?.total ?? 0} items)
                </span>
              </h2>

              {/* Mobile filter */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="outline" size="sm" className="md:hidden gap-1.5 ml-auto">
                    <SlidersHorizontal className="w-4 h-4" /> Filters
                    {hasFilters && <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-xs bg-[#2874F0]">!</Badge>}
                  </Button>
                </SheetTrigger>
                <SheetContent side="left">
                  <SheetHeader><SheetTitle>Filters</SheetTitle></SheetHeader>
                  <div className="mt-4"><FilterContent /></div>
                </SheetContent>
              </Sheet>

              <div className="md:ml-auto flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">Sort by:</span>
                {([
                  { v: "popularity", l: "Popularity" },
                  { v: "price_asc", l: "Price ↑" },
                  { v: "price_desc", l: "Price ↓" },
                  { v: "discount", l: "Discount" },
                  { v: "newest", l: "Newest" },
                ] as { v: SortKey; l: string }[]).map(o => (
                  <button key={o.v} onClick={() => { setSort(o.v); setPage(1); }}
                    className={`px-2 py-1 rounded border-b-2 transition-colors ${sort === o.v ? "border-[#2874F0] text-[#2874F0] font-medium" : "border-transparent text-muted-foreground hover:text-foreground"}`}>
                    {o.l}
                  </button>
                ))}
              </div>
            </div>

            {/* Active filter chips */}
            {hasFilters && (
              <div className="flex flex-wrap gap-2 mb-3">
                {search && <Chip label={`"${search}"`} onClear={() => setSearch("")} />}
                {category && <Chip label={categoriesArray.find(c => c.slug === category)?.name ?? category} onClear={() => setCategory("")} />}
                {selectedTags.map(t => <Chip key={t} label={t} onClear={() => toggleTag(t)} />)}
                {minPrice && <Chip label={`Min ₹${minPrice}`} onClear={() => setMinPrice("")} />}
                {maxPrice && <Chip label={`Max ₹${maxPrice}`} onClear={() => setMaxPrice("")} />}
                {inStock && <Chip label="In stock" onClear={() => setInStock(false)} />}
              </div>
            )}

            {gridLoading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {Array.from({ length: 12 }).map((_, i) => (
                  <div key={i} className="space-y-2">
                    <Skeleton className="aspect-square rounded-lg" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-1/2" />
                  </div>
                ))}
              </div>
            ) : (gridData?.products?.length ?? 0) === 0 ? (
              <div className="text-center py-16">
                <div className="text-6xl mb-4">🔍</div>
                <h3 className="text-lg font-semibold mb-2">No products found</h3>
                <p className="text-muted-foreground mb-4">Try adjusting your filters or search.</p>
                {hasFilters && <Button onClick={clearFilters}>Clear Filters</Button>}
              </div>
            ) : (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                  {gridData?.products.map((p, i) => (
                    <ProductCard key={p.id} product={p as never} index={i} />
                  ))}
                </div>
                {gridData && gridData.totalPages > 1 && (
                  <div className="flex justify-center items-center gap-2 mt-6">
                    <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => { setPage(p => p - 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      Previous
                    </Button>
                    <span className="text-sm text-muted-foreground px-2">Page {page} of {gridData.totalPages}</span>
                    <Button variant="outline" size="sm" disabled={page >= gridData.totalPages} onClick={() => { setPage(p => p + 1); window.scrollTo({ top: 0, behavior: "smooth" }); }}>
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </section>

      {/* Refer & Earn promo */}
      <section className="container mx-auto px-2 sm:px-4 py-3">
        <Link href="/refer">
          <div className="bg-gradient-to-r from-[#2874F0] via-[#3b82f6] to-[#0ea5e9] text-white rounded-md p-5 flex items-center justify-between gap-4 shadow-md cursor-pointer hover:shadow-lg transition-shadow">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center shrink-0">
                <span className="text-2xl">🎁</span>
              </div>
              <div>
                <p className="font-bold text-base sm:text-lg leading-tight">Refer a friend, get 100 Super Coins each</p>
                <p className="text-xs opacity-90 mt-0.5">1 Coin = ₹1 · Redeem on any order</p>
              </div>
            </div>
            <Button variant="secondary" size="sm" className="shrink-0 gap-1 bg-yellow-300 text-black hover:bg-yellow-400">Get my code <ArrowRight className="w-4 h-4" /></Button>
          </div>
        </Link>
      </section>

      {/* Recently Viewed */}
      <RecentlyViewedRail />

      {/* Bottom banners */}
      <BannerSection position="BOTTOM" />

      {/* About + Map */}
      <section className="container mx-auto px-2 sm:px-4 py-6">
        <div className="grid md:grid-cols-2 gap-4">
          <div className="bg-white dark:bg-card border rounded-md p-6">
            <h2 className="text-xl font-bold mb-3">About Gupta Enterprises</h2>
            <p className="text-sm text-muted-foreground leading-relaxed mb-4">
              Established in {SHOP_CONFIG.since} by <strong>{SHOP_CONFIG.ownerName}</strong>, Gupta Enterprises has been Kohima's trusted destination for quality stationery, art supplies, and office essentials. Located at Khedi Market, New NST — right opposite Hotel Galaxy.
            </p>
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2"><Phone className="w-4 h-4 text-[#2874F0] shrink-0" /><a href={`tel:${SHOP_CONFIG.phone}`} className="hover:text-[#2874F0]">+91 {SHOP_CONFIG.phone}</a></div>
              <div className="flex items-center gap-2"><Mail className="w-4 h-4 text-[#2874F0] shrink-0" /><a href={`mailto:${SHOP_CONFIG.email}`} className="hover:text-[#2874F0]">{SHOP_CONFIG.email}</a></div>
              <div className="flex items-start gap-2"><MapPin className="w-4 h-4 text-[#2874F0] shrink-0 mt-0.5" /><span className="text-muted-foreground">{SHOP_CONFIG.address}</span></div>
              <div className="flex items-center gap-2"><Clock className="w-4 h-4 text-[#2874F0] shrink-0" /><span className="text-muted-foreground">{SHOP_CONFIG.openHours}</span></div>
            </div>
          </div>

          <div className="bg-white dark:bg-card border rounded-md overflow-hidden">
            <div className="h-64">
              <MapContainer center={[SHOP_CONFIG.lat, SHOP_CONFIG.lng]} zoom={15} style={{ height: "100%", width: "100%" }}>
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="OpenStreetMap" />
                <Marker position={[SHOP_CONFIG.lat, SHOP_CONFIG.lng]} icon={shopIcon}>
                  <Popup><strong>Gupta Enterprises</strong><br />{SHOP_CONFIG.address}</Popup>
                </Marker>
              </MapContainer>
            </div>
            <div className="p-4">
              <p className="font-medium text-sm">{SHOP_CONFIG.name}</p>
              <p className="text-xs text-muted-foreground">{SHOP_CONFIG.address}</p>
              <Button variant="link" size="sm" className="px-0 mt-1 text-xs gap-1 text-[#2874F0]"
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

function Chip({ label, onClear }: { label: string; onClear: () => void }) {
  return (
    <Badge variant="secondary" className="gap-1 cursor-default">
      {label}
      <button onClick={onClear} className="ml-1 hover:text-destructive"><X className="w-3 h-3" /></button>
    </Badge>
  );
}

function Rail({
  title, icon, products, suffix, showRank = false,
}: {
  title: string;
  icon?: React.ReactNode;
  products: Product[];
  suffix?: React.ReactNode;
  showRank?: boolean;
}) {
  return (
    <div className="bg-white dark:bg-card rounded-md shadow-sm p-4">
      <div className="flex items-center gap-2 mb-3">
        {icon}
        <h2 className="text-base font-semibold">{title}</h2>
        {suffix}
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3">
        {products.map((p, idx) => (
          <div key={p.id} className="relative">
            {showRank && idx < 3 && (
              <Badge className="absolute -top-2 -left-2 z-10 bg-amber-500 text-white border-2 border-background shadow">
                #{idx + 1}
              </Badge>
            )}
            <ProductCard product={p as never} />
          </div>
        ))}
      </div>
    </div>
  );
}
