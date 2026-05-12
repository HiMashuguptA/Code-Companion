import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import { UpdateUserBody } from "@workspace/api-zod";
import { authenticateUser, requireAdmin, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// Save / update an address in the current user's address book
router.post("/me/save-address", authenticateUser, async (req: AuthRequest, res) => {
  const { street, city, state, pincode, lat, lng, label } = req.body as {
    street: string; city: string; state: string; pincode: string;
    lat?: number; lng?: number; label?: string;
  };
  if (!street || !city || !pincode) {
    return res.status(400).json({ error: "street, city, and pincode are required" });
  }
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) return res.status(404).json({ error: "User not found" });

    const existing = (user.addresses ?? []) as Array<Record<string, unknown>>;
    // Deduplicate: if same street+pincode exists, update it; otherwise add new
    const newAddr = {
      id: `addr-${Date.now()}`,
      label: label?.trim() || "Home",
      street: street.trim(),
      city: city.trim(),
      state: state?.trim() || "Nagaland",
      pincode: pincode.trim(),
      lat: lat ?? null,
      lng: lng ?? null,
      isDefault: existing.length === 0,
    };
    const duplicate = existing.find(
      a => String(a.street ?? "").toLowerCase() === newAddr.street.toLowerCase()
        && String(a.pincode ?? "") === newAddr.pincode
    );
    let updated: typeof existing;
    if (duplicate) {
      updated = existing.map(a => a.id === duplicate.id ? { ...a, ...newAddr, id: a.id } : a);
    } else {
      // Keep only last 5 addresses
      updated = [...existing, newAddr].slice(-5);
    }

    await db.update(usersTable).set({ addresses: updated }).where(eq(usersTable.id, req.userId!));
    return res.json({ message: "Address saved", addresses: updated });
  } catch (err) {
    req.log.error({ err }, "Failed to save address");
    return res.status(500).json({ error: "Internal server error" });
  }
});

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
