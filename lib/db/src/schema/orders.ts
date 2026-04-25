import { pgTable, text, serial, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const ordersTable = pgTable("orders", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  items: jsonb("items").notNull().default("[]"),
  status: text("status", {
    enum: ["PENDING", "CONFIRMED", "PROCESSING", "PACKED", "OUT_FOR_DELIVERY", "DELIVERED", "CANCELLED", "PICKUP_READY", "PICKED_UP"]
  }).notNull().default("PENDING"),
  deliveryType: text("delivery_type", { enum: ["DELIVERY", "PICKUP"] }).notNull().default("DELIVERY"),
  deliveryAddress: jsonb("delivery_address"),
  contactDetails: jsonb("contact_details"), // Store phone and name for delivery agent
  subtotal: numeric("subtotal", { precision: 10, scale: 2 }).notNull(),
  discount: numeric("discount", { precision: 10, scale: 2 }).notNull().default("0"),
  couponDiscount: numeric("coupon_discount", { precision: 10, scale: 2 }).notNull().default("0"),
  total: numeric("total", { precision: 10, scale: 2 }).notNull(),
  couponCode: text("coupon_code"),
  deliveryAgentId: integer("delivery_agent_id"),
  estimatedDelivery: timestamp("estimated_delivery", { withTimezone: true }),
  paymentStatus: text("payment_status", { enum: ["PENDING", "PAID", "FAILED", "REFUNDED"] }).notNull().default("PENDING"),
  paymentMethod: text("payment_method"),
  notes: text("notes"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertOrderSchema = createInsertSchema(ordersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertOrder = z.infer<typeof insertOrderSchema>;
export type Order = typeof ordersTable.$inferSelect;
