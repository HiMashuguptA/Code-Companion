import { Link } from "wouter";
import { ShoppingCart, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAddToCart } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";

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
  const addToCart = useAddToCart();

  const handleAddToCart = async (e: React.MouseEvent) => {
    e.preventDefault();
    if (!currentUser) {
      toast.error("Please sign in to add items to cart");
      return;
    }
    addToCart.mutate(
      { data: { productId: product.id, quantity: 1 } },
      {
        onSuccess: () => toast.success(`${product.name} added to cart`),
        onError: () => toast.error("Failed to add to cart"),
      }
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: index * 0.05 }}
    >
      <Link href={`/products/${product.id}`}>
        <div className="group bg-card border rounded-xl overflow-hidden hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 cursor-pointer">
          {/* Image */}
          <div className="relative aspect-square overflow-hidden bg-muted">
            <img
              src={product.images[0] ?? "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=400"}
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=400"; }}
            />
            {product.discount > 0 && (
              <Badge className="absolute top-2 left-2 bg-accent text-accent-foreground">
                {product.discount}% OFF
              </Badge>
            )}
            {product.stock === 0 && (
              <div className="absolute inset-0 bg-black/40 flex items-center justify-center">
                <Badge variant="secondary" className="text-sm">Out of Stock</Badge>
              </div>
            )}
          </div>

          {/* Content */}
          <div className="p-3">
            <h3 className="font-medium text-sm line-clamp-2 leading-snug mb-1">{product.name}</h3>

            {/* Rating */}
            {product.reviewCount > 0 && (
              <div className="flex items-center gap-1 mb-2">
                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                <span className="text-xs text-muted-foreground">{product.rating} ({product.reviewCount})</span>
              </div>
            )}

            {/* Price */}
            <div className="flex items-center gap-2 mb-2">
              <span className="font-bold text-base">{formatPrice(product.sellingPrice)}</span>
              {product.discount > 0 && (
                <span className="text-xs text-muted-foreground line-through">{formatPrice(product.actualPrice)}</span>
              )}
            </div>

            <Button
              size="sm"
              className="w-full gap-1.5"
              disabled={product.stock === 0 || addToCart.isPending}
              onClick={handleAddToCart}
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              Add to Cart
            </Button>
          </div>
        </div>
      </Link>
    </motion.div>
  );
}
