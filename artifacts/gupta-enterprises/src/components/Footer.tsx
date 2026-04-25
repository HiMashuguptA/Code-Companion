import { Link } from "wouter";
import { Phone, Mail, MapPin, Clock, Package, Heart, Truck, ShieldCheck, Gift } from "lucide-react";
import { SHOP_CONFIG } from "@/lib/shopConfig";

export function Footer() {
  return (
    <footer className="border-t bg-card mt-12">
      <div className="container mx-auto px-4 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-8">
          <div className="col-span-2 md:col-span-1">
            <Link href="/" className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-primary flex items-center justify-center">
                <Package className="w-5 h-5 text-primary-foreground" />
              </div>
              <span className="font-bold">{SHOP_CONFIG.name}</span>
            </Link>
            <p className="text-xs text-muted-foreground leading-relaxed mb-3">
              {SHOP_CONFIG.city}'s favourite stationery store, trusted since {SHOP_CONFIG.since} by {SHOP_CONFIG.ownerName}.
            </p>
            <p className="text-xs text-primary font-medium flex items-center gap-1">
              <Truck className="w-3.5 h-3.5" /> Same-day delivery in {SHOP_CONFIG.city}
            </p>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-3">Shop</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link href="/products" className="hover:text-primary">All Products</Link></li>
              <li><Link href="/products?category=1" className="hover:text-primary">Pens & Pencils</Link></li>
              <li><Link href="/products?category=2" className="hover:text-primary">Notebooks</Link></li>
              <li><Link href="/products?category=3" className="hover:text-primary">Art Supplies</Link></li>
              <li><Link href="/products?category=5" className="hover:text-primary">School Supplies</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-3">Account</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li><Link href="/dashboard" className="hover:text-primary">My Dashboard</Link></li>
              <li><Link href="/orders" className="hover:text-primary">My Orders</Link></li>
              <li><Link href="/favorites" className="hover:text-primary">Favorites</Link></li>
              <li><Link href="/refer" className="hover:text-primary flex items-center gap-1"><Gift className="w-3 h-3" /> Refer & Earn</Link></li>
              <li><Link href="/profile" className="hover:text-primary">Profile</Link></li>
            </ul>
          </div>

          <div>
            <h3 className="font-semibold text-sm mb-3">Reach Us</h3>
            <ul className="space-y-2 text-xs text-muted-foreground">
              <li className="flex items-start gap-2">
                <MapPin className="w-3.5 h-3.5 text-primary mt-0.5 shrink-0" />
                <span>{SHOP_CONFIG.address}</span>
              </li>
              <li className="flex items-center gap-2">
                <Phone className="w-3.5 h-3.5 text-primary shrink-0" />
                <a href={`tel:${SHOP_CONFIG.phone}`} className="hover:text-primary">+91 {SHOP_CONFIG.phone}</a>
              </li>
              <li className="flex items-center gap-2">
                <Mail className="w-3.5 h-3.5 text-primary shrink-0" />
                <a href={`mailto:${SHOP_CONFIG.email}`} className="hover:text-primary break-all">{SHOP_CONFIG.email}</a>
              </li>
              <li className="flex items-center gap-2">
                <Clock className="w-3.5 h-3.5 text-primary shrink-0" />
                <span>{SHOP_CONFIG.openHours}</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t pt-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-muted-foreground">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1"><ShieldCheck className="w-3.5 h-3.5 text-green-500" /> Genuine Products</span>
            <span className="flex items-center gap-1"><Truck className="w-3.5 h-3.5 text-primary" /> Same-Day Delivery</span>
          </div>
          <p className="flex items-center gap-1">
            © {new Date().getFullYear()} {SHOP_CONFIG.name} · Made with <Heart className="w-3 h-3 fill-red-500 text-red-500" /> in {SHOP_CONFIG.city}
          </p>
        </div>
      </div>
    </footer>
  );
}
