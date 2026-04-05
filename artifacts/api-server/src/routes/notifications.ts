import { Router } from "express";
import { db, notificationsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { authenticateUser, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const notifications = await db.select().from(notificationsTable)
      .where(eq(notificationsTable.userId, req.userId!))
      .orderBy(desc(notificationsTable.createdAt))
      .limit(50);

    return res.json(notifications.map(n => ({
      id: String(n.id),
      userId: String(n.userId),
      title: n.title,
      message: n.message,
      type: n.type,
      isRead: n.isRead,
      orderId: n.orderId ? String(n.orderId) : undefined,
      createdAt: n.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get notifications");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:notificationId/read", authenticateUser, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.notificationId!);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid notification ID" });

  try {
    await db.update(notificationsTable).set({ isRead: true })
      .where(eq(notificationsTable.id, id));
    return res.json({ message: "Marked as read" });
  } catch (err) {
    req.log.error({ err }, "Failed to mark notification");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/read-all", authenticateUser, async (req: AuthRequest, res) => {
  try {
    await db.update(notificationsTable).set({ isRead: true })
      .where(eq(notificationsTable.userId, req.userId!));
    return res.json({ message: "All marked as read" });
  } catch (err) {
    req.log.error({ err }, "Failed to mark all notifications");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
