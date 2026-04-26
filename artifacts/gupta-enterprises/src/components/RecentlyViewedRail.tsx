import { useMemo } from "react";
import { Link } from "wouter";
import { ArrowRight, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useListProducts, getListProductsQueryKey } from "@workspace/api-client-react";
import { ProductCard } from "@/components/ProductCard";
import { useRecentlyViewed } from "@/hooks/useRecentlyViewed";

interface ProductLike {
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

export function RecentlyViewedRail() {
  const { ids, clear } = useRecentlyViewed();

  const { data: productsData } = useListProducts(
    { limit: 100 },
    {
      query: {
        queryKey: getListProductsQueryKey({ limit: 100 }),
        enabled: ids.length > 0,
        staleTime: 1000 * 60 * 5,
      },
    },
  );

  const products = useMemo(() => {
    const all = (productsData?.products ?? []) as ProductLike[];
    const byId = new Map(all.map((p) => [p.id, p]));
    return ids.map((id) => byId.get(id)).filter(Boolean) as ProductLike[];
  }, [productsData, ids]);

  if (ids.length === 0 || products.length === 0) return null;

  return (
    <section className="container mx-auto px-4 py-10">
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-primary" />
          <h2 className="text-xl font-bold">Recently Viewed</h2>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={clear}>Clear</Button>
          <Link href="/products">
            <Button variant="ghost" size="sm" className="gap-1">View All <ArrowRight className="w-3.5 h-3.5" /></Button>
          </Link>
        </div>
      </div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {products.slice(0, 8).map((p) => (
          <ProductCard key={p.id} product={p as never} />
        ))}
      </div>
    </section>
  );
}
