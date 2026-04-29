import { Router } from "express";
import { db, productsTable, categoriesTable, reviewsTable } from "@workspace/db";
import { eq, ilike, and, gte, lte, sql, desc, asc, or } from "drizzle-orm";
import { CreateProductBody, UpdateProductBody } from "@workspace/api-zod";
import { authenticateUser, requireAdmin, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/", async (req, res) => {
  const {
    category,
    search,
    minPrice,
    maxPrice,
    inStock,
    tags,
    featured,
    sort,
    page = "1",
    limit = "20",
  } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  try {
    const conditions = [eq(productsTable.isActive, true)];

    if (category) {
      const cat = await db.select().from(categoriesTable).where(eq(categoriesTable.slug, category));
      if (cat.length > 0) conditions.push(eq(productsTable.categoryId, cat[0]!.id));
    }
    if (search) {
      conditions.push(or(
        ilike(productsTable.name, `%${search}%`),
        ilike(productsTable.description, `%${search}%`),
      )!);
    }
    if (minPrice) conditions.push(gte(productsTable.sellingPrice, minPrice));
    if (maxPrice) conditions.push(lte(productsTable.sellingPrice, maxPrice));
    if (inStock === "true") conditions.push(gte(productsTable.stock, 1));
    if (tags) {
      const tagArr = tags.split(",").map(t => t.trim()).filter(Boolean);
      if (tagArr.length > 0) {
        conditions.push(sql`${productsTable.tags} && ${tagArr}`);
      }
    }
    if (featured === "true") conditions.push(eq(productsTable.isFeatured, true));

    const orderClause = (() => {
      switch (sort) {
        case "price_asc": return asc(productsTable.sellingPrice);
        case "price_desc": return desc(productsTable.sellingPrice);
        case "popularity": return desc(productsTable.salesCount);
        case "discount": return sql`(${productsTable.actualPrice} - ${productsTable.sellingPrice}) DESC`;
        case "newest":
        default:
          return desc(productsTable.createdAt);
      }
    })();

    const whereClause = and(...conditions);
    const products = await db.select().from(productsTable)
      .where(whereClause)
      .limit(limitNum)
      .offset(offset)
      .orderBy(orderClause);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(whereClause);
    const total = Number(countResult?.count ?? 0);

    const enriched = await Promise.all(products.map(p => enrichProduct(p)));

    return res.json({
      products: enriched,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list products");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/featured", async (req, res) => {
  try {
    const featured = await db.select().from(productsTable)
      .where(and(eq(productsTable.isActive, true), eq(productsTable.isFeatured, true)))
      .limit(12)
      .orderBy(desc(productsTable.salesCount));
    let products = featured;
    if (products.length < 4) {
      const fillers = await db.select().from(productsTable)
        .where(and(eq(productsTable.isActive, true), gte(productsTable.stock, 1)))
        .limit(12 - products.length)
        .orderBy(desc(productsTable.salesCount));
      const seen = new Set(products.map(p => p.id));
      products = [...products, ...fillers.filter(p => !seen.has(p.id))];
    }
    const enriched = await Promise.all(products.map(p => enrichProduct(p)));
    return res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to get featured products");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/tags", async (req, res) => {
  try {
    const result = await db.execute(sql`
      SELECT tag, COUNT(*)::int AS count
      FROM (SELECT unnest(tags) AS tag FROM products WHERE is_active = true) t
      GROUP BY tag
      ORDER BY count DESC, tag ASC
    `);
    return res.json(result.rows.map((r: Record<string, unknown>) => ({
      tag: String(r.tag),
      count: Number(r.count),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to list tags");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:productId", async (req, res) => {
  const id = parseInt(req.params.productId!);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });

  try {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, id));
    if (!product) return res.status(404).json({ error: "Product not found" });
    return res.json(await enrichProduct(product));
  } catch (err) {
    req.log.error({ err }, "Failed to get product");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const parsed = CreateProductBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const [product] = await db.insert(productsTable).values({
      name: parsed.data.name,
      description: parsed.data.description,
      categoryId: parsed.data.categoryId ? parseInt(parsed.data.categoryId) : null,
      actualPrice: String(parsed.data.actualPrice),
      sellingPrice: String(parsed.data.sellingPrice),
      images: parsed.data.images,
      stock: parsed.data.stock,
      tags: parsed.data.tags ?? [],
      isFeatured: parsed.data.isFeatured ?? false,
      lowStockThreshold: parsed.data.lowStockThreshold ?? 5,
    }).returning();

    return res.status(201).json(await enrichProduct(product!));
  } catch (err) {
    req.log.error({ err }, "Failed to create product");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:productId", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.productId!);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });

  const parsed = UpdateProductBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const updates: Partial<typeof productsTable.$inferInsert> = {};
    const d = parsed.data;
    if (d.name !== undefined) updates.name = d.name;
    if (d.description !== undefined) updates.description = d.description;
    if (d.categoryId !== undefined) updates.categoryId = parseInt(d.categoryId);
    if (d.actualPrice !== undefined) updates.actualPrice = String(d.actualPrice);
    if (d.sellingPrice !== undefined) updates.sellingPrice = String(d.sellingPrice);
    if (d.images !== undefined) updates.images = d.images;
    if (d.stock !== undefined) updates.stock = d.stock;
    if (d.tags !== undefined) updates.tags = d.tags;
    if (d.isFeatured !== undefined) updates.isFeatured = d.isFeatured;
    if (d.lowStockThreshold !== undefined) updates.lowStockThreshold = d.lowStockThreshold;
    if (d.isActive !== undefined) updates.isActive = d.isActive;

    const [product] = await db.update(productsTable).set(updates).where(eq(productsTable.id, id)).returning();
    if (!product) return res.status(404).json({ error: "Product not found" });
    return res.json(await enrichProduct(product));
  } catch (err) {
    req.log.error({ err }, "Failed to update product");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:productId", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.productId!);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid product ID" });

  try {
    await db.delete(productsTable).where(eq(productsTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete product");
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function enrichProduct(product: typeof productsTable.$inferSelect) {
  let category = null;
  if (product.categoryId) {
    const [cat] = await db.select().from(categoriesTable).where(eq(categoriesTable.id, product.categoryId));
    if (cat) {
      category = { id: String(cat.id), name: cat.name, slug: cat.slug, icon: cat.icon };
    }
  }

  const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.productId, product.id));
  const rating = reviews.length > 0 ? reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length : 0;
  const actualPrice = parseFloat(String(product.actualPrice));
  const sellingPrice = parseFloat(String(product.sellingPrice));
  const discount = actualPrice > 0 ? Math.round(((actualPrice - sellingPrice) / actualPrice) * 100) : 0;

  return {
    id: String(product.id),
    name: product.name,
    description: product.description,
    categoryId: product.categoryId ? String(product.categoryId) : null,
    category,
    actualPrice,
    sellingPrice,
    discount,
    images: product.images,
    stock: product.stock,
    rating: Math.round(rating * 10) / 10,
    reviewCount: reviews.length,
    tags: product.tags ?? [],
    isFeatured: product.isFeatured,
    salesCount: product.salesCount ?? 0,
    lowStockThreshold: product.lowStockThreshold ?? 5,
    isActive: product.isActive,
    createdAt: product.createdAt,
  };
}

export default router;
