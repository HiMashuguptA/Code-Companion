import { useState } from "react";
import { Plus, Edit2, Trash2, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  useListProducts, useCreateProduct, useUpdateProduct, useDeleteProduct,
  useListCategories,
  getListProductsQueryKey, getListCategoriesQueryKey
} from "@workspace/api-client-react";
import type { Product, Category } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

type ProductForm = {
  name: string;
  description: string;
  price: number;
  comparePrice: number | undefined;
  stock: number;
  categoryId: string;
  brand: string;
  sku: string;
  isActive: boolean;
  images: string[];
};

const defaultForm: ProductForm = {
  name: "",
  description: "",
  price: 0,
  comparePrice: undefined,
  stock: 0,
  categoryId: "",
  brand: "",
  sku: "",
  isActive: true,
  images: [],
};

export function AdminProducts() {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [editProduct, setEditProduct] = useState<Product | null>(null);
  const [form, setForm] = useState<ProductForm>(defaultForm);
  const [search, setSearch] = useState("");
  const [imageInput, setImageInput] = useState("");

  const { data: productsData, isLoading } = useListProducts({}, {
    query: { queryKey: getListProductsQueryKey({}) }
  });
  const { data: categories } = useListCategories({
    query: { queryKey: getListCategoriesQueryKey() }
  });

  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct();
  const deleteProduct = useDeleteProduct();

  const openNew = () => {
    setEditProduct(null);
    setForm(defaultForm);
    setImageInput("");
    setOpen(true);
  };

  const openEdit = (p: Product) => {
    setEditProduct(p);
    setForm({
      name: p.name,
      description: p.description ?? "",
      price: p.price,
      comparePrice: p.comparePrice,
      stock: p.stock ?? 0,
      categoryId: p.categoryId ?? "",
      brand: p.brand ?? "",
      sku: p.sku ?? "",
      isActive: p.isActive ?? true,
      images: p.images ?? [],
    });
    setImageInput("");
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name || form.price <= 0) {
      toast.error("Please fill in the required fields"); return;
    }
    const data = {
      name: form.name,
      description: form.description || undefined,
      price: form.price,
      comparePrice: form.comparePrice,
      stock: form.stock,
      categoryId: form.categoryId || undefined,
      brand: form.brand || undefined,
      sku: form.sku || undefined,
      isActive: form.isActive,
      images: form.images.length > 0 ? form.images : undefined,
    };

    if (editProduct) {
      updateProduct.mutate({ productId: editProduct.id, data }, {
        onSuccess: () => {
          toast.success("Product updated");
          setOpen(false);
          qc.invalidateQueries({ queryKey: getListProductsQueryKey({}) });
        },
        onError: () => toast.error("Failed to update product"),
      });
    } else {
      createProduct.mutate({ data }, {
        onSuccess: () => {
          toast.success("Product created");
          setOpen(false);
          qc.invalidateQueries({ queryKey: getListProductsQueryKey({}) });
        },
        onError: () => toast.error("Failed to create product"),
      });
    }
  };

  const handleDelete = (productId: string) => {
    if (!confirm("Delete this product?")) return;
    deleteProduct.mutate({ productId }, {
      onSuccess: () => {
        toast.success("Product deleted");
        qc.invalidateQueries({ queryKey: getListProductsQueryKey({}) });
      },
      onError: () => toast.error("Failed to delete product"),
    });
  };

  const addImage = () => {
    if (imageInput.trim()) {
      setForm(f => ({ ...f, images: [...f.images, imageInput.trim()] }));
      setImageInput("");
    }
  };

  const products = productsData?.products ?? [];
  const filtered = products.filter((p: Product) =>
    !search || p.name.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Products</h1>
        <Button onClick={openNew} className="gap-2"><Plus className="w-4 h-4" /> Add Product</Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
          placeholder="Search products..."
          value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {isLoading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1,2,3,4,5,6].map(i => <Skeleton key={i} className="h-48 rounded-xl" />)}
        </div>
      ) : !filtered.length ? (
        <div className="text-center py-16">
          <Package className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground mb-4">{search ? "No products match your search" : "No products yet"}</p>
          {!search && <Button onClick={openNew}>Add First Product</Button>}
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((p: Product) => (
            <div key={p.id} className="bg-card border rounded-xl overflow-hidden">
              <div className="relative aspect-video bg-muted">
                <img
                  src={p.images?.[0] ?? "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=300"}
                  alt={p.name}
                  className="w-full h-full object-cover"
                  onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=300"; }}
                />
                <div className="absolute top-2 right-2 flex gap-1">
                  {!p.isActive && <Badge variant="outline" className="text-xs bg-background/80">Inactive</Badge>}
                </div>
              </div>
              <div className="p-3">
                <p className="font-medium text-sm line-clamp-2 mb-1">{p.name}</p>
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold text-primary">{formatPrice(p.price)}</span>
                  <span className="text-xs text-muted-foreground">Stock: {p.stock}</span>
                </div>
                <div className="flex gap-1.5">
                  <Button variant="outline" size="sm" className="flex-1 gap-1 text-xs" onClick={() => openEdit(p)}>
                    <Edit2 className="w-3 h-3" /> Edit
                  </Button>
                  <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => handleDelete(p.id)}>
                    <Trash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
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
                placeholder="Product name" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Description</Label>
              <textarea className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 resize-none"
                rows={3} placeholder="Product description" value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground">Price (₹) *</Label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="99" value={form.price || ""}
                  onChange={e => setForm(f => ({ ...f, price: parseFloat(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Compare Price (₹)</Label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="149"
                  value={form.comparePrice ?? ""}
                  onChange={e => setForm(f => ({ ...f, comparePrice: e.target.value ? parseFloat(e.target.value) : undefined }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Stock</Label>
                <input type="number" className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="50" value={form.stock || ""}
                  onChange={e => setForm(f => ({ ...f, stock: parseInt(e.target.value) || 0 }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Category</Label>
                <select className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  value={form.categoryId} onChange={e => setForm(f => ({ ...f, categoryId: e.target.value }))}>
                  <option value="">No Category</option>
                  {categories?.map((c: Category) => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">Brand</Label>
                <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="Classmate" value={form.brand}
                  onChange={e => setForm(f => ({ ...f, brand: e.target.value }))} />
              </div>
              <div>
                <Label className="text-xs text-muted-foreground">SKU</Label>
                <input className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="SKU-001" value={form.sku}
                  onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} />
              </div>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Images (URLs)</Label>
              <div className="flex gap-2 mt-1">
                <input className="flex-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                  placeholder="https://example.com/image.jpg"
                  value={imageInput} onChange={e => setImageInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && addImage()} />
                <Button type="button" variant="outline" size="sm" onClick={addImage}>Add</Button>
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
            <div className="flex items-center gap-2">
              <input type="checkbox" id="isActiveProduct" checked={form.isActive}
                onChange={e => setForm(f => ({ ...f, isActive: e.target.checked }))} className="accent-primary" />
              <Label htmlFor="isActiveProduct" className="cursor-pointer">Active (visible to customers)</Label>
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
