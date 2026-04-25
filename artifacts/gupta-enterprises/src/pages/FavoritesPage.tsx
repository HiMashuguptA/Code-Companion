import { Heart, ShoppingBag } from "lucide-react";
import { useLocation } from "wouter";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { useListFavorites } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { ProductCard } from "@/components/ProductCard";

export function FavoritesPage() {
  const [, navigate] = useLocation();
  const { currentUser, isLoading: authLoading } = useAuth();

  const { data: favorites = [], isLoading } = useListFavorites({
    query: { enabled: !!currentUser, retry: false }
  });

  // Show skeleton while auth is loading
  if (authLoading || isLoading) return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <Skeleton className="h-8 w-40 mb-6" />
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {[1,2,3,4,5,6,7,8].map(i => <Skeleton key={i} className="h-72 rounded-xl" />)}
      </div>
    </div>
  );

  // Show sign in page only after auth loading completes and no user
  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <Heart className="w-16 h-16 mx-auto mb-4 text-muted-foreground opacity-30" />
        <h2 className="text-xl font-semibold mb-2">Sign in to view your favorites</h2>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  if (favorites.length === 0) {
    return (
      <div className="container mx-auto px-4 py-16 text-center max-w-md">
        <Heart className="w-20 h-20 mx-auto mb-4 text-muted-foreground opacity-20" />
        <h2 className="text-2xl font-bold mb-2">No favorites yet</h2>
        <p className="text-muted-foreground mb-6">Start saving your favorite products by clicking the heart icon!</p>
        <Button size="lg" onClick={() => navigate("/products")}>Continue Shopping</Button>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <h1 className="text-2xl font-bold mb-6">Favorite Products</h1>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
        {favorites.map((product: any) => (
          <ProductCard key={product.id} product={product as never} />
        ))}
      </div>
    </div>
  );
}
