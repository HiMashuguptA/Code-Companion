import { useState } from "react";
import { useLocation } from "wouter";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from "@/components/ui/sheet";
import { Label } from "@/components/ui/label";
import { ProductCard } from "@/components/ProductCard";
import { useListProducts, useListCategories, getListProductsQueryKey, getListCategoriesQueryKey } from "@workspace/api-client-react";

export function ProductsPage() {
  const [location] = useLocation();
  const params = new URLSearchParams(location.split("?")[1] ?? "");
  const [search, setSearch] = useState(params.get("search") ?? "");
  const [category, setCategory] = useState(params.get("category") ?? "");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [inStock, setInStock] = useState(false);
  const [page, setPage] = useState(1);

  const queryParams = {
    search: search || undefined,
    category: category || undefined,
    minPrice: minPrice ? parseFloat(minPrice) : undefined,
    maxPrice: maxPrice ? parseFloat(maxPrice) : undefined,
    inStock: inStock || undefined,
    page,
    limit: 20,
  };

  const { data, isLoading } = useListProducts(queryParams, {
    query: { 
      queryKey: getListProductsQueryKey(queryParams),
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false
    }
  });

  const { data: categories } = useListCategories({
    query: { 
      queryKey: getListCategoriesQueryKey(),
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      refetchOnMount: false,
      refetchOnWindowFocus: false,
      refetchOnReconnect: false
    }
  });
  
  // Ensure categories is always an array
  const categoriesArray = Array.isArray(categories) ? categories : [];

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
  };

  const clearFilters = () => {
    setSearch("");
    setCategory("");
    setMinPrice("");
    setMaxPrice("");
    setInStock(false);
    setPage(1);
  };

  const hasFilters = search || category || minPrice || maxPrice || inStock;

  const FilterContent = () => (
    <div className="space-y-6">
      <div>
        <Label className="text-sm font-medium mb-2 block">Category</Label>
        <div className="flex flex-col gap-1">
          <button
            className={`text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer ${!category ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
            onClick={() => { setCategory(""); setPage(1); }}
          >
            All Categories
          </button>
          {categoriesArray.map(cat => (
            <button
              key={cat.id}
              className={`text-left text-sm px-3 py-2 rounded-lg transition-colors cursor-pointer ${category === cat.slug ? "bg-primary text-primary-foreground" : "hover:bg-muted"}`}
              onClick={() => { setCategory(cat.slug); setPage(1); }}
            >
              {cat.name}
              {cat.productCount !== undefined && (
                <span className="ml-1 opacity-60">({cat.productCount})</span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div>
        <Label className="text-sm font-medium mb-2 block">Price Range</Label>
        <div className="flex gap-2">
          <input
            type="number"
            placeholder="Min ₹"
            className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={minPrice}
            onChange={e => { setMinPrice(e.target.value); setPage(1); }}
          />
          <input
            type="number"
            placeholder="Max ₹"
            className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
            value={maxPrice}
            onChange={e => { setMaxPrice(e.target.value); setPage(1); }}
          />
        </div>
      </div>

      <div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            className="w-4 h-4 rounded accent-primary"
            checked={inStock}
            onChange={e => { setInStock(e.target.checked); setPage(1); }}
          />
          <span className="text-sm font-medium">In Stock Only</span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex flex-col md:flex-row gap-8">
        {/* Sidebar Filters - Desktop */}
        <aside className="hidden md:block w-56 shrink-0">
          <div className="sticky top-24">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-semibold">Filters</h3>
              {hasFilters && (
                <Button variant="ghost" size="sm" onClick={clearFilters} className="h-7 px-2 text-xs">
                  Clear all
                </Button>
              )}
            </div>
            <FilterContent />
          </div>
        </aside>

        {/* Main Content */}
        <div className="flex-1 min-w-0">
          {/* Top Bar */}
          <div className="flex flex-wrap gap-3 mb-6 items-center">
            <form onSubmit={handleSearch} className="flex-1 min-w-48">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="search"
                  placeholder="Search products..."
                  className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={search}
                  onChange={e => { setSearch(e.target.value); setPage(1); }}
                />
              </div>
            </form>

            {/* Mobile Filter */}
            <Sheet>
              <SheetTrigger asChild>
                <Button variant="outline" size="sm" className="md:hidden gap-1.5">
                  <SlidersHorizontal className="w-4 h-4" /> Filters
                  {hasFilters && <Badge className="ml-1 h-4 w-4 p-0 flex items-center justify-center text-xs">!</Badge>}
                </Button>
              </SheetTrigger>
              <SheetContent side="left">
                <SheetHeader>
                  <SheetTitle>Filters</SheetTitle>
                </SheetHeader>
                <div className="mt-4">
                  <FilterContent />
                </div>
              </SheetContent>
            </Sheet>

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters} className="gap-1">
                <X className="w-4 h-4" /> Clear
              </Button>
            )}

            <div className="text-sm text-muted-foreground ml-auto">
              {data ? `${data.total} products` : ""}
            </div>
          </div>

          {/* Active filters */}
          {hasFilters && (
            <div className="flex flex-wrap gap-2 mb-4">
              {search && <Badge variant="secondary" className="gap-1">{search} <X className="w-3 h-3 cursor-pointer" onClick={() => setSearch("")} /></Badge>}
              {category && <Badge variant="secondary" className="gap-1">{categoriesArray.find(c => c.slug === category)?.name ?? category} <X className="w-3 h-3 cursor-pointer" onClick={() => setCategory("")} /></Badge>}
              {minPrice && <Badge variant="secondary" className="gap-1">Min: ₹{minPrice} <X className="w-3 h-3 cursor-pointer" onClick={() => setMinPrice("")} /></Badge>}
              {maxPrice && <Badge variant="secondary" className="gap-1">Max: ₹{maxPrice} <X className="w-3 h-3 cursor-pointer" onClick={() => setMaxPrice("")} /></Badge>}
              {inStock && <Badge variant="secondary" className="gap-1">In Stock <X className="w-3 h-3 cursor-pointer" onClick={() => setInStock(false)} /></Badge>}
            </div>
          )}

          {/* Products Grid */}
          {isLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
              {Array.from({ length: 12 }).map((_, i) => (
                <div key={i} className="space-y-3">
                  <Skeleton className="aspect-square rounded-xl" />
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                  <Skeleton className="h-8" />
                </div>
              ))}
            </div>
          ) : (data?.products?.length ?? 0) === 0 ? (
            <div className="text-center py-16">
              <div className="text-6xl mb-4">🔍</div>
              <h3 className="text-lg font-semibold mb-2">No products found</h3>
              <p className="text-muted-foreground mb-4">Try adjusting your filters or search terms</p>
              <Button onClick={clearFilters}>Clear Filters</Button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {data?.products.map((product, i) => (
                  <ProductCard key={product.id} product={product as never} index={i} />
                ))}
              </div>

              {/* Pagination */}
              {data && data.totalPages > 1 && (
                <div className="flex justify-center gap-2 mt-8">
                  <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>
                    Previous
                  </Button>
                  <span className="flex items-center text-sm text-muted-foreground px-2">
                    Page {page} of {data.totalPages}
                  </span>
                  <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>
                    Next
                  </Button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}
