import { Router } from "express";
import { db, bannersTable } from "@workspace/db";
import { eq, and, asc } from "drizzle-orm";
import { CreateBannerBody, UpdateBannerBody } from "@workspace/api-zod";
import { authenticateUser, requireAdmin, type AuthRequest } from "../middlewares/auth.js";

const router = Router();

function formatBanner(b: typeof bannersTable.$inferSelect) {
  return {
    id: String(b.id),
    title: b.title,
    subtitle: b.subtitle,
    imageUrl: b.imageUrl,
    linkUrl: b.linkUrl,
    position: b.position,
    size: b.size,
    sortOrder: b.sortOrder,
    isActive: b.isActive,
    createdAt: b.createdAt,
    updatedAt: b.updatedAt,
  };
}

// Public: list active banners, optional position filter
router.get("/", async (req, res) => {
  try {
    const position = typeof req.query.position === "string" ? req.query.position : undefined;
    const conditions = [eq(bannersTable.isActive, true)];
    if (position && ["TOP", "MIDDLE", "BOTTOM"].includes(position)) {
      conditions.push(eq(bannersTable.position, position as "TOP" | "MIDDLE" | "BOTTOM"));
    }
    const rows = await db
      .select()
      .from(bannersTable)
      .where(and(...conditions))
      .orderBy(asc(bannersTable.sortOrder));
    return res.json(rows.map(formatBanner));
  } catch (err) {
    req.log.error({ err }, "Failed to list banners");
    return res.status(500).json({ error: "Internal server error" });
  }
});

// Admin: list all banners (active + inactive)
router.get("/all", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  try {
    const rows = await db
      .select()
      .from(bannersTable)
      .orderBy(asc(bannersTable.sortOrder));
    return res.json(rows.map(formatBanner));
  } catch (err) {
    req.log.error({ err }, "Failed to list all banners");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.post("/", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const parsed = CreateBannerBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const [banner] = await db.insert(bannersTable).values({
      title: parsed.data.title,
      subtitle: parsed.data.subtitle ?? null,
      imageUrl: parsed.data.imageUrl,
      linkUrl: parsed.data.linkUrl ?? null,
      position: parsed.data.position,
      size: parsed.data.size ?? "FULL",
      sortOrder: parsed.data.sortOrder ?? 0,
      isActive: parsed.data.isActive ?? true,
    }).returning();
    return res.status(201).json(formatBanner(banner!));
  } catch (err) {
    req.log.error({ err }, "Failed to create banner");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.put("/:bannerId", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.bannerId!);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid banner ID" });

  const parsed = UpdateBannerBody.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.issues });

  try {
    const updates: Partial<typeof bannersTable.$inferInsert> = {};
    const d = parsed.data;
    if (d.title !== undefined) updates.title = d.title;
    if (d.subtitle !== undefined) updates.subtitle = d.subtitle;
    if (d.imageUrl !== undefined) updates.imageUrl = d.imageUrl;
    if (d.linkUrl !== undefined) updates.linkUrl = d.linkUrl;
    if (d.position !== undefined) updates.position = d.position;
    if (d.size !== undefined) updates.size = d.size;
    if (d.sortOrder !== undefined) updates.sortOrder = d.sortOrder;
    if (d.isActive !== undefined) updates.isActive = d.isActive;

    const [banner] = await db.update(bannersTable).set(updates).where(eq(bannersTable.id, id)).returning();
    if (!banner) return res.status(404).json({ error: "Banner not found" });
    return res.json(formatBanner(banner));
  } catch (err) {
    req.log.error({ err }, "Failed to update banner");
    return res.status(500).json({ error: "Internal server error" });
  }
});

router.delete("/:bannerId", authenticateUser, requireAdmin, async (req: AuthRequest, res) => {
  const id = parseInt(req.params.bannerId!);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid banner ID" });

  try {
    await db.delete(bannersTable).where(eq(bannersTable.id, id));
    return res.status(204).send();
  } catch (err) {
    req.log.error({ err }, "Failed to delete banner");
    return res.status(500).json({ error: "Internal server error" });
  }
});

export default router;
