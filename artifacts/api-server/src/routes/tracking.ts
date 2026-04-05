import { Router } from "express";
import { db, trackingTable, ordersTable, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateDeliveryLocationBody } from "@workspace/api-zod";
import { authenticateUser, requireDeliveryAgent, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/:orderId", authenticateUser, async (req: AuthRequest, res) => {
  const orderId = parseInt(req.params.orderId!);
  if (isNaN(orderId)) return res.status(400).json({ error: "Invalid order ID" });

  try {
    const [order] = await db.select().from(ordersTable).where(eq(ordersTable.id, orderId));
    if (!order) return res.status(404).json({ error: "Order not found" });

    const [tracking] = await db.select().from(trackingTable).where(eq(trackingTable.orderId, orderId));

    let agentName = null;
    let agentPhone = null;
    if (order.deliveryAgentId) {
      const [agent] = await db.select().from(usersTable).where(eq(usersTable.id, order.deliveryAgentId));
      agentName = agent?.name ?? null;
      agentPhone = agent?.phone ?? null;
    }

    return res.json({
      orderId: String(orderId),
      status: order.status,
      agentName,
      agentPhone,
      currentLat: tracking?.currentLat ? parseFloat(String(tracking.currentLat)) : null,
      currentLng: tracking?.currentLng ? parseFloat(String(tracking.currentLng)) : null,
      destinationLat: tracking?.destinationLat ? parseFloat(String(tracking.destinationLat)) : null,
      destinationLng: tracking?.destinationLng ? parseFloat(String(tracking.destinationLng)) : null,
      estimatedDelivery: order.estimatedDelivery,
      history: tracking?.history ?? [],
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get tracking");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:orderId/location", authenticateUser, requireDeliveryAgent, async (req: AuthRequest, res) => {
  const orderId = parseInt(req.params.orderId!);
  if (isNaN(orderId)) return res.status(400).json({ error: "Invalid order ID" });

  const parsed = UpdateDeliveryLocationBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const [tracking] = await db.select().from(trackingTable).where(eq(trackingTable.orderId, orderId));
    if (!tracking) return res.status(404).json({ error: "Tracking not found" });

    await db.update(trackingTable).set({
      currentLat: String(parsed.data.lat),
      currentLng: String(parsed.data.lng),
      agentId: req.userId!,
    }).where(eq(trackingTable.orderId, orderId));

    return res.json({ message: "Location updated" });
  } catch (err) {
    req.log.error({ err }, "Failed to update location");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
