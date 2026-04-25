import { Router } from "express";
import { db, favoritesTable, productsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { authenticateUser, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// List user's favorites
router.get("/", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const favorites = await db.select({
      id: favoritesTable.id,
      productId: favoritesTable.productId,
      createdAt: favoritesTable.createdAt,
    }).from(favoritesTable).where(eq(favoritesTable.userId, req.userId!));

    // Get product details for each favorite
    const productsData = await Promise.all(
      favorites.map(async (fav) => {
        const [product] = await db.select().from(productsTable).where(eq(productsTable.id, fav.productId));
        return {
          favoriteId: fav.id,
          ...product,
        };
      })
    );

    return res.json(productsData);
  } catch (err) {
    req.log.error({ err }, "Failed to list favorites");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Add to favorites
router.post("/", authenticateUser, async (req: AuthRequest, res) => {
  const { productId } = req.body;
  if (!productId) return res.status(400).json({ error: "Product ID is required" });

  try {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(productId)));
    if (!product) return res.status(404).json({ error: "Product not found" });

    // Check if already favorited
    const [existing] = await db.select().from(favoritesTable)
      .where(and(eq(favoritesTable.userId, req.userId!), eq(favoritesTable.productId, parseInt(productId))));
    
    if (existing) {
      return res.status(400).json({ error: "Product already in favorites" });
    }

    const [fav] = await db.insert(favoritesTable).values({
      userId: req.userId!,
      productId: parseInt(productId),
    }).returning();

    return res.status(201).json({ favoriteId: fav!.id });
  } catch (err) {
    req.log.error({ err }, "Failed to add favorite");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Remove from favorites
router.delete("/:productId", authenticateUser, async (req: AuthRequest, res) => {
  const productId = parseInt(req.params.productId!);
  if (isNaN(productId)) return res.status(400).json({ error: "Invalid product ID" });

  try {
    const [deleted] = await db.delete(favoritesTable)
      .where(and(eq(favoritesTable.userId, req.userId!), eq(favoritesTable.productId, productId)))
      .returning();

    if (!deleted) return res.status(404).json({ error: "Favorite not found" });
    
    return res.json({ success: true });
  } catch (err) {
    req.log.error({ err }, "Failed to remove favorite");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Check if product is favorited
router.get("/check/:productId", authenticateUser, async (req: AuthRequest, res) => {
  const productId = parseInt(req.params.productId!);
  if (isNaN(productId)) return res.status(400).json({ error: "Invalid product ID" });

  try {
    const [fav] = await db.select().from(favoritesTable)
      .where(and(eq(favoritesTable.userId, req.userId!), eq(favoritesTable.productId, productId)));

    return res.json({ isFavorited: !!fav });
  } catch (err) {
    req.log.error({ err }, "Failed to check favorite");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
