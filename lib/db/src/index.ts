import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "./schema";

const { Pool } = pg;

// In production, PROD_DATABASE_URL takes precedence (Neon or other external DB).
// In development, falls back to the Replit-managed DATABASE_URL.
const connectionString = process.env.PROD_DATABASE_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

const sslRequired = connectionString.includes("sslmode=require") || connectionString.includes("neon.tech");

export const pool = new Pool({
  connectionString,
  ssl: sslRequired ? { rejectUnauthorized: false } : undefined,
});
export const db = drizzle(pool, { schema });

export * from "./schema";
