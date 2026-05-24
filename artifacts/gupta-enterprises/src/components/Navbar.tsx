import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ShoppingCart, Bell, User, Search, Menu, Package, LayoutDashboard, Truck, RotateCw, Heart, Gift, Phone, Coins, X, TrendingUp } from "lucide-react";
import { SHOP_CONFIG } from "@/lib/shopConfig";
import { useAuth } from "@/contexts/AuthContext";
import { useGetCart, useListNotifications, useMarkAllNotificationsRead, useListProducts, getGetCartQueryKey, getListNotificationsQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime } from "@/lib/utils";
import type { Notification } from "@workspace/api-client-react";

export function Navbar() {
  const [location, navigate] = useLocation();
  const { currentUser, dbUser, signOut, refetchProfile } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get("search") ?? "";
  });
  const [isRefetching, setIsRefetching] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const skipDebounceRef = useRef(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const qc = useQueryClient();

  // Fetch search suggestions when typing
  const { data: searchResults } = useListProducts(
    { search: searchQuery.trim().length >= 2 ? searchQuery.trim() : undefined, limit: 5 },
    {
      query: {
        queryKey: ["search-suggestions", searchQuery.trim()],
        enabled: searchQuery.trim().length >= 2,
        staleTime: 1000 * 30,
        retry: false,
      },
    }
  );

  // Close suggestions when clicking outside
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Sync search query from URL when navigating (e.g. back/forward)
  useEffect(() => {
    const params = new URLSearchParams(location.includes("?") ? location.split("?")[1] : "");
    const s = params.get("search") ?? "";
    skipDebounceRef.current = true;
    setSearchQuery(s);
    setShowSuggestions(false);
  }, [location]);

  // Auto-hide suggestions when query is cleared
  useEffect(() => {
    if (!searchQuery.trim()) setShowSuggestions(false);
  }, [searchQuery]);

  const { data: cart } = useGetCart({
    query: { queryKey: getGetCartQueryKey(), enabled: !!currentUser, retry: false }
  });
  const { data: notifications } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey(), enabled: !!currentUser, retry: false, refetchInterval: 5000 }
  });
  const markAllRead = useMarkAllNotificationsRead();

  const cartCount = cart?.itemCount ?? 0;
  const notificationsArray = Array.isArray(notifications) ? notifications : [];
  const unreadCount = notificationsArray.filter((n: Notification) => !n.isRead).length;
  const coins = dbUser?.superCoins ?? 0;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const currentCategory = new URLSearchParams(window.location.search).get("category") ?? "";
    const params = new URLSearchParams();
    if (searchQuery.trim()) params.set("search", searchQuery.trim());
    if (currentCategory) params.set("category", currentCategory);
    const qs = params.toString();
    navigate(qs ? `/?${qs}` : "/");
  };

  const handleRefreshProfile = async () => {
    setIsRefetching(true);
    try { await refetchProfile(); } catch (err) { console.error(err); } finally { setIsRefetching(false); }
  };

  return (
    <header className="sticky top-0 z-50 w-full">
      {/* Top thin promo bar */}
      <div className="bg-[#172337] text-white text-xs">
        <div className="container mx-auto px-4 py-1.5 flex items-center justify-between gap-2 flex-wrap">
          <span className="flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5" /> Same-day delivery within {SHOP_CONFIG.deliveryRadiusKm}km of {SHOP_CONFIG.city}
          </span>
          <a href={`tel:${SHOP_CONFIG.phone}`} className="hidden sm:flex items-center gap-1.5 hover:underline">
            <Phone className="w-3 h-3" /> +91 {SHOP_CONFIG.phone}
          </a>
        </div>
      </div>

      {/* Main Flipkart-style blue header */}
      <div className="bg-[#2874F0] text-white shadow-md">
        <div className="container mx-auto px-4 h-14 flex items-center gap-3 sm:gap-6">
          <Link href="/" className="flex items-center gap-2 shrink-0">
            <div className="w-8 h-8 rounded-lg bg-white flex items-center justify-center">
              <Package className="w-5 h-5 text-[#2874F0]" />
            </div>
            <div className="hidden sm:flex flex-col leading-tight">
              <span className="font-bold text-base">Gupta Enterprises</span>
              <span className="text-[10px] italic text-white/80">Stationery <span className="text-yellow-300">★</span> Trusted since {SHOP_CONFIG.since}</span>
            </div>
          </Link>

          <form onSubmit={handleSearch} className="flex-1 max-w-2xl">
            <div className="relative" ref={searchRef}>
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#2874F0] z-10" />
              <input type="search" placeholder="Search for pens, notebooks, art supplies..."
                className="w-full pl-9 pr-8 py-2 text-sm bg-white text-foreground rounded-sm border-0 focus:outline-none focus:ring-2 focus:ring-yellow-300/60"
                value={searchQuery}
                onChange={e => { setSearchQuery(e.target.value); setShowSuggestions(true); }}
                onFocus={() => setShowSuggestions(true)}
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(""); setShowSuggestions(false); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Search suggestions dropdown */}
              {showSuggestions && searchQuery.trim().length >= 2 && searchResults?.products && searchResults.products.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border z-50 overflow-hidden">
                  <div className="py-2">
                    <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Products</div>
                    {searchResults.products.map((p: { id: string; name: string; images?: string[]; sellingPrice?: number }) => (
                      <Link key={p.id} href={`/products/${p.id}`}>
                        <div className="flex items-center gap-3 px-3 py-2 hover:bg-[#f1f3f6] cursor-pointer transition-colors"
                          onClick={() => { setShowSuggestions(false); setSearchQuery(""); }}>
                          <img src={p.images?.[0] ?? ""} alt="" className="w-8 h-8 rounded object-cover bg-muted"
                            onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=50"; }} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm truncate">{p.name}</p>
                          </div>
                          <TrendingUp className="w-3 h-3 text-[#2874F0] shrink-0" />
                        </div>
                      </Link>
                    ))}
                    <button onClick={handleSearch}
                      className="w-full text-left px-3 py-2 text-sm text-[#2874F0] hover:bg-[#f1f3f6] font-medium flex items-center gap-2 transition-colors">
                      <Search className="w-3.5 h-3.5" /> Search for "{searchQuery.trim()}"
                    </button>
                  </div>
                </div>
              )}
            </div>
          </form>

          <div className="flex items-center gap-1 ml-auto">
            {currentUser ? (
              <>
                {coins > 0 && (
                  <Link href="/refer">
                    <Button variant="ghost" size="sm" className="text-white hover:bg-white/15 hover:text-white gap-1 hidden sm:flex">
                      <Coins className="w-4 h-4 text-yellow-300" /> {coins}
                    </Button>
                  </Link>
                )}

                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/15 hover:text-white">
                      <Bell className="w-5 h-5" />
                      {unreadCount > 0 && (
                        <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-yellow-400 text-black border-0">
                          {unreadCount > 9 ? "9+" : unreadCount}
                        </Badge>
                      )}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-80 p-0" align="end">
                    <div className="flex items-center justify-between p-3 border-b">
                      <span className="font-semibold text-sm">Notifications</span>
                      {unreadCount > 0 && (
                        <Button variant="ghost" size="sm" className="text-xs"
                          onClick={() => markAllRead.mutate(undefined, {
                            onSuccess: () => qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() })
                          })}>
                          Mark all read
                        </Button>
                      )}
                    </div>
                    <ScrollArea className="h-72">
                      {!notificationsArray.length ? (
                        <p className="text-center text-sm text-muted-foreground py-8">No notifications</p>
                      ) : notificationsArray.map((n: Notification) => (
                        <div key={n.id} className={`p-3 border-b last:border-0 ${!n.isRead ? "bg-primary/5" : ""}`}>
                          <p className="text-sm font-medium">{n.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">{n.message}</p>
                          <p className="text-xs text-muted-foreground mt-1">{formatDateTime(n.createdAt)}</p>
                        </div>
                      ))}
                    </ScrollArea>
                  </PopoverContent>
                </Popover>

                <Link href="/cart">
                  <Button variant="ghost" size="sm" className="relative text-white hover:bg-white/15 hover:text-white gap-1.5">
                    <ShoppingCart className="w-5 h-5" />
                    <span className="hidden sm:inline text-sm">Cart</span>
                    {cartCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs bg-yellow-400 text-black border-0">
                        {cartCount > 9 ? "9+" : cartCount}
                      </Badge>
                    )}
                  </Button>
                </Link>

                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full text-white hover:bg-white/15 hover:text-white">
                      {dbUser?.photoUrl ? (
                        <img src={dbUser.photoUrl} alt={dbUser.name ?? "User"} className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-yellow-300 text-[#2874F0] flex items-center justify-center text-xs font-bold">
                          {(dbUser?.name ?? dbUser?.phone ?? "U")[0]?.toUpperCase()}
                        </div>
                      )}
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-52">
                    <div className="px-2 py-1.5">
                      <p className="text-sm font-medium truncate">{dbUser?.name ?? dbUser?.phone ?? "User"}</p>
                      <p className="text-xs text-muted-foreground capitalize">{dbUser?.role?.toLowerCase().replace("_", " ")}</p>
                      <div className="flex items-center gap-1 mt-1.5 text-xs">
                        <Coins className="w-3.5 h-3.5 text-amber-500" />
                        <span className="font-medium">{coins} Super Coins</span>
                      </div>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={handleRefreshProfile} disabled={isRefetching}>
                      <RotateCw className="w-4 h-4 mr-2" />
                      {isRefetching ? "Refreshing..." : "Refresh Profile"}
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => navigate("/dashboard")}><LayoutDashboard className="w-4 h-4 mr-2" /> Dashboard</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/profile")}><User className="w-4 h-4 mr-2" /> Profile</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/favorites")}><Heart className="w-4 h-4 mr-2" /> My Favorites</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/orders")}><Package className="w-4 h-4 mr-2" /> My Orders</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => navigate("/refer")}><Gift className="w-4 h-4 mr-2" /> Refer & Earn</DropdownMenuItem>
                    {dbUser?.role === "ADMIN" && (
                      <DropdownMenuItem onClick={() => navigate("/admin")}><LayoutDashboard className="w-4 h-4 mr-2" /> Admin Dashboard</DropdownMenuItem>
                    )}
                    {(dbUser?.role === "DELIVERY_AGENT" || dbUser?.role === "ADMIN") && (
                      <DropdownMenuItem onClick={() => navigate("/delivery")}><Truck className="w-4 h-4 mr-2" /> Delivery Portal</DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={() => signOut()} className="text-destructive">Sign Out</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <>
                <Link href="/cart">
                  <Button variant="ghost" size="icon" className="relative text-white hover:bg-white/15 hover:text-white">
                    <ShoppingCart className="w-5 h-5" />
                  </Button>
                </Link>
                <Link href="/auth"><Button size="sm" variant="secondary" className="bg-white text-[#2874F0] hover:bg-white/90 font-semibold">Login</Button></Link>
              </>
            )}

            <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden text-white hover:bg-white/15 hover:text-white"><Menu className="w-5 h-5" /></Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72">
                <div className="flex items-center gap-2 mb-6">
                  <div className="w-8 h-8 rounded-lg bg-[#2874F0] flex items-center justify-center">
                    <Package className="w-5 h-5 text-white" />
                  </div>
                  <span className="font-bold text-lg">Gupta Enterprises</span>
                </div>
                <form onSubmit={handleSearch} className="mb-4">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <input type="search" placeholder="Search products..."
                      className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
                  </div>
                </form>
                <nav className="flex flex-col gap-1">
                  <Link href="/" onClick={() => setMobileOpen(false)}>
                    <Button variant={location === "/" ? "secondary" : "ghost"} className="w-full justify-start">Home</Button>
                  </Link>
                  <Link href="/orders" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">My Orders</Button>
                  </Link>
                  <Link href="/refer" onClick={() => setMobileOpen(false)}>
                    <Button variant="ghost" className="w-full justify-start">Refer & Earn</Button>
                  </Link>
                </nav>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </div>
    </header>
  );
}
