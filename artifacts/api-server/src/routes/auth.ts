import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterUserBody, UpdateProfileBody } from "@workspace/api-zod";
import { authenticateUser, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// Register or sync Firebase user
router.post("/register", async (req, res) => {
  console.log("🔵 [AUTH] Register endpoint called");
  console.log("📦 Request body:", req.body);
  
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    console.log("❌ [AUTH] Validation failed:", parsed.error.issues);
    return res.status(400).json({ error: parsed.error.issues });
  }
  
  const { firebaseUid, email, name, phone, photoUrl } = parsed.data;
  console.log("✅ [AUTH] Validation passed for user:", email, firebaseUid);

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, firebaseUid));
    console.log("🔍 [AUTH] Existing user check:", existing.length > 0 ? "FOUND" : "NOT FOUND");

    if (existing.length > 0) {
      const [user] = existing;
      console.log("📝 [AUTH] Returning existing user:", user.id, user.email);
      return res.json(formatUser(user!));
    }

    console.log("🆕 [AUTH] Creating new user...");
    const [user] = await db.insert(usersTable).values({
      firebaseUid,
      email,
      name: name ?? null,
      phone: phone ?? null,
      photoUrl: photoUrl ?? null,
      role: "USER",
    }).returning();

    console.log("✨ [AUTH] User created successfully:", user.id, user.email);
    return res.json(formatUser(user!));
  } catch (err) {
    console.error("💥 [AUTH] Error registering user:", err);
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
