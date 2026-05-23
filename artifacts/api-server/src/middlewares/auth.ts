import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  replitUserId?: string;
  session: Record<string, unknown> & {
    userId?: number;
    userRole?: string;
    replitUserId?: string;
  };
}

export async function authenticateUser(req: AuthRequest, res: Response, next: NextFunction) {
  const sessionUserId = req.session?.userId;

  if (!sessionUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  try {
    const [user] = await db.select().from(usersTable).where(eq(usersTable.id, sessionUserId));

    if (!user) {
      return res.status(401).json({ error: "User not found. Please log in again." });
    }

    req.userId = user.id;
    req.userRole = user.role;
    req.replitUserId = user.firebaseUid;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Authentication error" });
  }
}

export function requireAdmin(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden: Admin access required" });
  }
  next();
}

export function requireDeliveryAgent(req: AuthRequest, res: Response, next: NextFunction) {
  if (req.userRole !== "DELIVERY_AGENT" && req.userRole !== "ADMIN") {
    return res.status(403).json({ error: "Forbidden: Delivery agent access required" });
  }
  next();
}
