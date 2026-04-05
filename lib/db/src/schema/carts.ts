import { pgTable, serial, timestamp, integer, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const cartsTable = pgTable("carts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  items: jsonb("items").notNull().default("[]"),
  couponCode: jsonb("coupon_code"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertCartSchema = createInsertSchema(cartsTable).omit({ id: true, updatedAt: true });
export type InsertCart = z.infer<typeof insertCartSchema>;
export type Cart = typeof cartsTable.$inferSelect;
