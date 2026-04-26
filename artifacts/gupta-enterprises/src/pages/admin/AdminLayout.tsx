import { Link, useLocation } from "wouter";
import { LayoutDashboard, Package, ShoppingBag, Users, Tag, ChevronRight, RotateCw, Image as ImageIcon } from "lucide-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { Button } from "@/components/ui/button";
import { useState, useMemo } from "react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

const navItems = [
  { href: "/admin", label: "Dashboard", icon: LayoutDashboard, exact: true },
  { href: "/admin/orders", label: "Orders", icon: ShoppingBag },
  { href: "/admin/products", label: "Products", icon: Package },
  { href: "/admin/categories", label: "Categories", icon: Tag },
  { href: "/admin/users", label: "Users", icon: Users },
  { href: "/admin/coupons", label: "Coupons", icon: Tag },
  { href: "/admin/banners", label: "Banners", icon: ImageIcon },
];

export function AdminLayout({ children }: AdminLayoutProps) {
  const [location, navigate] = useLocation();
  const { dbUser, refetchProfile, isLoading } = useAuth();
  const [isRefetching, setIsRefetching] = useState(false);

  // Check access once, don't re-evaluate on every render
  const hasAdminAccess = useMemo(() => dbUser?.role === "ADMIN", [dbUser?.role]);

  const handleRefreshProfile = async () => {
    setIsRefetching(true);
    try {
      await refetchProfile();
      console.log("✅ Profile refreshed successfully");
    } catch (err) {
      console.error("❌ Failed to refresh profile:", err);
    } finally {
      setIsRefetching(false);
    }
  };

  if (!hasAdminAccess) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <h2 className="text-xl font-bold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">You don't have permission to access the admin panel.</p>
        <p className="text-sm text-muted-foreground mb-6">Current role: <span className="font-medium">{dbUser?.role || "Loading..."}</span></p>
        <div className="flex gap-2 justify-center">
          <Button onClick={() => navigate("/")}>Go Home</Button>
          <Button variant="outline" onClick={handleRefreshProfile} disabled={isRefetching}>
            <RotateCw className="w-4 h-4 mr-2" />
            {isRefetching ? "Refreshing..." : "Refresh Profile"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="flex flex-col md:flex-row gap-6">
        {/* Sidebar */}
        <aside className="md:w-48 shrink-0">
          <div className="bg-card border rounded-xl p-2 md:sticky md:top-24">
            <p className="text-xs font-semibold text-muted-foreground px-3 py-2">ADMIN PANEL</p>
            <nav className="space-y-0.5">
              {navItems.map(({ href, label, icon: Icon, exact }) => {
                const isActive = exact ? location === href : location.startsWith(href);
                return (
                  <Link key={href} href={href}>
                    <div className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm cursor-pointer transition-colors ${isActive ? "bg-primary text-primary-foreground font-medium" : "hover:bg-muted text-muted-foreground hover:text-foreground"}`}>
                      <Icon className="w-4 h-4 shrink-0" />
                      {label}
                      {isActive && <ChevronRight className="w-3 h-3 ml-auto" />}
                    </div>
                  </Link>
                );
              })}
            </nav>
          </div>
        </aside>

        {/* Content */}
        <main className="flex-1 min-w-0">{children}</main>
      </div>
    </div>
  );
}
