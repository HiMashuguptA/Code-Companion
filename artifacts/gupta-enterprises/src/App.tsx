import { Switch, Route, Router as WouterRouter } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { ThemeProvider } from "next-themes";
import { AuthProvider } from "@/contexts/FirebaseContext";
import { setBaseUrl } from "@workspace/api-client-react";
import { Navbar } from "@/components/Navbar";

import { HomePage } from "@/pages/HomePage";
import { ProductsPage } from "@/pages/ProductsPage";
import { ProductDetailPage } from "@/pages/ProductDetailPage";
import { CartPage } from "@/pages/CartPage";
import { CheckoutPage } from "@/pages/CheckoutPage";
import { OrdersPage } from "@/pages/OrdersPage";
import { OrderDetailPage } from "@/pages/OrderDetailPage";
import { ProfilePage } from "@/pages/ProfilePage";
import { AuthPage } from "@/pages/AuthPage";
import { DeliveryPortal } from "@/pages/DeliveryPortal";

import { AdminLayout } from "@/pages/admin/AdminLayout";
import { AdminDashboard } from "@/pages/admin/AdminDashboard";
import { AdminOrders } from "@/pages/admin/AdminOrders";
import { AdminProducts } from "@/pages/admin/AdminProducts";
import { AdminCoupons } from "@/pages/admin/AdminCoupons";
import { AdminUsers } from "@/pages/admin/AdminUsers";

import NotFound from "@/pages/not-found";

// Point API client to backend
const origin = window.location.origin;
const basePath = import.meta.env.BASE_URL?.replace(/\/$/, "") ?? "";
setBaseUrl(`${origin}${basePath}/api`);

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30_000,
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
      <Route path="/products" component={ProductsPage} />
      <Route path="/products/:productId" component={ProductDetailPage} />
      <Route path="/cart" component={CartPage} />
      <Route path="/checkout" component={CheckoutPage} />
      <Route path="/orders" component={OrdersPage} />
      <Route path="/orders/:orderId" component={OrderDetailPage} />
      <Route path="/profile" component={ProfilePage} />
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
      <Route path="/admin/coupons">
        <AdminLayout><AdminCoupons /></AdminLayout>
      </Route>
      <Route path="/admin/users">
        <AdminLayout><AdminUsers /></AdminLayout>
      </Route>

      <Route component={NotFound} />
    </Switch>
  );
}

function AppShell() {
  return (
    <Switch>
      <Route path="/auth">{() => <AuthPage />}</Route>
      <Route>{() => (
        <div className="min-h-screen flex flex-col">
          <Navbar />
          <main className="flex-1">
            <Router />
          </main>
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
