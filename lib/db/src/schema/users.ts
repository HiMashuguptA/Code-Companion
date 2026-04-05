import { pgTable, text, serial, timestamp, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const addressSchema = z.object({
  id: z.string(),
  label: z.string().optional(),
  street: z.string(),
  city: z.string(),
  state: z.string(),
  pincode: z.string(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  isDefault: z.boolean().optional(),
});

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  firebaseUid: text("firebase_uid").notNull().unique(),
  email: text("email").notNull().unique(),
  name: text("name"),
  phone: text("phone"),
  photoUrl: text("photo_url"),
  role: text("role", { enum: ["USER", "ADMIN", "DELIVERY_AGENT"] }).notNull().default("USER"),
  isActive: boolean("is_active").notNull().default(true),
  addresses: jsonb("addresses").default("[]"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
