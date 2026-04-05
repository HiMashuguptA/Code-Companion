import { Link } from "wouter";
import { Users, ShoppingBag, Package, Tag, TrendingUp } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetDashboardAnalytics,
  useGetRevenueAnalytics,
  useGetOrderStats,
} from "@workspace/api-client-react";
import { formatPrice } from "@/lib/utils";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from "recharts";

export function AdminDashboard() {
  const { data: dashboard, isLoading: d1 } = useGetDashboardAnalytics();
  const { data: revenue, isLoading: d2 } = useGetRevenueAnalytics({ period: "monthly" });
  const { data: orderStats, isLoading: d3 } = useGetOrderStats();

  const isLoading = d1 || d2 || d3;

  if (isLoading) {
    return (
      <div className="space-y-6">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
        <Skeleton className="h-72 rounded-xl" />
      </div>
    );
  }

  const stats = [
    {
      label: "Total Revenue",
      value: formatPrice(dashboard?.totalRevenue ?? 0),
      sub: `${dashboard?.activeOrders ?? 0} active orders`,
      icon: TrendingUp,
      color: "text-green-600",
      bg: "bg-green-50 dark:bg-green-900/10",
    },
    {
      label: "Total Orders",
      value: dashboard?.totalOrders ?? 0,
      sub: `${dashboard?.pendingOrders ?? 0} pending`,
      icon: ShoppingBag,
      color: "text-blue-600",
      bg: "bg-blue-50 dark:bg-blue-900/10",
    },
    {
      label: "Total Products",
      value: dashboard?.totalProducts ?? 0,
      sub: "in catalogue",
      icon: Package,
      color: "text-orange-600",
      bg: "bg-orange-50 dark:bg-orange-900/10",
    },
    {
      label: "Total Users",
      value: dashboard?.totalUsers ?? 0,
      sub: "registered",
      icon: Users,
      color: "text-purple-600",
      bg: "bg-purple-50 dark:bg-purple-900/10",
    },
  ];

  const revenueData = revenue ?? [];
  const orderStatusData = orderStats ?? [];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map(({ label, value, sub, icon: Icon, color, bg }) => (
          <div key={label} className="bg-card border rounded-xl p-5">
            <div className={`w-10 h-10 rounded-xl ${bg} flex items-center justify-center mb-3`}>
              <Icon className={`w-5 h-5 ${color}`} />
            </div>
            <p className="text-2xl font-bold mb-1">{value}</p>
            <p className="text-xs text-muted-foreground font-medium">{label}</p>
            <p className="text-xs text-muted-foreground mt-1">{sub}</p>
          </div>
        ))}
      </div>

      {/* Revenue Chart */}
      {revenueData.length > 0 && (
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Revenue Overview</h2>
          <ResponsiveContainer width="100%" height={250}>
            <BarChart data={revenueData}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis dataKey="period" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" tickFormatter={(v: number) => `₹${(v / 1000).toFixed(0)}k`} />
              <Tooltip
                formatter={(v: unknown) => [formatPrice(v as number), "Revenue"]}
                labelStyle={{ color: "hsl(var(--foreground))" }}
                contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }}
              />
              <Bar dataKey="revenue" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Order Status Chart */}
      {orderStatusData.length > 0 && (
        <div className="bg-card border rounded-xl p-5">
          <h2 className="font-semibold mb-4">Orders by Status</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={orderStatusData} layout="vertical">
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" />
              <XAxis type="number" tick={{ fontSize: 12 }} stroke="hsl(var(--muted-foreground))" />
              <YAxis dataKey="status" type="category" tick={{ fontSize: 11 }} width={120} stroke="hsl(var(--muted-foreground))" />
              <Tooltip contentStyle={{ backgroundColor: "hsl(var(--card))", border: "1px solid hsl(var(--border))", borderRadius: "8px" }} />
              <Bar dataKey="count" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Quick Actions */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {[
          { href: "/admin/orders", label: "Manage Orders", icon: ShoppingBag },
          { href: "/admin/products", label: "Manage Products", icon: Package },
          { href: "/admin/users", label: "Manage Users", icon: Users },
          { href: "/admin/coupons", label: "Manage Coupons", icon: Tag },
        ].map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href}>
            <div className="bg-card border rounded-xl p-4 hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 cursor-pointer text-center group">
              <Icon className="w-6 h-6 mx-auto mb-2 text-muted-foreground group-hover:text-primary-foreground" />
              <p className="text-sm font-medium">{label}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
