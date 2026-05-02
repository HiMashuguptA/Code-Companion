import { useState, useRef } from "react";
import { Plus, Edit2, Trash2, Package, Search, Upload, X, Star, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useListCategories, useListProductTags,
  getListProductsQueryKey, getListCategoriesQueryKey, getListProductTagsQueryKey,
} from "@workspace/api-client-react";
import type { Product, Category } from "@workspace/api-client-react";
import { useAuth } from "@/contexts/FirebaseContext";
import { useLocation } from "wouter";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type ProductForm = {
  name: string;
  description: string;
  actualPrice: number;
  sellingPrice: number;
  stock: number;
  categoryId: string;
  images: string[];
  tags: string[];
  isFeatured: boolean;
  lowStockThreshold: number;
};

const defaultForm: ProductForm = {
  name: "", description: "", actualPrice: 0, sellingPrice: 0,
  stock: 0, categoryId: "", images: [], tags: [], isFeatured: false, lowStockThreshold: 5,
};

export function AdminProducts() {
  const qc = useQueryClient();
  const [, navigate] = useLocation();
  const { currentUser, isLoading: authLoading } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [search, setSearch] = useState("");
  const [imageInput, setImageInput] = useState("");
  const [tagInput, setTagInput] = useState("");

  const { data: productsData, isLoading } = useListProducts({ limit: 200 }, {
    query: {
      queryKey: getListProductsQueryKey({ limit: 200 }),
      refetchInterval: 4000,
      refetchOnMount: true,
    },
  });
  const { data: categories } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey(), retry: false, refetchInterval: 4000 },
  });
  const { data: existingTags } = useListProductTags({
    query: { queryKey: getListProductTagsQueryKey(), staleTime: 1000 * 60 * 2 },
  });

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const openNew = () => { setEditProduct(null); setForm(defaultForm); setImageInput(""); setTagInput(""); setOpen(true); };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      actualPrice: p.actualPrice ?? p.sellingPrice,
      sellingPrice: p.sellingPrice,
      stock: p.stock ?? 0,
      categoryId: p.categoryId ?? "",
      images: p.images ?? [],
      tags: p.tags ?? [],
      isFeatured: p.isFeatured ?? false,
      lowStockThreshold: p.lowStockThreshold ?? 5,
    });
    setImageInput(""); setTagInput(""); setOpen(true);
  };

  const handleSave = () => {
    if (!form.name?.trim()) { toast.error("Product name is required"); return; }
    if (!form.description?.trim()) { toast.error("Product description is required"); return; }
    if (form.actualPrice <= 0) { toast.error("Actual price must be greater than 0"); return; }
    if (form.sellingPrice <= 0) { toast.error("Selling price must be greater than 0"); return; }
    const data = {
      name: form.name.trim(),
      description: form.description.trim(),
      actualPrice: form.actualPrice,
      sellingPrice: form.sellingPrice,
      stock: form.stock,
      categoryId: form.categoryId || undefined,
      images: form.images,
      tags: form.tags,
      isFeatured: form.isFeatured,
      lowStockThreshold: form.lowStockThreshold,
    };
    const onDone = (msg: string) => () => {
      toast.success(msg); setOpen(false); setForm(defaultForm);
      qc.invalidateQueries({ queryKey: getListProductsQueryKey({ limit: 200 }) });
      qc.invalidateQueries({ queryKey: getListProductTagsQueryKey() });
    };
    if (editProduct) {
      updateProduct.mutate({ productId: editProduct.id, data }, {
        onSuccess: onDone("Product updated"),
        onError: () => toast.error("Failed to update product"),
      });
    } else {
      createProduct.mutate({ data }, {
        onSuccess: onDone("Product created"),
        onError: () => toast.error("Failed to create product"),
      });
    }
  };

  const handleDelete = (productId: string) => {
    if (!confirm("Delete this product?")) return;
    deleteProduct.mutate({ productId }, {
      onSuccess: () => {
        toast.success("Product deleted");
        qc.invalidateQueries({ queryKey: getListProductsQueryKey({ limit: 200 }) });
      },
      onError: () => toast.error("Failed to delete product"),
    });
  };

  const handleToggleFeatured = (p: Product) => {
    updateProduct.mutate({ productId: p.id, data: { isFeatured: !p.isFeatured } }, {
      onSuccess: () => qc.invalidateQueries({ queryKey: getListProductsQueryKey({ limit: 200 }) }),
    });
  };

  const addImage = () => {
    if (imageInput.trim()) { setForm(f => ({ ...f, images: [...f.images, imageInput.trim()] })); setImageInput(""); }
  };

  const addTag = (raw?: string) => {
    const t = (raw ?? tagInput).trim().toLowerCase().replace(/\s+/g, "-");
    if (!t) return;
    setForm(f => f.tags.includes(t) ? f : { ...f, tags: [...f.tags, t] });
    setTagInput("");
  };

  const removeTag = (t: string) => setForm(f => ({ ...f, tags: f.tags.filter(x => x !== t) }));

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.currentTarget.files;
    if (!files) return;
    Array.from(files).forEach(file => {
      if (!file.type.startsWith("image/")) { toast.error(`${file.name} is not an image`); return; }
      const reader = new FileReader();
      reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement("canvas");
          let { width, height } = img;
          const MAX = 1200;
          if (width > height) { if (width > MAX) { height *= MAX / width; width = MAX; } }
          else { if (height > MAX) { width *= MAX / height; height = MAX; } }
          canvas.width = width; canvas.height = height;
          const ctx = canvas.getContext("2d"); if (!ctx) return;
          ctx.drawImage(img, 0, 0, width, height);
          setForm(f => ({ ...f, images: [...f.images, canvas.toDataURL("image/jpeg", 0.7)] }));
        };
        img.src = ev.target?.result as string;
      };
      reader.onerror = () => toast.error(`Failed to read ${file.name}`);
      reader.readAsDataURL(file);
    });
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const products = productsData?.products ?? [];
  const filtered = products.filter((p: Product) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
    (p.tags ?? []).some(t => t.toLowerCase().includes(search.toLowerCase())),
  );

  if (authLoading) return (
    <div className="space-y-4">
      <div className="flex items-center justify-between mb-6">
        <Skeleton className="h-8 w-32" /><Skeleton className="h-10 w-32" />
      </div>
      <Skeleton className="h-10 w-full mb-4" />
      <div className="space-y-3">{[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}</div>
    </div>
  );

  if (!currentUser) {
    return (
      <div className="text-center py-16">
        <h2 className="text-xl font-semibold mb-2">Access Denied</h2>
        <p className="text-muted-foreground mb-4">You need to sign in as an admin to access this page</p>
        <Button onClick={() => navigate("/auth")}>Sign In</Button>
      </div>
    );
  }

  const tagSuggestions = (existingTags ?? [])
    .map(t => t.tag)
    .filter(t => !form.tags.includes(t))
    .slice(0, 12);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Add Product</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Search by name or tag..." value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map(i => <Skeleton key={i} className="h-56 rounded-xl" />)}
        </div>
      ) : !filtered.length ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground mb-4">{search ? "No products match your search" : "No products yet"}</p>
          {!search && <Button onClick={openNew}>Add First Product</Button>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: Product) => {
            const lowStock = (p.stock ?? 0) <= (p.lowStockThreshold ?? 5);
            return (
              <div key={p.id} className="bg-card border rounded-xl overflow-hidden">
                <div className="relative aspect-video bg-muted">
                  <img src={p.images?.[0] ?? "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=300"}
                    alt={p.name} className="w-full h-full object-cover"
                    onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=300"; }} />
                  {p.isFeatured && (
                    <Badge className="absolute top-2 left-2 gap-1 bg-yellow-400 text-black border-0">
                      <Star className="w-3 h-3 fill-black" /> Featured
                    </Badge>
                  )}
                  {lowStock && (
                    <Badge className="absolute top-2 right-2 gap-1 bg-red-500 text-white border-0">
                      <AlertTriangle className="w-3 h-3" /> Low
                    </Badge>
                  )}
                </div>
                <div className="p-3">
                  <p className="font-medium text-sm line-clamp-2 mb-1">{p.name}</p>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-primary">{formatPrice(p.sellingPrice)}</span>
                    <span className={`text-xs ${lowStock ? "text-red-500 font-semibold" : "text-muted-foreground"}`}>Stock: {p.stock}</span>
                  </div>
                  {p.salesCount > 0 && (
                    <p className="text-xs text-muted-foreground mb-1">Sold: {p.salesCount}</p>
                  )}
                  {(p.tags ?? []).length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {(p.tags ?? []).slice(0, 3).map(t => (
                        <Badge key={t} variant="secondary" className="text-[10px] px-1.5 py-0">{t}</Badge>
                      ))}
                      {(p.tags ?? []).length > 3 && (
                        <Badge variant="secondary" className="text-[10px] px-1.5 py-0">+{(p.tags ?? []).length - 3}</Badge>
                      )}
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-1.5 pt-1 border-t">
                    <label className="flex items-center gap-1.5 text-xs cursor-pointer">
                      <Switch checked={p.isFeatured ?? false} onCheckedChange={() => handleToggleFeatured(p)} />
                      Featured
                    </label>
                    <div className="flex gap-1">
                      <Button variant="outline" size="sm" className="gap-1 text-xs h-7" onClick={() => openEdit(p)}>
                        <Edit2 className="w-3 h-3" /> Edit
                      </Button>
                      <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => handleDelete(p.id)}>
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editProduct ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Name *</Label>
              <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="Product name" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <textarea className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                rows={3} placeholder="Product description" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Actual Price (₹) *</Label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="199" value={form.actualPrice || ""}
                  onChange={e => setForm(f => ({ ...f, actualPrice: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Selling Price (₹) *</Label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="99" value={form.sellingPrice || ""}
                  onChange={e => setForm(f => ({ ...f, sellingPrice: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Stock</Label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="50" value={form.stock || ""}
                  onChange={e => setForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Low-stock threshold</Label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="5" value={form.lowStockThreshold || ""}
                  onChange={e => setForm(f => ({ ...f, lowStockThreshold: parseInt(e.target.value) || 0 }))} />
              </div>
              <div className="col-span-2">
                <Label className="text-xs text-muted-foreground">Category</Label>
                <select className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">No Category</option>
                  {categories?.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>

            {/* Featured toggle */}
            <div className="flex items-center justify-between p-3 bg-muted/40 rounded-lg">
              <div>
                <Label className="text-sm font-medium flex items-center gap-1.5">
                  <Star className="w-4 h-4 text-yellow-500" /> Featured Product
                </Label>
                <p className="text-xs text-muted-foreground">Featured products appear in the homepage spotlight rail.</p>
              </div>
              <Switch checked={form.isFeatured} onCheckedChange={v => setForm(f => ({ ...f, isFeatured: v }))} />
            </div>

            {/* Tags */}
            <div>
              <Label className="text-xs text-muted-foreground">Tags / Features (used for filtering)</Label>
              <div className="flex gap-2 mt-1">
                <input className="flex-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="e.g. waterproof, gel-pen, kids" value={tagInput}
                  onChange={e => setTagInput(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter" || e.key === ",") { e.preventDefault(); addTag(); } }} />
                <Button type="button" variant="outline" size="sm" onClick={() => addTag()}>Add Tag</Button>
              </div>
              {form.tags.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {form.tags.map(t => (
                    <Badge key={t} variant="secondary" className="gap-1 pr-1">
                      {t}
                      <button onClick={() => removeTag(t)} className="hover:text-destructive">
                        <X className="w-3 h-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              )}
              {tagSuggestions.length > 0 && (
                <div className="mt-2">
                  <p className="text-xs text-muted-foreground mb-1">Suggestions:</p>
                  <div className="flex flex-wrap gap-1.5">
                    {tagSuggestions.map(t => (
                      <button key={t} type="button" onClick={() => addTag(t)}
                        className="text-xs px-2 py-0.5 rounded-full border hover:bg-muted">+ {t}</button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div>
              <Label className="text-xs text-muted-foreground">Images (URLs or Files)</Label>
              <div className="space-y-2 mt-1">
                <div className="flex gap-2">
                  <input className="flex-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                    placeholder="https://example.com/image.jpg" value={imageInput} onChange={e => setImageInput(e.target.value)}
                    onKeyDown={e => e.key === "Enter" && addImage()} />
                  <Button type="button" variant="outline" size="sm" onClick={addImage}>Add URL</Button>
                  <Button type="button" variant="outline" size="sm" className="gap-1" onClick={() => fileInputRef.current?.click()}>
                    <Upload className="w-3 h-3" /> Upload
                  </Button>
                  <input ref={fileInputRef} type="file" multiple accept="image/*" onChange={handleFileUpload} className="hidden" />
                </div>
              </div>
              {form.images.length > 0 && (
                <div className="flex gap-2 mt-2 flex-wrap">
                  {form.images.map((img, i) => (
                    <div key={i} className="relative group">
                      <img src={img} alt="" className="w-12 h-12 rounded-lg object-cover border" />
                      <button className="absolute -top-1 -right-1 w-4 h-4 bg-destructive rounded-full text-white text-xs hidden group-hover:flex items-center justify-center"
                        onClick={() => setForm(f => ({ ...f, images: f.images.filter((_, j) => j !== i) }))}>×</button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={createProduct.isPending || updateProduct.isPending} className="flex-1">
                {editProduct ? "Update Product" : "Add Product"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
