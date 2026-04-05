import { useState } from "react";
import { Plus, Edit2, Trash2, Tag, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListCoupons, useCreateCoupon, useUpdateCoupon, useDeleteCoupon, getListCouponsQueryKey } from "@workspace/api-client-react";
import { formatDate, formatPrice } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface CouponForm {
  code: string;
  type: "PERCENTAGE" | "FIXED";
  value: string;
  minOrderValue: string;
  maxDiscount: string;
  usageLimit: string;
  expiresAt: string;
}

const emptyForm: CouponForm = {
  code: "", type: "PERCENTAGE", value: "", minOrderValue: "", maxDiscount: "", usageLimit: "", expiresAt: ""
};

export function AdminCoupons() {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<CouponForm>(emptyForm);

  const { data: coupons, isLoading } = useListCoupons();
  const createCoupon = useCreateCoupon();
  const updateCoupon = useUpdateCoupon(editingId ?? "");
  const deleteCoupon = useDeleteCoupon;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (coupon: NonNullable<typeof coupons>[0]) => {
    setEditingId(coupon.id);
    setForm({
      code: coupon.code,
      type: coupon.type as "PERCENTAGE" | "FIXED",
      value: String(coupon.value),
      minOrderValue: String(coupon.minOrderValue ?? ""),
      maxDiscount: String(coupon.maxDiscount ?? ""),
      usageLimit: String(coupon.usageLimit ?? ""),
      expiresAt: coupon.expiresAt ? new Date(coupon.expiresAt).toISOString().split("T")[0] : "",
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      code: form.code.toUpperCase(),
      type: form.type,
      value: parseFloat(form.value),
      minOrderValue: form.minOrderValue ? parseFloat(form.minOrderValue) : undefined,
      maxDiscount: form.maxDiscount ? parseFloat(form.maxDiscount) : undefined,
      usageLimit: form.usageLimit ? parseInt(form.usageLimit, 10) : undefined,
      expiresAt: form.expiresAt ? new Date(form.expiresAt).toISOString() : undefined,
    };

    if (editingId) {
      updateCoupon.mutate({ data: payload }, {
        onSuccess: () => {
          toast.success("Coupon updated");
          setOpen(false);
          queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });
        },
        onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed"),
      });
    } else {
      createCoupon.mutate({ data: payload }, {
        onSuccess: () => {
          toast.success("Coupon created");
          setOpen(false);
          queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });
        },
        onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed"),
      });
    }
  };

  const handleDelete = (id: string, code: string) => {
    if (!confirm(`Delete coupon "${code}"?`)) return;
    const mutation = deleteCoupon(id);
    mutation.mutate({}, {
      onSuccess: () => {
        toast.success("Coupon deleted");
        queryClient.invalidateQueries({ queryKey: getListCouponsQueryKey() });
      },
    });
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success(`Copied: ${code}`);
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-xl font-bold">Coupons</h1>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Coupon
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-3">
          {coupons?.map(coupon => (
            <div key={coupon.id} className="bg-card border rounded-xl p-4 flex flex-wrap items-center gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <code className="text-sm font-bold bg-muted px-2 py-0.5 rounded">{coupon.code}</code>
                  <button onClick={() => copyCode(coupon.code)} className="text-muted-foreground hover:text-foreground">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <Badge variant={coupon.isActive ? "default" : "secondary"} className="text-xs">
                    {coupon.isActive ? "Active" : "Inactive"}
                  </Badge>
                </div>
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>
                    {coupon.type === "PERCENTAGE" ? `${coupon.value}% off` : `₹${coupon.value} off`}
                  </span>
                  {coupon.minOrderValue && <span>Min: {formatPrice(coupon.minOrderValue)}</span>}
                  {coupon.maxDiscount && <span>Max: {formatPrice(coupon.maxDiscount)}</span>}
                  {coupon.expiresAt && <span>Expires: {formatDate(coupon.expiresAt)}</span>}
                  <span>Used: {coupon.usedCount ?? 0}{coupon.usageLimit ? `/${coupon.usageLimit}` : ""}</span>
                </div>
              </div>
              <div className="flex gap-1">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(coupon)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(coupon.id, coupon.code)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {!coupons?.length && (
            <div className="text-center py-12 text-muted-foreground">
              <Tag className="w-10 h-10 mx-auto mb-2 opacity-30" />
              <p>No coupons yet. Create your first coupon!</p>
            </div>
          )}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Coupon" : "Create Coupon"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Coupon Code *</Label>
              <input type="text" required placeholder="WELCOME100"
                className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 uppercase"
                value={form.code} onChange={e => setForm(f => ({ ...f, code: e.target.value.toUpperCase() }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Type *</Label>
                <Select value={form.type} onValueChange={(v: "PERCENTAGE" | "FIXED") => setForm(f => ({ ...f, type: v }))}>
                  <SelectTrigger className="h-9 text-sm"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PERCENTAGE">Percentage (%)</SelectItem>
                    <SelectItem value="FIXED">Fixed (₹)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">
                  Value * ({form.type === "PERCENTAGE" ? "%" : "₹"})
                </Label>
                <input type="number" required placeholder={form.type === "PERCENTAGE" ? "10" : "100"}
                  className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={form.value} onChange={e => setForm(f => ({ ...f, value: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Min Order (₹)</Label>
                <input type="number" placeholder="500"
                  className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={form.minOrderValue} onChange={e => setForm(f => ({ ...f, minOrderValue: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Max Discount (₹)</Label>
                <input type="number" placeholder="200"
                  className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={form.maxDiscount} onChange={e => setForm(f => ({ ...f, maxDiscount: e.target.value }))} />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Usage Limit</Label>
                <input type="number" placeholder="100"
                  className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={form.usageLimit} onChange={e => setForm(f => ({ ...f, usageLimit: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Expires At</Label>
                <input type="date"
                  className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={form.expiresAt} onChange={e => setForm(f => ({ ...f, expiresAt: e.target.value }))} />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1" disabled={createCoupon.isPending || updateCoupon.isPending}>
                {editingId ? "Update" : "Create"} Coupon
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
