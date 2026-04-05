import { Link, useLocation } from "wouter";
import { ArrowRight, ShieldCheck, Truck, RefreshCw, Star } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { ProductCard } from "@/components/ProductCard";
import { useGetFeaturedProducts, useListCategories } from "@workspace/api-client-react";

export function HomePage() {
  const [, navigate] = useLocation();
  const { data: featured, isLoading: featuredLoading } = useGetFeaturedProducts();
  const { data: categories, isLoading: catsLoading } = useListCategories();

  const categoryIcons: Record<string, string> = {
    "pens-pencils": "✏️",
    "notebooks-diaries": "📓",
    "art-supplies": "🎨",
    "office-supplies": "📎",
    "school-supplies": "🎒",
    "files-folders": "📁",
  };

  return (
    <div className="min-h-screen">
      {/* Hero */}
      <section className="relative bg-gradient-to-br from-primary/10 via-background to-accent/5 border-b overflow-hidden">
        <div className="container mx-auto px-4 py-16 md:py-24">
          <div className="max-w-2xl">
            <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
              <div className="inline-flex items-center gap-2 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm font-medium mb-4">
                <Star className="w-3.5 h-3.5 fill-current" />
                Trusted by 10,000+ customers
              </div>
              <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight mb-4 leading-tight">
                Your Favourite<br />
                <span className="text-primary">Stationery Store</span><br />
                Now Online
              </h1>
              <p className="text-lg text-muted-foreground mb-8 max-w-lg">
                Discover premium pens, notebooks, art supplies and more. Quality products at unbeatable prices, delivered to your doorstep.
              </p>
              <div className="flex gap-3">
                <Button size="lg" onClick={() => navigate("/products")} className="gap-2">
                  Shop Now <ArrowRight className="w-4 h-4" />
                </Button>
                <Button size="lg" variant="outline" onClick={() => navigate("/products?category=art-supplies")}>
                  Art Supplies
                </Button>
              </div>
            </motion.div>
          </div>
        </div>
        {/* Decorative circles */}
        <div className="absolute right-0 top-0 w-80 h-80 rounded-full bg-primary/5 -translate-y-1/2 translate-x-1/2 pointer-events-none" />
        <div className="absolute right-40 bottom-0 w-48 h-48 rounded-full bg-accent/5 translate-y-1/2 pointer-events-none" />
      </section>

      {/* Trust Badges */}
      <section className="border-b bg-muted/30">
        <div className="container mx-auto px-4 py-4">
          <div className="grid grid-cols-3 gap-4">
            {[
              { icon: Truck, label: "Free Delivery", sub: "On orders above ₹500" },
              { icon: ShieldCheck, label: "Secure Payments", sub: "100% safe & secure" },
              { icon: RefreshCw, label: "Easy Returns", sub: "7-day return policy" },
            ].map(({ icon: Icon, label, sub }) => (
              <div key={label} className="flex items-center gap-2 py-2">
                <Icon className="w-5 h-5 text-primary shrink-0" />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-muted-foreground hidden sm:block">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Categories */}
      <section className="container mx-auto px-4 py-12">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Shop by Category</h2>
            <p className="text-muted-foreground text-sm mt-1">Find exactly what you need</p>
          </div>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
          {catsLoading
            ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-24 rounded-xl" />)
            : categories?.map((cat, i) => (
                <motion.div
                  key={cat.id}
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.05 }}
                >
                  <Link href={`/products?category=${cat.slug}`}>
                    <div className="group flex flex-col items-center justify-center gap-2 p-4 rounded-xl border bg-card hover:bg-primary hover:text-primary-foreground hover:border-primary transition-all duration-200 cursor-pointer text-center h-24">
                      <span className="text-2xl">{categoryIcons[cat.slug] ?? "📦"}</span>
                      <span className="text-xs font-medium line-clamp-2 leading-tight">{cat.name}</span>
                      {cat.productCount !== undefined && (
                        <span className="text-xs opacity-60">{cat.productCount} items</span>
                      )}
                    </div>
                  </Link>
                </motion.div>
              ))}
        </div>
      </section>

      {/* Featured Products */}
      <section className="container mx-auto px-4 pb-16">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="text-2xl font-bold">Featured Products</h2>
            <p className="text-muted-foreground text-sm mt-1">Our most popular picks</p>
          </div>
          <Link href="/products">
            <Button variant="outline" size="sm" className="gap-1">
              View All <ArrowRight className="w-4 h-4" />
            </Button>
          </Link>
        </div>

        {featuredLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="space-y-3">
                <Skeleton className="aspect-square rounded-xl" />
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-4 w-1/2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {featured?.map((product, i) => (
              <ProductCard key={product.id} product={product as never} index={i} />
            ))}
          </div>
        )}
      </section>

      {/* Promo Banner */}
      <section className="container mx-auto px-4 pb-16">
        <div className="rounded-2xl bg-gradient-to-r from-primary to-primary/80 text-primary-foreground p-8 md:p-12 flex flex-col md:flex-row items-center gap-6">
          <div className="flex-1">
            <h3 className="text-2xl md:text-3xl font-bold mb-2">First Order Special!</h3>
            <p className="text-primary-foreground/80 mb-4">Get ₹100 OFF on your first order above ₹500. Use code WELCOME100 at checkout.</p>
            <Button variant="secondary" size="lg" onClick={() => navigate("/products")}>
              Start Shopping
            </Button>
          </div>
          <div className="text-6xl md:text-8xl opacity-20 font-bold">₹100</div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t bg-muted/30">
        <div className="container mx-auto px-4 py-8">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <div>
              <h4 className="font-semibold mb-3">Gupta Enterprises</h4>
              <p className="text-sm text-muted-foreground">Your trusted stationery partner since 1985.</p>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Quick Links</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li><Link href="/products" className="hover:text-foreground">All Products</Link></li>
                <li><Link href="/orders" className="hover:text-foreground">My Orders</Link></li>
                <li><Link href="/profile" className="hover:text-foreground">My Profile</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Categories</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li><Link href="/products?category=pens-pencils" className="hover:text-foreground">Pens & Pencils</Link></li>
                <li><Link href="/products?category=notebooks-diaries" className="hover:text-foreground">Notebooks</Link></li>
                <li><Link href="/products?category=art-supplies" className="hover:text-foreground">Art Supplies</Link></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold mb-3">Contact</h4>
              <ul className="space-y-1 text-sm text-muted-foreground">
                <li>123 Market Road, Delhi</li>
                <li>+91 98765 43210</li>
                <li>info@guptaenterprises.in</li>
              </ul>
            </div>
          </div>
          <div className="border-t mt-6 pt-4 text-center text-sm text-muted-foreground">
            2024 Gupta Enterprises. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
