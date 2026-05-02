import { useState, useEffect } from "react";
import { useRoute, useLocation } from "wouter";
import { Star, ShoppingCart, Heart, ArrowLeft, Tag, CheckCircle, Zap } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  useGetProduct, useGetProductReviews, useListOrders, useAddToCart, useCreateReview,
  useCheckFavorite, useAddFavorite, useRemoveFavorite,
  getGetProductQueryKey, getGetProductReviewsQueryKey, getListOrdersQueryKey, getGetCartQueryKey,
  getCheckFavoriteQueryKey, getListFavoritesQueryKey
} from "@workspace/api-client-react";
import type { Review } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";
import { formatPrice, formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

export function ProductDetailPage() {
  const [, params] = useRoute("/products/:id");
  const [, navigate] = useLocation();
  const { currentUser } = useAuth();
  const productId = params?.id ?? "";
  const qc = useQueryClient();

  const { data: product, isLoading } = useGetProduct(productId, {
    query: { 
      queryKey: getGetProductQueryKey(productId), 
      enabled: !!productId,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false
    }
  });
  const { data: reviews } = useGetProductReviews(productId, {
    query: { 
      queryKey: getGetProductReviewsQueryKey(productId), 
      enabled: !!productId,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false
    }
  });
  const { data: ordersData } = useListOrders(undefined, {
    query: { 
      queryKey: getListOrdersQueryKey(), 
      enabled: !!currentUser,
      retry: false,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false
    }
  });

  const { track: trackRecentlyViewed } = useRecentlyViewed();
  useEffect(() => {
    if (productId) trackRecentlyViewed(productId);
  }, [productId, trackRecentlyViewed]);

  const addToCart = useAddToCart();
  const createReview = useCreateReview();
  const { data: favoriteStatus } = useCheckFavorite(productId, {
    query: { queryKey: getCheckFavoriteQueryKey(productId), enabled: !!currentUser && !!productId }
  });
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();

  const [qty, setQty] = useState(1);
  const [imgIdx, setImgIdx] = useState(0);
  const [isFavorited, setIsFavorited] = useState(false);
  const [reviewForm, setReviewForm] = useState({ rating: 5, title: "", body: "", orderId: "" });
  const [showReviewForm, setShowReviewForm] = useState(false);

  useEffect(() => {
    setIsFavorited(favoriteStatus?.isFavorited ?? false);
  }, [favoriteStatus]);

  const handleToggleFavorite = () => {
    if (!currentUser) { navigate("/auth"); return; }

    if (isFavorited) {
      removeFavorite.mutate({ productId }, {
        onSuccess: () => {
          setIsFavorited(false);
          qc.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
          toast.success("Removed from favorites");
        },
        onError: () => toast.error("Failed to remove from favorites"),
      });
    } else {
      addFavorite.mutate({ data: { productId } }, {
        onSuccess: () => {
          setIsFavorited(true);
          qc.invalidateQueries({ queryKey: getGetProductQueryKey(productId) });
          toast.success("Added to favorites!");
        },
        onError: () => toast.error("Failed to add to favorites"),
      });
    }
  };

  const deliveredOrders = ordersData?.orders?.filter((o) => o.status === "DELIVERED") ?? [];
  const hasPurchased = deliveredOrders.some((o) =>
    o.items?.some((i: { productId: string }) => i.productId === productId)
  );
  const hasReviewed = reviews?.some((r: Review) => r.userId === currentUser?.uid);

  const handleAddToCart = () => {
    if (!currentUser) { navigate("/auth"); return; }
    addToCart.mutate({ data: { productId, quantity: qty } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetCartQueryKey() });
        toast.success(`${product?.name ?? "Item"} added to cart!`);
      },
      onError: () => toast.error("Failed to add to cart"),
    });
  };

  const handleBuyNow = () => {
    if (!currentUser) { navigate("/auth"); return; }
    addToCart.mutate({ data: { productId, quantity: qty } }, {
      onSuccess: () => {
        qc.invalidateQueries({ queryKey: getGetCartQueryKey() });
        navigate("/checkout");
      },
      onError: () => toast.error("Couldn't start checkout. Please try again."),
    });
  };

  const handleSubmitReview = () => {
    if (!currentUser) { navigate("/auth"); return; }
    createReview.mutate({
      productId,
      data: { rating: reviewForm.rating, title: reviewForm.title, body: reviewForm.body, orderId: reviewForm.orderId }
    }, {
      onSuccess: () => {
        toast.success("Review submitted!");
        setShowReviewForm(false);
        qc.invalidateQueries({ queryKey: getGetProductReviewsQueryKey(productId) });
      },
      onError: () => toast.error("Failed to submit review"),
    });
  };

  if (isLoading) return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <div className="grid md:grid-cols-2 gap-8">
        <Skeleton className="aspect-square rounded-2xl" />
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-6 w-1/4" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      </div>
    </div>
  );

  if (!product) return (
    <div className="container mx-auto px-4 py-16 text-center">
      <p className="text-muted-foreground">Product not found.</p>
      <Button variant="ghost" onClick={() => navigate("/products")} className="mt-4">
        <ArrowLeft className="w-4 h-4 mr-2" />Back to Products
      </Button>
    </div>
  );

  const images = product.images && product.images.length > 0
    ? product.images
    : ["https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=600"];
  const discountPct = (product as any).actualPrice && (product as any).actualPrice > product.sellingPrice
    ? Math.round((1 - product.sellingPrice / (product as any).actualPrice) * 100) : null;
  const avgRating = reviews?.length
    ? reviews.reduce((s: number, r: Review) => s + r.rating, 0) / reviews.length : 0;

  return (
    <div className="container mx-auto px-4 py-8 max-w-5xl">
      <Button variant="ghost" size="sm" onClick={() => navigate("/products")} className="mb-6 gap-1.5">
        <ArrowLeft className="w-4 h-4" /> Back
      </Button>

      <div className="grid md:grid-cols-2 gap-8 mb-10">
        <div>
          <div className="relative aspect-square rounded-2xl overflow-hidden bg-muted mb-3">
            <img src={images[imgIdx]} alt={product.name} className="w-full h-full object-cover" />
            {discountPct && <Badge className="absolute top-3 left-3 bg-red-500">{discountPct}% OFF</Badge>}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img: string, i: number) => (
                <button key={i} onClick={() => setImgIdx(i)}
                  className={`w-16 h-16 rounded-xl overflow-hidden border-2 transition-all ${imgIdx === i ? "border-primary" : "border-border"}`}>
                  <img src={img} alt="" className="w-full h-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-col">
          <div className="flex items-start justify-between gap-2 mb-2">
            <h1 className="text-2xl font-bold leading-tight">{product.name}</h1>
            <Button 
              variant="ghost" 
              size="icon" 
              className={`shrink-0 cursor-pointer ${isFavorited ? "text-red-500 hover:text-red-600" : "text-muted-foreground hover:text-red-500"}`}
              onClick={handleToggleFavorite}
              disabled={addFavorite.isPending || removeFavorite.isPending}
            >
              <Heart className={`w-5 h-5 ${isFavorited ? "fill-red-500" : ""}`} />
            </Button>
          </div>

          {reviews && reviews.length > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className={`w-4 h-4 ${s <= avgRating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">({reviews.length} review{reviews.length !== 1 ? "s" : ""})</span>
            </div>
          )}

          <div className="flex items-center gap-3 mb-4">
            <span className="text-3xl font-bold text-primary">{formatPrice(product.sellingPrice)}</span>
            {(product as any).actualPrice && (product as any).actualPrice > product.sellingPrice && (
              <span className="text-lg line-through text-muted-foreground">{formatPrice((product as any).actualPrice)}</span>
            )}
          </div>


          <p className="text-sm text-muted-foreground leading-relaxed mb-6">{product.description}</p>

          <div className="flex items-center gap-3 mb-6">
            <div className="flex items-center border rounded-xl overflow-hidden">
              <button className="w-10 h-10 flex items-center justify-center hover:bg-muted text-lg font-bold"
                onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
              <span className="w-12 text-center font-medium">{qty}</span>
              <button className="w-10 h-10 flex items-center justify-center hover:bg-muted text-lg font-bold"
                onClick={() => setQty(q => Math.min(product.stock ?? 99, q + 1))}>+</button>
            </div>
            {product.stock !== undefined && (
              <span className="text-sm text-muted-foreground">
                {product.stock > 0 ? `${product.stock} in stock` : "Out of stock"}
              </span>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <Button
              variant="outline"
              className="gap-2 border-primary/40 text-primary hover:bg-primary/5"
              size="lg"
              onClick={handleAddToCart}
              disabled={addToCart.isPending || product.stock === 0}
            >
              <ShoppingCart className="w-5 h-5" />
              {product.stock === 0 ? "Out of Stock" : addToCart.isPending ? "Adding..." : "Add to Cart"}
            </Button>
            <Button
              className="gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-md"
              size="lg"
              onClick={handleBuyNow}
              disabled={addToCart.isPending || product.stock === 0}
            >
              <Zap className="w-5 h-5 fill-white" /> Buy Now
            </Button>
          </div>

          {product.stock !== undefined && product.stock <= 5 && product.stock > 0 && (
            <p className="text-xs text-orange-500 mt-2">⚠️ Only {product.stock} left!</p>
          )}

          <Separator className="my-6" />

          <div className="text-sm space-y-1.5 text-muted-foreground">
            <p>✅ Free delivery on orders over ₹500</p>
            <p>📦 Usually delivered within 1–2 business days</p>
            <p>🔄 Easy returns within 2 days of delivery</p>
          </div>
        </div>
      </div>

      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">Reviews ({reviews?.length ?? 0})</TabsTrigger>
          <TabsTrigger value="details">Product Details</TabsTrigger>
        </TabsList>
        <TabsContent value="reviews" className="mt-4">
          {hasPurchased && !hasReviewed && (
            <div className="mb-6 bg-card border rounded-xl p-4">
              {!showReviewForm ? (
                <Button onClick={() => setShowReviewForm(true)} variant="outline" className="gap-2">
                  <Star className="w-4 h-4" /> Write a Review
                </Button>
              ) : (
                <div className="space-y-3">
                  <h3 className="font-medium">Your Review</h3>
                  <div className="flex gap-1">
                    {[1,2,3,4,5].map(s => (
                      <button key={s} onClick={() => setReviewForm(f => ({ ...f, rating: s }))}>
                        <Star className={`w-6 h-6 ${s <= reviewForm.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                      </button>
                    ))}
                  </div>
                  <input className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="Title" value={reviewForm.title}
                    onChange={e => setReviewForm(f => ({ ...f, title: e.target.value }))} />
                  <textarea className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                    rows={3} placeholder="Share your experience..." value={reviewForm.body}
                    onChange={e => setReviewForm(f => ({ ...f, body: e.target.value }))} />
                  {deliveredOrders.length > 0 && (
                    <select className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                      value={reviewForm.orderId} onChange={e => setReviewForm(f => ({ ...f, orderId: e.target.value }))}>
                      <option value="">Select order (optional)</option>
                      {deliveredOrders.map((o) => <option key={o.id} value={o.id}>Order #{o.id.slice(-6)}</option>)}
                    </select>
                  )}
                  <div className="flex gap-2">
                    <Button size="sm" onClick={handleSubmitReview} disabled={createReview.isPending}>Submit</Button>
                    <Button size="sm" variant="ghost" onClick={() => setShowReviewForm(false)}>Cancel</Button>
                  </div>
                </div>
              )}
            </div>
          )}

          {!reviews?.length ? (
            <p className="text-muted-foreground text-sm py-8 text-center">No reviews yet. Be the first!</p>
          ) : (
            <div className="space-y-4">
              {reviews?.map((r: Review) => (
                <div key={r.id} className="bg-card border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold">
                        {(r.user?.name ?? "U")[0]}
                      </div>
                      <span className="font-medium text-sm">{r.user?.name ?? "Verified Buyer"}</span>
                      <CheckCircle className="w-3.5 h-3.5 text-green-500" />
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(r.createdAt ?? "")}</span>
                  </div>
                  <div className="flex mb-1.5">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-4 h-4 ${s <= r.rating ? "fill-amber-400 text-amber-400" : "text-muted-foreground"}`} />
                    ))}
                  </div>
                  {r.title && <p className="font-medium text-sm mb-1">{r.title}</p>}
                  {r.body && <p className="text-sm text-muted-foreground">{r.body}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
        <TabsContent value="details" className="mt-4">
          <div className="bg-card border rounded-xl p-4 text-sm space-y-2">
            <p className="text-muted-foreground leading-relaxed">{product.description}</p>
            {product.category?.name && <p><span className="font-medium">Category:</span> {product.category.name}</p>}
            <p><span className="font-medium">In Stock:</span> {product.stock} units</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
