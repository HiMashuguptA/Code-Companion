import { Router } from "express";
import { db, categoriesTable, productsTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { CreateCategoryBody } from "@workspace/api-zod";
import { authenticateUser, requireAdmin, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  try {
    const cats = await db.select().from(categoriesTable);
    const enriched = await Promise.all(cats.map(async (cat) => {
      const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.categoryId, cat.id));
      return {
        id: String(cat.id),
        name: cat.name,
        slug: cat.slug,
        icon: cat.icon,
        image: cat.image,
        productCount: Number(countResult?.count ?? 0),
      };
    }));
    return res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to list categories");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const [cat] = await db.insert(categoriesTable).values({
      name: parsed.data.name,
      slug: parsed.data.slug,
      icon: parsed.data.icon ?? null,
      image: parsed.data.image ?? null,
    }).returning();
    return res.status(201).json({ id: String(cat!.id), name: cat!.name, slug: cat!.slug, icon: cat!.icon, image: cat!.image, productCount: 0 });
  } catch (err) {
    req.log.error({ err }, "Failed to create category");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update category
router.put("/:categoryId", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const categoryIdParam = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId;
  const categoryId = parseInt(categoryIdParam!);
  if (isNaN(categoryId)) return res.status(400).json({ error: "Invalid category ID" });

  const parsed = CreateCategoryBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const [cat] = await db.update(categoriesTable)
      .set({
        name: parsed.data.name,
        slug: parsed.data.slug,
        icon: parsed.data.icon ?? null,
        image: parsed.data.image ?? null,
      })
      .where(eq(categoriesTable.id, categoryId))
      .returning();
    
    if (!cat) return res.status(404).json({ error: "Category not found" });
    
    // Get product count
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.categoryId, cat.id));
    
    return res.json({ id: String(cat!.id), name: cat!.name, slug: cat!.slug, icon: cat!.icon, image: cat!.image, productCount: Number(countResult?.count ?? 0) });
  } catch (err) {
    req.log.error({ err }, "Failed to update category");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Delete category
router.delete("/:categoryId", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const categoryIdParam = Array.isArray(req.params.categoryId) ? req.params.categoryId[0] : req.params.categoryId;
  const categoryId = parseInt(categoryIdParam!);
  if (isNaN(categoryId)) return res.status(400).json({ error: "Invalid category ID" });

  try {
    const [deleted] = await db.delete(categoriesTable)
      .where(eq(categoriesTable.id, categoryId))
      .returning();
    
    if (!deleted) return res.status(404).json({ error: "Category not found" });
    
    return res.json({ success: true, id: String(deleted!.id) });
  } catch (err) {
    req.log.error({ err }, "Failed to delete category");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
