import { Router } from "express";
import { db, ordersTable, usersTable, productsTable } from "@workspace/db";
import { eq, sql, and, gte, lte } from "drizzle-orm";
import { authenticateUser, requireAdmin, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

router.get("/dashboard", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const { period = "month" } = req.query as { period?: string };

  try {
    const now = new Date();
    const startDate = getStartDate(period, now);
    const prevStartDate = getStartDate(period, new Date(startDate.getTime() - (now.getTime() - startDate.getTime())));

    const [totalRevenueResult] = await db.select({ total: sql<string>`coalesce(sum(total), 0)` }).from(ordersTable)
      .where(and(eq(ordersTable.paymentStatus, "PAID"), gte(ordersTable.createdAt, startDate)));
    const [prevRevenueResult] = await db.select({ total: sql<string>`coalesce(sum(total), 0)` }).from(ordersTable)
      .where(and(eq(ordersTable.paymentStatus, "PAID"), gte(ordersTable.createdAt, prevStartDate), lte(ordersTable.createdAt, startDate)));

    const totalRevenue = parseFloat(String(totalRevenueResult?.total ?? "0"));
    const prevRevenue = parseFloat(String(prevRevenueResult?.total ?? "0"));
    const revenueGrowth = prevRevenue > 0 ? ((totalRevenue - prevRevenue) / prevRevenue) * 100 : 0;

    const [totalOrdersResult] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(gte(ordersTable.createdAt, startDate));
    const [prevOrdersResult] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(and(gte(ordersTable.createdAt, prevStartDate), lte(ordersTable.createdAt, startDate)));
    const totalOrders = Number(totalOrdersResult?.count ?? 0);
    const prevOrders = Number(prevOrdersResult?.count ?? 0);
    const ordersGrowth = prevOrders > 0 ? ((totalOrders - prevOrders) / prevOrders) * 100 : 0;

    const [totalUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(usersTable);
    const [newUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(gte(usersTable.createdAt, startDate));
    const [prevUsersResult] = await db.select({ count: sql<number>`count(*)` }).from(usersTable).where(and(gte(usersTable.createdAt, prevStartDate), lte(usersTable.createdAt, startDate)));
    const usersGrowth = Number(prevUsersResult?.count ?? 0) > 0 ? ((Number(newUsersResult?.count ?? 0) - Number(prevUsersResult?.count ?? 0)) / Number(prevUsersResult?.count ?? 0)) * 100 : 0;

    const [totalProductsResult] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.isActive, true));

    const [pendingResult] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "PENDING"));
    const [deliveredResult] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "DELIVERED"));
    const [cancelledResult] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, "CANCELLED"));

    const [avgResult] = await db.select({ avg: sql<string>`coalesce(avg(total), 0)` }).from(ordersTable).where(eq(ordersTable.paymentStatus, "PAID"));

    return res.json({
      totalRevenue,
      totalOrders,
      totalUsers: Number(totalUsersResult?.count ?? 0),
      totalProducts: Number(totalProductsResult?.count ?? 0),
      revenueGrowth: Math.round(revenueGrowth * 10) / 10,
      ordersGrowth: Math.round(ordersGrowth * 10) / 10,
      usersGrowth: Math.round(usersGrowth * 10) / 10,
      pendingOrders: Number(pendingResult?.count ?? 0),
      deliveredOrders: Number(deliveredResult?.count ?? 0),
      cancelledOrders: Number(cancelledResult?.count ?? 0),
      avgOrderValue: Math.round(parseFloat(String(avgResult?.avg ?? "0")) * 100) / 100,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get dashboard analytics");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/revenue", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const { period = "month" } = req.query as { period?: string };

  try {
    const startDate = getStartDate(period, new Date());
    const groupBy = period === "year" ? "month" : "day";
    const format = period === "year" ? "YYYY-MM" : "YYYY-MM-DD";

    const results = await db.execute(sql`
      SELECT 
        TO_CHAR(created_at, ${format}) as date,
        COALESCE(SUM(total), 0) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE created_at >= ${startDate} AND payment_status = 'PAID'
      GROUP BY TO_CHAR(created_at, ${format})
      ORDER BY date ASC
    `);

    return res.json(results.rows.map((r: Record<string, unknown>) => ({
      date: r.date,
      revenue: parseFloat(String(r.revenue)),
      orders: parseInt(String(r.orders)),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get revenue analytics");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/top-products", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const { limit = "5" } = req.query as { limit?: string };

  try {
    const results = await db.execute(sql`
      SELECT 
        item->>'productId' as product_id,
        item->>'productName' as name,
        item->>'productImage' as image,
        SUM((item->>'quantity')::int) as total_sold,
        SUM((item->>'total')::numeric) as revenue
      FROM orders, jsonb_array_elements(items) as item
      WHERE payment_status = 'PAID'
      GROUP BY item->>'productId', item->>'productName', item->>'productImage'
      ORDER BY total_sold DESC
      LIMIT ${parseInt(limit)}
    `);

    return res.json(results.rows.map((r: Record<string, unknown>) => ({
      productId: r.product_id,
      name: r.name,
      image: r.image,
      totalSold: parseInt(String(r.total_sold)),
      revenue: parseFloat(String(r.revenue)),
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get top products");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/order-stats", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const statuses = ["PENDING", "CONFIRMED", "PROCESSING", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED"];
    const results = await Promise.all(statuses.map(async status => {
      const [r] = await db.select({ count: sql<number>`count(*)` }).from(ordersTable).where(eq(ordersTable.status, status as never));
      return [status, Number(r?.count ?? 0)];
    }));

    const stats = Object.fromEntries(results);
    return res.json({
      pending: stats["PENDING"] ?? 0,
      confirmed: stats["CONFIRMED"] ?? 0,
      processing: stats["PROCESSING"] ?? 0,
      outForDelivery: stats["OUT_FOR_DELIVERY"] ?? 0,
      delivered: stats["DELIVERED"] ?? 0,
      cancelled: stats["CANCELLED"] ?? 0,
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get order stats");
    return res.status(500).json({ error: "Internal server error" });
  }
});

function getStartDate(period: string, from: Date): Date {
  const d = new Date(from);
  switch (period) {
    case "today": d.setHours(0, 0, 0, 0); break;
    case "week": d.setDate(d.getDate() - 7); break;
    case "month": d.setMonth(d.getMonth() - 1); break;
    case "year": d.setFullYear(d.getFullYear() - 1); break;
    default: d.setMonth(d.getMonth() - 1);
  }
  return d;
}

export default router;
