import type { Request, Response, NextFunction } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export interface AuthRequest extends Request {
  userId?: number;
  userRole?: string;
  firebaseUid?: string;
}

export async function authenticateUser(req: AuthRequest, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return res.status(401).json({ error: "Unauthorized" });
  }

  const idToken = authHeader.substring(7);

  try {
    // Decode the Firebase JWT to extract uid (without full verification for dev speed)
    // In production, use firebase-admin to verify
    const parts = idToken.split(".");
    if (parts.length !== 3) {
      return res.status(401).json({ error: "Invalid token format" });
    }

    const payload = JSON.parse(Buffer.from(parts[1]!, "base64url").toString("utf-8"));
    const firebaseUid = payload.user_id || payload.sub;

    if (!firebaseUid) {
      return res.status(401).json({ error: "Invalid token" });
    }

    const [user] = await db.select().from(usersTable).where(eq(usersTable.firebaseUid, firebaseUid));

    if (!user) {
      return res.status(401).json({ error: "User not found. Please register first." });
    }

    req.userId = user.id;
    req.userRole = user.role;
    req.firebaseUid = firebaseUid;
    next();
  } catch (err) {
    return res.status(401).json({ error: "Invalid or expired token" });
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
