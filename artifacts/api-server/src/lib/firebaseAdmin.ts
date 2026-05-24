import jwt from "jsonwebtoken";
import { createPublicKey } from "crypto";

const FIREBASE_PROJECT_ID = "gupta-enterprises-98e81";
const GOOGLE_CERTS_URL =
  "https://www.googleapis.com/robot/v1/metadata/x509/securetoken@system.gserviceaccount.com";

interface CachedCerts {
  certs: Record<string, string>;
  expiresAt: number;
}

let certCache: CachedCerts | null = null;

async function getGooglePublicKeys(): Promise<Record<string, string>> {
  const now = Date.now();
  if (certCache && now < certCache.expiresAt) return certCache.certs;

  const res = await fetch(GOOGLE_CERTS_URL);
  const cacheControl = res.headers.get("cache-control") ?? "";
  const maxAgeMatch = cacheControl.match(/max-age=(\d+)/);
  const maxAge = maxAgeMatch ? parseInt(maxAgeMatch[1]!, 10) * 1000 : 3_600_000;

  const certs = (await res.json()) as Record<string, string>;
  certCache = { certs, expiresAt: now + maxAge };
  return certs;
}

export interface FirebaseTokenPayload {
  uid: string;
  phone_number?: string;
  email?: string;
  name?: string;
  picture?: string;
  firebase: { sign_in_provider: string };
}

export async function verifyFirebaseToken(idToken: string): Promise<FirebaseTokenPayload> {
  const decoded = jwt.decode(idToken, { complete: true });
  if (!decoded || typeof decoded === "string" || !decoded.header.kid) {
    throw new Error("Invalid token format");
  }

  const certs = await getGooglePublicKeys();
  const certPem = certs[decoded.header.kid];
  if (!certPem) throw new Error("Unknown key id");

  const publicKey = createPublicKey(certPem);

  const payload = jwt.verify(idToken, publicKey, {
    algorithms: ["RS256"],
    audience: FIREBASE_PROJECT_ID,
    issuer: `https://securetoken.google.com/${FIREBASE_PROJECT_ID}`,
  }) as jwt.JwtPayload;

  if (!payload.sub) throw new Error("Token missing subject");

  return {
    uid: payload.sub,
    phone_number: payload.phone_number as string | undefined,
    email: payload.email as string | undefined,
    name: payload.name as string | undefined,
    picture: payload.picture as string | undefined,
    firebase: payload.firebase as { sign_in_provider: string },
  };
}
