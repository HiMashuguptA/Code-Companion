import { useState } from "react";
import { useParams, useLocation } from "wouter";
import { ShoppingCart, Star, Package, ArrowLeft, ChevronLeft, ChevronRight, Minus, Plus, MapPin } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useGetProduct, useGetProductReviews, useAddToCart, useCreateReview, useListOrders } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatPrice, formatDate } from "@/lib/utils";
import { toast } from "sonner";

export function ProductDetailPage() {
  const { productId } = useParams<{ productId: string }>();
  const [, navigate] = useLocation();
  const { currentUser, dbUser } = useAuth();
  const [imageIdx, setImageIdx] = useState(0);
  const [qty, setQty] = useState(1);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewTitle, setReviewTitle] = useState("");
  const [reviewBody, setReviewBody] = useState("");

  const { data: product, isLoading } = useGetProduct(productId!, {
    query: { enabled: !!productId }
  });
  const { data: reviews, refetch: refetchReviews } = useGetProductReviews(productId!, {
    query: { enabled: !!productId }
  });
  const { data: myOrders } = useListOrders(undefined, {
    query: { enabled: !!currentUser }
  });
  const addToCart = useAddToCart();
  const createReview = useCreateReview(productId!);

  const canReview = !!myOrders?.orders.some(o =>
    o.status === "DELIVERED" &&
    (o.items as Array<{ productId: string }>).some(i => i.productId === productId)
  ) && !reviews?.some(r => r.userId === dbUser?.id);

  const deliveredOrderId = myOrders?.orders.find(o =>
    o.status === "DELIVERED" &&
    (o.items as Array<{ productId: string }>).some(i => i.productId === productId)
  )?.id;

  const handleAddToCart = () => {
    if (!currentUser) { toast.error("Please sign in"); return; }
    addToCart.mutate(
      { data: { productId: productId!, quantity: qty } },
      {
        onSuccess: () => toast.success(`${qty}x ${product?.name} added to cart`),
        onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed to add"),
      }
    );
  };

  const handleSubmitReview = async () => {
    if (!deliveredOrderId) return;
    createReview.mutate(
      { data: { rating: reviewRating, title: reviewTitle, body: reviewBody, orderId: deliveredOrderId } },
      {
        onSuccess: () => {
          toast.success("Review submitted!");
          setReviewTitle("");
          setReviewBody("");
          refetchReviews();
        },
        onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed to submit"),
      }
    );
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-8">
        <div className="grid md:grid-cols-2 gap-8">
          <Skeleton className="aspect-square rounded-xl" />
          <div className="space-y-4">
            <Skeleton className="h-8 w-3/4" />
            <Skeleton className="h-6 w-1/2" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) return (
    <div className="container mx-auto px-4 py-16 text-center">
      <h2 className="text-xl font-semibold mb-2">Product not found</h2>
      <Button onClick={() => navigate("/products")}>Back to Products</Button>
    </div>
  );

  const images = product.images?.length ? product.images : ["https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=600"];

  return (
    <div className="container mx-auto px-4 py-8">
      <Button variant="ghost" size="sm" onClick={() => navigate("/products")} className="gap-1 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to Products
      </Button>

      <div className="grid md:grid-cols-2 gap-8 mb-12">
        {/* Images */}
        <div>
          <div className="relative rounded-xl overflow-hidden bg-muted aspect-square mb-3">
            <motion.img
              key={imageIdx}
              src={images[imageIdx]}
              alt={product.name}
              className="w-full h-full object-cover"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=600"; }}
            />
            {images.length > 1 && (
              <>
                <button onClick={() => setImageIdx(i => (i - 1 + images.length) % images.length)}
                  className="absolute left-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center shadow">
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button onClick={() => setImageIdx(i => (i + 1) % images.length)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 w-8 h-8 rounded-full bg-background/80 flex items-center justify-center shadow">
                  <ChevronRight className="w-4 h-4" />
                </button>
              </>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2">
              {images.map((img, i) => (
                <button key={i} onClick={() => setImageIdx(i)}
                  className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${i === imageIdx ? "border-primary" : "border-transparent"}`}>
                  <img src={img} alt="" className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=80"; }} />
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          {product.category && (
            <Badge variant="secondary" className="mb-3">{product.category.name}</Badge>
          )}
          <h1 className="text-2xl md:text-3xl font-bold mb-3">{product.name}</h1>

          {/* Rating */}
          {(product.reviewCount ?? 0) > 0 && (
            <div className="flex items-center gap-2 mb-4">
              <div className="flex">
                {[1,2,3,4,5].map(s => (
                  <Star key={s} className={`w-4 h-4 ${s <= Math.round(product.rating ?? 0) ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                ))}
              </div>
              <span className="text-sm text-muted-foreground">{product.rating} ({product.reviewCount} reviews)</span>
            </div>
          )}

          {/* Price */}
          <div className="flex items-baseline gap-3 mb-4">
            <span className="text-3xl font-bold">{formatPrice(product.sellingPrice)}</span>
            {(product.discount ?? 0) > 0 && (
              <>
                <span className="text-lg text-muted-foreground line-through">{formatPrice(product.actualPrice)}</span>
                <Badge className="bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300">{product.discount}% off</Badge>
              </>
            )}
          </div>

          {/* Stock */}
          <div className="flex items-center gap-2 mb-6">
            <Package className="w-4 h-4 text-muted-foreground" />
            {(product.stock ?? 0) > 0 ? (
              <span className="text-sm text-green-600 font-medium">In Stock ({product.stock} available)</span>
            ) : (
              <span className="text-sm text-red-600 font-medium">Out of Stock</span>
            )}
          </div>

          <p className="text-muted-foreground mb-6 leading-relaxed">{product.description}</p>

          {/* Quantity & Cart */}
          {(product.stock ?? 0) > 0 && (
            <div className="flex flex-col sm:flex-row gap-3 mb-6">
              <div className="flex items-center border rounded-lg overflow-hidden">
                <button className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors"
                  onClick={() => setQty(q => Math.max(1, q - 1))}><Minus className="w-4 h-4" /></button>
                <span className="w-12 text-center font-medium">{qty}</span>
                <button className="w-10 h-10 flex items-center justify-center hover:bg-muted transition-colors"
                  onClick={() => setQty(q => Math.min(product.stock ?? 1, q + 1))}><Plus className="w-4 h-4" /></button>
              </div>
              <Button className="flex-1 gap-2" disabled={addToCart.isPending} onClick={handleAddToCart}>
                <ShoppingCart className="w-4 h-4" />
                Add to Cart — {formatPrice(product.sellingPrice * qty)}
              </Button>
            </div>
          )}

          <Separator className="my-6" />
          <div className="space-y-2 text-sm text-muted-foreground">
            <div className="flex items-center gap-2"><MapPin className="w-4 h-4" /> Free delivery on orders above ₹500</div>
          </div>
        </div>
      </div>

      {/* Reviews Tab */}
      <Tabs defaultValue="reviews">
        <TabsList>
          <TabsTrigger value="reviews">Reviews ({reviews?.length ?? 0})</TabsTrigger>
        </TabsList>
        <TabsContent value="reviews" className="mt-6">
          {canReview && (
            <div className="bg-card border rounded-xl p-6 mb-6">
              <h3 className="font-semibold mb-4">Write a Review</h3>
              <div className="flex gap-1 mb-4">
                {[1,2,3,4,5].map(s => (
                  <button key={s} onClick={() => setReviewRating(s)}>
                    <Star className={`w-6 h-6 cursor-pointer ${s <= reviewRating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                  </button>
                ))}
              </div>
              <input
                className="w-full px-3 py-2 mb-3 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Review title (optional)"
                value={reviewTitle}
                onChange={e => setReviewTitle(e.target.value)}
              />
              <textarea
                className="w-full px-3 py-2 mb-3 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[100px]"
                placeholder="Share your experience with this product..."
                value={reviewBody}
                onChange={e => setReviewBody(e.target.value)}
              />
              <Button onClick={handleSubmitReview} disabled={createReview.isPending}>
                Submit Review
              </Button>
            </div>
          )}

          {reviews?.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Star className="w-8 h-8 mx-auto mb-2 opacity-30" />
              <p>No reviews yet. Be the first to review this product!</p>
            </div>
          ) : (
            <div className="space-y-4">
              {reviews?.map(review => (
                <div key={review.id} className="bg-card border rounded-xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-sm font-bold text-primary">
                        {(review.user?.name ?? review.user?.email ?? "U")[0]?.toUpperCase()}
                      </div>
                      <span className="text-sm font-medium">{review.user?.name ?? review.user?.email}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{formatDate(review.createdAt)}</span>
                  </div>
                  <div className="flex gap-1 mb-2">
                    {[1,2,3,4,5].map(s => (
                      <Star key={s} className={`w-4 h-4 ${s <= review.rating ? "fill-yellow-400 text-yellow-400" : "text-gray-300"}`} />
                    ))}
                  </div>
                  {review.title && <p className="font-medium text-sm mb-1">{review.title}</p>}
                  {review.body && <p className="text-sm text-muted-foreground">{review.body}</p>}
                </div>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
