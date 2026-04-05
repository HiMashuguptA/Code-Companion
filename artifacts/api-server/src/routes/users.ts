import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { UpdateUserBody } from "@workspace/api-zod";
import { authenticateUser, requireAdmin, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const { role, page = "1" } = req.query as Record<string, string>;
  const pageNum = parseInt(page);
  const limitNum = 20;
  const offset = (pageNum - 1) * limitNum;

  try {
    const conditions = role ? [eq(usersTable.role, role as never)] : [];
    const whereClause = conditions.length > 0 ? conditions[0] : undefined;

    const users = await db.select().from(usersTable).where(whereClause).limit(limitNum).offset(offset);
    const [countResult] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(whereClause);
    const total = Number(countResult?.count ?? 0);

    return res.json({
      users: users.map(formatUser),
      total,
      page: pageNum,
      totalPages: Math.ceil(total / limitNum),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to list users");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/:userId", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.userId!);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, id));
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(formatUser(user));
  } catch (err) {
    req.log.error({ err }, "Failed to get user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:userId", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.userId!);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid user ID" });

  const parsed = UpdateUserBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const updates: Partial<typeof usersTable.$inferInsert> = {};
    if (parsed.data.role !== undefined) updates.role = parsed.data.role;
    if (parsed.data.isActive !== undefined) updates.isActive = parsed.data.isActive;

    const [user] = await db.update(usersTable).set(updates).where(eq(usersTable.id, id)).returning();
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(formatUser(user));
  } catch (err) {
    req.log.error({ err }, "Failed to update user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: String(user.id),
    firebaseUid: user.firebaseUid,
    email: user.email,
    name: user.name,
    phone: user.phone,
    role: user.role,
    photoUrl: user.photoUrl,
    addresses: user.addresses ?? [],
    createdAt: user.createdAt,
  };
}

export default router;
