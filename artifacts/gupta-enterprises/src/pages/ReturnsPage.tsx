import { Link } from "wouter";
import { ArrowLeft, RotateCw, PackageCheck, XCircle, Clock, BadgeIndianRupee, Phone, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHOP_CONFIG } from "@/lib/shopConfig";

export function ReturnsPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4 max-w-4xl flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <h1 className="font-bold text-lg">Return & Refund Policy</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">

        {/* Quick summary cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-center">
            <Clock className="w-6 h-6 text-green-600 mx-auto mb-2" />
            <p className="font-bold text-green-800 text-sm">7-Day Returns</p>
            <p className="text-xs text-green-700 mt-1">Return within 7 days of delivery for unused items</p>
          </div>
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 text-center">
            <BadgeIndianRupee className="w-6 h-6 text-blue-600 mx-auto mb-2" />
            <p className="font-bold text-blue-800 text-sm">Fast Refunds</p>
            <p className="text-xs text-blue-700 mt-1">Refunds processed within 5–7 business days</p>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-center">
            <Phone className="w-6 h-6 text-amber-600 mx-auto mb-2" />
            <p className="font-bold text-amber-800 text-sm">Easy Process</p>
            <p className="text-xs text-amber-700 mt-1">Call or WhatsApp us to initiate a return</p>
          </div>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <RotateCw className="w-5 h-5 text-[#2874F0]" /> 1. Eligibility for Returns
          </h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>Items must be returned within <strong>7 days</strong> of the delivery date.</li>
            <li>Products must be unused, unopened, and in their <strong>original packaging</strong> with all accessories and tags intact.</li>
            <li>A valid order ID and reason for return must be provided.</li>
            <li>Returns are accepted for: wrong item delivered, damaged or defective product, or items significantly different from the description.</li>
            <li>We also accept returns for change-of-mind purchases if the product is unopened and in original condition.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <XCircle className="w-5 h-5 text-red-500" /> 2. Non-Returnable Items
          </h2>
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <ul className="text-sm text-red-800 space-y-1.5 list-disc list-inside">
              <li>Ink cartridges, refill packs, and opened art media (paints, inks, adhesives)</li>
              <li>Customised or personalised products (e.g., engraved stationery, printed items)</li>
              <li>Hygiene-sensitive items once their seal or packaging is opened</li>
              <li>Products that have been used, damaged by the customer, or are missing parts</li>
              <li>Items purchased during clearance or final-sale promotions (marked as non-returnable)</li>
              <li>Digital products or gift vouchers once redeemed</li>
            </ul>
          </div>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" /> 3. Reporting Damaged or Wrong Items
          </h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>Damaged, defective, or incorrect items must be reported within <strong>24 hours</strong> of delivery.</li>
            <li>Please take clear photos of the damaged product and packaging and send them to us via WhatsApp or email.</li>
            <li>We will arrange a free pickup and send a replacement or process a full refund — your choice.</li>
            <li>Contact us at <a href={`tel:${SHOP_CONFIG.phone}`} className="text-[#2874F0] hover:underline">+91 {SHOP_CONFIG.phone}</a> or <a href={`mailto:${SHOP_CONFIG.email}`} className="text-[#2874F0] hover:underline">{SHOP_CONFIG.email}</a>.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <PackageCheck className="w-5 h-5 text-[#2874F0]" /> 4. How to Initiate a Return
          </h2>
          <ol className="text-sm text-muted-foreground space-y-3 list-decimal list-inside">
            <li>
              <strong>Contact Us:</strong> Call or WhatsApp us at <a href={`tel:${SHOP_CONFIG.phone}`} className="text-[#2874F0] hover:underline">+91 {SHOP_CONFIG.phone}</a> or email <a href={`mailto:${SHOP_CONFIG.email}`} className="text-[#2874F0] hover:underline">{SHOP_CONFIG.email}</a> with your order ID and return reason.
            </li>
            <li>
              <strong>Approval:</strong> Our team will review your request and confirm eligibility within 24 hours.
            </li>
            <li>
              <strong>Pickup or Drop-off:</strong> For eligible returns within {SHOP_CONFIG.city}, we will arrange a free pickup. Customers outside our delivery zone may need to drop the item at our store.
            </li>
            <li>
              <strong>Inspection:</strong> Once we receive the returned item, it will be inspected within 1–2 business days.
            </li>
            <li>
              <strong>Refund:</strong> After successful inspection, refunds are processed to the original payment method within 5–7 business days. Super Coins used in the order are also refunded to your wallet.
            </li>
          </ol>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <BadgeIndianRupee className="w-5 h-5 text-[#2874F0]" /> 5. Refund Details
          </h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>Refunds are credited back to the <strong>original payment method</strong> (UPI, card, wallet, etc.).</li>
            <li>For COD (Cash on Delivery) orders, refunds are processed to your bank account via NEFT/IMPS within 5–7 business days. We will ask for your bank details.</li>
            <li>Delivery charges are non-refundable unless the return is due to our error (wrong or damaged item).</li>
            <li>Super Coins and coupon discounts applied to the original order are refunded proportionally.</li>
            <li>Partial returns (returning some items from a multi-item order) are accepted. Refunds will be calculated for returned items only.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Phone className="w-5 h-5 text-[#2874F0]" /> 6. Exchange Policy
          </h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>Exchanges are available for eligible items (e.g., same product in a different colour or size).</li>
            <li>To exchange an item, contact us within 7 days of delivery — the same eligibility rules apply.</li>
            <li>If the requested exchange item is out of stock, we will offer a refund instead.</li>
            <li>Exchange dispatch happens within 2 business days of receiving and inspecting the returned item.</li>
          </ul>
        </section>

        <div className="bg-[#2874F0]/5 border border-[#2874F0]/20 rounded-xl p-4">
          <p className="text-sm font-semibold text-[#2874F0] mb-1">📞 Need help with a return?</p>
          <p className="text-xs text-muted-foreground">
            Our friendly team is here to help. Contact us at{" "}
            <a href={`tel:${SHOP_CONFIG.phone}`} className="text-[#2874F0] font-medium">+91 {SHOP_CONFIG.phone}</a>{" "}
            or{" "}
            <a href={`mailto:${SHOP_CONFIG.email}`} className="text-[#2874F0] font-medium">{SHOP_CONFIG.email}</a>{" "}
            during business hours: {SHOP_CONFIG.openHours}.
          </p>
        </div>

        <div className="border-t pt-6 text-center text-xs text-muted-foreground">
          <p>Last updated: {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}</p>
          <p className="mt-1">{SHOP_CONFIG.name} · {SHOP_CONFIG.address}</p>
        </div>
      </div>
    </div>
  );
}
