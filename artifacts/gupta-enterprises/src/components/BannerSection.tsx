import { Link } from "wouter";
import { useListBanners, getListBannersQueryKey } from "@workspace/api-client-react";

interface BannerLike {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
  position: "TOP" | "MIDDLE" | "BOTTOM";
  size: "SMALL" | "MEDIUM" | "LARGE" | "FULL";
  sortOrder: number;
  isActive: boolean;
}

interface BannerSectionProps {
  position: "TOP" | "MIDDLE" | "BOTTOM";
  className?: string;
}

const sizeClasses: Record<BannerLike["size"], string> = {
  SMALL: "h-24 sm:h-32",
  MEDIUM: "h-40 sm:h-56",
  LARGE: "h-56 sm:h-80",
  FULL: "h-44 sm:h-72 md:h-80",
};

export function BannerSection({ position, className = "" }: BannerSectionProps) {
  const { data } = useListBanners(
    { position },
    {
      query: {
        queryKey: getListBannersQueryKey({ position }),
        staleTime: 1000 * 60 * 5,
      },
    },
  );

  const banners = (data ?? []) as BannerLike[];
  if (banners.length === 0) return null;

  return (
    <section className={`container mx-auto px-4 py-4 ${className}`}>
      <div
        className={`grid gap-3 ${
          banners.length === 1
            ? "grid-cols-1"
            : banners.length === 2
              ? "grid-cols-1 md:grid-cols-2"
              : "grid-cols-1 md:grid-cols-2 lg:grid-cols-3"
        }`}
      >
        {banners.map((b) => {
          const inner = (
            <div
              className={`relative w-full overflow-hidden rounded-2xl group cursor-pointer ${sizeClasses[b.size]}`}
            >
              <img
                src={b.imageUrl}
                alt={b.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy"
              />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
              <div className="relative h-full flex flex-col justify-center p-5 sm:p-8 text-white max-w-md">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight drop-shadow">
                  {b.title}
                </h3>
                {b.subtitle && (
                  <p className="mt-1 text-sm sm:text-base text-white/90 drop-shadow line-clamp-2">
                    {b.subtitle}
                  </p>
                )}
              </div>
            </div>
          );
          return b.linkUrl ? (
            <Link key={b.id} href={b.linkUrl}>{inner}</Link>
          ) : (
            <div key={b.id}>{inner}</div>
          );
        })}
      </div>
    </section>
  );
}
