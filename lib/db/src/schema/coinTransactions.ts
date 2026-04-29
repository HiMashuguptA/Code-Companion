import { pgTable, text, serial, timestamp, integer } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const coinTransactionsTable = pgTable("coin_transactions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  amount: integer("amount").notNull(),
  reason: text("reason", { enum: ["REFERRAL_BONUS", "REFEREE_BONUS", "ORDER_REWARD", "ORDER_REDEEM", "ADMIN_ADJUST"] }).notNull(),
  description: text("description"),
  orderId: integer("order_id"),
  referredUserId: integer("referred_user_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertCoinTxSchema = createInsertSchema(coinTransactionsTable).omit({ id: true, createdAt: true });
export type InsertCoinTx = z.infer<typeof insertCoinTxSchema>;
export type CoinTransaction = typeof coinTransactionsTable.$inferSelect;
