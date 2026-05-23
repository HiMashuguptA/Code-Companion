import { Link } from "wouter";
import { ArrowLeft, Shield, Truck, RotateCw, FileText } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHOP_CONFIG } from "@/lib/shopConfig";

export function TermsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4 max-w-4xl flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <h1 className="font-bold text-lg">Terms & Conditions</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
          <p className="text-sm text-amber-800">
            Welcome to {SHOP_CONFIG.name}. These terms govern your use of our website, products, and services. By placing an order, you agree to these terms.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-[#2874F0]" /> 1. General Terms</h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>{SHOP_CONFIG.name} operates as an online stationery and office-supply retailer serving {SHOP_CONFIG.city} and surrounding areas within a {SHOP_CONFIG.deliveryRadiusKm} km radius.</li>
            <li>All prices are listed in Indian Rupees (INR) and include applicable taxes unless stated otherwise.</li>
            <li>Product images are for illustrative purposes only. Minor variations in color or design may occur.</li>
            <li>We reserve the right to refuse service, cancel orders, or limit quantities at our discretion.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><Truck className="w-5 h-5 text-[#2874F0]" /> 2. Orders & Delivery</h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>Orders are accepted subject to product availability. If an item becomes unavailable after order placement, we will notify you and offer a refund or substitute.</li>
            <li>Same-day delivery is available for orders placed before 2 PM within {SHOP_CONFIG.city} city limits.</li>
            <li>Standard delivery timelines are estimates and may vary due to weather, traffic, or other unforeseen circumstances.</li>
            <li>Delivery address changes after order confirmation may incur additional charges and are not guaranteed.</li>
            <li>Orders above INR 500 qualify for free delivery. Below INR 500, a delivery fee of INR 50 applies.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><RotateCw className="w-5 h-5 text-[#2874F0]" /> 3. Returns & Refunds</h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>Returns are accepted within 7 days of delivery for unused products in original packaging with a valid reason.</li>
            <li>Perishable, customized, or hygiene-sensitive products (e.g., certain art supplies) are non-returnable unless damaged or defective.</li>
            <li>Refunds are processed to the original payment method within 5-7 business days after the returned item is received and inspected.</li>
            <li>Defective or incorrect items must be reported within 24 hours of delivery with supporting photos.</li>
            <li>Super Coins redeemed on an order will be refunded to your wallet if the order is cancelled or returned.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-[#2874F0]" /> 4. Coupons & Super Coins</h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>Coupons are subject to their individual terms including minimum order value, category restrictions, and expiry dates.</li>
            <li>Only one coupon can be applied per order. Coupons cannot be combined with other offers unless explicitly stated.</li>
            <li>Super Coins are earned at a rate of 2% of the order total (after discounts) and can be redeemed up to 50% of any order value.</li>
            <li>1 Super Coin equals INR 1. Coins have no expiry unless your account remains inactive for more than 12 months.</li>
            <li>Referral bonuses are credited only after the referred user places and receives their first order.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-[#2874F0]" /> 5. Account & Privacy</h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>You are responsible for maintaining the confidentiality of your account credentials.</li>
            <li>We collect and process personal data in accordance with applicable Indian data protection laws.</li>
            <li>Your information is used solely for order processing, delivery, and improving our services.</li>
            <li>We do not sell or share your personal data with third parties for marketing purposes.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-[#2874F0]" /> 6. Limitation of Liability</h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>{SHOP_CONFIG.name} is not liable for indirect, incidental, or consequential damages arising from product use or delivery delays.</li>
            <li>Our total liability for any claim shall not exceed the amount paid for the specific product or service in question.</li>
            <li>Force majeure events (natural disasters, strikes, government actions) may cause delays beyond our control.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2"><FileText className="w-5 h-5 text-[#2874F0]" /> 7. Contact & Disputes</h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>For any queries or disputes, please contact us at {SHOP_CONFIG.phone} or {SHOP_CONFIG.email}.</li>
            <li>Disputes shall be resolved amicably. Failing which, jurisdiction lies with courts in Kohima, Nagaland, India.</li>
            <li>These terms may be updated from time to time. Continued use of the platform constitutes acceptance of the revised terms.</li>
          </ul>
        </section>

        <div className="border-t pt-6 text-center text-xs text-muted-foreground">
          <p>Last updated: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="mt-1">{SHOP_CONFIG.name} · {SHOP_CONFIG.address}</p>
        </div>
      </div>
    </div>
  );
}
