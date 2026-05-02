import { Router } from "express";
import { db, ordersTable, usersTable, productsTable } from "@workspace/db";
import { eq, sql, and, gte, lte, lt, desc } from "drizzle-orm";
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

router.get("/sales-range", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const { from, to } = req.query as { from?: string; to?: string };
  if (!from || !to) return res.status(400).json({ error: "from and to dates are required (YYYY-MM-DD)" });

  try {
    const fromDate = new Date(from);
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);

    const results = await db.execute(sql`
      SELECT
        TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD') as date,
        COALESCE(SUM(total), 0) as revenue,
        COUNT(*) as orders
      FROM orders
      WHERE created_at >= ${fromDate} AND created_at <= ${toDate} AND payment_status = 'PAID'
      GROUP BY TO_CHAR(created_at AT TIME ZONE 'UTC', 'YYYY-MM-DD')
      ORDER BY date ASC
    `);

    const rowMap = new Map<string, { revenue: number; orders: number }>();
    for (const r of results.rows as Array<Record<string, unknown>>) {
      rowMap.set(String(r.date), { revenue: parseFloat(String(r.revenue)), orders: parseInt(String(r.orders)) });
    }

    const series: Array<{ date: string; revenue: number; orders: number }> = [];
    for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
      const key = d.toISOString().slice(0, 10);
      const v = rowMap.get(key) ?? { revenue: 0, orders: 0 };
      series.push({ date: key, revenue: v.revenue, orders: v.orders });
    }
    return res.json(series);
  } catch (err) {
    req.log.error({ err }, "Failed to get sales range");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/top-products", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const { limit = "10" } = req.query as { limit?: string };

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

    return res.json(results.rows.map((r: Record<string, unknown>, idx: number) => ({
      productId: r.product_id,
      name: r.name,
      image: r.image,
      totalSold: parseInt(String(r.total_sold)),
      revenue: parseFloat(String(r.revenue)),
      rank: idx + 1,
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

router.get("/low-stock", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const rows = await db.select().from(productsTable)
      .where(and(eq(productsTable.isActive, true), lte(productsTable.stock, sql`${productsTable.lowStockThreshold}`)))
      .orderBy(productsTable.stock);
    return res.json(rows.map(p => ({
      productId: String(p.id),
      name: p.name,
      image: p.images?.[0] ?? null,
      stock: p.stock,
      lowStockThreshold: p.lowStockThreshold,
    })));
  } catch (err) {
    req.log.error({ err }, "Failed to get low stock");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.get("/inventory", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const [skuCount] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(eq(productsTable.isActive, true));
    const [unitsResult] = await db.select({ total: sql<number>`coalesce(sum(stock),0)` }).from(productsTable).where(eq(productsTable.isActive, true));
    const [outResult] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(and(eq(productsTable.isActive, true), eq(productsTable.stock, 0)));
    const [lowResult] = await db.select({ count: sql<number>`count(*)` }).from(productsTable).where(and(eq(productsTable.isActive, true), lte(productsTable.stock, sql`${productsTable.lowStockThreshold}`), sql`${productsTable.stock} > 0`));
    const [valueResult] = await db.select({ total: sql<string>`coalesce(sum(stock * selling_price),0)` }).from(productsTable).where(eq(productsTable.isActive, true));

    const top = await db.select().from(productsTable)
      .where(eq(productsTable.isActive, true))
      .orderBy(desc(productsTable.salesCount))
      .limit(5);

    return res.json({
      totalSkus: Number(skuCount?.count ?? 0),
      totalStockUnits: Number(unitsResult?.total ?? 0),
      outOfStock: Number(outResult?.count ?? 0),
      lowStock: Number(lowResult?.count ?? 0),
      inventoryValue: parseFloat(String(valueResult?.total ?? "0")),
      topRotating: top.map(p => ({
        productId: String(p.id),
        name: p.name,
        image: p.images?.[0] ?? null,
        totalSold: p.salesCount,
        revenue: p.salesCount * parseFloat(String(p.sellingPrice)),
      })),
    });
  } catch (err) {
    req.log.error({ err }, "Failed to get inventory insights");
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
