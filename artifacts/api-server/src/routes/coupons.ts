import { Router } from "express";
import { db, couponsTable, usersTable, notificationsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { CreateCouponBody, UpdateCouponBody, ValidateCouponBody } from "@workspace/api-zod";
import { authenticateUser, requireAdmin, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const coupons = await db.select().from(couponsTable);
    return res.json(coupons.map(formatCoupon));
  } catch (err) {
    req.log.error({ err }, "Failed to list coupons");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/validate", async (req, res) => {
  const parsed = ValidateCouponBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const { code, orderTotal } = parsed.data;
    const [coupon] = await db.select().from(couponsTable).where(
      and(eq(couponsTable.code, code), eq(couponsTable.isActive, true))
    );

    if (!coupon) return res.json({ valid: false, message: "Invalid or expired coupon" });
    if (coupon.expiresAt && new Date(coupon.expiresAt) < new Date()) {
      return res.json({ valid: false, message: "Coupon has expired" });
    }
    if (coupon.minOrderValue && orderTotal < parseFloat(String(coupon.minOrderValue))) {
      return res.json({ valid: false, message: `Minimum order of ₹${coupon.minOrderValue} required` });
    }

    let discount = 0;
    if (coupon.discountType === "FLAT") {
      discount = Math.min(parseFloat(String(coupon.discountValue)), orderTotal);
    } else {
      const disc = orderTotal * parseFloat(String(coupon.discountValue)) / 100;
      discount = coupon.maxDiscount ? Math.min(disc, parseFloat(String(coupon.maxDiscount))) : disc;
    }

    return res.json({ valid: true, discount, message: "Coupon applied successfully", coupon: formatCoupon(coupon) });
  } catch (err) {
    req.log.error({ err }, "Failed to validate coupon");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const parsed = CreateCouponBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const [coupon] = await db.insert(couponsTable).values({
      code: parsed.data.code.toUpperCase(),
      description: parsed.data.description ?? null,
      discountType: parsed.data.discountType,
      discountValue: String(parsed.data.discountValue),
      minOrderValue: parsed.data.minOrderValue ? String(parsed.data.minOrderValue) : null,
      maxDiscount: parsed.data.maxDiscount ? String(parsed.data.maxDiscount) : null,
      isFirstOrder: parsed.data.isFirstOrder ?? false,
      isActive: true,
      usageLimit: parsed.data.usageLimit ?? null,
      expiresAt: parsed.data.expiresAt ? new Date(parsed.data.expiresAt) : null,
    }).returning();

    // Notify all regular users about the new coupon
    const regularUsers = await db.select({ id: usersTable.id }).from(usersTable)
      .where(eq(usersTable.role, "USER"));

    const discountText = parsed.data.discountType === "FLAT" 
      ? `₹${parsed.data.discountValue} off`
      : `${parsed.data.discountValue}% off`;
    
    if (regularUsers.length > 0) {
      await db.insert(notificationsTable).values(
        regularUsers.map(user => ({
          userId: user.id,
          title: `New Coupon: ${coupon!.code}`,
          message: `Get ${discountText} on your orders with coupon code "${coupon!.code}"${parsed.data.description ? ` - ${parsed.data.description}` : ''}`,
          type: "PROMOTION" as const,
        }))
      );
    }

    return res.status(201).json(formatCoupon(coupon!));
  } catch (err) {
    req.log.error({ err }, "Failed to create coupon");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:couponId", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.couponId!);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid coupon ID" });

  const parsed = UpdateCouponBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const updates: Partial<typeof couponsTable.$inferInsert> = {};
    const d = parsed.data;
    if (d.description !== undefined) updates.description = d.description;
    if (d.discountValue !== undefined) updates.discountValue = String(d.discountValue);
    if (d.minOrderValue !== undefined) updates.minOrderValue = String(d.minOrderValue);
    if (d.maxDiscount !== undefined) updates.maxDiscount = String(d.maxDiscount);
    if (d.isFirstOrder !== undefined) updates.isFirstOrder = d.isFirstOrder;
    if (d.isActive !== undefined) updates.isActive = d.isActive;
    if (d.usageLimit !== undefined) updates.usageLimit = d.usageLimit;
    if (d.expiresAt !== undefined) updates.expiresAt = new Date(d.expiresAt);

    const [coupon] = await db.update(couponsTable).set(updates).where(eq(couponsTable.id, id)).returning();
    if (!coupon) return res.status(404).json({ error: "Coupon not found" });
    return res.json(formatCoupon(coupon));
  } catch (err) {
    req.log.error({ err }, "Failed to update coupon");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:couponId", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.couponId!);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid coupon ID" });

  try {
    await db.delete(couponsTable).where(eq(couponsTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete coupon");
    return res.status(500).json({ error: "Internal server error" });
  }
});

function formatCoupon(c: typeof couponsTable.$inferSelect) {
  return {
    id: String(c.id),
    code: c.code,
    description: c.description,
    discountType: c.discountType,
    discountValue: parseFloat(String(c.discountValue)),
    minOrderValue: c.minOrderValue ? parseFloat(String(c.minOrderValue)) : undefined,
    maxDiscount: c.maxDiscount ? parseFloat(String(c.maxDiscount)) : undefined,
    isFirstOrder: c.isFirstOrder,
    isActive: c.isActive,
    usageLimit: c.usageLimit,
    usageCount: c.usageCount,
    expiresAt: c.expiresAt,
    createdAt: c.createdAt,
  };
}

export default router;
