import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterUserBody, UpdateProfileBody } from "@workspace/api-zod";
import { authenticateUser, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// Register or sync Firebase user
router.post("/register", async (req, res) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  const { firebaseUid, email, name, phone, photoUrl } = parsed.data;

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, firebaseUid));

    if (existing.length > 0) {
      const [user] = existing;
      return res.json(formatUser(user!));
    }

    const [user] = await db.insert(usersTable).values({
      firebaseUid,
      email,
      name: name ?? null,
      phone: phone ?? null,
      photoUrl: photoUrl ?? null,
      role: "USER",
    }).returning();

    return res.json(formatUser(user!));
  } catch (err) {
    req.log.error({ err }, "Failed to register user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Get current user profile
router.get("/profile", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(formatUser(user));
  } catch (err) {
    req.log.error({ err }, "Failed to get profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Update profile
router.put("/profile", authenticateUser, async (req: AuthRequest, res) => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  const { name, phone, photoUrl, addresses } = parsed.data;

  try {
    const [user] = await db.update(usersTable)
      .set({
        ...(name !== undefined && { name }),
        ...(phone !== undefined && { phone }),
        ...(photoUrl !== undefined && { photoUrl }),
        ...(addresses !== undefined && { addresses: addresses as never }),
      })
      .where(eq(usersTable.id, req.userId!))
      .returning();

    return res.json(formatUser(user!));
  } catch (err) {
    req.log.error({ err }, "Failed to update profile");
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
