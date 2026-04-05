import { pgTable, text, serial, timestamp, integer, numeric, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const trackingTable = pgTable("tracking", {
  id: serial("id").primaryKey(),
  orderId: integer("order_id").notNull().unique(),
  agentId: integer("agent_id"),
  currentLat: numeric("current_lat", { precision: 10, scale: 7 }),
  currentLng: numeric("current_lng", { precision: 10, scale: 7 }),
  destinationLat: numeric("destination_lat", { precision: 10, scale: 7 }),
  destinationLng: numeric("destination_lng", { precision: 10, scale: 7 }),
  history: jsonb("history").default("[]"),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertTrackingSchema = createInsertSchema(trackingTable).omit({ id: true, updatedAt: true });
export type InsertTracking = z.infer<typeof insertTrackingSchema>;
export type Tracking = typeof trackingTable.$inferSelect;
