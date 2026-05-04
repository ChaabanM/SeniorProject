import { SignJWT, jwtVerify } from "jose";
import type { UserRow } from "./authDb";

export type UserRole = UserRow["role"];

type SessionPayload = {
  email: string;
  role: UserRole;
};

const SESSION_COOKIE = "dss_session";

function getJwtSecret() {
  // In production, set AUTH_SECRET to a strong random value.
  const secret = process.env.AUTH_SECRET ?? "dev-insecure-secret-change-me";
  return new TextEncoder().encode(secret);
}

export function getSessionCookieName() {
  return SESSION_COOKIE;
}

export async function createSessionToken(payload: SessionPayload) {
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT(payload)
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt(now)
    .setExpirationTime(now + 60 * 60 * 12) // 12h
    .sign(getJwtSecret());
}

export async function verifySession(token: string): Promise<SessionPayload | null> {
  const t = String(token ?? "").trim();
  if (!t) return null;
  try {
    const res = await jwtVerify(t, getJwtSecret());
    const email = typeof res.payload.email === "string" ? res.payload.email : "";
    const role = res.payload.role as UserRole | undefined;
    if (!email || !role) return null;
    return { email, role };
  } catch {
    return null;
  }
}

