import { Switch, Route, Router as WouterRouter, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect } from "react";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/contexts/FirebaseContext";
import { setBaseUrl } from "@workspace/api-client-react";
import { Navbar } from "@/components/Navbar";
import { Footer } from "@/components/Footer";

import { HomePage } from "@/pages/HomePage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { CartPage } from "@/pages/CartPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { OrderDetailPage } from "@/pages/OrderDetailPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { FavoritesPage } from "@/pages/FavoritesPage";
import { AuthPage } from "@/pages/AuthPage";
import { DeliveryPortal } from "@/pages/DeliveryPortal";
import { DashboardPage } from "@/pages/DashboardPage";
import { ReferEarnPage } from "@/pages/ReferEarnPage";

import { AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminOrders } from "@/pages/admin/AdminOrders";
import { AdminProducts } from "@/pages/admin/AdminProducts";
import { AdminCategories } from "@/pages/admin/AdminCategories";
import { AdminCoupons } from "@/pages/admin/AdminCoupons";
import { AdminBanners } from "@/pages/admin/AdminBanners";
import { AdminUsers } from "@/pages/admin/AdminUsers";

import NotFound from "@/pages/not-found";

// Point API client to backend (URLs already include /api prefix)
const apiUrl = import.meta.env.VITE_API_URL || "";
setBaseUrl(apiUrl || null);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: unknown) => {
        try {
          // Don't retry on auth errors (401, 403)
          const apiError = error as any;
          if (apiError?.status === 401 || apiError?.status === 403) {
            console.log("🚫 Not retrying on auth error (401/403)");
            return false;
          }
          // Don't retry network errors beyond initial attempt
          if (apiError?.message?.includes("Network") || apiError?.message?.includes("fetch")) {
            return failureCount < 1;
          }
        } catch (e) {
          // If error checking fails, don't retry
          return false;
        }
        // Don't retry at all by default - data is already cached
        return false;
      },
      staleTime: 1000 * 60 * 5, // 5 minutes
      gcTime: 1000 * 60 * 10, // 10 minutes
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false,
      refetchInterval: undefined,
    },
  },
});

// Pages that don't need Navbar (auth page)
const NO_NAV_PATHS = ["/auth"];

function Router() {
  return (
    <Switch>
      <Route path="/" component={HomePage} />
      <Route path="/auth" component={AuthPage} />
      <Route path="/products">{() => <ProductsRedirect />}</Route>
      <Route path="/products/:productId" component={ProductDetailPage} />
      <Route path="/cart" component={CartPage} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/orders" component={OrdersPage} />
      <Route path="/orders/:orderId" component={OrderDetailPage} />
      <Route path="/profile" component={ProfilePage} />
      <Route path="/favorites" component={FavoritesPage} />
      <Route path="/dashboard" component={DashboardPage} />
      <Route path="/refer" component={ReferEarnPage} />
      <Route path="/delivery" component={DeliveryPortal} />

      {/* Admin Routes */}
      <Route path="/admin">
        <AdminLayout><AdminDashboard /></AdminLayout>
      </Route>
      <Route path="/admin/orders">
        <AdminLayout><AdminOrders /></AdminLayout>
      </Route>
      <Route path="/admin/orders/:orderId">
        <AdminLayout><OrderDetailPage /></AdminLayout>
      </Route>
      <Route path="/admin/products">
        <AdminLayout><AdminProducts /></AdminLayout>
      </Route>
      <Route path="/admin/categories">
        <AdminLayout><AdminCategories /></AdminLayout>
      </Route>
      <Route path="/admin/coupons">
        <AdminLayout><AdminCoupons /></AdminLayout>
      </Route>
      <Route path="/admin/banners">
        <AdminLayout><AdminBanners /></AdminLayout>
      </Route>
      <Route path="/admin/users">
        <AdminLayout><AdminUsers /></AdminLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function ProductsRedirect() {
  const [location, navigate] = useLocation();
  useEffect(() => {
    const qs = location.split("?")[1];
    navigate(qs ? `/?${qs}` : "/", { replace: true });
  }, [location, navigate]);
  return null;
}

const PROTECTED_PREFIXES = ["/admin", "/account", "/orders", "/cart", "/checkout", "/favorites", "/profile"];

function LogoutHandler() {
  const { currentUser, isLoading } = useAuth();
  const [location, navigate] = useLocation();

  // Only redirect logged-out users away from protected routes
  useEffect(() => {
    if (
      !isLoading &&
      currentUser === null &&
      PROTECTED_PREFIXES.some((p) => location === p || location.startsWith(`${p}/`))
    ) {
      console.log("📍 User logged out, redirecting to home");
      navigate("/");
    }
  }, [currentUser, isLoading, location, navigate]);

  return null;
}

function AppShell() {
  return (
    <Switch>
      <Route path="/auth">{() => <AuthPage />}</Route>
      <Route>{() => (
        <div className="min-h-screen flex flex-col">
          <LogoutHandler />
          <Navbar />
          <main className="flex-1">
            <Router />
          </main>
          <Footer />
        </div>
      )}</Route>
    </Switch>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="light" enableSystem>
        <AuthProvider>
          <WouterRouter base={import.meta.env.BASE_URL?.replace(/\/$/, "") ?? ""}>
            <AppShell />
          </WouterRouter>
          <Toaster richColors position="top-right" />
        </AuthProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
