import { Link } from "wouter";
import { Users, ShoppingBag, Package, Tag, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetDashboardAnalytics, useGetRevenueAnalytics, useGetOrderStats,
  getGetDashboardAnalyticsQueryKey, getGetRevenueAnalyticsQueryKey, getGetOrderStatsQueryKey
} from "@workspace/api-client-react";
import { formatPrice } from "@/lib/utils";
import {
  ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid,
  BarChart, Bar
} from "recharts";

export function AdminDashboard() {
  const { data: analytics, isLoading } = useGetDashboardAnalytics({
    query: { queryKey: getGetDashboardAnalyticsQueryKey() }
  });
  const { data: revenue } = useGetRevenueAnalytics({
    query: { queryKey: getGetRevenueAnalyticsQueryKey() }
  });
  const { data: orderStats } = useGetOrderStats({
    query: { queryKey: getGetOrderStatsQueryKey() }
  });

  const stats = [
    { label: "Total Users", value: analytics?.totalUsers ?? 0, icon: Users, color: "text-blue-600", bg: "bg-blue-50 dark:bg-blue-900/20", href: "/admin/users" },
    { label: "Total Orders", value: analytics?.totalOrders ?? 0, icon: ShoppingBag, color: "text-saffron-600", bg: "bg-orange-50 dark:bg-orange-900/20", href: "/admin/orders" },
    { label: "Total Products", value: analytics?.totalProducts ?? 0, icon: Package, color: "text-purple-600", bg: "bg-purple-50 dark:bg-purple-900/20", href: "/admin/products" },
    { label: "Total Revenue", value: formatPrice(analytics?.totalRevenue ?? 0), icon: TrendingUp, color: "text-green-600", bg: "bg-green-50 dark:bg-green-900/20", href: "/admin/orders" },
    { label: "Active Coupons", value: analytics?.activeCoupons ?? 0, icon: Tag, color: "text-amber-600", bg: "bg-amber-50 dark:bg-amber-900/20", href: "/admin/coupons" },
  ];

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-2xl font-bold">Dashboard</h1>
        <p className="text-muted-foreground text-sm">Welcome back! Here's an overview.</p>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {stats.map(({ label, value, icon: Icon, color, bg, href }) => (
          <Link key={label} href={href}>
            <div className="bg-card border rounded-xl p-4 hover:shadow-md transition-all cursor-pointer">
              <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${color}`} />
              </div>
              {isLoading ? (
                <Skeleton className="h-7 w-16 mb-1" />
              ) : (
                <p className="text-2xl font-bold">{value}</p>
              )}
              <p className="text-xs text-muted-foreground">{label}</p>
            </div>
          </Link>
        ))}
      </div>

      {/* Revenue chart */}
      {revenue?.data && revenue.data.length > 0 && (
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Revenue Trend</h2>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={revenue.data}>
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

      {/* Order stats chart */}
      {orderStats?.data && orderStats.data.length > 0 && (
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Orders by Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={orderStats.data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey="status" tick={{ fontSize: 10 }} className="fill-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="fill-muted-foreground" />
              <Tooltip />
              <Bar dataKey="count" fill="hsl(24, 95%, 53%)" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { href: "/admin/orders", label: "Manage Orders", icon: ShoppingBag },
          { href: "/admin/products", label: "Manage Products", icon: Package },
          { href: "/admin/coupons", label: "Manage Coupons", icon: Tag },
          { href: "/admin/users", label: "Manage Users", icon: Users },
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
