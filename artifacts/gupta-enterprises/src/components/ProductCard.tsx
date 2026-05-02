import { Link } from "wouter";
import { ShoppingCart, Star, Heart, Plus, Minus, Check } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  useAddToCart, useUpdateCartItem, useRemoveCartItem,
  useCheckFavorite, useAddFavorite, useRemoveFavorite, useGetCart,
  getCheckFavoriteQueryKey, getListFavoritesQueryKey, getGetCartQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";
import { useState, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";

interface Product {
  id: string;
  name: string;
  description: string;
  actualPrice: number;
  sellingPrice: number;
  discount: number;
  images: string[];
  stock: number;
  rating: number;
  reviewCount: number;
}

interface ProductCardProps {
  product: Product;
  index?: number;
}

export function ProductCard({ product, index = 0 }: ProductCardProps) {
  const { currentUser } = useAuth();
  const qc = useQueryClient();
  const [justAdded, setJustAdded] = useState(false);

  const addToCart = useAddToCart();
  const updateCartItem = useUpdateCartItem();
  const removeCartItem = useRemoveCartItem();

  const { data: cart } = useGetCart({
    query: { queryKey: getGetCartQueryKey(), enabled: !!currentUser, retry: false, staleTime: 30000 },
  });

  const { data: favoriteStatus } = useCheckFavorite(product.id, {
    query: { queryKey: getCheckFavoriteQueryKey(product.id), enabled: !!currentUser },
  });
  const addFavorite = useAddFavorite();
  const removeFavorite = useRemoveFavorite();
  const [isFavorited, setIsFavorited] = useState(false);

  useEffect(() => {
    setIsFavorited(favoriteStatus?.isFavorited ?? false);
  }, [favoriteStatus]);

  const cartItem = cart?.items?.find((i: { productId: string }) => i.productId === product.id);
  const cartQty = cartItem?.quantity ?? 0;

  const invalidateCart = () => qc.invalidateQueries({ queryKey: getGetCartQueryKey() });

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUser) { toast.error("Please sign in to add items to cart"); return; }
    addToCart.mutate(
      { data: { productId: product.id, quantity: 1 } },
      {
        onSuccess: () => {
          invalidateCart();
          setJustAdded(true);
          setTimeout(() => setJustAdded(false), 1500);
        },
        onError: () => toast.error("Failed to add to cart"),
      }
    );
  };

  const handleIncrease = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!cartItem) return;
    const newQty = cartQty + 1;
    if (newQty > product.stock) { toast.error("Not enough stock"); return; }
    updateCartItem.mutate(
      { itemId: cartItem.id, data: { quantity: newQty } },
      { onSuccess: invalidateCart, onError: () => toast.error("Failed to update cart") }
    );
  };

  const handleDecrease = (e: React.MouseEvent) => {
    e.preventDefault();
    if (!cartItem) return;
    if (cartQty <= 1) {
      removeCartItem.mutate(
        { itemId: cartItem.id },
        { onSuccess: invalidateCart, onError: () => toast.error("Failed to remove from cart") }
      );
    } else {
      updateCartItem.mutate(
        { itemId: cartItem.id, data: { quantity: cartQty - 1 } },
        { onSuccess: invalidateCart, onError: () => toast.error("Failed to update cart") }
      );
    }
  };

  const handleToggleFavorite = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUser) { toast.error("Please sign in to save products"); return; }
    if (isFavorited) {
      removeFavorite.mutate({ productId: String(product.id) }, {
        onSuccess: () => {
          setIsFavorited(false);
          qc.invalidateQueries({ queryKey: getCheckFavoriteQueryKey(product.id) });
          qc.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
        },
        onError: () => toast.error("Failed to remove from favorites"),
      });
    } else {
      addFavorite.mutate({ data: { productId: String(product.id) } }, {
        onSuccess: () => {
          setIsFavorited(true);
          qc.invalidateQueries({ queryKey: getCheckFavoriteQueryKey(product.id) });
          qc.invalidateQueries({ queryKey: getListFavoritesQueryKey() });
        },
        onError: () => toast.error("Failed to save product"),
      });
    }
  };

  const isPending = addToCart.isPending || updateCartItem.isPending || removeCartItem.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, delay: Math.min(index * 0.04, 0.4) }}
    >
      <Link href={`/products/${product.id}`}>
        <div className="group bg-card border rounded-xl overflow-hidden hover:shadow-lg transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
          {/* Image */}
          <div className="relative aspect-square overflow-hidden bg-muted">
            <img
              src={product.images[0] ?? "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=600"}
              alt={product.name}
              className="w-full h-full object-contain group-hover:scale-105 transition-transform duration-300"
              onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=600"; }}
            />
            {product.discount > 0 && (
              <Badge className="absolute top-2 left-2 bg-green-500 text-white border-0 text-[10px] font-bold">
                {product.discount}% OFF
              </Badge>
            )}
            <button
              onClick={handleToggleFavorite}
              disabled={addFavorite.isPending || removeFavorite.isPending}
              className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/90 flex items-center justify-center shadow-sm hover:scale-110 transition-transform z-10"
            >
              <Heart className={`w-3.5 h-3.5 transition-colors ${isFavorited ? "fill-red-500 text-red-500" : "text-muted-foreground"}`} />
            </button>
            {product.stock === 0 && (
              <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                <Badge variant="secondary" className="text-sm font-medium">Out of Stock</Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-3">
            <h3 className="font-medium text-sm line-clamp-2 leading-snug mb-1">{product.name}</h3>

            {product.reviewCount > 0 && (
              <div className="flex items-center gap-1 mb-1.5">
                <div className="flex items-center gap-0.5 bg-green-500 text-white rounded px-1.5 py-0.5">
                  <span className="text-[10px] font-bold">{product.rating}</span>
                  <Star className="w-2.5 h-2.5 fill-white" />
                </div>
                <span className="text-[10px] text-muted-foreground">({product.reviewCount})</span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-center gap-2 mb-2.5">
              <span className="font-bold text-base text-foreground">{formatPrice(product.sellingPrice)}</span>
              {product.discount > 0 && (
                <span className="text-xs text-muted-foreground line-through">{formatPrice(product.actualPrice)}</span>
              )}
            </div>

            {/* Cart controls */}
            <AnimatePresence mode="wait">
              {cartQty > 0 ? (
                <motion.div
                  key="qty"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                  className="flex items-center justify-between gap-2"
                  onClick={e => e.preventDefault()}
                >
                  <button
                    onClick={handleDecrease}
                    disabled={isPending}
                    className="w-8 h-8 rounded-full border-2 border-primary flex items-center justify-center text-primary hover:bg-primary hover:text-white transition-colors"
                  >
                    <Minus className="w-3.5 h-3.5" />
                  </button>
                  <span className="font-semibold text-sm w-8 text-center">{cartQty}</span>
                  <button
                    onClick={handleIncrease}
                    disabled={isPending || cartQty >= product.stock}
                    className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white hover:bg-primary/90 transition-colors disabled:opacity-40"
                  >
                    <Plus className="w-3.5 h-3.5" />
                  </button>
                </motion.div>
              ) : (
                <motion.div
                  key="add"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  transition={{ duration: 0.15 }}
                >
                  <Button
                    size="sm"
                    className={`w-full gap-1.5 transition-all ${justAdded ? "bg-green-500 hover:bg-green-500" : ""}`}
                    disabled={product.stock === 0 || isPending}
                    onClick={handleAddToCart}
                  >
                    {justAdded ? (
                      <><Check className="w-3.5 h-3.5" /> Added!</>
                    ) : (
                      <><ShoppingCart className="w-3.5 h-3.5" /> Add to Cart</>
                    )}
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
