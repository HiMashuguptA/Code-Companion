import { useState } from "react";
import { Plus, Edit2, Trash2, Package, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useListProducts, useListCategories, useCreateProduct, useUpdateProduct, useDeleteProduct, getListProductsQueryKey } from "@workspace/api-client-react";
import { formatPrice } from "@/lib/utils";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface ProductForm {
  name: string;
  description: string;
  actualPrice: string;
  sellingPrice: string;
  categoryId: string;
  stock: string;
  images: string;
  tags: string;
}

const emptyForm: ProductForm = {
  name: "", description: "", actualPrice: "", sellingPrice: "",
  categoryId: "", stock: "", images: "", tags: ""
};

export function AdminProducts() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<ProductForm>(emptyForm);

  const params = { search: search || undefined, page, limit: 20 };
  const { data, isLoading } = useListProducts(params, {
    query: { queryKey: getListProductsQueryKey(params) }
  });
  const { data: categories } = useListCategories();
  const createProduct = useCreateProduct();
  const updateProduct = useUpdateProduct(editingId ?? "");
  const deleteProduct = useDeleteProduct;

  const openCreate = () => {
    setEditingId(null);
    setForm(emptyForm);
    setOpen(true);
  };

  const openEdit = (product: typeof data extends undefined ? never : NonNullable<typeof data>["products"][0]) => {
    setEditingId(product.id);
    setForm({
      name: product.name,
      description: product.description ?? "",
      actualPrice: String(product.actualPrice),
      sellingPrice: String(product.sellingPrice),
      categoryId: product.categoryId ?? "",
      stock: String(product.stock),
      images: (product.images ?? []).join(", "),
      tags: (product.tags ?? []).join(", "),
    });
    setOpen(true);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const payload = {
      name: form.name,
      description: form.description || undefined,
      actualPrice: parseFloat(form.actualPrice),
      sellingPrice: parseFloat(form.sellingPrice),
      categoryId: form.categoryId || undefined,
      stock: parseInt(form.stock, 10),
      images: form.images.split(",").map(s => s.trim()).filter(Boolean),
      tags: form.tags.split(",").map(s => s.trim()).filter(Boolean),
    };

    const mutation = editingId
      ? updateProduct.mutate({ data: payload }, {
          onSuccess: () => {
            toast.success("Product updated");
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey(params) });
          },
          onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed"),
        })
      : createProduct.mutate({ data: payload }, {
          onSuccess: () => {
            toast.success("Product created");
            setOpen(false);
            queryClient.invalidateQueries({ queryKey: getListProductsQueryKey(params) });
          },
          onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed"),
        });
  };

  const handleDelete = (id: string, name: string) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    const mutation = deleteProduct(id);
    mutation.mutate({}, {
      onSuccess: () => {
        toast.success("Product deleted");
        queryClient.invalidateQueries({ queryKey: getListProductsQueryKey(params) });
      },
      onError: (err: unknown) => toast.error((err as { data?: { error?: string } })?.data?.error ?? "Failed"),
    });
  };

  const field = (key: keyof ProductForm, label: string, type = "text", placeholder = "") => (
    <div>
      <Label className="text-xs text-muted-foreground mb-1 block">{label}</Label>
      <input
        type={type}
        placeholder={placeholder}
        className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
        value={form[key]}
        onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
      />
    </div>
  );

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <h1 className="text-xl font-bold">Products</h1>
        <Button onClick={openCreate} size="sm" className="gap-1.5">
          <Plus className="w-4 h-4" /> Add Product
        </Button>
      </div>

      <div className="relative mb-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
        <input
          type="search"
          placeholder="Search products..."
          className="w-full pl-9 pr-4 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
          value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map(i => <Skeleton key={i} className="h-16 rounded-xl" />)}
        </div>
      ) : (
        <div className="space-y-2">
          {data?.products.map(product => (
            <div key={product.id} className="bg-card border rounded-xl p-3 flex items-center gap-3">
              <img
                src={product.images?.[0] ?? "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=60"}
                alt={product.name}
                className="w-12 h-12 rounded-lg object-cover shrink-0"
                onError={e => { (e.target as HTMLImageElement).src = "https://images.unsplash.com/photo-1583485088034-697b5bc54ccd?w=60"; }}
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-1">{product.name}</p>
                <div className="flex items-center gap-2 mt-1">
                  <span className="text-xs font-bold">{formatPrice(product.sellingPrice)}</span>
                  {(product.discount ?? 0) > 0 && (
                    <span className="text-xs text-muted-foreground line-through">{formatPrice(product.actualPrice)}</span>
                  )}
                  <Badge variant={product.stock > 0 ? "secondary" : "destructive"} className="text-xs">
                    {product.stock > 0 ? `Stock: ${product.stock}` : "Out of Stock"}
                  </Badge>
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(product)}>
                  <Edit2 className="w-3.5 h-3.5" />
                </Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive hover:text-destructive" onClick={() => handleDelete(product.id, product.name)}>
                  <Trash2 className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          ))}

          {data && data.totalPages > 1 && (
            <div className="flex justify-center gap-2 mt-4">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(p => p - 1)}>Previous</Button>
              <span className="flex items-center text-sm text-muted-foreground px-2">{page} / {data.totalPages}</span>
              <Button variant="outline" size="sm" disabled={page >= data.totalPages} onClick={() => setPage(p => p + 1)}>Next</Button>
            </div>
          )}
        </div>
      )}

      {/* Product Form Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit Product" : "Add Product"}</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-3 mt-2">
            {field("name", "Product Name *", "text", "e.g. Premium Ball Pen Set")}
            <div>
              <Label className="text-xs text-muted-foreground mb-1 block">Description</Label>
              <textarea
                className="w-full px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50 min-h-[80px]"
                placeholder="Product description..."
                value={form.description}
                onChange={e => setForm(f => ({ ...f, description: e.target.value }))}
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              {field("actualPrice", "MRP (₹) *", "number", "99")}
              {field("sellingPrice", "Selling Price (₹) *", "number", "79")}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs text-muted-foreground mb-1 block">Category</Label>
                <Select value={form.categoryId} onValueChange={v => setForm(f => ({ ...f, categoryId: v }))}>
                  <SelectTrigger className="h-9 text-sm">
                    <SelectValue placeholder="Select category" />
                  </SelectTrigger>
                  <SelectContent>
                    {categories?.map(cat => (
                      <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              {field("stock", "Stock *", "number", "100")}
            </div>
            {field("images", "Image URLs", "text", "https://..., https://...")}
            {field("tags", "Tags", "text", "pen, blue, premium")}
            <div className="flex gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)} className="flex-1">Cancel</Button>
              <Button type="submit" className="flex-1" disabled={createProduct.isPending || updateProduct.isPending}>
                {editingId ? "Update" : "Create"} Product
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
