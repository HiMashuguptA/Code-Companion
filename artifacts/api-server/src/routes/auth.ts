import { Router } from "express";
import { db, usersTable, coinTransactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { RegisterUserBody, UpdateProfileBody } from "@workspace/api-zod";
import { authenticateUser, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

const REFEREE_BONUS = 50;
const REFERRAL_BONUS = 100;

function genReferralCode(seed: string) {
  const base = seed.replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
  const slice = (base.slice(0, 4) || "GUPT").padEnd(4, "X");
  const suffix = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `${slice}${suffix}`;
}

async function uniqueReferralCode(seed: string) {
  for (let i = 0; i < 8; i++) {
    const code = genReferralCode(seed);
    const existing = await db.select().from(usersTable).where(eq(usersTable.referralCode, code));
    if (existing.length === 0) return code;
  }
  return `GUPT${Date.now().toString(36).toUpperCase()}`;
}

router.post("/register", async (req, res) => {
  const parsed = RegisterUserBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }

  const { firebaseUid, email, name, phone, photoUrl, referralCode } = parsed.data;

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, firebaseUid));
    if (existing.length > 0) {
      let user = existing[0]!;
      if (!user.referralCode) {
        const code = await uniqueReferralCode(name ?? email);
        const [updated] = await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, user.id)).returning();
        if (updated) user = updated;
      }
      return res.json(formatUser(user));
    }

    let referredById: number | null = null;
    if (referralCode) {
      const [refUser] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode.toUpperCase()));
      if (refUser) referredById = refUser.id;
    }

    const newCode = await uniqueReferralCode(name ?? email);
    const [user] = await db.insert(usersTable).values({
      firebaseUid,
      email,
      name: name ?? null,
      phone: phone ?? null,
      photoUrl: photoUrl ?? null,
      role: "USER",
      referralCode: newCode,
      referredBy: referredById,
      superCoins: referredById ? REFEREE_BONUS : 0,
    }).returning();

    if (referredById && user) {
      // Referee gets 50 coins immediately on sign-up
      await db.insert(coinTransactionsTable).values({
        userId: user.id,
        amount: REFEREE_BONUS,
        reason: "REFEREE_BONUS",
        description: `Welcome bonus for joining via referral`,
      });
      // Referrer bonus (100 coins) is awarded ONLY when the referee's first order is DELIVERED (see orders route)
    }

    return res.json(formatUser(user!));
  } catch (err) {
    console.error("Error registering user:", err);
    req.log.error({ err }, "Failed to register user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

async function getCoins(userId: number) {
  const [u] = await db.select().from(usersTable).where(eq(usersTable.id, userId));
  return u?.superCoins ?? 0;
}

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
    superCoins: user.superCoins ?? 0,
    referralCode: user.referralCode,
    referredBy: user.referredBy ? String(user.referredBy) : null,
    createdAt: user.createdAt,
  };
}

export default router;
