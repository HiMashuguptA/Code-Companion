import { useState } from "react";
import { Link } from "wouter";
import { Gift, Copy, Check, Share2, Users, IndianRupee, MessageCircle, Mail, Sparkles, Coins, ArrowDownCircle, ArrowUpCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/contexts/FirebaseContext";
import { SHOP_CONFIG } from "@/lib/shopConfig";
import { toast } from "sonner";
import {
  useGetMyReferralInfo, useListMyCoinTransactions,
  getGetMyReferralInfoQueryKey, getListMyCoinTransactionsQueryKey,
} from "@workspace/api-client-react";
import type { CoinTransaction } from "@workspace/api-client-react";
import { formatPrice, formatDateTime } from "@/lib/utils";

const REASON_LABEL: Record<string, string> = {
  REFERRAL_BONUS: "Friend joined using your code",
  REFEREE_BONUS: "Welcome bonus",
  ORDER_REWARD: "Order reward",
  ORDER_REDEEM: "Redeemed at checkout",
  ADMIN_ADJUST: "Admin adjustment",
};

export function ReferEarnPage() {
  const { currentUser } = useAuth();
  const [copied, setCopied] = useState(false);

  const { data: referralInfo, isLoading } = useGetMyReferralInfo({
    query: { queryKey: getGetMyReferralInfoQueryKey(), enabled: !!currentUser, retry: false },
  });
  const { data: txData } = useListMyCoinTransactions({
    query: { queryKey: getListMyCoinTransactionsQueryKey(), enabled: !!currentUser, retry: false },
  });

  if (!currentUser) {
    return (
      <div className="container mx-auto px-4 py-16 text-center">
        <p className="text-muted-foreground mb-4">Please sign in to access your referral code & wallet.</p>
        <Link href="/auth"><Button>Sign In</Button></Link>
      </div>
    );
  }

  if (isLoading || !referralInfo) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-3xl space-y-4">
        <Skeleton className="h-44 rounded-3xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  const code = referralInfo.referralCode;
  const shareUrl = referralInfo.shareUrl || `${window.location.origin}/auth?ref=${code}`;
  const shareText = `Hey! Shop quality stationery at ${SHOP_CONFIG.name} in Kohima — use my code ${code} when you sign up and we both get 50–100 Super Coins (₹1 = 1 Coin) on our orders!`;

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
    window.open(`https://wa.me/?text=${encodeURIComponent(`${shareText} ${shareUrl}`)}`, "_blank");
  };

  const handleShareEmail = () => {
    const subject = encodeURIComponent(`Super Coins for shopping at ${SHOP_CONFIG.name}`);
    const body = encodeURIComponent(`${shareText}\n\n${shareUrl}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  };

  const handleNativeShare = async () => {
    if (typeof navigator !== "undefined" && "share" in navigator) {
      try { await navigator.share({ title: `${SHOP_CONFIG.name} — Refer & Earn`, text: shareText, url: shareUrl }); } catch { /* ignored */ }
    } else { handleCopy(); }
  };

  const transactions = (txData ?? []) as CoinTransaction[];

  return (
    <div className="container mx-auto px-4 py-8 max-w-3xl">
      {/* Hero */}
      <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-950 dark:via-orange-950 dark:to-yellow-950 border border-amber-300/40 p-8 mb-6 text-center">
        <Sparkles className="absolute top-4 right-4 w-6 h-6 text-amber-500/60" />
        <Sparkles className="absolute bottom-4 left-4 w-5 h-5 text-amber-500/60" />
        <div className="w-16 h-16 mx-auto rounded-2xl bg-amber-500/15 flex items-center justify-center mb-4">
          <Gift className="w-8 h-8 text-amber-600" />
        </div>
        <Badge className="mb-3 bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/15">Refer & Earn Super Coins</Badge>
        <h1 className="text-2xl sm:text-3xl font-bold mb-2">Give 50, Get 100</h1>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Invite a friend to {SHOP_CONFIG.name}. They get <strong>50 Super Coins</strong> on signup, and you earn <strong>100 Coins</strong> when they place their first order. 1 Coin = ₹1.
        </p>
      </div>

      {/* Wallet card */}
      <div className="grid sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-card border rounded-2xl p-5 text-center">
          <Coins className="w-6 h-6 mx-auto text-amber-500 mb-2" />
          <p className="text-2xl font-bold">{referralInfo.superCoins}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Coin Balance</p>
        </div>
        <div className="bg-card border rounded-2xl p-5 text-center">
          <Users className="w-6 h-6 mx-auto text-blue-500 mb-2" />
          <p className="text-2xl font-bold">{referralInfo.totalReferrals}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Friends Joined</p>
        </div>
        <div className="bg-card border rounded-2xl p-5 text-center">
          <IndianRupee className="w-6 h-6 mx-auto text-green-500 mb-2" />
          <p className="text-2xl font-bold">{formatPrice(referralInfo.totalEarned)}</p>
          <p className="text-xs text-muted-foreground mt-0.5">Lifetime Earnings</p>
        </div>
      </div>

      {/* Code card */}
      <div className="bg-card border-2 border-dashed border-amber-500/40 rounded-2xl p-6 mb-6 text-center">
        <p className="text-xs text-muted-foreground uppercase tracking-wide mb-2">Your Referral Code</p>
        <p className="text-3xl sm:text-4xl font-bold font-mono tracking-widest text-amber-600 mb-4 select-all">{code}</p>
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

      {/* Transaction history */}
      <div className="bg-card border rounded-2xl p-6 mb-6">
        <h2 className="font-semibold mb-4 flex items-center gap-2"><Coins className="w-4 h-4 text-amber-500" /> Coin History</h2>
        {transactions.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">No transactions yet — start sharing your code!</p>
        ) : (
          <ul className="divide-y">
            {transactions.map(tx => {
              const positive = tx.amount > 0;
              return (
                <li key={tx.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${positive ? "bg-green-100 dark:bg-green-900/30 text-green-600" : "bg-red-100 dark:bg-red-900/30 text-red-600"}`}>
                    {positive ? <ArrowDownCircle className="w-5 h-5" /> : <ArrowUpCircle className="w-5 h-5" />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{tx.description || REASON_LABEL[tx.reason] || tx.reason}</p>
                    <p className="text-xs text-muted-foreground">{formatDateTime(tx.createdAt)}</p>
                  </div>
                  <span className={`shrink-0 text-sm font-semibold ${positive ? "text-green-600" : "text-red-600"}`}>
                    {positive ? "+" : ""}{tx.amount} 🪙
                  </span>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* How it works */}
      <div className="bg-card border rounded-2xl p-6 mb-6">
        <h2 className="font-semibold mb-4">How it works</h2>
        <div className="space-y-4">
          {[
            { icon: Share2, title: "Share your code", desc: "Send your unique code to friends and family in Kohima." },
            { icon: Users, title: "They sign up & order", desc: "Your friend uses your code at signup. They get 50 Super Coins instantly." },
            { icon: IndianRupee, title: "You earn 100 Coins", desc: "When they place their first paid order, 100 Super Coins are added to your wallet." },
            { icon: Coins, title: "Redeem at checkout", desc: "Use coins on any order — up to 50% of the order value." },
          ].map(({ icon: Icon, title, desc }, i) => (
            <div key={i} className="flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center shrink-0">
                <Icon className="w-5 h-5 text-amber-600" />
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
          <li>Referral bonuses apply only on the friend's first paid order.</li>
          <li>Maximum coin redemption per order: 50% of the order total.</li>
          <li>Every order earns you 2% back as Super Coins automatically.</li>
          <li>One referral code per customer. Self-referrals are not eligible.</li>
        </ul>
      </div>
    </div>
  );
}
