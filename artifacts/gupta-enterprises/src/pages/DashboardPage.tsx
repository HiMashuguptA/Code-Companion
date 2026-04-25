import { Link } from "wouter";
import { Package, Heart, ShoppingBag, Gift, Star, MapPin, ArrowRight, Clock, CheckCircle, Truck, IndianRupee } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useListOrders, useListFavorites, useGetCart,
  getListOrdersQueryKey, getListFavoritesQueryKey, getGetCartQueryKey,
} from "@workspace/api-client-react";
import type { Order } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatPrice, formatDate } from "@/lib/utils";
import { SHOP_CONFIG } from "@/lib/shopConfig";

const STATUS_COLORS: Record<string, string> = {
  PENDING: "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-500/30",
  CONFIRMED: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  PROCESSING: "bg-blue-500/10 text-blue-700 dark:text-blue-400 border-blue-500/30",
  PACKED: "bg-purple-500/10 text-purple-700 dark:text-purple-400 border-purple-500/30",
  OUT_FOR_DELIVERY: "bg-orange-500/10 text-orange-700 dark:text-orange-400 border-orange-500/30",
  DELIVERED: "bg-green-500/10 text-green-700 dark:text-green-400 border-green-500/30",
  CANCELLED: "bg-red-500/10 text-red-700 dark:text-red-400 border-red-500/30",
};

export function DashboardPage() {
  const { currentUser, dbUser } = useAuth();

  const { data: ordersData, isLoading: ordersLoading } = useListOrders(undefined, {
    query: { queryKey: getListOrdersQueryKey(), enabled: !!currentUser, retry: false },
  });
  const { data: favoritesData } = useListFavorites({
    query: { queryKey: getListFavoritesQueryKey(), enabled: !!currentUser, retry: false },
  });
  const { data: cart } = useGetCart({
    query: { queryKey: getGetCartQueryKey(), enabled: !!currentUser, retry: false },
  });

  const orders: Order[] = ordersData?.orders ?? [];
  const recentOrders = orders.slice(0, 4);
  const totalSpent = orders
    .filter((o) => o.status === "DELIVERED")
    .reduce((s, o) => s + Number(o.total), 0);
  const activeOrdersCount = orders.filter((o) =>
    !["DELIVERED", "CANCELLED"].includes(o.status as string),
  ).length;
  const deliveredCount = orders.filter((o) => o.status === "DELIVERED").length;
  const favoritesArray = Array.isArray(favoritesData) ? favoritesData : [];
  const cartItemCount = cart?.itemCount ?? 0;

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">Please sign in to access your dashboard.</p>
        <Link href="/auth"><Button>Sign In</Button></Link>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      {/* Welcome */}
      <div className="mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold">
          Welcome back, {dbUser?.name?.split(" ")[0] ?? "Friend"}! 👋
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          Here's a quick overview of your account and recent activity.
        </p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <StatCard
          icon={ShoppingBag}
          label="In Cart"
          value={cartItemCount}
          accent="text-primary"
          href="/cart"
        />
        <StatCard
          icon={Truck}
          label="Active Orders"
          value={activeOrdersCount}
          accent="text-orange-500"
          href="/orders"
        />
        <StatCard
          icon={CheckCircle}
          label="Delivered"
          value={deliveredCount}
          accent="text-green-500"
          href="/orders?status=DELIVERED"
        />
        <StatCard
          icon={Heart}
          label="Favorites"
          value={favoritesArray.length}
          accent="text-red-500"
          href="/favorites"
        />
      </div>

      {/* Total spent + Refer banner */}
      <div className="grid md:grid-cols-3 gap-4 mb-8">
        <div className="md:col-span-1 bg-gradient-to-br from-saffron-100 to-orange-100 dark:from-saffron-950 dark:to-orange-950 border border-primary/20 rounded-2xl p-5">
          <div className="flex items-center gap-2 text-sm text-muted-foreground mb-1">
            <IndianRupee className="w-4 h-4 text-primary" /> Total Spent
          </div>
          <p className="text-3xl font-bold text-primary">{formatPrice(totalSpent)}</p>
          <p className="text-xs text-muted-foreground mt-1">
            Across {deliveredCount} delivered order{deliveredCount === 1 ? "" : "s"}
          </p>
        </div>

        <div className="md:col-span-2 bg-card border rounded-2xl p-5 flex flex-col sm:flex-row items-center gap-4 justify-between">
          <div className="flex items-start gap-3">
            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
              <Gift className="w-6 h-6 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold">Refer & Earn ₹100</h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                Invite friends to {SHOP_CONFIG.name} — both you and your friend get ₹100 credit on first order.
              </p>
            </div>
          </div>
          <Link href="/refer">
            <Button size="sm" className="gap-1 shrink-0">Get my code <ArrowRight className="w-4 h-4" /></Button>
          </Link>
        </div>
      </div>

      {/* Recent orders */}
      <div className="bg-card border rounded-2xl p-5 mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold">Recent Orders</h2>
          <Link href="/orders">
            <Button variant="ghost" size="sm" className="gap-1">View all <ArrowRight className="w-3.5 h-3.5" /></Button>
          </Link>
        </div>

        {ordersLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 rounded-xl" />)}
          </div>
        ) : recentOrders.length === 0 ? (
          <div className="text-center py-10">
            <Package className="w-10 h-10 mx-auto text-muted-foreground/50 mb-3" />
            <p className="text-sm text-muted-foreground mb-4">No orders yet — let's change that!</p>
            <Link href="/products"><Button>Start Shopping</Button></Link>
          </div>
        ) : (
          <div className="space-y-2">
            {recentOrders.map((o) => (
              <Link key={o.id} href={`/orders/${o.id}`}>
                <div className="flex items-center gap-3 p-3 rounded-xl border hover:border-primary/40 hover:bg-muted/40 transition-all cursor-pointer">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <Package className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium text-sm">Order #{String(o.id).slice(-6)}</p>
                      <Badge variant="outline" className={`text-[10px] ${STATUS_COLORS[o.status as string] ?? ""}`}>
                        {(o.status as string).replace(/_/g, " ")}
                      </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="w-3 h-3" /> {formatDate(o.createdAt ?? "")}
                    </p>
                  </div>
                  <p className="font-semibold text-sm">{formatPrice(o.total)}</p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>

      {/* Quick actions */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <QuickAction icon={Package} href="/orders" label="My Orders" desc="Track or reorder" />
        <QuickAction icon={Heart} href="/favorites" label="Favorites" desc="Your saved items" />
        <QuickAction icon={MapPin} href="/profile" label="Addresses" desc="Manage delivery" />
        <QuickAction icon={Star} href="/products" label="Browse Catalog" desc="New arrivals" />
      </div>
    </div>
  );
}

function StatCard({
  icon: Icon, label, value, accent, href,
}: {
  icon: React.ElementType;
  label: string;
  value: number;
  accent: string;
  href: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-card border rounded-2xl p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer">
        <Icon className={`w-5 h-5 mb-2 ${accent}`} />
        <p className="text-2xl font-bold">{value}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
      </div>
    </Link>
  );
}

function QuickAction({
  icon: Icon, href, label, desc,
}: {
  icon: React.ElementType;
  href: string;
  label: string;
  desc: string;
}) {
  return (
    <Link href={href}>
      <div className="bg-card border rounded-2xl p-4 hover:border-primary/40 hover:shadow-md transition-all cursor-pointer flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm">{label}</p>
          <p className="text-xs text-muted-foreground truncate">{desc}</p>
        </div>
      </div>
    </Link>
  );
}
