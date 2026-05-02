import { Router } from "express";
import {
  db,
  ordersTable,
  usersTable,
  cartsTable,
  productsTable,
  trackingTable,
  notificationsTable,
  coinTransactionsTable,
} from "@workspace/db";
import { eq, and, sql, desc, ne } from "drizzle-orm";
import { CreateOrderBody, UpdateOrderBody, AssignDeliveryAgentBody } from "@workspace/api-zod";
import { authenticateUser, requireAdmin, requireDeliveryAgent, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const COIN_VALUE = 1; // 1 coin = ₹1
const REWARD_PCT = 0.02; // 2% of paid total back as coins

router.get("/", authenticateUser, async (req: AuthRequest, res) => {
  const { status, page = "1", limit = "20" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  const offset = (pageNum - 1) * limitNum;

  try {
    const conditions = req.userRole === "ADMIN" ? [] : [eq(ordersTable.userId, req.userId!)];
    if (status) conditions.push(eq(ordersTable.status, status as never));

    const whereClause = conditions.length > 0 ? and(...conditions) : undefined;
    const orders = await db.select().from(ordersTable).where(whereClause).limit(limitNum).offset(offset).orderBy(desc(ordersTable.createdAt));
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(whereClause);
    const total = Number(countResult?.count ?? 0);

    const enriched = await Promise.all(orders.map(o => enrichOrder(o)));

    return res.json({
      orders: enriched,
      total,
      page: pageNum,
      limit: limitNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list orders");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticateUser, async (req: AuthRequest, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.userId, req.userId!));
    if (!cart) return res.status(400).json({ error: "Cart is empty" });

    const cartItems = cart.items as Array<{ id: string; productId: string; quantity: number; price: number }>;
    if (cartItems.length === 0) return res.status(400).json({ error: "Cart is empty" });

    const productsToDecrement: Array<{ productId: number; quantity: number }> = [];
    for (const item of cartItems) {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(item.productId)));
      if (!product) return res.status(400).json({ error: `Product ${item.productId} not found` });
      if ((product.stock ?? 0) < item.quantity) {
        return res.status(400).json({
          error: `Insufficient stock for "${product.name}". Available: ${product.stock ?? 0}, Requested: ${item.quantity}`,
        });
      }
      productsToDecrement.push({ productId: parseInt(item.productId), quantity: item.quantity });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) return res.status(401).json({ error: "User not found" });

    const subtotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    const couponDiscount = 0;
    const couponCode = cart.couponCode as string | null;
    const deliveryFee = parsed.data.deliveryType === "DELIVERY" && subtotal < 500 ? 50 : 0;

    const requestedCoins = Math.max(0, Math.floor(parsed.data.coinsToRedeem ?? 0));
    const baseTotal = Math.max(0, subtotal - couponDiscount + deliveryFee);
    const maxRedeem = Math.min(user.superCoins ?? 0, Math.floor(baseTotal * 0.5));
    const coinsRedeemed = Math.min(requestedCoins, maxRedeem);
    const coinDiscount = coinsRedeemed * COIN_VALUE;
    const total = Math.max(0, baseTotal - coinDiscount);
    const coinsEarned = Math.max(0, Math.floor(total * REWARD_PCT));

    const orderItems = await Promise.all(cartItems.map(async item => {
      const [product] = await db.select().from(productsTable).where(eq(productsTable.id, parseInt(item.productId)));
      return {
        id: item.id,
        productId: item.productId,
        quantity: item.quantity,
        price: item.price,
        total: item.price * item.quantity,
        productName: product?.name ?? "Product",
        productImage: product?.images?.[0] ?? "",
      };
    }));

    const estimatedDelivery = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);

    const [order] = await db.insert(ordersTable).values({
      userId: req.userId!,
      items: orderItems,
      status: "PENDING",
      deliveryType: parsed.data.deliveryType,
      deliveryAddress: parsed.data.deliveryAddress ?? null,
      contactDetails: parsed.data.contactDetails ?? null,
      subtotal: String(subtotal),
      discount: String(deliveryFee ? -deliveryFee : 0),
      couponDiscount: String(couponDiscount),
      coinsRedeemed,
      coinsEarned,
      total: String(total),
      couponCode,
      paymentStatus: "PAID",
      paymentMethod: parsed.data.paymentMethod,
      notes: parsed.data.notes ?? null,
      estimatedDelivery,
    }).returning();

    for (const { productId, quantity } of productsToDecrement) {
      await db.update(productsTable)
        .set({
          stock: sql`${productsTable.stock} - ${quantity}`,
          salesCount: sql`${productsTable.salesCount} + ${quantity}`,
        })
        .where(eq(productsTable.id, productId));
    }

    if (coinsRedeemed > 0) {
      await db.update(usersTable)
        .set({ superCoins: sql`${usersTable.superCoins} - ${coinsRedeemed}` })
        .where(eq(usersTable.id, req.userId!));
      await db.insert(coinTransactionsTable).values({
        userId: req.userId!,
        amount: -coinsRedeemed,
        reason: "ORDER_REDEEM",
        description: `Redeemed on Order #${order!.id}`,
        orderId: order!.id,
      });
    }
    // coinsEarned are recorded but NOT credited until order is DELIVERED

    const trackingPayload: typeof trackingTable.$inferInsert = {
      orderId: order!.id,
      destinationLat: parsed.data.deliveryAddress?.lat ? String(parsed.data.deliveryAddress.lat) : null,
      destinationLng: parsed.data.deliveryAddress?.lng ? String(parsed.data.deliveryAddress.lng) : null,
      history: [{ status: "PENDING", message: "Order placed successfully", timestamp: new Date() }],
    };
    await db.insert(trackingTable).values(trackingPayload);

    await db.update(cartsTable).set({ items: [], couponCode: null }).where(eq(cartsTable.userId, req.userId!));

    await db.insert(notificationsTable).values({
      userId: req.userId!,
      title: "Order Placed",
      message: `Your order #${order!.id} has been placed successfully`,
      type: "ORDER_UPDATE",
      orderId: order!.id,
    });

    // Notify all admins about the new order
    const admins = await db.select().from(usersTable).where(eq(usersTable.role, "ADMIN"));
    for (const admin of admins) {
      await db.insert(notificationsTable).values({
        userId: admin.id,
        title: "New Order Received",
        message: `A new order #${order!.id} has been placed (₹${total.toFixed(2)})`,
        type: "ORDER_UPDATE",
        orderId: order!.id,
      });
    }

    return res.status(201).json(await enrichOrder(order!));
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/delivery-agent", authenticateUser, requireDeliveryAgent, async (req: AuthRequest, res) => {
  try {
    const orders = await db.select().from(ordersTable)
      .where(eq(ordersTable.deliveryAgentId, req.userId!))
      .orderBy(desc(ordersTable.updatedAt));
    const enriched = await Promise.all(orders.map(o => enrichOrder(o)));
    return res.json(enriched);
  } catch (err) {
    req.log.error({ err }, "Failed to get agent orders");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:orderId", authenticateUser, async (req: AuthRequest, res) => {
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const id = parseInt(orderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!order) return res.status(404).json({ error: "Order not found" });

    if (req.userRole !== "ADMIN" && req.userRole !== "DELIVERY_AGENT" && order.userId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    return res.json(await enrichOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to get order");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:orderId", authenticateUser, async (req: AuthRequest, res) => {
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const id = parseInt(orderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Order not found" });

    if (req.userRole === "DELIVERY_AGENT" && existing.deliveryAgentId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }

    const [order] = await db.update(ordersTable)
      .set({
        status: parsed.data.status,
        ...(parsed.data.estimatedDelivery && { estimatedDelivery: new Date(parsed.data.estimatedDelivery) }),
      })
      .where(eq(ordersTable.id, id))
      .returning();

    const [tracking] = await db.select().from(trackingTable).where(eq(trackingTable.orderId, id));
    if (tracking) {
      const history = (tracking.history as Array<unknown>) ?? [];
      history.push({ status: parsed.data.status, message: getStatusMessage(parsed.data.status), timestamp: new Date() });
      await db.update(trackingTable).set({ history }).where(eq(trackingTable.orderId, id));
    }

    // Notify the customer
    await db.insert(notificationsTable).values({
      userId: existing.userId,
      title: "Order Update",
      message: `Order #${id}: ${getStatusMessage(parsed.data.status)}`,
      type: "ORDER_UPDATE",
      orderId: id,
    });

    // Notify all admin users
    const admins = await db.select().from(usersTable).where(eq(usersTable.role, "ADMIN"));
    for (const admin of admins) {
      if (admin.id !== existing.userId) {
        await db.insert(notificationsTable).values({
          userId: admin.id,
          title: "Order Status Changed",
          message: `Order #${id} is now: ${getStatusMessage(parsed.data.status)}`,
          type: "ORDER_UPDATE",
          orderId: id,
        });
      }
    }

    // When order is DELIVERED: credit coins earned + check referral bonus
    if (parsed.data.status === "DELIVERED" && existing.status !== "DELIVERED") {
      const coinsEarned = existing.coinsEarned ?? 0;
      if (coinsEarned > 0) {
        await db.update(usersTable)
          .set({ superCoins: sql`${usersTable.superCoins} + ${coinsEarned}` })
          .where(eq(usersTable.id, existing.userId));
        await db.insert(coinTransactionsTable).values({
          userId: existing.userId,
          amount: coinsEarned,
          reason: "ORDER_REWARD",
          description: `Super Coins credited for Order #${id}`,
          orderId: id,
        });
        await db.insert(notificationsTable).values({
          userId: existing.userId,
          title: "Super Coins Credited!",
          message: `You earned ${coinsEarned} Super Coins from Order #${id}`,
          type: "ORDER_UPDATE",
          orderId: id,
        });
      }

      // Check if this is the user's first completed order — award referrer bonus
      const [orderUser] = await db.select().from(usersTable).where(eq(usersTable.id, existing.userId));
      if (orderUser?.referredBy) {
        const previousDeliveries = await db.select({ count: sql<number>`count(*)` })
          .from(ordersTable)
          .where(and(
            eq(ordersTable.userId, existing.userId),
            eq(ordersTable.status, "DELIVERED"),
            ne(ordersTable.id, id),
          ));
        const prevCount = Number(previousDeliveries[0]?.count ?? 0);
        if (prevCount === 0) {
          // First ever delivered order — award referrer 100 coins
          const REFERRAL_BONUS = 100;
          await db.update(usersTable)
            .set({ superCoins: sql`${usersTable.superCoins} + ${REFERRAL_BONUS}` })
            .where(eq(usersTable.id, orderUser.referredBy));
          await db.insert(coinTransactionsTable).values({
            userId: orderUser.referredBy,
            amount: REFERRAL_BONUS,
            reason: "REFERRAL_BONUS",
            description: `${orderUser.name ?? orderUser.email} completed their first order`,
            referredUserId: existing.userId,
            orderId: id,
          });
          await db.insert(notificationsTable).values({
            userId: orderUser.referredBy,
            title: "Referral Bonus Earned!",
            message: `${orderUser.name ?? "Your friend"} placed their first order. You earned ${REFERRAL_BONUS} Super Coins!`,
            type: "ORDER_UPDATE",
            orderId: id,
          });
        }
      }
    }

    return res.json(await enrichOrder(order!));
  } catch (err) {
    req.log.error({ err }, "Failed to update order");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:orderId/assign-agent", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const id = parseInt(orderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

  const parsed = AssignDeliveryAgentBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const agentId = parseInt(parsed.data.agentId);
    const [order] = await db.update(ordersTable)
      .set({ deliveryAgentId: agentId, status: "CONFIRMED" })
      .where(eq(ordersTable.id, id))
      .returning();

    if (!order) return res.status(404).json({ error: "Order not found" });

    await db.insert(notificationsTable).values({
      userId: agentId,
      title: "New Delivery Assignment",
      message: `You have been assigned Order #${id}`,
      type: "ORDER_UPDATE",
      orderId: id,
    });

    return res.json(await enrichOrder(order));
  } catch (err) {
    req.log.error({ err }, "Failed to assign agent");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:orderId/return", authenticateUser, async (req: AuthRequest, res) => {
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const id = parseInt(orderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

  const { reason, images } = req.body as { reason?: string; images?: string[] };
  if (!reason?.trim()) return res.status(400).json({ error: "Return reason is required" });

  try {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Order not found" });
    if (existing.userId !== req.userId && req.userRole !== "ADMIN") {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (existing.status !== "DELIVERED") {
      return res.status(400).json({ error: "Only delivered orders can be returned" });
    }

    // Update order status to mark return requested and store reason in notes
    const returnNote = `RETURN_REQUESTED: ${reason.trim()}${images?.length ? ` | images: ${images.length}` : ""}`;
    const [order] = await db.update(ordersTable)
      .set({ status: "CANCELLED", notes: returnNote })
      .where(eq(ordersTable.id, id))
      .returning();

    // Notify customer
    await db.insert(notificationsTable).values({
      userId: existing.userId,
      title: "Return Request Received",
      message: `Your return request for Order #${id} has been submitted. We'll contact you within 24 hours.`,
      type: "ORDER_UPDATE",
      orderId: id,
    });

    // Notify all admins
    const admins = await db.select().from(usersTable).where(eq(usersTable.role, "ADMIN"));
    for (const admin of admins) {
      await db.insert(notificationsTable).values({
        userId: admin.id,
        title: "Return Request",
        message: `Order #${id} has a return request: ${reason.trim().slice(0, 80)}`,
        type: "ORDER_UPDATE",
        orderId: id,
      });
    }

    return res.json({ message: "Return request submitted", order: await enrichOrder(order!) });
  } catch (err) {
    req.log.error({ err }, "Failed to submit return");
    return res.status(500).json({ error: "Internal server error" });
  }
});

function getStatusMessage(status: string) {
  const messages: Record<string, string> = {
    PENDING: "Order placed",
    CONFIRMED: "Order confirmed",
    PROCESSING: "Order is being processed",
    PACKED: "Order packed and ready",
    OUT_FOR_DELIVERY: "Out for delivery",
    DELIVERED: "Delivered successfully",
    CANCELLED: "Order cancelled",
    PICKUP_READY: "Ready for pickup",
    PICKED_UP: "Order picked up",
  };
  return messages[status] ?? status;
}

async function enrichOrder(order: typeof ordersTable.$inferSelect) {
  let user = null;
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, order.userId));
  if (u) user = { id: String(u.id), email: u.email, name: u.name, phone: u.phone, role: u.role, superCoins: u.superCoins ?? 0, createdAt: u.createdAt };

  let deliveryAgent = null;
  if (order.deliveryAgentId) {
    const [agent] = await db.select().from(usersTable).where(eq(usersTable.id, order.deliveryAgentId));
    if (agent) deliveryAgent = { id: String(agent.id), email: agent.email, name: agent.name, phone: agent.phone, role: agent.role, superCoins: agent.superCoins ?? 0, createdAt: agent.createdAt };
  }

  return {
    id: String(order.id),
    userId: String(order.userId),
    user,
    items: order.items,
    status: order.status,
    deliveryType: order.deliveryType,
    deliveryAddress: order.deliveryAddress,
    contactDetails: order.contactDetails,
    subtotal: parseFloat(String(order.subtotal)),
    discount: parseFloat(String(order.discount)),
    couponDiscount: parseFloat(String(order.couponDiscount)),
    coinsRedeemed: order.coinsRedeemed ?? 0,
    coinsEarned: order.coinsEarned ?? 0,
    total: parseFloat(String(order.total)),
    couponCode: order.couponCode,
    deliveryAgentId: order.deliveryAgentId ? String(order.deliveryAgentId) : null,
    deliveryAgent,
    estimatedDelivery: order.estimatedDelivery,
    paymentStatus: order.paymentStatus,
    paymentMethod: order.paymentMethod,
    notes: order.notes,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export default router;
