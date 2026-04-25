import { Router } from "express";
import { db, cartsTable, productsTable, couponsTable, usersTable } from "@workspace/db";
import { eq, and, gte } from "drizzle-orm";
import { AddToCartBody, UpdateCartItemBody, ApplyCouponBody } from "@workspace/api-zod";
import { authenticateUser, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

interface CartItemData {
  id: string;
  productId: string;
  quantity: number;
  price: number;
}

router.get("/", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const cart = await getOrCreateCart(req.userId!);
    return res.json(await formatCart(cart));
  } catch (err) {
    req.log.error({ err }, "Failed to get cart");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticateUser, async (req: AuthRequest, res) => {
  const parsed = AddToCartBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const { productId, quantity } = parsed.data;
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(productId)));
    if (!product) return res.status(404).json({ error: "Product not found" });
    if (product.stock < quantity) return res.status(400).json({ error: "Insufficient stock" });

    const cart = await getOrCreateCart(req.userId!);
    const items = cart.items as CartItemData[];

    const existingIdx = items.findIndex(i => i.productId === productId);
    if (existingIdx >= 0) {
      items[existingIdx]!.quantity += quantity;
    } else {
      items.push({
        id: `${productId}-${Date.now()}`,
        productId,
        quantity,
        price: parseFloat(String(product.sellingPrice)),
      });
    }

    const [updated] = await db.update(cartsTable).set({ items }).where(eq(cartsTable.id, cart.id)).returning();
    return res.json(await formatCart(updated!));
  } catch (err) {
    req.log.error({ err }, "Failed to add to cart");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:itemId", authenticateUser, async (req: AuthRequest, res) => {
  const parsed = UpdateCartItemBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const cart = await getOrCreateCart(req.userId!);
    const items = cart.items as CartItemData[];
    const idx = items.findIndex(i => i.id === req.params.itemId);
    if (idx < 0) return res.status(404).json({ error: "Item not found" });

    if (parsed.data.quantity <= 0) {
      items.splice(idx, 1);
    } else {
      // Validate stock when updating quantity
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(items[idx]!.productId)));
      if (!product) return res.status(404).json({ error: "Product not found" });
      if ((product.stock ?? 0) < parsed.data.quantity) {
        return res.status(400).json({ 
          error: `Insufficient stock for this product. Available: ${product.stock ?? 0}, Requested: ${parsed.data.quantity}` 
        });
      }
      items[idx]!.quantity = parsed.data.quantity;
    }

    const [updated] = await db.update(cartsTable).set({ items }).where(eq(cartsTable.id, cart.id)).returning();
    return res.json(await formatCart(updated!));
  } catch (err) {
    req.log.error({ err }, "Failed to update cart item");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:itemId", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const cart = await getOrCreateCart(req.userId!);
    const items = (cart.items as CartItemData[]).filter(i => i.id !== req.params.itemId);
    const [updated] = await db.update(cartsTable).set({ items }).where(eq(cartsTable.id, cart.id)).returning();
    return res.json(await formatCart(updated!));
  } catch (err) {
    req.log.error({ err }, "Failed to remove cart item");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/", authenticateUser, async (req: AuthRequest, res) => {
  try {
    await db.update(cartsTable).set({ items: [], couponCode: null }).where(eq(cartsTable.userId, req.userId!));
    return res.json({ message: "Cart cleared" });
  } catch (err) {
    req.log.error({ err }, "Failed to clear cart");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/apply-coupon", authenticateUser, async (req: AuthRequest, res) => {
  const parsed = ApplyCouponBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const cart = await getOrCreateCart(req.userId!);
    const items = cart.items as CartItemData[];
    const subtotal = items.reduce((sum, i) => sum + i.price * i.quantity, 0);

    const [coupon] = await db.select().from(couponsTable).where(
      and(eq(couponsTable.code, parsed.data.code), eq(couponsTable.isActive, true))
    );

    if (!coupon) return res.status(400).json({ error: "Invalid or expired coupon" });
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.status(400).json({ error: "Coupon has expired" });
    }
    if (coupon.minOrderValue && subtotal < parseFloat(String(coupon.minOrderValue))) {
      return res.status(400).json({ error: `Minimum order of ₹${coupon.minOrderValue} required` });
    }

    if (coupon.isFirstOrder) {
      // Check if user has any previous orders — simplified check
    }

    const [updated] = await db.update(cartsTable)
      .set({ couponCode: parsed.data.code })
      .where(eq(cartsTable.id, cart.id))
      .returning();

    return res.json(await formatCart(updated!));
  } catch (err) {
    req.log.error({ err }, "Failed to apply coupon");
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function getOrCreateCart(userId: number) {
  const existing = await db.select().from(cartsTable).where(eq(cartsTable.userId, userId));
  if (existing.length > 0) return existing[0]!;

  const [cart] = await db.insert(cartsTable).values({ userId, items: [] }).returning();
  return cart!;
}

async function formatCart(cart: typeof cartsTable.$inferSelect) {
  const items = cart.items as CartItemData[];
  const couponCode = cart.couponCode as string | null;

  const enrichedItems = await Promise.all(items.map(async item => {
    const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(item.productId)));
    return {
      id: item.id,
      productId: item.productId,
      product: product ? {
        id: String(product.id),
        name: product.name,
        description: product.description,
        actualPrice: parseFloat(String(product.actualPrice)),
        sellingPrice: parseFloat(String(product.sellingPrice)),
        images: product.images,
        stock: product.stock,
        isActive: product.isActive,
        createdAt: product.createdAt,
        discount: 0,
        reviewCount: 0,
        rating: 0,
      } : null,
      quantity: item.quantity,
      price: item.price,
    };
  }));

  const subtotal = enrichedItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
  let couponDiscount = 0;

  if (couponCode) {
    const [coupon] = await db.select().from(couponsTable).where(eq(couponsTable.code, couponCode));
    if (coupon) {
      if (coupon.discountType === "FLAT") {
        couponDiscount = Math.min(parseFloat(String(coupon.discountValue)), subtotal);
      } else {
        const disc = subtotal * parseFloat(String(coupon.discountValue)) / 100;
        couponDiscount = coupon.maxDiscount ? Math.min(disc, parseFloat(String(coupon.maxDiscount))) : disc;
      }
    }
  }

  const total = Math.max(0, subtotal - couponDiscount);

  return {
    items: enrichedItems,
    subtotal,
    discount: 0,
    couponDiscount,
    total,
    couponCode: couponCode ?? undefined,
    itemCount: enrichedItems.reduce((sum, i) => sum + i.quantity, 0),
  };
}

export default router;
