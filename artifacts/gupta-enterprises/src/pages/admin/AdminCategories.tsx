import { useState, useMemo } from "react";
import { Plus, FolderOpen, Edit2, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  useListCategories, useCreateCategory, useUpdateCategory, useDeleteCategory,
  getListCategoriesQueryKey
} from "@workspace/api-client-react";
import type { Category } from "@workspace/api-client-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/contexts/FirebaseContext";

type CategoryForm = {
  name: string;
  slug: string;
  icon: string;
  image: string;
};

const defaultForm: CategoryForm = {
  name: "",
  slug: "",
  icon: "",
  image: "",
};

export function AdminCategories() {
  const qc = useQueryClient();
  const { currentUser, isLoading: authLoading } = useAuth();
  const [open, setOpen] = useState(false);
  const [editCategory, setEditCategory] = useState<Category | null>(null);
  const [form, setForm] = useState<CategoryForm>(defaultForm);

  const categoryQueryKey = useMemo(() => getListCategoriesQueryKey(), []);

  const { data: categoriesData, isLoading } = useListCategories({
    query: { 
      queryKey: categoryQueryKey,
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 10,
      enabled: !!currentUser,
      retry: 0,
      refetchInterval: 2000, // Auto-refetch every 2 seconds for real-time updates
      refetchOnMount: true,
      refetchOnWindowFocus: true,
      refetchOnReconnect: true
    }
  });

  const createCategory = useCreateCategory();
  const updateCategory = useUpdateCategory();
  const deleteCategory = useDeleteCategory();

  const openNew = () => {
    setEditCategory(null);
    setForm(defaultForm);
    setOpen(true);
  };

  const openEdit = (cat: Category) => {
    setEditCategory(cat);
    setForm({
      name: cat.name,
      slug: cat.slug,
      icon: cat.icon || "",
      image: (cat as any).image || "",
    });
    setOpen(true);
  };

  const handleSave = () => {
    if (!form.name.trim()) {
      toast.error("Please enter a category name");
      return;
    }
    if (!form.slug.trim()) {
      toast.error("Please enter a category slug");
      return;
    }

    const data = {
      name: form.name.trim(),
      slug: form.slug.trim(),
      icon: form.icon.trim() || undefined,
      image: form.image.trim() || undefined,
    };

    if (editCategory) {
      updateCategory.mutate({ categoryId: String(editCategory.id), data }, {
        onSuccess: () => {
          toast.success("Category updated");
          setOpen(false);
          setForm(defaultForm);
          setEditCategory(null);
          qc.invalidateQueries({ queryKey: categoryQueryKey });
        },
        onError: (error) => {
          console.error("Failed to update category:", error);
          toast.error("Failed to update category");
        },
      });
    } else {
      createCategory.mutate({ data }, {
        onSuccess: () => {
          toast.success("Category created");
          setOpen(false);
          setForm(defaultForm);
          qc.invalidateQueries({ queryKey: categoryQueryKey });
        },
        onError: (error) => {
          console.error("Failed to create category:", error);
          toast.error("Failed to create category");
        },
      });
    }
  };

  const handleDelete = (cat: Category) => {
    if (!confirm(`Delete category "${cat.name}"? This action cannot be undone.`)) return;
    
    deleteCategory.mutate({ categoryId: String(cat.id) }, {
      onSuccess: () => {
        toast.success("Category deleted");
        qc.invalidateQueries({ queryKey: categoryQueryKey });
      },
      onError: (error) => {
        console.error("Failed to delete category:", error);
        toast.error("Failed to delete category");
      },
    });
  };

  const categories = categoriesData ?? [];

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">Categories</h1>
        <Button onClick={openNew} className="gap-2 cursor-pointer"><Plus className="w-4 h-4" /> Add Category</Button>
      </div>

      {authLoading || isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map(i => <Skeleton key={i} className="h-16 rounded-lg" />)}
        </div>
      ) : !currentUser ? (
        <div className="text-center py-16">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground">Please log in to view categories</p>
        </div>
      ) : !categories.length ? (
        <div className="text-center py-16">
          <FolderOpen className="w-12 h-12 mx-auto mb-3 text-muted-foreground opacity-30" />
          <p className="text-muted-foreground mb-4">No categories yet</p>
          <Button onClick={openNew} className="cursor-pointer">Add First Category</Button>
        </div>
      ) : (
        <div className="space-y-2">
          {categories.map((c: Category) => (
            <div key={c.id} className="flex items-center justify-between p-4 bg-card border rounded-lg hover:bg-muted/50 transition-colors">
              {(c as any).image && (
                <img src={(c as any).image} alt={c.name} className="w-16 h-16 object-cover rounded-lg mr-4" onError={e => { (e.target as HTMLImageElement).style.display = 'none'; }} />
              )}
              <div className="flex-1">
                <p className="font-medium flex items-center gap-2">
                  {c.icon && <span>{c.icon}</span>}
                  {c.name}
                </p>
                <p className="text-xs text-muted-foreground">Slug: {c.slug} • {c.productCount ?? 0} products</p>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" onClick={() => openEdit(c)} className="gap-1 cursor-pointer">
                  <Edit2 className="w-4 h-4" /> Edit
                </Button>
                <Button variant="destructive" size="sm" onClick={() => handleDelete(c)} className="gap-1 cursor-pointer">
                  <Trash2 className="w-4 h-4" /> Delete
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{editCategory ? "Edit Category" : "Add Category"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div>
              <Label className="text-xs text-muted-foreground">Category Name *</Label>
              <input
                className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g., Electronics, Books, Clothing"
                value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Slug *</Label>
              <input
                className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g., electronics, books, clothing (no spaces)"
                value={form.slug}
                onChange={e => setForm(f => ({ ...f, slug: e.target.value.toLowerCase().replace(/\s+/g, '-') }))}
                onKeyDown={e => e.key === "Enter" && handleSave()}
              />
              <p className="text-xs text-muted-foreground mt-1">URL-friendly identifier for the category</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Icon (Emoji)</Label>
              <input
                className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="e.g., 📱, 📚, 👕"
                value={form.icon}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))}
                maxLength={4}
              />
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Category Image URL</Label>
              <input
                className="w-full mt-1 px-3 py-2 text-sm bg-muted rounded-lg border-0 focus:outline-none focus:ring-2 focus:ring-primary/50"
                placeholder="https://example.com/image.jpg"
                value={form.image}
                onChange={e => setForm(f => ({ ...f, image: e.target.value }))}
              />
              {form.image && (
                <div className="mt-2 p-2 bg-muted rounded-lg">
                  <img src={form.image} alt="Preview" className="w-full h-20 object-cover rounded" onError={e => { (e.target as HTMLImageElement).src = "https://via.placeholder.com/200x100?text=Invalid+Image"; }} />
                </div>
              )}
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleSave} disabled={createCategory.isPending || updateCategory.isPending} className="flex-1 cursor-pointer disabled:cursor-not-allowed">
                {editCategory ? "Update Category" : "Create Category"}
              </Button>
              <Button variant="outline" onClick={() => setOpen(false)} className="cursor-pointer">Cancel</Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
