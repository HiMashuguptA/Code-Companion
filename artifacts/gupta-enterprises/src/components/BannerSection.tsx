import { useEffect, useState } from "react";
import { Link } from "wouter";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { useListBanners, getListBannersQueryKey } from "@workspace/api-client-react";

interface BannerLike {
  id: string;
  title: string;
  subtitle?: string | null;
  imageUrl: string;
  linkUrl?: string | null;
  productId?: string | null;
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
  FULL: "h-44 sm:h-64 md:h-80",
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

  if (position === "TOP") {
    return <CarouselBanner banners={banners} className={className} />;
  }

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
            <div className={`relative w-full overflow-hidden rounded-2xl group cursor-pointer ${sizeClasses[b.size]}`}>
              <img src={b.imageUrl} alt={b.title}
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                loading="lazy" />
              <div className="absolute inset-0 bg-gradient-to-r from-black/60 via-black/30 to-transparent" />
              <div className="relative h-full flex flex-col justify-center p-5 sm:p-8 text-white max-w-md">
                <h3 className="text-xl sm:text-2xl md:text-3xl font-bold leading-tight drop-shadow">{b.title}</h3>
                {b.subtitle && <p className="mt-1 text-sm sm:text-base text-white/90 drop-shadow line-clamp-2">{b.subtitle}</p>}
              </div>
            </div>
          );
          return b.linkUrl ? <Link key={b.id} href={b.linkUrl}>{inner}</Link> : <div key={b.id}>{inner}</div>;
        })}
      </div>
    </section>
  );
}

function CarouselBanner({ banners, className }: { banners: BannerLike[]; className: string }) {
  const [idx, setIdx] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    if (paused || banners.length <= 1) return;
    const t = setInterval(() => setIdx(i => (i + 1) % banners.length), 4500);
    return () => clearInterval(t);
  }, [paused, banners.length]);

  const go = (delta: number) => setIdx(i => (i + delta + banners.length) % banners.length);

  return (
    <section
      className={`container mx-auto px-2 sm:px-4 pt-2 pb-3 ${className}`}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="relative overflow-hidden rounded-xl bg-muted shadow-sm">
        <div className="relative h-44 sm:h-64 md:h-80">
          {banners.map((b, i) => {
            const inner = (
              <>
                <img src={b.imageUrl} alt={b.title}
                  className="absolute inset-0 w-full h-full object-cover" loading={i === 0 ? "eager" : "lazy"} />
                <div className="absolute inset-0 bg-gradient-to-r from-black/55 via-black/20 to-transparent" />
                <div className="relative h-full flex flex-col justify-center p-5 sm:p-10 text-white max-w-xl">
                  <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold leading-tight drop-shadow">{b.title}</h3>
                  {b.subtitle && <p className="mt-2 text-sm sm:text-base text-white/95 drop-shadow line-clamp-2">{b.subtitle}</p>}
                </div>
              </>
            );
            const slide = (
              <div
                key={b.id}
                className={`absolute inset-0 transition-opacity duration-700 ${i === idx ? "opacity-100" : "opacity-0 pointer-events-none"}`}
              >
                {b.linkUrl ? <Link href={b.linkUrl}><div className="relative h-full cursor-pointer">{inner}</div></Link> : <div className="relative h-full">{inner}</div>}
              </div>
            );
            return slide;
          })}
        </div>

        {banners.length > 1 && (
          <>
            <button
              aria-label="Previous"
              onClick={() => go(-1)}
              className="absolute left-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              aria-label="Next"
              onClick={() => go(1)}
              className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full bg-black/40 hover:bg-black/60 text-white flex items-center justify-center backdrop-blur-sm"
            >
              <ChevronRight className="w-5 h-5" />
            </button>

            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
              {banners.map((_, i) => (
                <button
                  key={i}
                  aria-label={`Go to slide ${i + 1}`}
                  onClick={() => setIdx(i)}
                  className={`h-1.5 rounded-full transition-all ${i === idx ? "w-6 bg-white" : "w-1.5 bg-white/60"}`}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </section>
  );
}
