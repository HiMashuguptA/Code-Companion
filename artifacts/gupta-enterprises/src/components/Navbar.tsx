import { useState, useEffect, useRef, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ShoppingCart, Bell, User, Search, Menu, Package, LayoutDashboard, Truck, RotateCw, Heart, Gift, Phone, Coins, X, TrendingUp, Clock, Zap } from "lucide-react";
import { SHOP_CONFIG } from "@/lib/shopConfig";
import { useAuth } from "@/contexts/AuthContext";
import { useGetCart, useListNotifications, useMarkAllNotificationsRead, useListProducts, useListCategories, getGetCartQueryKey, getListNotificationsQueryKey, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { formatDateTime } from "@/lib/utils";
import type { Notification } from "@workspace/api-client-react";

const TRENDING_SEARCHES = [
  "Cello Pens",
  "Water Colour",
  "Notebook A4",
  "Wildcraft Bag",
  "Sketch Pens",
  "Graph Paper",
];

const RECENT_SEARCHES_KEY = "gupta-recent-searches";
const MAX_RECENT_SEARCHES = 6;

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
  const [recentSearches, setRecentSearches] = useState<string[]>([]);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(-1);
  const skipDebounceRef = useRef(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const qc = useQueryClient();

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem(RECENT_SEARCHES_KEY);
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch {
        // ignore
      }
    }
  }, []);

  // Fetch categories for category matching
  const { data: categories } = useListCategories({
    query: {
      queryKey: getListCategoriesQueryKey(),
      staleTime: 1000 * 60 * 10,
      enabled: showSuggestions,
    },
  });

  // Debounced search query for product suggestions
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const handleQueryChange = useCallback((query: string) => {
    setSearchQuery(query);
    setSelectedSuggestionIndex(-1);

    if (debounceRef.current) clearTimeout(debounceRef.current);

    if (query.trim().length >= 2) {
      debounceRef.current = setTimeout(() => {
        setDebouncedQuery(query.trim());
      }, 300);
    } else {
      setDebouncedQuery("");
    }
  }, []);

  // Fetch search suggestions when typing
  const { data: searchResults } = useListProducts(
    { search: debouncedQuery || undefined, limit: 5 },
    {
      query: {
        queryKey: ["search-suggestions", debouncedQuery],
        enabled: debouncedQuery.length >= 2,
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
        setSelectedSuggestionIndex(-1);
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
    setSelectedSuggestionIndex(-1);
  }, [location]);

  // Auto-hide suggestions when query is cleared
  useEffect(() => {
    if (!searchQuery.trim()) {
      setShowSuggestions(false);
      setSelectedSuggestionIndex(-1);
    }
  }, [searchQuery]);

  const categoriesArray = Array.isArray(categories) ? categories : [];

  // Helper function to highlight matching text
  const highlightMatch = (text: string, query: string) => {
    if (!query.trim()) return text;
    const regex = new RegExp(`(${query.split("").join("|")})`, "gi");
    const parts = text.split(regex);
    return parts.map((part, i) => 
      regex.test(part) ? <strong key={i} className="font-bold">{part}</strong> : part
    );
  };

  // Get all suggestions: recent searches, trending, categories, products
  const allSuggestions = useCallback(() => {
    const q = searchQuery.trim();
    const suggestions: Array<{
      type: "recent" | "trending" | "category" | "product" | "search";
      label: string;
      query?: string;
      id?: string;
      icon?: React.ReactNode;
      image?: string;
    }> = [];

    if (!q) {
      // Show recent searches (max 3)
      recentSearches.slice(0, 3).forEach((s) => {
        suggestions.push({ type: "recent", label: s, query: s, icon: <Clock className="w-3.5 h-3.5 text-muted-foreground" /> });
      });

      // Show trending searches
      TRENDING_SEARCHES.forEach((s) => {
        suggestions.push({ type: "trending", label: s, query: s, icon: <Zap className="w-3.5 h-3.5 text-amber-500" /> });
      });
    } else {
      // Match categories
      categoriesArray
        .filter((c) => c.name.toLowerCase().includes(q.toLowerCase()))
        .forEach((c) => {
          suggestions.push({ type: "category", label: `Search in ${c.name}`, query: q, id: c.slug });
        });

      // Add product suggestions
      (searchResults?.products ?? []).forEach((p: any) => {
        suggestions.push({ type: "product", label: p.name, id: p.id, image: p.images?.[0] });
      });

      // Add "Search all" option
      if (q) {
        suggestions.push({ type: "search", label: `Search for "${q}"`, query: q });
      }
    }

    return suggestions;
  }, [searchQuery, recentSearches, categoriesArray, searchResults]);

  const suggestions = allSuggestions();

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSuggestionIndex((i) => (i < suggestions.length - 1 ? i + 1 : 0));
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedSuggestionIndex((i) => (i > 0 ? i - 1 : suggestions.length - 1));
        break;
      case "Enter":
        e.preventDefault();
        if (selectedSuggestionIndex >= 0 && suggestions[selectedSuggestionIndex]) {
          const s = suggestions[selectedSuggestionIndex];
          if (s.type === "product") {
            navigate(`/products/${s.id}`);
            setShowSuggestions(false);
            setSearchQuery("");
          } else if (s.type === "category") {
            const params = new URLSearchParams();
            params.set("search", s.query!);
            params.set("category", s.id!);
            navigate(`/?${params.toString()}`);
            setShowSuggestions(false);
            setSearchQuery("");
          } else if (s.query) {
            addRecentSearch(s.query);
            const params = new URLSearchParams();
            params.set("search", s.query);
            navigate(`/?${params.toString()}`);
            setShowSuggestions(false);
            setSearchQuery("");
          }
        }
        break;
      case "Escape":
        e.preventDefault();
        setShowSuggestions(false);
        setSelectedSuggestionIndex(-1);
        break;
    }
  };

  const addRecentSearch = (query: string) => {
    const q = query.trim();
    if (!q) return;
    const updated = [q, ...recentSearches.filter((s) => s !== q)].slice(0, MAX_RECENT_SEARCHES);
    setRecentSearches(updated);
    localStorage.setItem(RECENT_SEARCHES_KEY, JSON.stringify(updated));
  };

  const clearRecentSearches = () => {
    setRecentSearches([]);
    localStorage.removeItem(RECENT_SEARCHES_KEY);
  };

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
    const q = searchQuery.trim();
    if (!q) return;
    addRecentSearch(q);
    const currentCategory = new URLSearchParams(window.location.search).get("category") ?? "";
    const params = new URLSearchParams();
    params.set("search", q);
    if (currentCategory) params.set("category", currentCategory);
    navigate(`/?${params.toString()}`);
    setShowSuggestions(false);
    setSelectedSuggestionIndex(-1);
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
                onChange={e => { handleQueryChange(e.target.value); setShowSuggestions(true); }}
                onFocus={() => { if (searchQuery.trim() || recentSearches.length > 0 || true) setShowSuggestions(true); }}
                onKeyDown={handleKeyDown}
              />
              {searchQuery && (
                <button type="button" onClick={() => { setSearchQuery(""); setShowSuggestions(false); setSelectedSuggestionIndex(-1); }}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                  <X className="w-4 h-4" />
                </button>
              )}

              {/* Enhanced search suggestions dropdown */}
              {showSuggestions && suggestions.length > 0 && (
                <div className="absolute top-full left-0 right-0 mt-1 bg-white rounded-lg shadow-xl border z-50 overflow-hidden">
                  <div className="py-2 max-h-96 overflow-y-auto">
                    {!searchQuery.trim() && recentSearches.length > 0 && (
                      <>
                        <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider flex items-center justify-between">
                          <span>Recent Searches</span>
                          <button type="button" onClick={clearRecentSearches} className="text-xs text-[#2874F0] hover:underline">Clear</button>
                        </div>
                        {recentSearches.slice(0, 3).map((s, i) => (
                          <button key={`recent-${i}`}
                            type="button"
                            onClick={() => {
                              setSearchQuery(s);
                              addRecentSearch(s);
                              const params = new URLSearchParams();
                              params.set("search", s);
                              navigate(`/?${params.toString()}`);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-[#f1f3f6] cursor-pointer transition-colors flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                            <span className="text-sm">{s}</span>
                          </button>
                        ))}
                      </>
                    )}

                    {!searchQuery.trim() && (
                      <>
                        <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Trending</div>
                        {TRENDING_SEARCHES.map((s) => (
                          <button key={`trend-${s}`}
                            type="button"
                            onClick={() => {
                              setSearchQuery(s);
                              addRecentSearch(s);
                              const params = new URLSearchParams();
                              params.set("search", s);
                              navigate(`/?${params.toString()}`);
                              setShowSuggestions(false);
                            }}
                            className="w-full text-left px-3 py-2 hover:bg-[#f1f3f6] cursor-pointer transition-colors flex items-center gap-2">
                            <Zap className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                            <span className="text-sm">{s}</span>
                          </button>
                        ))}
                      </>
                    )}

                    {searchQuery.trim() && (
                      <>
                        {/* Category matches */}
                        {suggestions.filter(s => s.type === "category").length > 0 && (
                          <>
                            <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Categories</div>
                            {suggestions.filter(s => s.type === "category").map((s, idx) => {
                              const absIdx = suggestions.indexOf(s);
                              return (
                                <button key={`cat-${s.id}`}
                                  type="button"
                                  onClick={() => {
                                    const params = new URLSearchParams();
                                    params.set("search", s.query!);
                                    params.set("category", s.id!);
                                    navigate(`/?${params.toString()}`);
                                    setShowSuggestions(false);
                                    setSearchQuery("");
                                  }}
                                  className={`w-full text-left px-3 py-2 cursor-pointer transition-colors flex items-center gap-2 ${selectedSuggestionIndex === absIdx ? "bg-[#2874F0]/10" : "hover:bg-[#f1f3f6]"}`}>
                                  <Search className="w-3.5 h-3.5 text-[#2874F0] shrink-0" />
                                  <span className="text-sm">{highlightMatch(s.label, searchQuery.trim())}</span>
                                </button>
                              );
                            })}
                          </>
                        )}

                        {/* Product suggestions */}
                        {suggestions.filter(s => s.type === "product").length > 0 && (
                          <>
                            <div className="px-3 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">Products</div>
                            {suggestions.filter(s => s.type === "product").map((s) => {
                              const absIdx = suggestions.indexOf(s);
                              return (
                                <Link key={`prod-${s.id}`} href={`/products/${s.id}`}>
                                  <button type="button"
                                    onClick={() => { setShowSuggestions(false); setSearchQuery(""); setSelectedSuggestionIndex(-1); }}
                                    className={`w-full text-left px-3 py-2 cursor-pointer transition-colors flex items-center gap-3 ${selectedSuggestionIndex === absIdx ? "bg-[#2874F0]/10" : "hover:bg-[#f1f3f6]"}`}>
                                    <img src={s.image ?? ""} alt="" className="w-8 h-8 rounded object-cover bg-muted shrink-0"
                                      onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=50"; }} />
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm truncate">{highlightMatch(s.label, searchQuery.trim())}</p>
                                    </div>
                                    <TrendingUp className="w-3 h-3 text-[#2874F0] shrink-0" />
                                  </button>
                                </Link>
                              );
                            })}
                          </>
                        )}

                        {/* Search all option */}
                        {suggestions.filter(s => s.type === "search").length > 0 && (
                          <button type="button"
                            onClick={handleSearch}
                            className={`w-full text-left px-3 py-2 text-sm text-[#2874F0] hover:bg-[#f1f3f6] font-medium flex items-center gap-2 transition-colors border-t mt-2 ${selectedSuggestionIndex === suggestions.length - 1 ? "bg-[#2874F0]/10" : ""}`}>
                            <Search className="w-3.5 h-3.5" /> Search for "{searchQuery.trim()}"
                          </button>
                        )}
                      </>
                    )}
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
