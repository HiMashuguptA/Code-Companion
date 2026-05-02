import { useState } from "react";
import { Plus, Edit2, Trash2, Tag, Copy, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  useListCoupons, useCreateCoupon, useUpdateCoupon, useDeleteCoupon,
  getListCouponsQueryKey
} from "@workspace/api-client-react";
import type { Coupon } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { useLocation } from "wouter";
import { formatDate } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type CouponForm = {
  code: string;
  description: string;
  discountType: "FLAT" | "PERCENTAGE";
  discountValue: number;
  minOrderValue: number | undefined;
  maxDiscount: number | undefined;
  usageLimit: number | undefined;
  expiresAt: string | undefined;
  isActive: boolean;
};

const defaultForm: CouponForm = {
  code: "",
  description: "",
  discountType: "PERCENTAGE",
  discountValue: 10,
  minOrderValue: undefined,
  maxDiscount: undefined,
  usageLimit: undefined,
  expiresAt: undefined,
  isActive: true,
};

export function AdminCoupons() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { currentUser, isLoading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [editCoupon, setEditCoupon] = useState<Coupon | null>(null);
  const [form, setForm] = useState<CouponForm>(defaultForm);
  const [broadcastOpen, setBroadcastOpen] = useState(false);
  const [broadcastForm, setBroadcastForm] = useState({ title: "", message: "" });
  const [broadcastPending, setBroadcastPending] = useState(false);

  const { data: coupons, isLoading } = useListCoupons({
    query: { queryKey: getListCouponsQueryKey(), retry: false }
  });

  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon();
  const deleteCoupon = useDeleteCoupon();

  const openNew = () => {
    setEditCoupon(null);
    setForm(defaultForm);
    setOpen(true);
  };

  const openEdit = (c: Coupon) => {
    setEditCoupon(c);
    setForm({
      code: c.code,
      description: c.description ?? "",
      discountType: c.discountType as "FLAT" | "PERCENTAGE",
      discountValue: c.discountValue,
      minOrderValue: c.minOrderValue,
      maxDiscount: c.maxDiscount,
      usageLimit: c.usageLimit,
      expiresAt: c.expiresAt ? c.expiresAt.slice(0, 10) : undefined,
      isActive: c.isActive,
    });
    setOpen(true);
  };

  const handleSave = () => {
    const data = {
      code: form.code,
      description: form.description || undefined,
      discountType: form.discountType,
      discountValue: form.discountValue,
      minOrderValue: form.minOrderValue,
      maxDiscount: form.maxDiscount,
      usageLimit: form.usageLimit,
      expiresAt: form.expiresAt || undefined,
      isActive: form.isActive,
    };

    if (editCoupon) {
      updateCoupon.mutate({ couponId: editCoupon.id, data }, {
        onSuccess: () => {
          toast.success("Coupon updated");
          setOpen(false);
          qc.invalidateQueries({ queryKey: getListCouponsQueryKey() });
        },
        onError: () => toast.error("Failed to update coupon"),
      });
    } else {
      createCoupon.mutate({ data }, {
        onSuccess: () => {
          toast.success("Coupon created");
          setOpen(false);
          qc.invalidateQueries({ queryKey: getListCouponsQueryKey() });
        },
        onError: () => toast.error("Failed to create coupon"),
      });
    }
  };

  const handleDelete = (couponId: string) => {
    if (!confirm("Are you sure you want to delete this coupon?")) return;
    deleteCoupon.mutate({ couponId }, {
      onSuccess: () => {
        toast.success("Coupon deleted");
        qc.invalidateQueries({ queryKey: getListCouponsQueryKey() });
      },
      onError: () => toast.error("Failed to delete coupon"),
    });
  };

  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success("Coupon code copied!");
  };

  const handleBroadcast = async () => {
    if (!broadcastForm.title || !broadcastForm.message) {
      toast.error("Please fill in both title and message");
      return;
    }
    setBroadcastPending(true);
    try {
      const res = await fetch("/api/notifications/broadcast", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...broadcastForm, type: "PROMO" }),
        credentials: "include",
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed");
      toast.success(data.message ?? "Notification sent!");
      setBroadcastOpen(false);
      setBroadcastForm({ title: "", message: "" });
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Failed to send notification");
    } finally {
      setBroadcastPending(false);
    }
  };

  // Show skeleton while auth is loading
  if (authLoading) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-32" />
        <Skeleton className="h-10 w-40" />
      </div>
      <div className="grid sm:grid-cols-2 gap-4">
        {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
      </div>
    </div>
  );

  // Show sign in message if not authenticated
  if (!currentUser) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">You need to sign in as an admin to access this page</p>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Coupons</h1>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setBroadcastOpen(true)} className="gap-2">
            <Bell className="w-4 h-4" /> Notify Users
          </Button>
          <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> New Coupon</Button>
        </div>
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 gap-4">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-40 rounded-xl" />)}
        </div>
      ) : !coupons?.length ? (
        <div className="text-center py-16">
          <Tag className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground mb-4">No coupons yet</p>
          <Button onClick={openNew}>Create First Coupon</Button>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 gap-4">
          {coupons.map((c: Coupon) => (
            <div key={c.id} className="bg-card border rounded-xl p-4">
              <div className="flex items-start justify-between mb-3">
                <div className="flex items-center gap-2">
                  <button onClick={() => handleCopy(c.code)}
                    className="font-mono font-bold text-lg hover:text-primary transition-colors flex items-center gap-1">
                    {c.code}
                    <Copy className="w-3.5 h-3.5 opacity-60" />
                  </button>
                  {c.isActive ? (
                    <Badge className="bg-green-100 text-green-700 text-xs">Active</Badge>
                  ) : (
                    <Badge variant="outline" className="text-xs text-muted-foreground">Inactive</Badge>
                  )}
                </div>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openEdit(c)}>
                    <Edit2 className="w-3.5 h-3.5" />
                  </Button>
                  <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(c.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {c.description && <p className="text-sm text-muted-foreground mb-2">{c.description}</p>}

              <div className="flex flex-wrap gap-2 text-xs">
                <span className="bg-primary/10 text-primary px-2 py-1 rounded-full font-medium">
                  {c.discountType === "PERCENTAGE" ? `${c.discountValue}% off` : `₹${c.discountValue} off`}
                </span>
                {c.minOrderValue && (
                  <span className="bg-muted text-muted-foreground px-2 py-1 rounded-full">
                    Min ₹{c.minOrderValue}
                  </span>
                )}
                {c.maxDiscount && c.discountType === "PERCENTAGE" && (
                  <span className="bg-muted text-muted-foreground px-2 py-1 rounded-full">
                    Max ₹{c.maxDiscount}
                  </span>
                )}
              </div>

              <div className="flex justify-between mt-3 text-xs text-muted-foreground">
                <span>Used: {c.usageCount ?? 0}{c.usageLimit ? `/${c.usageLimit}` : ""}</span>
                {c.expiresAt && <span>Expires {formatDate(c.expiresAt)}</span>}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editCoupon ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Code *</Label>
              <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 uppercase font-mono"
                placeholder="SAVE20" value={form.code}
                onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="20% off on all stationery" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Discount Type</Label>
                <select className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={form.discountType} onChange={e => setForm(f => ({ ...f, discountType: e.target.value as "FLAT" | "PERCENTAGE" }))}>
                  <option value="PERCENTAGE">Percentage (%)</option>
                  <option value="FLAT">Flat (₹)</option>
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Discount Value *</Label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder={form.discountType === "PERCENTAGE" ? "10" : "50"}
                  value={form.discountValue || ""}
                  onChange={e => setForm(f => ({ ...f, discountValue: parseFloat(e.target.value) || 0 }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Min Order (₹)</Label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="200"
                  value={form.minOrderValue ?? ""}
                  onChange={e => setForm(f => ({ ...f, minOrderValue: e.target.value ? parseFloat(e.target.value) : undefined }))} />
              </div>
              {form.discountType === "PERCENTAGE" && (
                <div>
                  <Label className="text-xs text-muted-foreground">Max Discount (₹)</Label>
                  <input type="number" className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="100"
                    value={form.maxDiscount ?? ""}
                    onChange={e => setForm(f => ({ ...f, maxDiscount: e.target.value ? parseFloat(e.target.value) : undefined }))} />
                </div>
              )}
              <div>
                <Label className="text-xs text-muted-foreground">Usage Limit</Label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="100"
                  value={form.usageLimit ?? ""}
                  onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value ? parseInt(e.target.value) : undefined }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Expires At</Label>
                <input type="date" className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={form.expiresAt ?? ""}
                  onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value || undefined }))} />
              </div>
            </div>
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActive" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="accent-primary" />
              <Label htmlFor="isActive" className="cursor-pointer">Active</Label>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={createCoupon.isPending || updateCoupon.isPending} className="flex-1">
                {editCoupon ? "Update Coupon" : "Create Coupon"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Broadcast notification dialog */}
      <Dialog open={broadcastOpen} onOpenChange={setBroadcastOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Bell className="w-4 h-4" /> Send Notification to All Users</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Title *</Label>
              <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g. New Coupon Available!"
                value={broadcastForm.title}
                onChange={e => setBroadcastForm(f => ({ ...f, title: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Message *</Label>
              <textarea className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                rows={3}
                placeholder="Use code SAVE20 to get 20% off your next order!"
                value={broadcastForm.message}
                onChange={e => setBroadcastForm(f => ({ ...f, message: e.target.value }))} />
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleBroadcast} disabled={broadcastPending} className="flex-1 gap-2">
                <Bell className="w-4 h-4" />
                {broadcastPending ? "Sending..." : "Send to All Users"}
              </Button>
              <Button variant="outline" onClick={() => setBroadcastOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
