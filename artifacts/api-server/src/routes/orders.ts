import { Router } from "express";
import { db, ordersTable, usersTable, cartsTable, productsTable, trackingTable, notificationsTable } from "@workspace/db";
import { eq, and, sql, desc } from "drizzle-orm";
import { CreateOrderBody, UpdateOrderBody, AssignDeliveryAgentBody } from "@workspace/api-zod";
import { authenticateUser, requireAdmin, requireDeliveryAgent, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// List orders
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

// Create order
router.post("/", authenticateUser, async (req: AuthRequest, res) => {
  const parsed = CreateOrderBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    // Get cart
    const [cart] = await db.select().from(cartsTable).where(eq(cartsTable.userId, req.userId!));
    if (!cart) return res.status(400).json({ error: "Cart is empty" });

    const cartItems = cart.items as Array<{ id: string; productId: string; quantity: number; price: number }>;
    if (cartItems.length === 0) return res.status(400).json({ error: "Cart is empty" });

    const subtotal = cartItems.reduce((sum, i) => sum + i.price * i.quantity, 0);
    let couponDiscount = 0;
    const couponCode = cart.couponCode as string | null;

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

    const total = Math.max(0, subtotal - couponDiscount);
    const estimatedDelivery = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000); // 2 days

    const [order] = await db.insert(ordersTable).values({
      userId: req.userId!,
      items: orderItems,
      status: "PENDING",
      deliveryType: parsed.data.deliveryType,
      deliveryAddress: parsed.data.deliveryAddress ?? null,
      subtotal: String(subtotal),
      discount: "0",
      couponDiscount: String(couponDiscount),
      total: String(total),
      couponCode: couponCode,
      paymentStatus: "PAID",
      paymentMethod: parsed.data.paymentMethod,
      notes: parsed.data.notes ?? null,
      estimatedDelivery,
    }).returning();

    // Create tracking entry
    await db.insert(trackingTable).values({
      orderId: order!.id,
      destinationLat: (parsed.data.deliveryAddress as Record<string, number> | null)?.lat ?? null,
      destinationLng: (parsed.data.deliveryAddress as Record<string, number> | null)?.lng ?? null,
      history: [{ status: "PENDING", message: "Order placed successfully", timestamp: new Date() }],
    });

    // Clear cart
    await db.update(cartsTable).set({ items: [], couponCode: null }).where(eq(cartsTable.userId, req.userId!));

    // Create notification
    await db.insert(notificationsTable).values({
      userId: req.userId!,
      title: "Order Placed",
      message: `Your order #${order!.id} has been placed successfully`,
      type: "ORDER_UPDATE",
      orderId: order!.id,
    });

    return res.status(201).json(await enrichOrder(order!));
  } catch (err) {
    req.log.error({ err }, "Failed to create order");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get delivery agent orders
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

// Get single order
router.get("/:orderId", authenticateUser, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.orderId!);
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

// Update order status
router.put("/:orderId", authenticateUser, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.orderId!);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid order ID" });

  const parsed = UpdateOrderBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const [existing] = await db.select().from(ordersTable).where(eq(ordersTable.id, id));
    if (!existing) return res.status(404).json({ error: "Order not found" });

    // Delivery agents can only update their assigned orders
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

    // Add tracking event
    const [tracking] = await db.select().from(trackingTable).where(eq(trackingTable.orderId, id));
    if (tracking) {
      const history = (tracking.history as Array<unknown>) ?? [];
      history.push({ status: parsed.data.status, message: getStatusMessage(parsed.data.status), timestamp: new Date() });
      await db.update(trackingTable).set({ history }).where(eq(trackingTable.orderId, id));
    }

    // Notify user
    await db.insert(notificationsTable).values({
      userId: existing.userId,
      title: "Order Update",
      message: `Order #${id}: ${getStatusMessage(parsed.data.status)}`,
      type: "ORDER_UPDATE",
      orderId: id,
    });

    return res.json(await enrichOrder(order!));
  } catch (err) {
    req.log.error({ err }, "Failed to update order");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Assign delivery agent
router.post("/:orderId/assign-agent", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.orderId!);
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

    // Notify delivery agent
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
  if (u) user = { id: String(u.id), email: u.email, name: u.name, phone: u.phone, role: u.role, createdAt: u.createdAt };

  let deliveryAgent = null;
  if (order.deliveryAgentId) {
    const [agent] = await db.select().from(usersTable).where(eq(usersTable.id, order.deliveryAgentId));
    if (agent) deliveryAgent = { id: String(agent.id), email: agent.email, name: agent.name, phone: agent.phone, role: agent.role, createdAt: agent.createdAt };
  }

  return {
    id: String(order.id),
    userId: String(order.userId),
    user,
    items: order.items,
    status: order.status,
    deliveryType: order.deliveryType,
    deliveryAddress: order.deliveryAddress,
    subtotal: parseFloat(String(order.subtotal)),
    discount: parseFloat(String(order.discount)),
    couponDiscount: parseFloat(String(order.couponDiscount)),
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
