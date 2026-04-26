import { Link, useLocation } from "wouter";
import { useListCategories, getListCategoriesQueryKey } from "@workspace/api-client-react";
import { Skeleton } from "@/components/ui/skeleton";

interface Cat {
  id: string;
  name: string;
  slug: string;
  icon?: string | null;
  image?: string | null;
}

const FALLBACK_ICONS: Record<string, string> = {
  "pens-pencils": "✏️",
  "notebooks-diaries": "📓",
  "art-supplies": "🎨",
  "office-supplies": "💼",
  "school-supplies": "🎒",
  "files-folders": "📁",
};

export function CategoryNavBar() {
  const [location] = useLocation();
  const { data: cats, isLoading } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey(), staleTime: 1000 * 60 * 10 },
  });

  if (isLoading) {
    return (
      <div className="bg-card border-b">
        <div className="container mx-auto px-2 py-2 flex gap-2 overflow-x-auto no-scrollbar">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-16 w-20 shrink-0 rounded-lg" />)}
        </div>
      </div>
    );
  }

  const items = (cats ?? []) as Cat[];
  if (items.length === 0) return null;

  return (
    <div className="bg-card border-b sticky top-[57px] z-30">
      <div className="container mx-auto px-2 py-2 flex gap-1 sm:gap-2 overflow-x-auto no-scrollbar">
        {items.map((c) => {
          const href = `/products?category=${c.slug}`;
          const active = location.startsWith(href);
          const icon = c.icon || FALLBACK_ICONS[c.slug] || "🛍️";
          return (
            <Link key={c.id} href={href}>
              <div
                className={`flex flex-col items-center gap-1 px-3 py-1.5 rounded-lg shrink-0 cursor-pointer transition-all min-w-[72px] ${
                  active ? "bg-primary/10 text-primary" : "hover:bg-muted text-foreground/80"
                }`}
              >
                {c.image ? (
                  <img src={c.image} alt={c.name} className="w-10 h-10 rounded-full object-cover" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-muted flex items-center justify-center text-xl">{icon}</div>
                )}
                <span className="text-[11px] font-medium leading-tight text-center line-clamp-2">{c.name}</span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
