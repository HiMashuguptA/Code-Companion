import { Router, type Request, type Response } from "express";
import { db, usersTable, coinTransactionsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { UpdateProfileBody } from "@workspace/api-zod";
import { authenticateUser, type AuthRequest } from "../middlewares/auth.js";
import { verifyFirebaseToken } from "../lib/firebaseAdmin.js";

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

// ── Firebase Phone Auth callback ──────────────────────────────────────────────
// Called by the frontend after Firebase verifies the OTP and returns an ID token.
router.post("/firebase-callback", async (req: Request, res: Response) => {
  const { idToken, referralCode } = req.body as {
    idToken: string;
    referralCode?: string;
  };

  if (!idToken) {
    return res.status(400).json({ error: "idToken is required" });
  }

  try {
    const payload = await verifyFirebaseToken(idToken);
    const { uid, phone_number, email, name } = payload;

    // Phone is the primary identifier for phone-auth users
    const resolvedPhone = phone_number ?? null;
    // Generate a stable synthetic email for phone-only users
    const resolvedEmail = email ?? `${uid}@phone.gupta.app`;

    let existing = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, uid));
    let user = existing[0];

    if (!user) {
      // Try matching by phone number to link existing accounts
      if (resolvedPhone) {
        const byPhone = await db.select().from(usersTable).where(eq(usersTable.phone, resolvedPhone));
        if (byPhone.length > 0) {
          user = byPhone[0];
          await db.update(usersTable)
            .set({ firebaseUid: uid })
            .where(eq(usersTable.id, user!.id));
        }
      }
    }

    if (!user) {
      // New user — create account
      let referredById: number | null = null;
      if (referralCode) {
        const [refUser] = await db
          .select()
          .from(usersTable)
          .where(eq(usersTable.referralCode, referralCode.toUpperCase()));
        if (refUser) referredById = refUser.id;
      }

      const newCode = await uniqueReferralCode(name ?? resolvedPhone ?? uid);

      const [created] = await db
        .insert(usersTable)
        .values({
          firebaseUid: uid,
          email: resolvedEmail,
          name: name ?? null,
          phone: resolvedPhone,
          photoUrl: null,
          role: "USER",
          referralCode: newCode,
          referredBy: referredById,
          superCoins: referredById ? REFEREE_BONUS : 0,
        })
        .returning();

      if (referredById && created) {
        // Give referee bonus coins
        await db.insert(coinTransactionsTable).values({
          userId: created.id,
          amount: REFEREE_BONUS,
          reason: "REFEREE_BONUS",
          description: "Welcome bonus for joining via referral",
        });

        // Give referrer bonus coins
        await db.update(usersTable)
          .set({ superCoins: REFERRAL_BONUS })
          .where(eq(usersTable.id, referredById));

        await db.insert(coinTransactionsTable).values({
          userId: referredById,
          amount: REFERRAL_BONUS,
          reason: "REFERRAL_BONUS",
          description: `Referral bonus — new user joined`,
        });
      }

      user = created!;
    } else {
      // Existing user — ensure referral code exists and update phone if available
      const updates: Partial<typeof usersTable.$inferInsert> = {};
      if (!user.referralCode) {
        updates.referralCode = await uniqueReferralCode(name ?? resolvedPhone ?? uid);
      }
      if (resolvedPhone && !user.phone) {
        updates.phone = resolvedPhone;
      }
      if (Object.keys(updates).length > 0) {
        const [updated] = await db
          .update(usersTable)
          .set(updates)
          .where(eq(usersTable.id, user.id))
          .returning();
        if (updated) user = updated;
      }
    }

    // Persist session
    (req.session as Record<string, unknown>).userId = user!.id;
    (req.session as Record<string, unknown>).userRole = user!.role;
    (req.session as Record<string, unknown>).firebaseUid = uid;

    return res.json(formatUser(user!));
  } catch (err) {
    console.error("Error in firebase-callback:", err);
    req.log?.error({ err }, "Failed to handle Firebase auth callback");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Logout ────────────────────────────────────────────────────────────────────
router.post("/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Failed to log out" });
    }
    res.clearCookie("connect.sid");
    return res.json({ message: "Logged out successfully" });
  });
});

// ── /me ───────────────────────────────────────────────────────────────────────
router.get("/me", authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(formatUser(user));
  } catch (err) {
    req.log?.error({ err }, "Failed to get /me");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// ── Profile ───────────────────────────────────────────────────────────────────
router.get("/profile", authenticateUser, async (req: AuthRequest, res: Response) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) return res.status(404).json({ error: "User not found" });
    return res.json(formatUser(user));
  } catch (err) {
    req.log?.error({ err }, "Failed to get profile");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/profile", authenticateUser, async (req: AuthRequest, res: Response) => {
  const parsed = UpdateProfileBody.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues });
  }
  const { name, phone, photoUrl, addresses } = parsed.data;

  try {
    const [user] = await db
      .update(usersTable)
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
    req.log?.error({ err }, "Failed to update profile");
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
