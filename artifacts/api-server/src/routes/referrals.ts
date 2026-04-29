import { Router } from "express";
import { db, usersTable, coinTransactionsTable } from "@workspace/db";
import { eq, sql, and, gt, desc } from "drizzle-orm";
import { authenticateUser, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/me", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, req.userId!));
    if (!user) return res.status(404).json({ error: "User not found" });

    const [referralsCount] = await db.select({ count: sql<number>`count(*)` })
      .from(usersTable)
      .where(eq(usersTable.referredBy, user.id));

    const [earned] = await db.select({ total: sql<number>`coalesce(sum(amount),0)` })
      .from(coinTransactionsTable)
      .where(and(eq(coinTransactionsTable.userId, user.id), gt(coinTransactionsTable.amount, 0)));

    return res.json({
      referralCode: user.referralCode ?? "",
      superCoins: user.superCoins ?? 0,
      totalReferrals: Number(referralsCount?.count ?? 0),
      totalEarned: Number(earned?.total ?? 0),
      shareUrl: `${req.protocol}://${req.get("host")}/?ref=${user.referralCode ?? ""}`,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to fetch referral info");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/transactions", authenticateUser, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(coinTransactionsTable)
      .where(eq(coinTransactionsTable.userId, req.userId!))
      .orderBy(desc(coinTransactionsTable.createdAt))
      .limit(100);
    return res.json(rows.map(r => ({
      id: String(r.id),
      amount: r.amount,
      reason: r.reason,
      description: r.description,
      orderId: r.orderId ? String(r.orderId) : null,
      createdAt: r.createdAt,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to fetch coin transactions");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
