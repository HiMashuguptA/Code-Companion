import { Router } from "express";
import { db, reviewsTable, usersTable, ordersTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateReviewBody, UpdateReviewBody } from "@workspace/api-zod";
import { authenticateUser, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/product/:productId", async (req, res) => {
  const productId = parseInt(req.params.productId!);
  if (isNaN(productId)) return res.status(400).json({ error: "Invalid product ID" });

  try {
    const reviews = await db.select().from(reviewsTable).where(eq(reviewsTable.productId, productId));
    const enriched = await Promise.all(reviews.map(async r => {
      const [user] = await db.select().from(usersTable).where(eq(usersTable.id, r.userId));
      return {
        id: String(r.id),
        productId: String(r.productId),
        userId: String(r.userId),
        user: user ? { id: String(user.id), email: user.email, name: user.name, photoUrl: user.photoUrl, role: user.role, createdAt: user.createdAt } : null,
        rating: r.rating,
        title: r.title,
        body: r.body,
        createdAt: r.createdAt,
      };
    }));
    return res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to get reviews");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/product/:productId", authenticateUser, async (req: AuthRequest, res) => {
  const productId = parseInt(req.params.productId!);
  if (isNaN(productId)) return res.status(400).json({ error: "Invalid product ID" });

  const parsed = CreateReviewBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    // Verify user has a delivered order with this product
    const userOrders = await db.select().from(ordersTable).where(
      and(eq(ordersTable.userId, req.userId!), eq(ordersTable.status, "DELIVERED"))
    );

    const hasDeliveredOrder = userOrders.some(order => {
      const items = order.items as Array<{ productId: string }>;
      return items.some(item => item.productId === String(productId));
    });

    if (!hasDeliveredOrder) {
      return res.status(403).json({ error: "You can only review products from delivered orders" });
    }

    // Check for duplicate review
    const existing = await db.select().from(reviewsTable).where(
      and(eq(reviewsTable.userId, req.userId!), eq(reviewsTable.productId, productId))
    );
    if (existing.length > 0) {
      return res.status(400).json({ error: "You have already reviewed this product" });
    }

    const [review] = await db.insert(reviewsTable).values({
      productId,
      userId: req.userId!,
      orderId: parseInt(parsed.data.orderId),
      rating: parsed.data.rating,
      title: parsed.data.title ?? null,
      body: parsed.data.body ?? null,
    }).returning();

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    return res.status(201).json({
      id: String(review!.id),
      productId: String(review!.productId),
      userId: String(review!.userId),
      user: user ? { id: String(user.id), email: user.email, name: user.name, photoUrl: user.photoUrl, role: user.role, createdAt: user.createdAt } : null,
      rating: review!.rating,
      title: review!.title,
      body: review!.body,
      createdAt: review!.createdAt,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to create review");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:reviewId", authenticateUser, async (req: AuthRequest, res) => {
  const reviewId = parseInt(req.params.reviewId!);
  if (isNaN(reviewId)) return res.status(400).json({ error: "Invalid review ID" });

  const parsed = UpdateReviewBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const [existing] = await db.select().from(reviewsTable).where(eq(reviewsTable.id, reviewId));
    if (!existing) return res.status(404).json({ error: "Review not found" });
    if (existing.userId !== req.userId) return res.status(403).json({ error: "Forbidden" });

    const [review] = await db.update(reviewsTable).set({
      ...(parsed.data.rating !== undefined && { rating: parsed.data.rating }),
      ...(parsed.data.title !== undefined && { title: parsed.data.title }),
      ...(parsed.data.body !== undefined && { body: parsed.data.body }),
    }).where(eq(reviewsTable.id, reviewId)).returning();

    return res.json({ id: String(review!.id), productId: String(review!.productId), userId: String(review!.userId), rating: review!.rating, title: review!.title, body: review!.body, createdAt: review!.createdAt });
  } catch (err) {
    req.log.error({ err }, "Failed to update review");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
