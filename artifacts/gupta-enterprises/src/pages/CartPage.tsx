import { useState } from "react";
import { Link, useLocation } from "wouter";
import { Trash2, ShoppingBag, Tag, ChevronRight, Minus, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Skeleton } from "@/components/ui/skeleton";
import {
  useGetCart, useUpdateCartItem, useRemoveCartItem, useClearCart, useApplyCoupon,
  getGetCartQueryKey
} from "@workspace/api-client-react";
import type { CartItem } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/AuthContext";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function CartPage() {
  const [, navigate] = useLocation();
  const { currentUser, isLoading: authLoading } = useAuth();
  const [couponCode, setCouponCode] = useState("");
  const queryClient = useQueryClient();

  const { data: cart, isLoading } = useGetCart({
    query: {
      queryKey: getGetCartQueryKey(),
      enabled: !!currentUser,
      retry: false,
      // Real-time cart sync: poll while user is on cart page so changes
      // from other tabs/devices appear within a few seconds.
      refetchInterval: 5000,
      refetchOnWindowFocus: true,
    },
  });
  const updateItem = useUpdateCartItem();
  const removeItem = useRemoveCartItem();
  const clearCart = useClearCart();
  const applyCoupon = useApplyCoupon();

  // Show skeleton while auth is loading
  if (authLoading || isLoading) return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <Skeleton className="h-8 w-32 mb-6" />
      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-4">{[1,2,3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}</div>
        <Skeleton className="h-64 rounded-xl" />
      </div>
    </div>
  );

  // Show sign in page only after auth loading completes and no user
  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <ShoppingBag className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-semibold mb-2">Sign in to view your cart</h2>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  const items = cart?.items ?? [];

  if (items.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-md">
        <ShoppingBag className="w-20 h-20 mx-auto mb-4 text-muted-foreground opacity-20" />
        <h2 className="text-2xl font-bold mb-2">Your cart is empty</h2>
        <p className="text-muted-foreground mb-6">Looks like you haven't added anything yet.</p>
        <Button size="lg" onClick={() => navigate("/products")}>Start Shopping</Button>
      </div>
    );
  }

  const handleUpdateQty = (itemId: string, qty: number) => {
    if (qty < 1) return;
    // Optimistic update: update UI immediately
    const existing = queryClient.getQueryData<typeof cart>(getGetCartQueryKey());
    if (existing) {
      const updatedItems = (existing.items as Array<CartItem & { product?: { images?: string[]; name?: string } }>).map(it =>
        it.id === itemId ? { ...it, quantity: qty, total: it.price * qty } : it
      );
      queryClient.setQueryData(getGetCartQueryKey(), {
        ...existing,
        items: updatedItems,
        itemCount: updatedItems.reduce((s, it) => s + it.quantity, 0),
        subtotal: updatedItems.reduce((s, it) => s + it.price * it.quantity, 0),
        total: updatedItems.reduce((s, it) => s + it.price * it.quantity, 0) - (existing.discount ?? 0) - (existing.couponDiscount ?? 0),
      });
    }
    updateItem.mutate({ itemId, data: { quantity: qty } }, {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() }),
      onError: () => {
        toast.error("Failed to update quantity");
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      },
    });
  };

  const handleRemove = (itemId: string) => {
    // Optimistic update: remove immediately from UI
    const existing = queryClient.getQueryData<typeof cart>(getGetCartQueryKey());
    if (existing) {
      const updatedItems = (existing.items as Array<CartItem & { product?: { images?: string[]; name?: string } }>).filter(it => it.id !== itemId);
      queryClient.setQueryData(getGetCartQueryKey(), {
        ...existing,
        items: updatedItems,
        itemCount: updatedItems.reduce((s, it) => s + it.quantity, 0),
        subtotal: updatedItems.reduce((s, it) => s + it.price * it.quantity, 0),
        total: updatedItems.reduce((s, it) => s + it.price * it.quantity, 0) - (existing.discount ?? 0) - (existing.couponDiscount ?? 0),
      });
    }
    removeItem.mutate({ itemId }, {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast.success("Item removed from cart");
      },
      onError: () => {
        toast.error("Failed to remove item");
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      },
    });
  };

  const handleApplyCoupon = () => {
    if (!couponCode.trim()) return;
    applyCoupon.mutate({ data: { code: couponCode.toUpperCase() } }, {
      onSuccess: () => {
        toast.success("Coupon applied successfully!");
        queryClient.invalidateQueries({ queryKey: getGetCartQueryKey() });
      },
      onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Invalid coupon"),
    });
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Shopping Cart ({cart?.itemCount})</h1>
        <Button variant="ghost" size="sm" onClick={() => clearCart.mutate(undefined)}>Clear All</Button>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        <div className="md:col-span-2 space-y-3">
          {items.map((item: CartItem) => (
            <div key={item.id} className="bg-card border rounded-xl p-4 flex gap-4">
              <Link href={`/products/${item.productId}`}>
                <img
                  src={item.product?.images?.[0] ?? "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=100"}
                  alt={item.product?.name}
                  className="w-20 h-20 rounded-lg object-cover shrink-0 cursor-pointer hover:opacity-90 transition-opacity"
                  onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=100"; }}
                />
              </Link>
              <div className="flex-1 min-w-0">
                <Link href={`/products/${item.productId}`}>
                  <h3 className="font-medium text-sm line-clamp-2 cursor-pointer hover:text-[#2874F0] transition-colors">{item.product?.name}</h3>
                </Link>
                <p className="text-sm font-bold mt-1">{formatPrice(item.price)}</p>
              </div>
              <div className="flex flex-col items-end gap-3">
                <button onClick={() => handleRemove(item.id)} disabled={removeItem.isPending} className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50">
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="flex items-center border rounded-lg">
                  <button className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50" onClick={() => handleUpdateQty(item.id, item.quantity - 1)} disabled={updateItem.isPending || item.quantity <= 1}>
                    <Minus className="w-3 h-3" />
                  </button>
                  <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                  <button className="w-8 h-8 flex items-center justify-center hover:bg-muted transition-colors disabled:opacity-50" onClick={() => handleUpdateQty(item.id, item.quantity + 1)} disabled={updateItem.isPending}>
                    <Plus className="w-3 h-3" />
                  </button>
                </div>
                <span className="text-sm font-semibold">{formatPrice(item.price * item.quantity)}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card border rounded-xl p-5 h-fit sticky top-24">
          <h2 className="font-semibold text-lg mb-4">Order Summary</h2>
          <div className="space-y-2 text-sm mb-4">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Subtotal ({cart?.itemCount} items)</span>
              <span>{formatPrice(cart?.subtotal ?? 0)}</span>
            </div>
            {(cart?.discount ?? 0) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Discount</span><span>-{formatPrice(cart?.discount ?? 0)}</span>
              </div>
            )}
            {(cart?.couponDiscount ?? 0) > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Coupon ({cart?.couponCode})</span><span>-{formatPrice(cart?.couponDiscount ?? 0)}</span>
              </div>
            )}
            <div className="flex justify-between text-muted-foreground">
              <span>Delivery</span>
              <span className="text-green-600">{(cart?.subtotal ?? 0) >= 500 ? "Free" : formatPrice(50)}</span>
            </div>
            <Separator />
            <div className="flex justify-between font-bold text-base">
              <span>Total</span>
              <span>{formatPrice((cart?.total ?? 0) + ((cart?.subtotal ?? 0) < 500 ? 50 : 0))}</span>
            </div>
          </div>

          {!cart?.couponCode && (
            <div className="mb-4">
              <div className="flex gap-2">
                <div className="relative flex-1">
                  <Tag className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                  <input type="text" placeholder="Coupon code"
                    className="w-full pl-9 pr-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    value={couponCode} onChange={e => setCouponCode(e.target.value.toUpperCase())} />
                </div>
                <Button size="sm" variant="outline" onClick={handleApplyCoupon} disabled={applyCoupon.isPending}>Apply</Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">Try WELCOME100, SAVE50</p>
            </div>
          )}

          {cart?.couponCode && (
            <div className="flex items-center justify-between mb-4 bg-green-50 rounded-lg px-3 py-2">
              <div className="flex items-center gap-2">
                <Tag className="w-4 h-4 text-green-600" />
                <span className="text-sm font-medium text-green-700">{cart.couponCode} applied</span>
              </div>
              <Badge variant="secondary" className="text-green-700 bg-green-100">-{formatPrice(cart.couponDiscount)}</Badge>
            </div>
          )}

          <Button className="w-full gap-2 mt-2" size="lg" onClick={() => navigate("/checkout")}>
            Proceed to Checkout <ChevronRight className="w-4 h-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
