import { useState, useRef, useCallback } from "react";
import { Plus, Pencil, Trash2, Eye, EyeOff, ImageIcon, ExternalLink, Package, Upload, Crop, ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import {
  useListAllBanners, useCreateBanner, useUpdateBanner, useDeleteBanner, useListProducts,
  getListAllBannersQueryKey, getListBannersQueryKey, getListProductsQueryKey,
} from "@workspace/api-client-react";
import type { Product } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";

const TARGET_W = 1400;
const TARGET_H = 525;
const CROP_ASPECT = TARGET_W / TARGET_H; // ~2.667:1

interface BannerForm {
  title: string;
  subtitle: string;
  imageUrl: string;
  linkUrl: string;
  productId: string;
  position: "TOP" | "MIDDLE" | "BOTTOM";
  size: "SMALL" | "MEDIUM" | "LARGE" | "FULL";
  sortOrder: number;
  isActive: boolean;
}

const EMPTY_FORM: BannerForm = {
  title: "", subtitle: "", imageUrl: "", linkUrl: "", productId: "",
  position: "TOP", size: "FULL", sortOrder: 0, isActive: true,
};

interface BannerRecord extends Omit<BannerForm, "productId"> {
  id: string;
  productId?: string | null;
}

export function AdminBanners() {
  const qc = useQueryClient();
  const { data, isLoading } = useListAllBanners({
    query: { queryKey: getListAllBannersQueryKey() },
  });
  const { data: productsData } = useListProducts({ limit: 200 }, {
    query: { queryKey: getListProductsQueryKey({ limit: 200 }), staleTime: 1000 * 60 * 5 },
  });
  const products = (productsData?.products ?? []) as Product[];
  const banners = (data ?? []) as BannerRecord[];

  const createMut = useCreateBanner();
  const updateMut = useUpdateBanner();
  const deleteMut = useDeleteBanner();

  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<BannerForm>(EMPTY_FORM);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Crop dialog state
  const [cropOpen, setCropOpen] = useState(false);
  const [rawImage, setRawImage] = useState<HTMLImageElement | null>(null);
  const [cropOffsetX, setCropOffsetX] = useState(50); // 0-100 percent
  const [cropOffsetY, setCropOffsetY] = useState(50); // 0-100 percent

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) { toast.error("File too large (max 20 MB)"); return; }
    setUploading(true);
    const reader = new FileReader();
    reader.onload = evt => {
      const img = new Image();
      img.onload = () => {
        setRawImage(img);
        setCropOffsetX(50);
        setCropOffsetY(50);
        setUploading(false);
        setCropOpen(true); // Open crop dialog
      };
      img.src = evt.target?.result as string;
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  const applyCrop = useCallback(() => {
    if (!rawImage) return;
    const canvas = document.createElement("canvas");
    canvas.width = TARGET_W;
    canvas.height = TARGET_H;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const imgAspect = rawImage.naturalWidth / rawImage.naturalHeight;
    let srcX: number, srcY: number, srcW: number, srcH: number;

    if (imgAspect > CROP_ASPECT) {
      // Image wider than crop window — crop horizontally, full height
      srcH = rawImage.naturalHeight;
      srcW = rawImage.naturalHeight * CROP_ASPECT;
      srcX = (rawImage.naturalWidth - srcW) * (cropOffsetX / 100);
      srcY = 0;
    } else {
      // Image taller than crop window — crop vertically, full width
      srcW = rawImage.naturalWidth;
      srcH = rawImage.naturalWidth / CROP_ASPECT;
      srcX = 0;
      srcY = (rawImage.naturalHeight - srcH) * (cropOffsetY / 100);
    }

    ctx.drawImage(rawImage, srcX, srcY, srcW, srcH, 0, 0, TARGET_W, TARGET_H);
    const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
    setForm(f => ({ ...f, imageUrl: dataUrl }));
    setCropOpen(false);
    setRawImage(null);
  }, [rawImage, cropOffsetX, cropOffsetY]);

  // Computed preview style for the crop viewport
  const cropPreviewStyle = useCallback(() => {
    if (!rawImage) return {};
    const previewW = 560; // dialog width approx
    const previewH = previewW / CROP_ASPECT;
    const imgAspect = rawImage.naturalWidth / rawImage.naturalHeight;

    if (imgAspect > CROP_ASPECT) {
      // Image wider — show full height, offset horizontally
      const scaledImgW = previewH * imgAspect;
      const maxOffsetPx = scaledImgW - previewW;
      const offsetPx = maxOffsetPx * (cropOffsetX / 100);
      return {
        backgroundImage: `url(${rawImage.src})`,
        backgroundSize: `${scaledImgW}px ${previewH}px`,
        backgroundPosition: `-${offsetPx}px 0px`,
        backgroundRepeat: "no-repeat",
        width: "100%",
        aspectRatio: `${TARGET_W} / ${TARGET_H}`,
      };
    } else {
      // Image taller — show full width, offset vertically
      const scaledImgH = previewW / imgAspect;
      const maxOffsetPx = scaledImgH - previewH;
      const offsetPx = maxOffsetPx * (cropOffsetY / 100);
      return {
        backgroundImage: `url(${rawImage.src})`,
        backgroundSize: `${previewW}px ${scaledImgH}px`,
        backgroundPosition: `0px -${offsetPx}px`,
        backgroundRepeat: "no-repeat",
        width: "100%",
        aspectRatio: `${TARGET_W} / ${TARGET_H}`,
      };
    }
  }, [rawImage, cropOffsetX, cropOffsetY]);

  function openCreate() { setEditingId(null); setForm(EMPTY_FORM); setOpen(true); }

  function openEdit(b: BannerRecord) {
    setEditingId(b.id);
    setForm({
      title: b.title, subtitle: b.subtitle ?? "", imageUrl: b.imageUrl,
      linkUrl: b.linkUrl ?? "", productId: b.productId ?? "",
      position: b.position, size: b.size, sortOrder: b.sortOrder ?? 0, isActive: b.isActive,
    });
    setOpen(true);
  }

  function invalidateAll() {
    qc.invalidateQueries({ queryKey: getListAllBannersQueryKey() });
    qc.invalidateQueries({ queryKey: getListBannersQueryKey({ position: "TOP" }) });
    qc.invalidateQueries({ queryKey: getListBannersQueryKey({ position: "MIDDLE" }) });
    qc.invalidateQueries({ queryKey: getListBannersQueryKey({ position: "BOTTOM" }) });
  }

  function handleSubmit() {
    if (!form.title.trim() || !form.imageUrl.trim()) {
      toast.error("Title and image URL are required"); return;
    }
    const body = {
      title: form.title.trim(), subtitle: form.subtitle.trim() || undefined,
      imageUrl: form.imageUrl.trim(), linkUrl: form.linkUrl.trim() || undefined,
      productId: form.productId || undefined, position: form.position,
      size: form.size, sortOrder: Number(form.sortOrder) || 0, isActive: form.isActive,
    };
    const cb = {
      onSuccess: () => { toast.success(editingId ? "Banner updated" : "Banner created"); setOpen(false); invalidateAll(); },
      onError: () => toast.error(editingId ? "Failed to update banner" : "Failed to create banner"),
    };
    if (editingId) updateMut.mutate({ bannerId: editingId, data: body }, cb);
    else createMut.mutate({ data: body }, cb);
  }

  function handleDelete(id: string) {
    if (!confirm("Delete this banner?")) return;
    deleteMut.mutate({ bannerId: id }, {
      onSuccess: () => { toast.success("Banner deleted"); invalidateAll(); },
      onError: () => toast.error("Failed to delete"),
    });
  }

  function handleToggleActive(b: BannerRecord) {
    updateMut.mutate({ bannerId: b.id, data: { isActive: !b.isActive } }, { onSuccess: () => invalidateAll() });
  }

  const linkedProductName = (productId?: string | null) =>
    productId ? products.find(p => p.id === productId)?.name : null;

  const needsHorizontalCrop = rawImage && (rawImage.naturalWidth / rawImage.naturalHeight) > CROP_ASPECT;
  const needsVerticalCrop = rawImage && (rawImage.naturalWidth / rawImage.naturalHeight) <= CROP_ASPECT;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold">Banners</h1>
          <p className="text-sm text-muted-foreground">Promotional banners shown on the homepage. The TOP position rotates as a carousel.</p>
        </div>
        <Button onClick={openCreate} className="gap-1.5">
          <Plus className="w-4 h-4" /> New Banner
        </Button>
      </div>

      {isLoading ? (
        <div className="grid gap-3">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-28 rounded-xl" />)}
        </div>
      ) : banners.length === 0 ? (
        <div className="text-center py-16 bg-card border rounded-xl">
          <ImageIcon className="w-10 h-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium">No banners yet</p>
          <p className="text-sm text-muted-foreground mb-4">Create your first promotional banner to display on the homepage.</p>
          <Button onClick={openCreate} className="gap-1.5"><Plus className="w-4 h-4" /> New Banner</Button>
        </div>
      ) : (
        <div className="grid gap-3">
          {banners.map(b => {
            const linkedName = linkedProductName(b.productId);
            return (
              <div key={b.id} className="bg-card border rounded-xl overflow-hidden flex flex-col sm:flex-row">
                <div className="sm:w-48 h-32 sm:h-auto shrink-0 bg-muted">
                  {b.imageUrl ? <img src={b.imageUrl} alt={b.title} className="w-full h-full object-cover" /> : (
                    <div className="w-full h-full flex items-center justify-center text-muted-foreground"><ImageIcon className="w-8 h-8" /></div>
                  )}
                </div>
                <div className="flex-1 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      <h3 className="font-semibold truncate">{b.title}</h3>
                      <Badge variant="outline" className="text-xs">{b.position}</Badge>
                      <Badge variant="outline" className="text-xs">{b.size}</Badge>
                      {b.isActive
                        ? <Badge className="text-xs bg-green-500/10 text-green-700 border-green-500/30 hover:bg-green-500/10">Active</Badge>
                        : <Badge variant="secondary" className="text-xs">Hidden</Badge>}
                      <span className="text-xs text-muted-foreground">order: {b.sortOrder}</span>
                    </div>
                    {b.subtitle && <p className="text-sm text-muted-foreground line-clamp-2">{b.subtitle}</p>}
                    {linkedName ? (
                      <p className="text-xs text-blue-600 flex items-center gap-1 mt-1"><Package className="w-3 h-3" /> Links to product: {linkedName}</p>
                    ) : b.linkUrl ? (
                      <p className="text-xs text-muted-foreground flex items-center gap-1 mt-1"><ExternalLink className="w-3 h-3" /> {b.linkUrl}</p>
                    ) : null}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <Button size="sm" variant="ghost" onClick={() => handleToggleActive(b)} title={b.isActive ? "Hide" : "Show"}>
                      {b.isActive ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => openEdit(b)}><Pencil className="w-4 h-4" /></Button>
                    <Button size="sm" variant="ghost" onClick={() => handleDelete(b.id)}><Trash2 className="w-4 h-4 text-destructive" /></Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Banner form dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Banner" : "New Banner"}</DialogTitle>
            <DialogDescription>Promotional banners shown on the homepage. TOP position rotates as a carousel.</DialogDescription>
          </DialogHeader>
          <div className="grid gap-3">
            <div>
              <Label htmlFor="b-title">Title *</Label>
              <Input id="b-title" value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="e.g. Same-Day Delivery in Kohima" />
            </div>
            <div>
              <Label htmlFor="b-subtitle">Subtitle</Label>
              <Textarea id="b-subtitle" rows={2} value={form.subtitle} onChange={e => setForm(f => ({ ...f, subtitle: e.target.value }))} placeholder="Optional supporting text" />
            </div>
            <div>
              <Label>Banner Image *</Label>
              <div className="flex gap-2 mt-1">
                <Input value={form.imageUrl.startsWith("data:") ? "(uploaded image)" : form.imageUrl}
                  onChange={e => setForm(f => ({ ...f, imageUrl: e.target.value }))}
                  placeholder="Paste URL or upload file below"
                  readOnly={form.imageUrl.startsWith("data:")}
                  className={form.imageUrl.startsWith("data:") ? "opacity-60" : ""}
                />
                <Button type="button" variant="outline" size="sm" className="shrink-0 gap-1.5"
                  onClick={() => fileInputRef.current?.click()} disabled={uploading}>
                  <Upload className="w-3.5 h-3.5" />
                  {uploading ? "Loading…" : "Upload"}
                </Button>
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileUpload} />
              <p className="text-xs text-muted-foreground mt-1">Tip: Upload any image — you can crop/position it after uploading. Ideal output: 1400×525 px.</p>
              {form.imageUrl && (
                <div className="mt-2 rounded-lg overflow-hidden border h-28 bg-muted relative group">
                  <img src={form.imageUrl} alt="preview" className="w-full h-full object-cover" />
                  <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                    {form.imageUrl.startsWith("data:") && (
                      <Button type="button" size="sm" variant="secondary" className="gap-1 text-xs"
                        onClick={() => { setRawImage(null); setCropOffsetX(50); setCropOffsetY(50); /* re-open crop */ fileInputRef.current?.click(); }}>
                        <Crop className="w-3 h-3" /> Re-crop
                      </Button>
                    )}
                    <button type="button"
                      className="bg-destructive text-destructive-foreground rounded-md px-2 py-1 text-xs"
                      onClick={() => setForm(f => ({ ...f, imageUrl: "" }))}>Remove</button>
                  </div>
                </div>
              )}
            </div>
            <div>
              <Label htmlFor="b-product">Link to Product (recommended)</Label>
              <Select value={form.productId || "__none"} onValueChange={v => setForm(f => ({ ...f, productId: v === "__none" ? "" : v }))}>
                <SelectTrigger><SelectValue placeholder="No product (use custom URL)" /></SelectTrigger>
                <SelectContent className="max-h-60 overflow-y-auto">
                  <SelectItem value="__none">— No product (use custom URL below) —</SelectItem>
                  {products.map(p => <SelectItem key={p.id} value={p.id}>{p.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label htmlFor="b-link">Custom Link URL</Label>
              <Input id="b-link" value={form.linkUrl} onChange={e => setForm(f => ({ ...f, linkUrl: e.target.value }))}
                placeholder="/?category=pens-pencils" disabled={!!form.productId} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Position</Label>
                <Select value={form.position} onValueChange={v => setForm(f => ({ ...f, position: v as BannerForm["position"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="TOP">Top (rotating carousel)</SelectItem>
                    <SelectItem value="MIDDLE">Middle</SelectItem>
                    <SelectItem value="BOTTOM">Bottom</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Size</Label>
                <Select value={form.size} onValueChange={v => setForm(f => ({ ...f, size: v as BannerForm["size"] }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="SMALL">Small</SelectItem>
                    <SelectItem value="MEDIUM">Medium</SelectItem>
                    <SelectItem value="LARGE">Large</SelectItem>
                    <SelectItem value="FULL">Full width</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 items-end">
              <div>
                <Label htmlFor="b-order">Sort order</Label>
                <Input id="b-order" type="number" value={form.sortOrder} onChange={e => setForm(f => ({ ...f, sortOrder: Number(e.target.value) }))} />
              </div>
              <div className="flex items-center justify-between gap-2 h-10 px-3 border rounded-md">
                <Label htmlFor="b-active" className="cursor-pointer">Active</Label>
                <Switch id="b-active" checked={form.isActive} onCheckedChange={v => setForm(f => ({ ...f, isActive: v }))} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button onClick={handleSubmit} disabled={createMut.isPending || updateMut.isPending}>
              {editingId ? "Save Changes" : "Create Banner"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Crop / Position dialog */}
      <Dialog open={cropOpen} onOpenChange={open => { if (!open) { setCropOpen(false); setRawImage(null); } }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2"><Crop className="w-4 h-4" /> Crop & Position Banner</DialogTitle>
            <DialogDescription>
              The dashed frame shows exactly what will appear in the banner (1400×525). Adjust the slider to reposition the image.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Live crop preview */}
            <div className="rounded-xl overflow-hidden border-2 border-dashed border-primary/50" style={cropPreviewStyle()} />

            {/* Offset sliders */}
            {needsHorizontalCrop && (
              <div>
                <Label className="text-sm flex items-center gap-2 mb-1">
                  <ChevronLeft className="w-4 h-4" /> Horizontal Position <ChevronRight className="w-4 h-4" />
                </Label>
                <input type="range" min={0} max={100} value={cropOffsetX}
                  onChange={e => setCropOffsetX(Number(e.target.value))}
                  className="w-full accent-primary" />
                <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                  <span>Left</span><span>Center</span><span>Right</span>
                </div>
              </div>
            )}
            {needsVerticalCrop && (
              <div>
                <Label className="text-sm mb-1 block">Vertical Position</Label>
                <input type="range" min={0} max={100} value={cropOffsetY}
                  onChange={e => setCropOffsetY(Number(e.target.value))}
                  className="w-full accent-primary" />
                <div className="flex justify-between text-xs text-muted-foreground mt-0.5">
                  <span>Top</span><span>Center</span><span>Bottom</span>
                </div>
              </div>
            )}

            <p className="text-xs text-muted-foreground">The final image will be exported at 1400×525 px (JPEG 95% quality).</p>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => { setCropOpen(false); setRawImage(null); }}>Cancel</Button>
            <Button onClick={applyCrop} className="gap-1.5"><Crop className="w-4 h-4" /> Apply Crop</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
