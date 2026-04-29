import { useMemo, useState } from "react";
import { Link } from "wouter";
import {
  Users, ShoppingBag, Package, Tag, TrendingUp, Coins, AlertTriangle,
  Boxes, IndianRupee, Trophy, Calendar,
} from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useGetDashboardAnalytics, useGetRevenueAnalytics, useGetOrderStats,
  useGetSalesRange, useGetLowStockProducts, useGetInventoryInsights, useGetTopProducts,
  getGetDashboardAnalyticsQueryKey, getGetRevenueAnalyticsQueryKey,
  getGetOrderStatsQueryKey, getGetSalesRangeQueryKey,
  getGetLowStockProductsQueryKey, getGetInventoryInsightsQueryKey,
  getGetTopProductsQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatPrice } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid, BarChart, Bar,
} from "recharts";

const fmtDate = (d: Date) => d.toISOString().slice(0, 10);

type Preset = "7d" | "30d" | "90d" | "ytd" | "custom";

export function AdminDashboard() {
  const { isLoading: authLoading } = useAuth();

  // Date range state
  const today = useMemo(() => new Date(), []);
  const [preset, setPreset] = useState<Preset>("30d");
  const [from, setFrom] = useState(() => {
    const d = new Date(); d.setDate(d.getDate() - 29); return fmtDate(d);
  });
  const [to, setTo] = useState(fmtDate(today));

  const applyPreset = (p: Preset) => {
    setPreset(p);
    const end = new Date();
    const start = new Date();
    if (p === "7d") start.setDate(end.getDate() - 6);
    else if (p === "30d") start.setDate(end.getDate() - 29);
    else if (p === "90d") start.setDate(end.getDate() - 89);
    else if (p === "ytd") { start.setMonth(0); start.setDate(1); }
    if (p !== "custom") { setFrom(fmtDate(start)); setTo(fmtDate(end)); }
  };

  const { data: analytics, isLoading } = useGetDashboardAnalytics(undefined, {
    query: { queryKey: getGetDashboardAnalyticsQueryKey(), retry: false },
  });
  const { data: revenue } = useGetRevenueAnalytics(undefined, {
    query: { queryKey: getGetRevenueAnalyticsQueryKey(), retry: false },
  });
  const { data: orderStats } = useGetOrderStats({
    query: { queryKey: getGetOrderStatsQueryKey(), retry: false },
  });

  const rangeParams = { from, to };
  const { data: salesRange, isFetching: salesFetching } = useGetSalesRange(rangeParams, {
    query: { queryKey: getGetSalesRangeQueryKey(rangeParams), retry: false },
  });

  const { data: lowStock } = useGetLowStockProducts({
    query: { queryKey: getGetLowStockProductsQueryKey(), retry: false, refetchInterval: 30000 },
  });

  const { data: inventory } = useGetInventoryInsights({
    query: { queryKey: getGetInventoryInsightsQueryKey(), retry: false, refetchInterval: 30000 },
  });

  const topParams = { limit: 10 };
  const { data: topProducts } = useGetTopProducts(topParams, {
    query: { queryKey: getGetTopProductsQueryKey(topParams), retry: false },
  });

  const stats = [
    { label: "Total Sales", value: formatPrice(analytics?.totalRevenue ?? 0), icon: IndianRupee, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20", href: "/admin/orders" },
    { label: "Total Orders", value: analytics?.totalOrders ?? 0, icon: ShoppingBag, color: "text-saffron-600", bg: "bg-orange-50 dark:bg-orange-900/20", href: "/admin/orders" },
    { label: "Total Users", value: analytics?.totalUsers ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", href: "/admin/users" },
    { label: "Total Products", value: analytics?.totalProducts ?? 0, icon: Package, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", href: "/admin/products" },
    { label: "Pending Orders", value: analytics?.pendingOrders ?? 0, icon: Tag, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", href: "/admin/orders" },
  ];

  const rangeTotalRevenue = (salesRange ?? []).reduce((s, d) => s + Number(d.revenue ?? 0), 0);
  const rangeTotalOrders = (salesRange ?? []).reduce((s, d) => s + Number(d.orders ?? 0), 0);
  const rangeAvgOrderValue = rangeTotalOrders > 0 ? rangeTotalRevenue / rangeTotalOrders : 0;

  const orderStatusData = orderStats ? [
    { status: "Pending", count: orderStats.pending },
    { status: "Confirmed", count: orderStats.confirmed },
    { status: "Processing", count: orderStats.processing },
    { status: "Out", count: orderStats.outForDelivery },
    { status: "Delivered", count: orderStats.delivered },
    { status: "Cancelled", count: orderStats.cancelled },
  ] : [];

  if (authLoading) {
    return (
      <div className="space-y-8">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-32 rounded-xl" />)}
        </div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Welcome back! Here's an overview of your store.</p>
      </div>

      {/* Top stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href}>
            <div className="bg-card border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              {isLoading ? <Skeleton className="h-7 w-16 mb-1" /> : <p className="text-2xl font-bold">{value}</p>}
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Inventory insights */}
      {inventory && (
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
          <InsightCard label="SKUs" value={inventory.totalSkus} icon={Package} color="text-blue-600" bg="bg-blue-50 dark:bg-blue-900/20" />
          <InsightCard label="Stock Units" value={inventory.totalStockUnits} icon={Boxes} color="text-indigo-600" bg="bg-indigo-50 dark:bg-indigo-900/20" />
          <InsightCard label="Inventory Value" value={formatPrice(inventory.inventoryValue)} icon={IndianRupee} color="text-green-600" bg="bg-green-50 dark:bg-green-900/20" />
          <InsightCard label="Low Stock" value={inventory.lowStock} icon={AlertTriangle} color={inventory.lowStock > 0 ? "text-amber-600" : "text-muted-foreground"} bg="bg-amber-50 dark:bg-amber-900/20" />
          <InsightCard label="Out of Stock" value={inventory.outOfStock} icon={AlertTriangle} color={inventory.outOfStock > 0 ? "text-red-600" : "text-muted-foreground"} bg="bg-red-50 dark:bg-red-900/20" />
        </div>
      )}

      {/* Sales by date range */}
      <div className="bg-card border rounded-xl p-5">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
          <div>
            <h2 className="font-semibold">Sales by Date Range</h2>
            <p className="text-xs text-muted-foreground">Day-wise revenue and orders for any window.</p>
          </div>
          <div className="flex flex-wrap items-center gap-1.5">
            {(["7d", "30d", "90d", "ytd"] as Preset[]).map(p => (
              <Button key={p} size="sm" variant={preset === p ? "default" : "outline"} className="h-7 px-2 text-xs" onClick={() => applyPreset(p)}>
                {p === "7d" ? "Last 7 days" : p === "30d" ? "Last 30 days" : p === "90d" ? "Last 90 days" : "Year to date"}
              </Button>
            ))}
            <div className="flex items-center gap-1.5 ml-2 px-2 py-1 border rounded-md">
              <Calendar className="w-3.5 h-3.5 text-muted-foreground" />
              <input type="date" value={from} max={to}
                onChange={e => { setFrom(e.target.value); setPreset("custom"); }}
                className="text-xs bg-transparent border-0 focus:outline-none" />
              <span className="text-xs text-muted-foreground">to</span>
              <input type="date" value={to} min={from} max={fmtDate(today)}
                onChange={e => { setTo(e.target.value); setPreset("custom"); }}
                className="text-xs bg-transparent border-0 focus:outline-none" />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-3 mb-4">
          <SmallStat label="Revenue" value={formatPrice(rangeTotalRevenue)} icon={IndianRupee} />
          <SmallStat label="Orders" value={String(rangeTotalOrders)} icon={ShoppingBag} />
          <SmallStat label="Avg Order Value" value={formatPrice(Math.round(rangeAvgOrderValue))} icon={TrendingUp} />
        </div>

        {salesFetching ? (
          <Skeleton className="h-56 rounded-lg" />
        ) : (salesRange ?? []).length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-12">No sales data for this range.</p>
        ) : (
          <ResponsiveContainer width="100%" height={240}>
            <AreaChart data={salesRange}>
              <defs>
                <linearGradient id="rangeGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#2874F0" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#2874F0" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={v => `₹${v}`} />
              <Tooltip formatter={(v: number, n: string) => n === "revenue" ? [`₹${v}`, "Revenue"] : [v, "Orders"]} />
              <Area type="monotone" dataKey="revenue" stroke="#2874F0" fill="url(#rangeGradient)" strokeWidth={2} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Two-column: Top selling rank + Low stock */}
      <div className="grid lg:grid-cols-2 gap-4">
        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Trophy className="w-4 h-4 text-amber-500" />
            <h2 className="font-semibold">Top Selling Products</h2>
          </div>
          {(topProducts ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">No sales recorded yet.</p>
          ) : (
            <ol className="space-y-2">
              {topProducts!.map((p, i) => (
                <li key={p.productId} className="flex items-center gap-3 p-2 rounded-lg hover:bg-muted/50">
                  <Badge className={`shrink-0 w-7 h-7 flex items-center justify-center text-xs font-bold ${i === 0 ? "bg-amber-500" : i === 1 ? "bg-zinc-400" : i === 2 ? "bg-orange-700" : "bg-muted text-foreground"} text-white border-0`}>
                    #{i + 1}
                  </Badge>
                  {p.image && <img src={p.image} alt={p.name} className="w-10 h-10 rounded-md object-cover" />}
                  <div className="flex-1 min-w-0">
                    <Link href={`/products/${p.productId}`} className="text-sm font-medium hover:text-primary line-clamp-1">{p.name}</Link>
                    <p className="text-xs text-muted-foreground">{p.totalSold} sold · {formatPrice(p.revenue)} revenue</p>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <div className="bg-card border rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <AlertTriangle className="w-4 h-4 text-red-500" />
            <h2 className="font-semibold">Low Stock Alerts</h2>
            {(lowStock?.length ?? 0) > 0 && (
              <Badge variant="destructive" className="text-xs">{lowStock!.length}</Badge>
            )}
          </div>
          {(lowStock ?? []).length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-6">✅ All products well stocked.</p>
          ) : (
            <ul className="divide-y max-h-80 overflow-y-auto">
              {lowStock!.map(p => (
                <li key={p.productId} className="flex items-center gap-3 py-2 first:pt-0 last:pb-0">
                  {p.image && <img src={p.image} alt={p.name} className="w-9 h-9 rounded-md object-cover shrink-0" />}
                  <div className="flex-1 min-w-0">
                    <Link href={`/admin/products`} className="text-sm font-medium hover:text-primary line-clamp-1">{p.name}</Link>
                    <p className="text-xs text-muted-foreground">Threshold: {p.lowStockThreshold}</p>
                  </div>
                  <Badge className={`shrink-0 ${p.stock === 0 ? "bg-red-500 text-white" : "bg-amber-500 text-white"} border-0`}>
                    {p.stock === 0 ? "Out" : `${p.stock} left`}
                  </Badge>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* Existing revenue + status charts */}
      <div className="grid lg:grid-cols-2 gap-4">
        {revenue && revenue.length > 0 && (
          <div className="bg-card border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Revenue Trend (Lifetime)</h2>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={revenue}>
                <defs>
                  <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="hsl(24, 95%, 53%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="date" tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" tickFormatter={v => `₹${v}`} />
                <Tooltip formatter={(v: number) => [`₹${v}`, "Revenue"]} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(24, 95%, 53%)" fill="url(#revenueGradient)" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}

        {orderStatusData.length > 0 && (
          <div className="bg-card border rounded-xl p-5">
            <h2 className="font-semibold mb-4">Orders by Status</h2>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={orderStatusData}>
                <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                <XAxis dataKey="status" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
                <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
                <Tooltip />
                <Bar dataKey="count" fill="#2874F0" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4">
        {[
          { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
          { href: "/admin/products", label: "Products", icon: Package },
          { href: "/admin/banners", label: "Banners", icon: Tag },
          { href: "/admin/coupons", label: "Coupons", icon: Coins },
          { href: "/admin/users", label: "Users", icon: Users },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <div className="bg-card border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer flex flex-col items-center gap-2 text-center">
              <Icon className="w-6 h-6 text-primary" />
              <p className="text-sm font-medium">{label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}

function InsightCard({
  label, value, icon: Icon, color, bg,
}: { label: string; value: number | string; icon: React.ComponentType<{ className?: string }>; color: string; bg: string }) {
  return (
    <div className="bg-card border rounded-xl p-4">
      <div className={`w-9 h-9 rounded-xl ${bg} flex items-center justify-center mb-2`}>
        <Icon className={`w-4 h-4 ${color}`} />
      </div>
      <p className="text-lg font-bold">{value}</p>
      <p className="text-xs text-muted-foreground">{label}</p>
    </div>
  );
}

function SmallStat({
  label, value, icon: Icon,
}: { label: string; value: string; icon: React.ComponentType<{ className?: string }> }) {
  return (
    <div className="bg-muted/40 rounded-lg p-3">
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Icon className="w-3.5 h-3.5" /> {label}
      </div>
      <p className="text-lg font-bold mt-0.5">{value}</p>
    </div>
  );
}
