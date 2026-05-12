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
  couponsTable,
} from "@workspace/db";
import { eq, and, sql, desc, asc, lte, ne } from "drizzle-orm";
import { CreateOrderBody, UpdateOrderBody, AssignDeliveryAgentBody } from "@workspace/api-zod";
import { authenticateUser, requireAdmin, requireDeliveryAgent, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const COIN_VALUE = 1;
const REWARD_PCT = 0.02;

const RETURN_STATUSES = ["RETURN_PENDING", "RETURN_IN_TRANSIT", "RETURNED", "REFUND_INITIATED"] as const;

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

    const userOrderNumberMap = new Map<number, number>();
    if (req.userRole !== "ADMIN" && req.userId) {
      const allUserOrders = await db
        .select({ id: ordersTable.id })
        .from(ordersTable)
        .where(eq(ordersTable.userId, req.userId))
        .orderBy(asc(ordersTable.createdAt));
      allUserOrders.forEach((o, i) => userOrderNumberMap.set(o.id, i + 1));
    }

    const enriched = await Promise.all(orders.map(o => enrichOrder(o, userOrderNumberMap.get(o.id))));

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

    if (couponCode) {
      await db.update(couponsTable)
        .set({ usageCount: sql`${couponsTable.usageCount} + 1` })
        .where(eq(couponsTable.code, couponCode));
    }

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

    let userOrderNumber: number | undefined;
    if (req.userRole !== "ADMIN") {
      const [{ count }] = await db
        .select({ count: sql<number>`count(*)` })
        .from(ordersTable)
        .where(and(
          eq(ordersTable.userId, order.userId),
          lte(ordersTable.createdAt, order.createdAt),
        ));
      userOrderNumber = Number(count);
    }

    return res.json(await enrichOrder(order, userOrderNumber));
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

    await db.insert(notificationsTable).values({
      userId: existing.userId,
      title: "Order Update",
      message: `Order #${id}: ${getStatusMessage(parsed.data.status)}`,
      type: "ORDER_UPDATE",
      orderId: id,
    });

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

    // Only refund coins/stock for true cancellations (not return-flow statuses)
    const isReturnStatus = RETURN_STATUSES.includes(existing.status as typeof RETURN_STATUSES[number]);
    if (parsed.data.status === "CANCELLED" && existing.status !== "CANCELLED" && !isReturnStatus) {
      const coinsToRefund = existing.coinsRedeemed ?? 0;
      if (coinsToRefund > 0) {
        await db.update(usersTable)
          .set({ superCoins: sql`${usersTable.superCoins} + ${coinsToRefund}` })
          .where(eq(usersTable.id, existing.userId));
        await db.insert(coinTransactionsTable).values({
          userId: existing.userId,
          amount: coinsToRefund,
          reason: "ORDER_REFUND",
          description: `Super Coins refunded for cancelled Order #${id}`,
          orderId: id,
        });
        await db.insert(notificationsTable).values({
          userId: existing.userId,
          title: "Super Coins Refunded",
          message: `${coinsToRefund} Super Coins have been returned to your wallet as Order #${id} was cancelled.`,
          type: "ORDER_UPDATE",
          orderId: id,
        });
      }

      const cancelledItems = existing.items as Array<{ productId: string; quantity: number }>;
      for (const item of cancelledItems) {
        const pid = parseInt(item.productId);
        if (!isNaN(pid)) {
          await db.update(productsTable)
            .set({
              stock: sql`${productsTable.stock} + ${item.quantity}`,
              salesCount: sql`GREATEST(0, ${productsTable.salesCount} - ${item.quantity})`,
            })
            .where(eq(productsTable.id, pid));
        }
      }
    }

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

// ─── Return Flow ──────────────────────────────────────────────────────────────

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

    const [order] = await db.update(ordersTable)
      .set({
        status: "RETURN_PENDING",
        notes: `RETURN_REQUESTED: ${reason.trim()}`,
        returnImages: images?.length ? images : null,
      })
      .where(eq(ordersTable.id, id))
      .returning();

    await db.insert(notificationsTable).values({
      userId: existing.userId,
      title: "Return Request Received",
      message: `Your return request for Order #${id} has been submitted. Our team will review it within 24 hours.`,
      type: "ORDER_UPDATE",
      orderId: id,
    });

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

router.post("/:orderId/return-approve", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const id = parseInt(orderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

  try {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Order not found" });

    const currentNotes = existing.notes ?? "";
    // Support both new (RETURN_PENDING status) and legacy (CANCELLED + notes) returns
    const isPendingReturn = existing.status === "RETURN_PENDING" && currentNotes.startsWith("RETURN_REQUESTED:");
    const isLegacyReturn = existing.status === "CANCELLED" && currentNotes.startsWith("RETURN_REQUESTED:");
    if (!isPendingReturn && !isLegacyReturn) {
      return res.status(400).json({ error: "This order does not have a pending return request" });
    }

    const newNotes = currentNotes.replace(/^RETURN_REQUESTED:/, "RETURN_APPROVED:");
    const [order] = await db.update(ordersTable)
      .set({ notes: newNotes, status: "RETURN_PENDING" })
      .where(eq(ordersTable.id, id))
      .returning();

    await db.insert(notificationsTable).values({
      userId: existing.userId,
      title: "Return Request Approved",
      message: `Your return request for Order #${id} has been approved. A delivery agent will be assigned to collect the item.`,
      type: "ORDER_UPDATE",
      orderId: id,
    });

    return res.json({ message: "Return approved", order: await enrichOrder(order!) });
  } catch (err) {
    req.log.error({ err }, "Failed to approve return");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/:orderId/return-reject", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const id = parseInt(orderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

  const { message: rejectionMsg } = req.body as { message?: string };

  try {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Order not found" });

    const currentNotes = existing.notes ?? "";
    if (!currentNotes.startsWith("RETURN_REQUESTED:") && !currentNotes.startsWith("RETURN_APPROVED:")) {
      return res.status(400).json({ error: "This order does not have a return request to reject" });
    }

    const rejectedReason = currentNotes.replace(/^RETURN_REQUESTED:|^RETURN_APPROVED:/, "").trim();
    const newNotes = `RETURN_REJECTED: ${rejectedReason}${rejectionMsg?.trim() ? ` | reason: ${rejectionMsg.trim()}` : ""}`;
    const [order] = await db.update(ordersTable)
      .set({ status: "DELIVERED", notes: newNotes })
      .where(eq(ordersTable.id, id))
      .returning();

    const notifMsg = rejectionMsg?.trim()
      ? `Your return request for Order #${id} could not be approved: ${rejectionMsg.trim()}`
      : `Your return request for Order #${id} has been reviewed and unfortunately cannot be approved at this time.`;

    await db.insert(notificationsTable).values({
      userId: existing.userId,
      title: "Return Request Update",
      message: notifMsg,
      type: "ORDER_UPDATE",
      orderId: id,
    });

    return res.json({ message: "Return rejected", order: await enrichOrder(order!) });
  } catch (err) {
    req.log.error({ err }, "Failed to reject return");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Assign agent for return pickup → RETURN_IN_TRANSIT
router.post("/:orderId/return-assign-agent", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const id = parseInt(orderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

  const { agentId } = req.body as { agentId?: string };
  if (!agentId) return res.status(400).json({ error: "agentId is required" });

  try {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Order not found" });
    if (existing.status !== "RETURN_PENDING") {
      return res.status(400).json({ error: "Order must be in RETURN_PENDING state" });
    }

    const agentIdNum = parseInt(agentId);
    const [order] = await db.update(ordersTable)
      .set({ status: "RETURN_IN_TRANSIT", deliveryAgentId: agentIdNum })
      .where(eq(ordersTable.id, id))
      .returning();

    // Notify the customer
    await db.insert(notificationsTable).values({
      userId: existing.userId,
      title: "Return Pickup Arranged",
      message: `A delivery agent has been assigned to collect your return for Order #${id}. You can track their location in real time.`,
      type: "ORDER_UPDATE",
      orderId: id,
    });

    // Notify the agent
    await db.insert(notificationsTable).values({
      userId: agentIdNum,
      title: "Return Pickup Assignment",
      message: `You have been assigned to collect the return for Order #${id}. Pickup address is the customer's delivery address.`,
      type: "ORDER_UPDATE",
      orderId: id,
    });

    return res.json({ message: "Agent assigned for return pickup", order: await enrichOrder(order!) });
  } catch (err) {
    req.log.error({ err }, "Failed to assign return agent");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Mark item as physically returned (agent picked up from customer) → RETURNED
router.post("/:orderId/return-mark-returned", authenticateUser, async (req: AuthRequest, res) => {
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const id = parseInt(orderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

  try {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Order not found" });

    if (req.userRole !== "ADMIN" && existing.deliveryAgentId !== req.userId) {
      return res.status(403).json({ error: "Forbidden" });
    }
    if (existing.status !== "RETURN_IN_TRANSIT") {
      return res.status(400).json({ error: "Order must be in RETURN_IN_TRANSIT state" });
    }

    const [order] = await db.update(ordersTable)
      .set({ status: "RETURNED" })
      .where(eq(ordersTable.id, id))
      .returning();

    await db.insert(notificationsTable).values({
      userId: existing.userId,
      title: "Return Received",
      message: `Your returned item for Order #${id} has been collected. Refund will be initiated within 2-5 business days.`,
      type: "ORDER_UPDATE",
      orderId: id,
    });

    return res.json({ message: "Order marked as returned", order: await enrichOrder(order!) });
  } catch (err) {
    req.log.error({ err }, "Failed to mark returned");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Admin initiates refund → REFUND_INITIATED + refund coins + restore stock
router.post("/:orderId/return-initiate-refund", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const orderId = Array.isArray(req.params.orderId) ? req.params.orderId[0] : req.params.orderId;
  const id = parseInt(orderId);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

  try {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Order not found" });
    if (existing.status !== "RETURNED") {
      return res.status(400).json({ error: "Order must be in RETURNED state to initiate refund" });
    }

    const [order] = await db.update(ordersTable)
      .set({ status: "REFUND_INITIATED", paymentStatus: "REFUNDED" })
      .where(eq(ordersTable.id, id))
      .returning();

    // Refund any redeemed coins back to user
    const coinsToRefund = existing.coinsRedeemed ?? 0;
    if (coinsToRefund > 0) {
      await db.update(usersTable)
        .set({ superCoins: sql`${usersTable.superCoins} + ${coinsToRefund}` })
        .where(eq(usersTable.id, existing.userId));
      await db.insert(coinTransactionsTable).values({
        userId: existing.userId,
        amount: coinsToRefund,
        reason: "ORDER_REFUND",
        description: `Super Coins refunded for returned Order #${id}`,
        orderId: id,
      });
    }

    // Reclaim any coins that were earned and credited (reversal)
    const coinsEarned = existing.coinsEarned ?? 0;
    if (coinsEarned > 0) {
      await db.update(usersTable)
        .set({ superCoins: sql`GREATEST(0, ${usersTable.superCoins} - ${coinsEarned})` })
        .where(eq(usersTable.id, existing.userId));
      await db.insert(coinTransactionsTable).values({
        userId: existing.userId,
        amount: -coinsEarned,
        reason: "ORDER_REFUND",
        description: `Super Coins reversed for returned Order #${id}`,
        orderId: id,
      });
    }

    // Restore product stock
    const returnedItems = existing.items as Array<{ productId: string; quantity: number }>;
    for (const item of returnedItems) {
      const pid = parseInt(item.productId);
      if (!isNaN(pid)) {
        await db.update(productsTable)
          .set({
            stock: sql`${productsTable.stock} + ${item.quantity}`,
            salesCount: sql`GREATEST(0, ${productsTable.salesCount} - ${item.quantity})`,
          })
          .where(eq(productsTable.id, pid));
      }
    }

    await db.insert(notificationsTable).values({
      userId: existing.userId,
      title: "Refund Initiated",
      message: `Your refund of ₹${parseFloat(String(existing.total)).toFixed(0)} for Order #${id} has been initiated. It will reflect in 2-5 business days.`,
      type: "ORDER_UPDATE",
      orderId: id,
    });

    return res.json({ message: "Refund initiated", order: await enrichOrder(order!) });
  } catch (err) {
    req.log.error({ err }, "Failed to initiate refund");
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
    RETURN_PENDING: "Return request pending review",
    RETURN_IN_TRANSIT: "Return in transit — agent heading to collect",
    RETURNED: "Item collected — refund processing",
    REFUND_INITIATED: "Refund initiated",
  };
  return messages[status] ?? status;
}

async function enrichOrder(order: typeof ordersTable.$inferSelect, userOrderNumber?: number) {
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
    userOrderNumber: userOrderNumber ?? null,
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
    returnImages: order.returnImages ?? null,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
  };
}

export default router;
