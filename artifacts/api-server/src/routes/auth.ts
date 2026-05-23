import { Router, type Request, type Response } from "express";
import { db, usersTable, coinTransactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateProfileBody } from "@workspace/api-zod";
import { authenticateUser, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

// Replit Auth login redirect
router.get("/replit-login", (req: Request, res: Response) => {
  const domains = process.env.REPLIT_DOMAINS?.split(",")[0]?.trim();
  const returnTo = encodeURIComponent(`https://${domains ?? "localhost:5000"}/api/auth/replit-return`);
  res.redirect(`https://replit.com/auth_with_repl_site?domain=${domains ?? "localhost:5000"}&redirect_uri=${returnTo}`);
});

// Replit Auth return callback (browser redirect after Replit OAuth)
router.get("/replit-return", (req: Request, res: Response) => {
  // The actual session creation happens via POST /api/auth/replit-callback from the frontend
  // After Replit Auth sets the __replauthuser cookie, redirect back to the app
  res.redirect("/");
});

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

// Replit Auth callback — called by frontend after Replit Auth completes
router.post("/replit-callback", async (req, res) => {
  const { replitUserId, email, name, photoUrl, referralCode } = req.body as {
    replitUserId: string;
    email?: string;
    name?: string;
    photoUrl?: string;
    referralCode?: string;
  };

  if (!replitUserId) {
    return res.status(400).json({ error: "replitUserId is required" });
  }

  try {
    let existing = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, replitUserId));
    let user = existing[0];

    // If not found by firebaseUid, try by email to link existing accounts
    if (!user && email) {
      const byEmail = await db.select().from(usersTable).where(eq(usersTable.email, email));
      if (byEmail.length > 0) {
        user = byEmail[0];
        // Update firebaseUid to link this new auth provider
        await db.update(usersTable)
          .set({ firebaseUid: replitUserId, name: name ?? user.name, photoUrl: photoUrl ?? user.photoUrl })
          .where(eq(usersTable.id, user.id));
      }
    }

    if (!user) {
      // New user — register
      let referredById: number | null = null;
      if (referralCode) {
        const [refUser] = await db.select().from(usersTable).where(eq(usersTable.referralCode, referralCode.toUpperCase()));
        if (refUser) referredById = refUser.id;
      }

      const newCode = await uniqueReferralCode(name ?? email ?? replitUserId);
      const resolvedEmail = email || `${replitUserId}@replit.auth`;

      const [created] = await db.insert(usersTable).values({
        firebaseUid: replitUserId,
        email: resolvedEmail,
        name: name ?? null,
        phone: null,
        photoUrl: photoUrl ?? null,
        role: "USER",
        referralCode: newCode,
        referredBy: referredById,
        superCoins: referredById ? REFEREE_BONUS : 0,
      }).returning();

      if (referredById && created) {
        await db.insert(coinTransactionsTable).values({
          userId: created.id,
          amount: REFEREE_BONUS,
          reason: "REFEREE_BONUS",
          description: `Welcome bonus for joining via referral`,
        });
      }

      user = created!;
    } else {
      // Existing user — ensure referral code exists
      if (!user.referralCode) {
        const code = await uniqueReferralCode(name ?? email ?? replitUserId);
        const [updated] = await db.update(usersTable)
          .set({ referralCode: code })
          .where(eq(usersTable.id, user.id))
          .returning();
        if (updated) user = updated;
      }
    }

    // Persist session
    (req.session as Record<string, unknown>).userId = user!.id;
    (req.session as Record<string, unknown>).userRole = user!.role;
    (req.session as Record<string, unknown>).replitUserId = replitUserId;

    return res.json(formatUser(user!));
  } catch (err) {
    console.error("Error in replit-callback:", err);
    req.log.error({ err }, "Failed to handle Replit auth callback");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Keep backward-compatible /register endpoint (used by existing API client hooks)
router.post("/register", async (req, res) => {
  const { firebaseUid, email, name, phone, photoUrl, referralCode } = req.body as {
    firebaseUid: string;
    email: string;
    name?: string;
    phone?: string;
    photoUrl?: string;
    referralCode?: string;
  };

  if (!firebaseUid || !email) {
    return res.status(400).json({ error: "firebaseUid and email are required" });
  }

  try {
    const existing = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, firebaseUid));
    if (existing.length > 0) {
      let user = existing[0]!;
      if (!user.referralCode) {
        const code = await uniqueReferralCode(name ?? email);
        const [updated] = await db.update(usersTable).set({ referralCode: code }).where(eq(usersTable.id, user.id)).returning();
        if (updated) user = updated;
      }
      // Persist session
      (req.session as Record<string, unknown>).userId = user.id;
      (req.session as Record<string, unknown>).userRole = user.role;
      (req.session as Record<string, unknown>).replitUserId = firebaseUid;
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
      await db.insert(coinTransactionsTable).values({
        userId: user.id,
        amount: REFEREE_BONUS,
        reason: "REFEREE_BONUS",
        description: `Welcome bonus for joining via referral`,
      });
    }

    // Persist session
    if (user) {
      (req.session as Record<string, unknown>).userId = user.id;
      (req.session as Record<string, unknown>).userRole = user.role;
      (req.session as Record<string, unknown>).replitUserId = firebaseUid;
    }

    return res.json(formatUser(user!));
  } catch (err) {
    console.error("Error registering user:", err);
    req.log.error({ err }, "Failed to register user");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to log out" });
    }
    res.clearCookie("connect.sid");
    return res.json({ message: "Logged out successfully" });
  });
});

router.get("/me", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(formatUser(user));
  } catch (err) {
    req.log.error({ err }, "Failed to get /me");
    return res.status(500).json({ error: "Internal server error" });
  }
});

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
