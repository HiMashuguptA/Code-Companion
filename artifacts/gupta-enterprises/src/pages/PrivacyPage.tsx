import { Link } from "wouter";
import { ArrowLeft, Shield, Eye, Lock, Database, Bell, UserCheck, Mail } from "lucide-react";
import { Button } from "@/components/ui/button";
import { SHOP_CONFIG } from "@/lib/shopConfig";

export function PrivacyPage() {
  return (
    <div className="min-h-screen bg-white">
      <div className="border-b">
        <div className="container mx-auto px-4 py-4 max-w-4xl flex items-center gap-3">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-1 text-muted-foreground">
              <ArrowLeft className="w-4 h-4" /> Back
            </Button>
          </Link>
          <h1 className="font-bold text-lg">Privacy Policy</h1>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
          <Shield className="w-5 h-5 text-blue-600 shrink-0 mt-0.5" />
          <p className="text-sm text-blue-800">
            At {SHOP_CONFIG.name}, your privacy is important to us. This policy explains how we collect,
            use, and protect your personal information when you use our platform.
          </p>
        </div>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Database className="w-5 h-5 text-[#2874F0]" /> 1. Information We Collect
          </h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li><strong>Account Information:</strong> Mobile number and name when you register or log in.</li>
            <li><strong>Order Information:</strong> Delivery addresses, order history, and payment method preferences (we do not store card numbers).</li>
            <li><strong>Usage Data:</strong> Pages visited, products viewed, search queries, and time spent — used to improve your experience.</li>
            <li><strong>Device Information:</strong> Browser type, operating system, and IP address for security and analytics purposes.</li>
            <li><strong>Communication Data:</strong> Messages or queries you send us through the contact form or via phone/email.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Eye className="w-5 h-5 text-[#2874F0]" /> 2. How We Use Your Information
          </h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>To process and fulfill your orders accurately and on time.</li>
            <li>To send order confirmations, delivery updates, and tracking notifications.</li>
            <li>To personalize your shopping experience and show relevant product recommendations.</li>
            <li>To manage your Super Coins wallet, referral rewards, and coupon entitlements.</li>
            <li>To improve our website functionality, fix bugs, and optimise performance.</li>
            <li>To respond to customer support queries, returns, and refund requests.</li>
            <li>To send occasional promotional communications — you may opt out at any time.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Lock className="w-5 h-5 text-[#2874F0]" /> 3. Data Security
          </h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>All data is transmitted over HTTPS (TLS) encryption to protect your information in transit.</li>
            <li>Passwords and OTPs are never stored — we use Firebase Authentication for secure phone-based login.</li>
            <li>Payment transactions are processed by trusted third-party gateways. We do not store card or UPI credentials.</li>
            <li>Access to user data is restricted to authorized personnel only, with strict internal access controls.</li>
            <li>We conduct periodic security audits and implement industry-standard best practices.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#2874F0]" /> 4. Data Sharing
          </h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>We do <strong>not</strong> sell, rent, or trade your personal data to any third parties for marketing purposes.</li>
            <li>We share data only with trusted service providers necessary to operate our platform (e.g., delivery partners, payment gateways).</li>
            <li>These partners are contractually bound to keep your data confidential and use it only for the specified purpose.</li>
            <li>We may disclose information if required by law, court order, or government authority.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Bell className="w-5 h-5 text-[#2874F0]" /> 5. Cookies & Tracking
          </h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li>We use session cookies to maintain your login state. These are essential for the platform to function.</li>
            <li>Analytics cookies help us understand how users interact with our website — these are anonymised and aggregated.</li>
            <li>You may disable cookies in your browser settings, though some features may not work correctly as a result.</li>
            <li>We do not use cross-site tracking cookies or serve third-party advertisements.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-[#2874F0]" /> 6. Your Rights
          </h2>
          <ul className="text-sm text-muted-foreground space-y-2 list-disc list-inside">
            <li><strong>Access:</strong> You may request a copy of all personal data we hold about you.</li>
            <li><strong>Correction:</strong> You may update your name, address, or contact details from your profile page at any time.</li>
            <li><strong>Deletion:</strong> You may request deletion of your account and all associated data by contacting us.</li>
            <li><strong>Opt-out:</strong> You may unsubscribe from promotional messages at any time without affecting your ability to place orders.</li>
          </ul>
        </section>

        <section className="space-y-3">
          <h2 className="text-lg font-bold flex items-center gap-2">
            <Mail className="w-5 h-5 text-[#2874F0]" /> 7. Contact Us
          </h2>
          <p className="text-sm text-muted-foreground">
            For any privacy-related queries, data requests, or concerns, please reach out to us:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1 list-none">
            <li>📞 <a href={`tel:${SHOP_CONFIG.phone}`} className="text-[#2874F0] hover:underline">+91 {SHOP_CONFIG.phone}</a></li>
            <li>✉️ <a href={`mailto:${SHOP_CONFIG.email}`} className="text-[#2874F0] hover:underline">{SHOP_CONFIG.email}</a></li>
            <li>📍 {SHOP_CONFIG.address}</li>
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
