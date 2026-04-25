import { useState } from "react";
import { Link } from "wouter";
import { Gift, Copy, Check, Share2, Users, IndianRupee, MessageCircle, Mail, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/contexts/FirebaseContext";
import { SHOP_CONFIG } from "@/lib/shopConfig";
import { toast } from "sonner";

function makeReferralCode(uid?: string | null, name?: string | null): string {
  const base = (name?.split(" ")[0] ?? "FRIEND").replace(/[^A-Za-z]/g, "").toUpperCase().slice(0, 6) || "FRIEND";
  const seed = (uid ?? "guest").slice(-4).toUpperCase().replace(/[^A-Z0-9]/g, "0");
  return `${base}${seed}`;
}

export function ReferEarnPage() {
  const { currentUser, dbUser } = useAuth();
  const [copied, setCopied] = useState(false);

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">Please sign in to access your referral code.</p>
        <Link href="/auth"><Button>Sign In</Button></Link>
      </div>
    );
  }

  const code = makeReferralCode(currentUser.uid, dbUser?.name ?? currentUser.email);
  const shareUrl = `${window.location.origin}/?ref=${code}`;
  const shareText = `Hey! Shop quality stationery at ${SHOP_CONFIG.name} in Kohima — use my code ${code} and we both get ₹100 off your first order!`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(`${shareText} ${shareUrl}`);
      setCopied(true);
      toast.success("Copied! Now share with friends.");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn't copy — please copy manually.");
    }
  };

  const handleShareWhatsApp = () => {
    const url = `https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`;
    window.open(url, "_blank");
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`₹100 off at ${SHOP_CONFIG.name}`);
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try {
        await navigator.share({
          title: `${SHOP_CONFIG.name} — Refer & Earn`,
          text: shareText,
          url: shareUrl,
        });
      } catch {
        // user cancelled
      }
    } else {
      handleCopy();
    }
  };

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-saffron-100 via-amber-50 to-orange-100 dark:from-saffron-950 dark:via-orange-950 dark:to-amber-950 border border-primary/20 p-8 mb-6 text-center">
        <Sparkles className="absolute top-4 right-4 w-6 h-6 text-primary/40" />
        <Sparkles className="absolute bottom-4 left-4 w-5 h-5 text-primary/40" />
        <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
          <Gift className="w-8 h-8 text-primary" />
        </div>
        <Badge className="mb-3 bg-primary/10 text-primary border-primary/20">Refer & Earn</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Give ₹100, Get ₹100</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Invite a friend to {SHOP_CONFIG.name}. They get ₹100 off their first order — and you get ₹100 credit when they order.
        </p>
      </div>

      {/* Code card */}
      <div className="bg-card border-2 border-dashed border-primary/40 rounded-2xl p-6 mb-6 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Your Referral Code</p>
        <p className="text-3xl sm:text-4xl font-bold font-mono tracking-widest text-primary mb-4 select-all">{code}</p>
        <div className="flex flex-wrap items-center justify-center gap-2">
          <Button onClick={handleCopy} variant="outline" size="sm" className="gap-2">
            {copied ? <><Check className="w-4 h-4" /> Copied!</> : <><Copy className="w-4 h-4" /> Copy Code</>}
          </Button>
          <Button onClick={handleShareWhatsApp} size="sm" className="gap-2 bg-green-600 hover:bg-green-700 text-white">
            <MessageCircle className="w-4 h-4" /> WhatsApp
          </Button>
          <Button onClick={handleShareEmail} variant="outline" size="sm" className="gap-2">
            <Mail className="w-4 h-4" /> Email
          </Button>
          <Button onClick={handleNativeShare} variant="outline" size="sm" className="gap-2">
            <Share2 className="w-4 h-4" /> Share
          </Button>
        </div>
      </div>

      {/* How it works */}
      <div className="bg-card border rounded-2xl p-6 mb-6">
        <h2 className="font-semibold mb-4">How it works</h2>
        <div className="space-y-4">
          {[
            { icon: Share2, title: "Share your code", desc: "Send your unique code to friends and family in Kohima." },
            { icon: Users, title: "They sign up & order", desc: "Your friend uses your code at checkout on their first order." },
            { icon: IndianRupee, title: "Both earn ₹100", desc: "You both get ₹100 credit added to your account automatically." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-primary" />
              </div>
              <div>
                <p className="font-medium text-sm">{i + 1}. {title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Terms */}
      <div className="text-xs text-muted-foreground bg-muted/40 rounded-xl p-4 leading-relaxed">
        <p className="font-medium mb-2 text-foreground">Terms & conditions</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Referral credit applies only on the friend's first paid order.</li>
          <li>Credit can be used on orders above ₹500 within {SHOP_CONFIG.deliveryRadiusKm}km of {SHOP_CONFIG.city}.</li>
          <li>One referral code per customer. Self-referrals are not eligible.</li>
          <li>Credits expire 90 days after issue.</li>
        </ul>
      </div>
    </div>
  );
}
