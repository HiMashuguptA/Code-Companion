import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Link, useLocation } from "wouter";
import { ShoppingCart, Bell, User, Search, Menu, Sun, Moon, Package, LayoutDashboard, Truck, RotateCw, Heart } from "lucide-react";
import { useTheme } from "next-themes";
import { useAuth } from "@/contexts/FirebaseContext";
import { useGetCart, useListNotifications, useMarkAllNotificationsRead, getGetCartQueryKey, getListNotificationsQueryKey } from "@workspace/api-client-react";
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
  const { resolvedTheme, setTheme } = useTheme();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [isRefetching, setIsRefetching] = useState(false);
  const qc = useQueryClient();

  const { data: cart } = useGetCart({
    query: { queryKey: getGetCartQueryKey(), enabled: !!currentUser, retry: false }
  });
  const { data: notifications } = useListNotifications({
    query: { queryKey: getListNotificationsQueryKey(), enabled: !!currentUser, retry: false }
  });
  const markAllRead = useMarkAllNotificationsRead();

  const cartCount = cart?.itemCount ?? 0;
  // Ensure notifications is always an array
  const notificationsArray = Array.isArray(notifications) ? notifications : [];
  const unreadCount = notificationsArray.filter((n: Notification) => !n.isRead).length;

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchQuery.trim()) navigate(`/products?search=${encodeURIComponent(searchQuery.trim())}`);
  };

  const handleRefreshProfile = async () => {
    setIsRefetching(true);
    try {
      await refetchProfile();
      console.log("✅ Profile refreshed from navbar");
    } catch (err) {
      console.error("❌ Failed to refresh profile:", err);
    } finally {
      setIsRefetching(false);
    }
  };

  const navLinks = [
    { href: "/", label: "Home" },
    { href: "/products", label: "Products" },
  ];

  return (
    <header className="sticky top-0 z-50 w-full border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
      <div className="container mx-auto px-4 h-16 flex items-center gap-4">
        <Link href="/" className="flex items-center gap-2 shrink-0">
          <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
            <Package className="w-5 h-5 text-primary-foreground" />
          </div>
          <span className="font-bold text-lg hidden sm:block">Gupta Enterprises</span>
        </Link>

        <nav className="hidden md:flex items-center gap-1 ml-2">
          {navLinks.map(link => (
            <Link key={link.href} href={link.href}>
              <Button variant={location === link.href ? "secondary" : "ghost"} size="sm">{link.label}</Button>
            </Link>
          ))}
        </nav>

        <form onSubmit={handleSearch} className="flex-1 max-w-md hidden sm:flex">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="search" placeholder="Search pens, notebooks, art supplies..."
              className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
              value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
          </div>
        </form>

        <div className="flex items-center gap-1 ml-auto">
          <Button variant="ghost" size="icon" onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}>
            {resolvedTheme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </Button>

          {currentUser ? (
            <>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="ghost" size="icon" className="relative">
                    <Bell className="w-5 h-5" />
                    {unreadCount > 0 && (
                      <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                        {unreadCount > 9 ? "9+" : unreadCount}
                      </Badge>
                    )}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-80 p-0" align="end">
                  <div className="flex items-center justify-between p-3 border-b">
                    <span className="font-semibold text-sm">Notifications</span>
                    {unreadCount > 0 && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="text-xs" 
                        onClick={() => markAllRead.mutate(undefined, {
                          onSuccess: () => {
                            qc.invalidateQueries({ queryKey: getListNotificationsQueryKey() });
                          }
                        })}
                      >
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
                <Button variant="ghost" size="icon" className="relative">
                  <ShoppingCart className="w-5 h-5" />
                  {cartCount > 0 && (
                    <Badge className="absolute -top-1 -right-1 h-5 w-5 p-0 flex items-center justify-center text-xs">
                      {cartCount > 9 ? "9+" : cartCount}
                    </Badge>
                  )}
                </Button>
              </Link>

              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="rounded-full">
                    {dbUser?.photoUrl ? (
                      <img src={dbUser.photoUrl} alt={dbUser.name ?? "User"} className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center text-primary-foreground text-xs font-bold">
                        {(dbUser?.name ?? currentUser.email ?? "U")[0]?.toUpperCase()}
                      </div>
                    )}
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-48">
                  <div className="px-2 py-1.5">
                    <p className="text-sm font-medium truncate">{dbUser?.name ?? currentUser.email}</p>
                    <p className="text-xs text-muted-foreground capitalize">{dbUser?.role?.toLowerCase().replace("_", " ")}</p>
                  </div>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={handleRefreshProfile} disabled={isRefetching}>
                    <RotateCw className="w-4 h-4 mr-2" />
                    {isRefetching ? "Refreshing..." : "Refresh Profile"}
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={() => navigate("/profile")}><User className="w-4 h-4 mr-2" /> Profile</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/favorites")}><Heart className="w-4 h-4 mr-2" /> My Favorites</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => navigate("/orders")}><Package className="w-4 h-4 mr-2" /> My Orders</DropdownMenuItem>
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
                <Button variant="ghost" size="icon" className="relative"><ShoppingCart className="w-5 h-5" /></Button>
              </Link>
              <Link href="/auth"><Button size="sm">Sign In</Button></Link>
            </>
          )}

          <Sheet open={mobileOpen} onOpenChange={setMobileOpen}>
            <SheetTrigger asChild>
              <Button variant="ghost" size="icon" className="md:hidden"><Menu className="w-5 h-5" /></Button>
            </SheetTrigger>
            <SheetContent side="left" className="w-72">
              <div className="flex items-center gap-2 mb-6">
                <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                  <Package className="w-5 h-5 text-primary-foreground" />
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
                {navLinks.map(link => (
                  <Link key={link.href} href={link.href} onClick={() => setMobileOpen(false)}>
                    <Button variant={location === link.href ? "secondary" : "ghost"} className="w-full justify-start">{link.label}</Button>
                  </Link>
                ))}
              </nav>
            </SheetContent>
          </Sheet>
        </div>
      </div>
    </header>
  );
}
